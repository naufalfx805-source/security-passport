import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIssue } from '../src/engine/analyze.js';

const ids = (fields) => analyzeIssue(fields).areas.map((a) => a.id).sort();

test('a webhook that fetches a remote image is flagged as SSRF', () => {
  const result = analyzeIssue({ summary: 'Add webhook that fetches the remote image for link previews' });
  const ssrf = result.areas.find((a) => a.id === 'ssrf');
  assert.ok(ssrf, 'ssrf area detected');
  assert.ok(ssrf.matches.includes('webhook'));
});

test('avatar upload is flagged as upload', () => {
  assert.deepEqual(ids({ summary: 'Let users upload an avatar' }), ['upload']);
});

test('password reset is flagged as authentication', () => {
  assert.ok(ids({ summary: 'Forgot password flow with magic link' }).includes('auth'));
});

test('copy changes are not flagged', () => {
  assert.deepEqual(ids({ summary: 'Fix typo in the footer' }), []);
  assert.deepEqual(ids({ summary: 'Update the onboarding illustration colours' }), []);
});

test('ADF descriptions are read', () => {
  const description = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Store the Stripe API key and verify the webhook signature.' }] }],
  };
  const found = ids({ summary: 'Billing integration', description });
  for (const id of ['payments', 'secrets', 'ssrf', 'crypto']) assert.ok(found.includes(id), `${id} detected`);
});

test('a security-passport label adds an area the wording missed', () => {
  const result = analyzeIssue({ summary: 'Refactor the importer', labels: ['security-passport:ssrf'] });
  assert.deepEqual(result.areas.map((a) => a.id), ['ssrf']);
  assert.match(result.areas[0].matches[0], /label/);
});

test('unknown labels are ignored', () => {
  assert.deepEqual(ids({ summary: 'Refactor', labels: ['security-passport:nonsense', 'frontend'] }), []);
});

test('the product name itself is not read as personal data', () => {
  assert.deepEqual(ids({ summary: 'Check the Security Passport panel before release' }), []);
  assert.ok(ids({ summary: 'Store the passport number of each traveller' }).includes('pii'));
});

test('matches are capped at three per area', () => {
  const result = analyzeIssue({ summary: 'login login sign in sign up password session jwt sso' });
  const auth = result.areas.find((a) => a.id === 'auth');
  assert.ok(auth.matches.length <= 3);
});
