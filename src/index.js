// Forge entry points: the issue trigger, the issue panel resolver, and the
// actions shared by the Rovo agent and the MCP server.

import Resolver from '@forge/resolver';
import { analyzeIssue } from './engine/analyze.js';
import { mergePassport, passportToText, samePassport, setCheckStatus } from './engine/passport.js';
import {
  getIssueFields, getPassport, normalizeIssueKey, normalizeProjectKey, savePassport, searchOpenPassports,
} from './jira.js';

// Read the ticket, re-run the analysis and save the passport if anything changed.
async function refresh(issueKey, as) {
  const [fields, existing] = await Promise.all([getIssueFields(issueKey, as), getPassport(issueKey, as)]);
  const next = mergePassport(existing, analyzeIssue(fields));
  if (!samePassport(existing, next)) await savePassport(issueKey, next, as);
  return next;
}

// trigger: avi:jira:created:issue and avi:jira:updated:issue
export async function onIssueEvent(event) {
  const issueKey = normalizeIssueKey(event?.issue?.key);
  if (!issueKey) return;
  await refresh(issueKey, 'app');
}

// Issue panel. The issue key comes from the Forge context, not from the
// browser payload, so a user cannot point the panel at another issue.
const resolver = new Resolver();

function panelIssueKey(req) {
  const key = normalizeIssueKey(req.context?.extension?.issue?.key);
  if (!key) throw new Error('Open this panel from a Jira issue.');
  return key;
}

resolver.define('getPassport', async (req) => {
  const issueKey = panelIssueKey(req);
  const passport = (await getPassport(issueKey, 'user')) || (await refresh(issueKey, 'user'));
  return { issueKey, passport };
});

resolver.define('rescan', async (req) => {
  const issueKey = panelIssueKey(req);
  return { issueKey, passport: await refresh(issueKey, 'user') };
});

resolver.define('updateCheck', async (req) => {
  const issueKey = panelIssueKey(req);
  const { checkId, status, note } = req.payload || {};
  const current = (await getPassport(issueKey, 'user')) || (await refresh(issueKey, 'user'));
  const next = setCheckStatus(current, String(checkId || ''), { status, note, by: req.context?.accountId || null });
  await savePassport(issueKey, next, 'user');
  return { issueKey, passport: next };
});

export const panelResolver = resolver.getDefinitions();

// Actions (Rovo agent tools and MCP tools). They run as the invoking user.
function actorOf(context) {
  return context?.principal?.accountId || context?.accountId || 'agent';
}

export async function getPassportAction(payload) {
  const issueKey = normalizeIssueKey(payload?.issueKey);
  if (!issueKey) return 'Give me a Jira issue key, for example SEC-12.';
  const passport = (await getPassport(issueKey, 'user')) || (await refresh(issueKey, 'user'));
  return passportToText(issueKey, passport);
}

export async function listOpenChecksAction(payload) {
  const raw = payload?.projectKey;
  const projectKey = raw ? normalizeProjectKey(raw) : null;
  if (raw && !projectKey) return `"${raw}" is not a valid Jira project key.`;
  const issues = await searchOpenPassports(projectKey, 'user');
  if (issues.length === 0) return projectKey ? `No open Security Passports in ${projectKey}.` : 'No open Security Passports.';
  return issues
    .map((i) => `- ${i.key} (${i.openCount ?? '?'} open): ${i.summary}`)
    .join('\n');
}

export async function recordEvidenceAction(payload, context) {
  const issueKey = normalizeIssueKey(payload?.issueKey);
  const checkId = String(payload?.checkId || '').trim().toUpperCase();
  const evidence = String(payload?.evidence || '').trim();
  if (!issueKey || !checkId) return 'I need the issue key and the check ID, for example SEC-12 and SSRF-1.';
  const current = (await getPassport(issueKey, 'user')) || (await refresh(issueKey, 'user'));
  try {
    const next = setCheckStatus(current, checkId, { status: 'done', note: evidence, by: actorOf(context) });
    await savePassport(issueKey, next, 'user');
    return `Recorded ${checkId} on ${issueKey} as done with evidence: ${evidence}\n\n${passportToText(issueKey, next)}`;
  } catch (error) {
    return `Nothing was changed: ${error.message}`;
  }
}
