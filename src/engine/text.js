// Turn Jira's Atlassian Document Format (ADF) into plain text for matching.

const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'panel', 'tableRow', 'rule', 'expand', 'nestedExpand',
]);

export function adfToText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  switch (node.type) {
    case 'text':
      return node.text || '';
    case 'hardBreak':
      return '\n';
    case 'mention':
    case 'emoji':
      return node.attrs?.text || '';
    case 'inlineCard':
    case 'blockCard':
      return node.attrs?.url ? ` ${node.attrs.url} ` : '';
    default: {
      const separator = node.type === 'tableRow' ? ' | ' : '';
      const inner = (node.content || []).map(adfToText).join(separator);
      return BLOCK_TYPES.has(node.type) ? `${inner}\n` : inner;
    }
  }
}

// Everything the analyzer looks at, lower-cased and with whitespace collapsed.
export function issueText({ summary, description, labels, components } = {}) {
  const parts = [
    summary || '',
    typeof description === 'string' ? description : adfToText(description),
    (labels || []).join(' '),
    (components || []).map((c) => (typeof c === 'string' ? c : c?.name || '')).join(' '),
  ];
  return parts.join('\n').toLowerCase().replace(/[ \t]+/g, ' ');
}
