// The Security Passport: the checks a ticket needs and their status.
// Stored as the Jira issue property "security-passport".

import { RULES_BY_ID, RULES_VERSION } from './rules.js';

export const PROPERTY_KEY = 'security-passport';
export const CHECK_STATUSES = ['open', 'done', 'accepted'];
const MIN_EVIDENCE = 5;
const MIN_JUSTIFICATION = 20;

// The checks of one area, limited to `checkIds` when the analysis narrowed them.
// The `when` pattern is rule logic, not data, so it is not stored.
function checksForArea(areaId, checkIds) {
  const rule = RULES_BY_ID.get(areaId);
  const allowed = checkIds ? new Set(checkIds) : null;
  return (rule?.checks || [])
    .filter((check) => !allowed || allowed.has(check.id))
    .map(({ when, ...check }) => ({ ...check, area: areaId }));
}

function summarize(checks) {
  const total = checks.length;
  const openCount = checks.filter((c) => c.status === 'open').length;
  const status = total === 0 ? 'not-required' : openCount === 0 ? 'complete' : 'open';
  return { status, total, openCount, doneCount: total - openCount };
}

// Combine a fresh analysis with the stored passport. A check the analysis no
// longer asks for (for example after the description was edited) stays and is
// flagged "stale", so editing words cannot clear a gate. The exception is a
// rules upgrade: open checks the new rules no longer ask for came from our old
// rules, not from the ticket, so they are dropped. Closed checks keep their
// evidence either way.
export function mergePassport(existing, analysis, { now = new Date().toISOString() } = {}) {
  const previous = new Map((existing?.checks || []).map((c) => [c.id, c]));
  const rulesChanged = Boolean(existing) && existing.rulesVersion !== RULES_VERSION;
  const checks = [];

  for (const area of analysis.areas) {
    for (const check of checksForArea(area.id, area.checkIds)) {
      const prev = previous.get(check.id);
      checks.push(prev
        ? { ...check, status: prev.status, note: prev.note ?? null, by: prev.by ?? null, at: prev.at ?? null }
        : { ...check, status: 'open', note: null, by: null, at: null });
      previous.delete(check.id);
    }
  }
  for (const prev of previous.values()) {
    if (rulesChanged && prev.status === 'open') continue;
    checks.push({ ...prev, stale: true });
  }

  // Areas found now, plus earlier areas that still have checks in the passport.
  const areasWithChecks = new Set(checks.map((c) => c.area));
  const detected = new Map((existing?.detected || [])
    .filter((d) => areasWithChecks.has(d.id))
    .map((d) => [d.id, { ...d, stale: true }]));
  for (const area of analysis.areas) detected.set(area.id, { ...area, stale: false });

  const next = {
    version: 1,
    rulesVersion: RULES_VERSION,
    areas: [...detected.keys()],
    detected: [...detected.values()],
    checks,
    ...summarize(checks),
    updatedAt: existing?.updatedAt ?? now,
  };
  if (!samePassport(existing, next)) next.updatedAt = now;
  return next;
}

export function samePassport(a, b) {
  if (!a || !b) return false;
  const strip = ({ updatedAt, ...rest }) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

// Change one check. "done" needs evidence and "accepted" needs a justification,
// both attributed to the person (or agent) who made the change.
export function setCheckStatus(passport, checkId, { status, note = '', by = null, now = new Date().toISOString() }) {
  if (!passport) throw new Error('This issue has no Security Passport yet.');
  if (!CHECK_STATUSES.includes(status)) throw new Error(`Unknown status "${status}".`);
  const index = passport.checks.findIndex((c) => c.id === checkId);
  if (index === -1) throw new Error(`Check ${checkId} is not part of this passport.`);
  const text = String(note || '').trim();
  if (status === 'done' && text.length < MIN_EVIDENCE) {
    throw new Error('Add evidence, such as a test name or a pull request link.');
  }
  if (status === 'accepted' && text.length < MIN_JUSTIFICATION) {
    throw new Error(`Explain why the risk is accepted (at least ${MIN_JUSTIFICATION} characters).`);
  }
  const checks = passport.checks.map((c, i) => (i === index
    ? { ...c, status, note: status === 'open' ? null : text, by: status === 'open' ? null : by, at: status === 'open' ? null : now }
    : c));
  return { ...passport, checks, ...summarize(checks), updatedAt: now };
}

// Plain-text view for Rovo agents and MCP clients.
export function passportToText(issueKey, passport) {
  if (!passport || passport.status === 'not-required') {
    return `${issueKey}: no security checks are needed for what this ticket describes. If the work touches sign-in, uploads, URL fetching, payments, secrets or personal data, add that to the ticket or add a label such as security-passport:ssrf.`;
  }
  const lines = [`${issueKey}: Security Passport is ${passport.status.toUpperCase()} (${passport.doneCount} of ${passport.total} checks closed).`];
  for (const area of passport.detected || []) {
    lines.push(`Area: ${area.label}${area.stale ? ' (no longer in the ticket text)' : ''}. Detected from: ${area.matches.join(', ')}.`);
  }
  for (const c of passport.checks) {
    const state = c.status === 'open' ? 'OPEN' : c.status === 'done' ? `DONE (evidence: ${c.note})` : `ACCEPTED RISK (${c.note})`;
    const stale = c.stale ? ' (no longer in the ticket text, still required)' : '';
    lines.push(`- ${c.id}${c.cwe ? ` [${c.cwe}]` : ''} ${state}${stale}: ${c.title} How to verify: ${c.verify}`);
  }
  return lines.join('\n');
}
