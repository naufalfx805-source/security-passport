// Detect which security areas a ticket touches, with the words that matched.

import { RULES, RULES_BY_ID } from './rules.js';
import { issueText } from './text.js';

const LABEL_PREFIX = 'security-passport:';
const MAX_MATCHES_PER_AREA = 3;

export function analyzeIssue(fields = {}) {
  // Our own override labels are handled below; keep them out of the wording
  // check so "security-passport:..." is not read as a passport (PII) mention.
  const labels = (fields.labels || []).filter((l) => !String(l).toLowerCase().startsWith(LABEL_PREFIX));
  const text = issueText({ ...fields, labels });
  const areas = [];
  for (const rule of RULES) {
    const matches = new Set();
    for (const pattern of rule.patterns) {
      const found = text.match(new RegExp(pattern.source, 'g'));
      for (const hit of found || []) {
        if (matches.size < MAX_MATCHES_PER_AREA) matches.add(hit.trim());
      }
    }
    if (matches.size === 0) continue;
    // Keep only the checks whose own context matches; drop the area if none apply.
    const checkIds = rule.checks.filter((c) => !c.when || c.when.test(text)).map((c) => c.id);
    if (checkIds.length > 0) areas.push({ id: rule.id, label: rule.label, matches: [...matches], checkIds });
  }

  // A label such as "security-passport:ssrf" adds an area the wording missed.
  for (const label of fields.labels || []) {
    const lower = String(label).toLowerCase();
    if (!lower.startsWith(LABEL_PREFIX)) continue;
    const id = lower.slice(LABEL_PREFIX.length);
    const rule = RULES_BY_ID.get(id);
    if (rule && !areas.some((a) => a.id === id)) {
      // An explicit label asks for the whole area, so every check applies.
      areas.push({ id, label: rule.label, matches: [`label ${label}`], checkIds: rule.checks.map((c) => c.id) });
    }
  }
  return { areas };
}
