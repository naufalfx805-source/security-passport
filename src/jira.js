// Jira REST helpers. Reads and writes use asUser() whenever a person or agent
// triggered them, so Jira's own permissions decide what they may see and change.

import { asApp, asUser, route } from '@forge/api';
import { PROPERTY_KEY } from './engine/passport.js';

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const PROJECT_KEY = /^[A-Z][A-Z0-9_]+$/;

export function normalizeIssueKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return ISSUE_KEY.test(key) ? key : null;
}

export function normalizeProjectKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return PROJECT_KEY.test(key) ? key : null;
}

function client(as) {
  return as === 'user' ? asUser() : asApp();
}

export async function getIssueFields(issueKey, as) {
  const res = await client(as).requestJira(
    route`/rest/api/3/issue/${issueKey}?fields=summary,description,labels,components`,
  );
  if (!res.ok) throw new Error(`Jira returned ${res.status} for ${issueKey}.`);
  const issue = await res.json();
  return issue.fields || {};
}

export async function getPassport(issueKey, as) {
  const res = await client(as).requestJira(route`/rest/api/3/issue/${issueKey}/properties/${PROPERTY_KEY}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read the Security Passport of ${issueKey} (${res.status}).`);
  const body = await res.json();
  return body.value || null;
}

export async function savePassport(issueKey, passport, as) {
  const res = await client(as).requestJira(route`/rest/api/3/issue/${issueKey}/properties/${PROPERTY_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(passport),
  });
  if (!res.ok) throw new Error(`Could not save the Security Passport of ${issueKey} (${res.status}).`);
}

// Issues whose passport is still open, newest first. The project key is
// validated above, so it cannot change the shape of the JQL query.
export async function searchOpenPassports(projectKey, as) {
  const jql = projectKey
    ? `project = "${projectKey}" AND securityPassportStatus = "open" ORDER BY updated DESC`
    : 'securityPassportStatus = "open" ORDER BY updated DESC';
  const res = await client(as).requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, maxResults: 25, fields: ['summary'], properties: [PROPERTY_KEY] }),
  });
  if (!res.ok) throw new Error(`Jira search failed (${res.status}).`);
  const body = await res.json();
  return (body.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields?.summary || '',
    openCount: issue.properties?.[PROPERTY_KEY]?.openCount ?? null,
  }));
}
