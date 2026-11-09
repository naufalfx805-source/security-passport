// MCP smoke test for Security Passport through the Atlassian MCP server.
// Signs in with OAuth 2.1 (dynamic client registration + PKCE, callback on localhost),
// lists the app's tools, reads a passport, lists open checks and can record evidence.
// Tokens and client secrets stay in memory, are never printed, and tokens are revoked at the end.
//
// Usage:
//   node scripts/mcp-smoke.mjs <ISSUE-KEY> [--project KEY] [--record CHECK-ID "evidence"]
//                              [--variants claude-code,minimal] [--port 33418]
// Each variant registers its own client and prints its own sign-in URL; the first one
// that comes back signed in is used.
//   claude-code  every scope the server advertises, plus prompt=consent (what MCP SDK clients send)
//   minimal      read:me read:account read:jira-work write:jira-work, plus prompt=consent
// Verified 2026-11-09 with the claude-code variant. Earlier attempts with only the four Jira
// scopes and no prompt=consent were refused after the consent screen (POST /authorize/resume ->
// invalid_request "Incorrect request parameters"). The token endpoint accepted the code once the
// client secret returned by registration was sent with it.
// Before it can work, a site admin must enable the app's tools for MCP-compatible apps
// (see "Connect an MCP client" in the README).

import crypto from 'node:crypto';
import http from 'node:http';

const APP_ID = '73ed7a14-59de-41d1-8c1a-16b679c5860e';
const SERVER = `https://mcp.atlassian.com/forge/${APP_ID}`;
const MINIMAL_SCOPES = 'read:me read:account read:jira-work write:jira-work';
const WAIT_MS = 45 * 60 * 1000;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args.slice(i + 1, i + 3);
};
const issueKey = args[0] && !args[0].startsWith('--') ? args[0].toUpperCase() : 'SEC-1';
const projectKey = (flag('--project')?.[0] || issueKey.split('-')[0]).toUpperCase();
const record = flag('--record');
const port = Number(flag('--port')?.[0] || 33418);
const variantNames = (flag('--variants')?.[0] || 'claude-code').split(',');
const redirectUri = `http://localhost:${port}/callback`;

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const log = (...parts) => console.log(...parts);

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`${init?.method || 'GET'} ${url} -> ${res.status}: ${String(text).slice(0, 300)}`);
  return body;
}

// 1. Discovery: the server's 401 names its protected-resource metadata.
async function discover() {
  const probe = await fetch(SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping' }),
  });
  const header = probe.headers.get('www-authenticate') || '';
  const metadataUrl = /resource_metadata="([^"]+)"/.exec(header)?.[1];
  if (!metadataUrl) throw new Error(`No resource_metadata in WWW-Authenticate (status ${probe.status}).`);
  const resource = await getJson(metadataUrl);
  const issuer = resource.authorization_servers[0];
  const u = new URL(issuer);
  const asMeta = await getJson(`${u.origin}/.well-known/oauth-authorization-server${u.pathname}`);
  return { resource: resource.resource, scopes: resource.scopes_supported || [], as: asMeta };
}

// 2. One registered client and one sign-in URL per variant.
async function prepareVariant(name, { resource, scopes, as }) {
  const scope = name === 'claude-code' ? scopes.join(' ') : MINIMAL_SCOPES;
  const client = await getJson(as.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: `Security Passport MCP smoke test (${name})`,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const verifier = b64url(crypto.randomBytes(32));
  const state = b64url(crypto.randomBytes(16));
  const url = new URL(as.authorization_endpoint);
  for (const [k, v] of Object.entries({
    response_type: 'code', client_id: client.client_id, redirect_uri: redirectUri, state, scope, resource,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
    prompt: 'consent',
  })) url.searchParams.set(k, v);
  // The registration may return a secret even for a public client; the token endpoint
  // can insist on it (Atlassian AX-2244), so keep it in memory for the exchange.
  return { name, clientId: client.client_id, clientSecret: client.client_secret || null, verifier, state, url: url.toString() };
}

// 3. Wait for the browser to come back to the localhost callback with any variant's state.
function waitForSignIn(variants) {
  const byState = new Map(variants.map((v) => [v.state, v]));
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === '/health') { res.end('ok'); return; }
      if (url.pathname !== '/callback') { res.statusCode = 404; res.end(); return; }
      const variant = byState.get(url.searchParams.get('state'));
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (!variant || error || !code) {
        res.end(`Sign-in failed: ${error || 'unknown state'} ${url.searchParams.get('error_description') || ''}`);
        log(`Callback without a usable code (${variant?.name || 'unknown variant'}): ${error || 'no code'}`);
        return;
      }
      res.end(`Signed in (${variant.name}). You can close this tab and go back to the terminal.`);
      server.close();
      clearTimeout(timer);
      resolve({ variant, code });
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('Timed out waiting for sign-in.')); }, WAIT_MS);
    server.listen(port, '127.0.0.1');
  });
}

