import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIssue } from '../src/engine/analyze.js';
import { mergePassport, passportToText, samePassport, setCheckStatus } from '../src/engine/passport.js';

const T0 = '2026-11-07T10:00:00.000Z';
const T1 = '2026-11-07T11:00:00.000Z';

function build(summary, existing = null, now = T0) {
  return mergePassport(existing, analyzeIssue({ summary }), { now });
}

test('a ticket with no risky wording needs no checks', () => {
  const p = build('Fix typo in the footer');
  assert.equal(p.status, 'not-required');
  assert.equal(p.total, 0);
});

test('a risky ticket gets open checks', () => {
  const p = build('Send webhooks to the customer URL');
  assert.equal(p.status, 'open');
  assert.ok(p.checks.some((c) => c.id === 'SSRF-1' && c.status === 'open'));
  assert.equal(p.openCount, p.total);
});

test('re-running the analysis keeps statuses and does not touch updatedAt', () => {
  let p = build('Send webhooks to the customer URL');
  p = setCheckStatus(p, 'SSRF-1', { status: 'done', note: 'test_rejects_private_ips', by: 'acc-1', now: T0 });
  const again = mergePassport(p, analyzeIssue({ summary: 'Send webhooks to the customer URL' }), { now: T1 });
  assert.equal(again.checks.find((c) => c.id === 'SSRF-1').status, 'done');
  assert.equal(again.updatedAt, p.updatedAt);
  assert.ok(samePassport(p, again));
});

test('new wording adds checks without dropping old ones', () => {
  const first = build('Send webhooks to the customer URL');
  const second = mergePassport(first, analyzeIssue({ summary: 'Send webhooks to the customer URL and let users upload a CSV' }), { now: T1 });
  assert.ok(second.checks.some((c) => c.area === 'upload'));
  assert.ok(second.checks.some((c) => c.area === 'ssrf'));
  assert.equal(second.updatedAt, T1);
});

test('removing the wording does not clear the gate', () => {
  const first = build('Send webhooks to the customer URL');
  const edited = mergePassport(first, analyzeIssue({ summary: 'Small refactor' }), { now: T1 });
  assert.equal(edited.status, 'open');
  assert.ok(edited.checks.every((c) => c.stale === true));
});

test('done needs evidence and accepted needs a justification', () => {
  const p = build('Send webhooks to the customer URL');
  assert.throws(() => setCheckStatus(p, 'SSRF-1', { status: 'done', note: '' }), /evidence/);
  assert.throws(() => setCheckStatus(p, 'SSRF-1', { status: 'accepted', note: 'fine' }), /at least 20/);
  assert.throws(() => setCheckStatus(p, 'NOPE-1', { status: 'done', note: 'some evidence' }), /not part/);
});

test('closing every check completes the passport, and reopening reopens it', () => {
  let p = build('Send webhooks to the customer URL');
  for (const c of p.checks) {
    p = setCheckStatus(p, c.id, { status: c.id === 'SSRF-3' ? 'accepted' : 'done', note: 'covered by the internal-only network policy test', by: 'acc-1', now: T1 });
  }
  assert.equal(p.status, 'complete');
  assert.equal(p.openCount, 0);
  p = setCheckStatus(p, 'SSRF-2', { status: 'open', now: T1 });
  assert.equal(p.status, 'open');
  assert.equal(p.checks.find((c) => c.id === 'SSRF-2').note, null);
});

test('text view lists checks with CWE and evidence', () => {
  let p = build('Send webhooks to the customer URL');
  p = setCheckStatus(p, 'SSRF-1', { status: 'done', note: 'PR #42', by: 'acc-1', now: T1 });
  const text = passportToText('SEC-12', p);
  assert.match(text, /SEC-12: Security Passport is OPEN/);
  assert.match(text, /SSRF-1 \[CWE-918\] DONE \(evidence: PR #42\)/);
  assert.match(passportToText('SEC-13', build('Fix typo')), /no security checks are needed/);
});
