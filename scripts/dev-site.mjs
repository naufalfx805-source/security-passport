// Development-site helper: set up demo data and inspect passports over the Jira REST API.
// Credentials come from the environment (FORGE_EMAIL, FORGE_API_TOKEN) and are never printed.
//
// Usage:
//   node --env-file=$HOME/.forge-env scripts/dev-site.mjs <site> <command> [args]
// Commands:
//   projects                      list the projects on the site
//   myself                        who the token belongs to
//   create-project KEY "Name"     company-managed Kanban project (workflow validators need one)
//   create-issues KEY             the demo tickets used in the video
//   create-issue KEY "Summary" ["Description"]  one ticket (checks the created trigger)
//   touch KEY...                  toggle a label so the updated trigger fires
//   reset KEY...                  delete stored passports (demo preparation)
//   done KEY                      try to move an issue to Done
//   passport ISSUE-KEY            the stored Security Passport of one issue
//   search-open [KEY]             JQL: issues whose passport is open

const [site, command, ...args] = process.argv.slice(2);
if (!site || !command) {
  console.error('usage: dev-site.mjs <site> <command> [args]');
  process.exit(2);
}
if (!process.env.FORGE_EMAIL || !process.env.FORGE_API_TOKEN) {
  console.error('FORGE_EMAIL and FORGE_API_TOKEN must be set (use node --env-file).');
  process.exit(2);
}
const auth = `Basic ${Buffer.from(`${process.env.FORGE_EMAIL}:${process.env.FORGE_API_TOKEN}`).toString('base64')}`;

async function jira(path, init = {}) {
  const res = await fetch(`https://${site}${path}`, {
    ...init,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let body = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`${init.method || 'GET'} ${path} -> ${res.status}: ${detail.slice(0, 400)}`);
  }
  return body;
}

const adf = (text) => ({
  type: 'doc',
  version: 1,
  content: text.split('\n\n').map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
});

const DEMO_ISSUES = [
  ['Add a webhook that fetches the customer\'s logo from a URL', 'When a customer saves their profile, call the webhook and fetch the logo image from the URL they entered, then cache it.'],
  ['Let users upload a profile photo', 'Accept JPG or PNG avatars and show them in the header.'],
  ['Store the Stripe API key and verify the webhook signature', 'Billing integration: keep the Stripe secret key in the settings page and check the signature of incoming payment webhooks.'],
  ['Admins can invite users and change their roles', 'Add an invite form and a role selector to the team settings page.'],
  ['Fix typo in the footer', 'The footer says "Copyrigth".'],
];

