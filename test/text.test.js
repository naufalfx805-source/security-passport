import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adfToText, issueText } from '../src/engine/text.js';

test('ADF paragraphs, breaks, mentions and links become text', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', content: [{ type: 'text', text: 'Plan' }] },
      { type: 'paragraph', content: [
        { type: 'text', text: 'Ask ' }, { type: 'mention', attrs: { text: '@Ana' } },
        { type: 'hardBreak' }, { type: 'inlineCard', attrs: { url: 'https://example.com/spec' } },
      ] },
    ],
  };
  const text = adfToText(doc);
  assert.match(text, /Plan\n/);
  assert.match(text, /Ask @Ana\n/);
  assert.match(text, /https:\/\/example\.com\/spec/);
});

test('issueText joins summary, description, labels and components in lower case', () => {
  const text = issueText({ summary: 'Login Page', description: 'Uses OAuth', labels: ['Frontend'], components: [{ name: 'Web App' }] });
  assert.equal(text, 'login page\nuses oauth\nfrontend\nweb app');
});

test('missing fields are fine', () => {
  assert.equal(issueText({}), '\n\n\n');
  assert.equal(adfToText(null), '');
});