async function exchange(as, variant, code, resource) {
  const base = {
    grant_type: 'authorization_code', client_id: variant.clientId, code, redirect_uri: redirectUri,
    code_verifier: variant.verifier, resource,
  };
  const attempts = variant.clientSecret ? [{ ...base, client_secret: variant.clientSecret }, base] : [base];
  let lastError;
  for (const form of attempts) {
    try {
      const token = await getJson(as.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams(form),
      });
      log(`Token exchange worked ${form.client_secret ? 'with' : 'without'} the client secret.`);
      return { accessToken: token.access_token, refreshToken: token.refresh_token || null };
    } catch (error) {
      lastError = error;
      log(`Token exchange ${form.client_secret ? 'with' : 'without'} the client secret failed: ${error.message.replace(/"access_token":"[^"]*"/g, '')}`);
    }
  }
  throw lastError;
}

// 4. MCP over streamable HTTP. Responses are JSON or a short event stream.
function mcpClient(accessToken) {
  let sessionId = null;
  let nextId = 1;
  async function send(message) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const res = await fetch(SERVER, { method: 'POST', headers, body: JSON.stringify(message) });
    sessionId = res.headers.get('mcp-session-id') || sessionId;
    const text = await res.text();
    if (!res.ok) throw new Error(`${message.method} -> ${res.status}: ${text.slice(0, 300)}`);
    if (message.id === undefined) return null;
    const payloads = (res.headers.get('content-type') || '').includes('text/event-stream')
      ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))
      : [JSON.parse(text)];
    const reply = payloads.find((p) => p.id === message.id);
    if (!reply) throw new Error(`${message.method}: no reply`);
    if (reply.error) throw new Error(`${message.method}: ${JSON.stringify(reply.error)}`);
    return reply.result;
  }
  return {
    request: (method, params) => send({ jsonrpc: '2.0', id: nextId++, method, params }),
    notify: (method, params) => send({ jsonrpc: '2.0', method, params }),
  };
}

const textOf = (result) => (result?.content || []).map((c) => c.text || JSON.stringify(c)).join('\n');

async function main() {
  const discovered = await discover();
  const { resource, as } = discovered;
  log(`MCP server: ${SERVER}`);
  log(`Authorization server: ${as.issuer}`);
  const variants = [];
  for (const name of variantNames) variants.push(await prepareVariant(name, discovered));
  for (const v of variants) log(`SIGN-IN URL [${v.name}]: ${v.url}`);
  log('Waiting for sign-in...');
  const { variant, code } = await waitForSignIn(variants);
  log(`Signed in with variant "${variant.name}".`);
  const { accessToken, refreshToken } = await exchange(as, variant, code, resource);

  try {
    const mcp = mcpClient(accessToken);
    const init = await mcp.request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'security-passport-smoke', version: '1.0.0' },
    });
    log(`Connected to ${init.serverInfo?.name || 'server'} ${init.serverInfo?.version || ''} (protocol ${init.protocolVersion}).`);
    await mcp.notify('notifications/initialized');

    const { tools = [] } = await mcp.request('tools/list', {});
    log(`\nTools (${tools.length}):`);
    for (const t of tools) log(`- ${t.name}: ${(t.description || '').slice(0, 120)}`);
    const tool = (suffix) => tools.find((t) => t.name === suffix || t.name.endsWith(suffix) || t.name.includes(suffix))?.name;

    const get = tool('get-security-passport');
    if (get) log(`\n== ${get} ${issueKey}\n${textOf(await mcp.request('tools/call', { name: get, arguments: { issueKey } }))}`);
    const list = tool('list-open-security-checks');
    if (list) log(`\n== ${list} ${projectKey}\n${textOf(await mcp.request('tools/call', { name: list, arguments: { projectKey } }))}`);
    const rec = tool('record-security-evidence');
    if (rec && record) {
      const [checkId, evidence] = record;
      log(`\n== ${rec} ${issueKey} ${checkId}\n${textOf(await mcp.request('tools/call', { name: rec, arguments: { issueKey, checkId, evidence } }))}`);
    }
  } finally {
    if (as.revocation_endpoint) {
      for (const [kind, token] of [['refresh', refreshToken], ['access', accessToken]]) {
        if (!token) continue;
        const form = { token, client_id: variant.clientId };
        if (variant.clientSecret) form.client_secret = variant.clientSecret;
        await fetch(as.revocation_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(form),
        }).then((r) => log(`${kind === 'refresh' ? '\n' : ''}${kind} token revoked (${r.status}).`), () => log(`${kind} token revocation failed.`));
      }
    }
  }
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
