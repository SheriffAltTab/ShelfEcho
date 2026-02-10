/**
 * Prepares raw Open Library description for display:
 * - Keeps ### as headings (rendered as <h3>)
 * - Strips **, *** and single * (bold/italic)
 * - Removes links: [text](url) -> text only
 * - Square brackets: [digits] removed; [text] -> text (no brackets)
 * - Decodes HTML entities (&ndash;, &#123; etc.)
 */

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function stripDescriptionFormatting(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw;
  s = decodeHtmlEntities(s);
  // Markdown links: [link text](url) -> link text only
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Square brackets: [digits] remove entirely; [text] -> text (no brackets)
  s = s.replace(/\[\d+\]/g, '');
  s = s.replace(/\[([^\]]+)\]/g, '$1');
  // Raw URLs
  s = s.replace(/https?:\/\/[^\s)\]']+/g, '');
  // Strip *** and ** (bold)
  s = s.replace(/\*{2,3}/g, '');
  // Strip single * (italic): *text* -> text
  s = s.replace(/\*([^*]+)\*/g, '$1');
  return s;
}

export interface DescriptionBlock {
  type: 'h3' | 'p';
  text: string;
}

/**
 * Splits stripped description into blocks: lines starting with ### become h3, others become p.
 */
export function parseDescriptionBlocks(stripped: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  const lines = stripped.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('###')) {
      blocks.push({ type: 'h3', text: trimmed.replace(/^#+\s*/, '').trim() });
    } else {
      blocks.push({ type: 'p', text: trimmed });
    }
  }

  if (blocks.length === 0) return [{ type: 'p', text: stripped.trim() }];
  return blocks;
}

export function formatBookDescription(raw: string): DescriptionBlock[] {
  const stripped = stripDescriptionFormatting(raw);
  return parseDescriptionBlocks(stripped);
}