const commands = {
  async projects() {
    const page = await jira('/rest/api/3/project/search?maxResults=50');
    for (const p of page.values || []) console.log(`${p.key}  ${p.name}  (${p.style || p.projectTypeKey})`);
    console.log(`(${(page.values || []).length} projects)`);
  },

  async myself() {
    const me = await jira('/rest/api/3/myself');
    console.log(`${me.displayName} ${me.accountId}`);
  },

  async 'create-project'(key, name) {
    const me = await jira('/rest/api/3/myself');
    const project = await jira('/rest/api/3/project', {
      method: 'POST',
      body: JSON.stringify({
        key,
        name: name || key,
        projectTypeKey: 'software',
        projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
        leadAccountId: me.accountId,
        assigneeType: 'UNASSIGNED',
      }),
    });
    console.log(`created project ${project.key} (id ${project.id})`);
  },

  async 'create-issues'(key) {
    const meta = await jira(`/rest/api/3/project/${key}`);
    const type = (meta.issueTypes || []).find((t) => t.name === 'Task') || (meta.issueTypes || []).find((t) => !t.subtask);
    for (const [summary, description] of DEMO_ISSUES) {
      const issue = await jira('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify({ fields: { project: { key }, issuetype: { id: type.id }, summary, description: adf(description) } }),
      });
      console.log(`${issue.key}  ${summary}`);
    }
  },

  // One new ticket, to check that avi:jira:created:issue builds a passport.
  async 'create-issue'(key, summary, description = '') {
    const meta = await jira(`/rest/api/3/project/${key}`);
    const type = (meta.issueTypes || []).find((t) => t.name === 'Task') || (meta.issueTypes || []).find((t) => !t.subtask);
    const fields = { project: { key }, issuetype: { id: type.id }, summary };
    if (description) fields.description = adf(description);
    const issue = await jira('/rest/api/3/issue', { method: 'POST', body: JSON.stringify({ fields }) });
    console.log(`${issue.key}  ${summary}`);
  },

  // Toggle a "demo" label so Jira fires avi:jira:updated:issue for each key.
  // Adding a label the issue already has changes nothing, and Jira sends no event.
  async touch(...keys) {
    for (const key of keys) {
      const issue = await jira(`/rest/api/3/issue/${key}?fields=labels`);
      const op = (issue.fields.labels || []).includes('demo') ? 'remove' : 'add';
      await jira(`/rest/api/3/issue/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ update: { labels: [{ [op]: 'demo' }] } }),
      });
      console.log(`touched ${key} (${op} label demo)`);
    }
  },

  // Delete stored passports (demo preparation only); the next event or panel view rebuilds them.
  async reset(...keys) {
    for (const key of keys) {
      try {
        await jira(`/rest/api/3/issue/${key}/properties/security-passport`, { method: 'DELETE' });
        console.log(`reset ${key}`);
      } catch (error) {
        if (!/-> 404/.test(error.message)) throw error;
        console.log(`${key}: no passport to reset`);
      }
    }
  },

  // Try to move an issue to Done; the Security Passport validator may refuse.
  async done(issueKey) {
    const { transitions } = await jira(`/rest/api/3/issue/${issueKey}/transitions`);
    const toDone = transitions.find((t) => t.to?.name === 'Done' || t.name === 'Done');
    if (!toDone) { console.log(`${issueKey}: no transition to Done`); return; }
    try {
      await jira(`/rest/api/3/issue/${issueKey}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: toDone.id } }),
      });
      console.log(`${issueKey}: moved to Done`);
    } catch (error) {
      console.log(`${issueKey}: refused -> ${error.message.replace(/^.*?-> /, '')}`);
    }
  },

  async passport(issueKey) {
    let property;
    try {
      property = await jira(`/rest/api/3/issue/${issueKey}/properties/security-passport`);
    } catch (error) {
      if (/-> 404/.test(error.message)) { console.log(`${issueKey}: no passport yet`); return; }
      throw error;
    }
    const p = property.value;
    console.log(`${issueKey}: ${p.status} (${p.doneCount}/${p.total} closed, rules v${p.rulesVersion ?? 1}), areas: ${p.areas.join(', ') || 'none'}`);
    for (const area of p.detected) console.log(`  area ${area.id}: ${area.matches.join(', ')}`);
    for (const c of p.checks) {
      const who = c.by ? `, by ${c.by} at ${c.at}` : '';
      console.log(`  ${c.id} ${c.status}${c.note ? ` (${c.note}${who})` : ''}${c.stale ? ' [stale]' : ''}`);
    }
  },

  async 'search-open'(projectKey) {
    const jql = projectKey
      ? `project = "${projectKey}" AND securityPassportStatus = "open" ORDER BY key ASC`
      : 'securityPassportStatus = "open" ORDER BY key ASC';
    const result = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({ jql, fields: ['summary'], maxResults: 50 }),
    });
    console.log(`JQL: ${jql}`);
    for (const issue of result.issues || []) console.log(`  ${issue.key}  ${issue.fields.summary}`);
    console.log(`  (${(result.issues || []).length} issues)`);
  },
};

const run = commands[command];
if (!run) {
  console.error(`unknown command ${command}`);
  process.exit(2);
}
run(...args).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
