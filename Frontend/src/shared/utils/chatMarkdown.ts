// The small piece of Markdown an assistant reply may use: **bold**, *italic*, line breaks and
// simple bullet or numbered lists. Headings are read as a bold line; anything else (links, tables,
// code, raw HTML) stays as the plain text it was written as. The result is data that a component
// turns into React elements, so model text never reaches the page as HTML.

export type ChatInlineKind = 'text' | 'strong' | 'em';

export interface ChatInline {
  kind: ChatInlineKind;
  text: string;
  /** Where the piece starts in its line; unique within the line, so it serves as a React key. */
  offset: number;
}

export interface ChatLine {
  /** The line's number in the reply; unique within the reply, so it serves as a React key. */
  lineNumber: number;
  inlines: ChatInline[];
}

export type ChatBlock =
  | { kind: 'paragraph'; lines: ChatLine[] }
  | { kind: 'list'; ordered: boolean; start: number; items: ChatLine[] };

/** `**bold**` or `__bold__`, then `*italic*` whose stars hug the words, so "2 * 3" stays text. */
const INLINE_PATTERN = /\*\*(.+?)\*\*|__(.+?)__|\*(?=[^*\s])([^*\n]*?[^*\s])\*/g;
const BULLET_PATTERN = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_PATTERN = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING_PATTERN = /^\s*#{1,6}\s+(.*)$/;

export function parseChatInlines(line: string): ChatInline[] {
  const inlines: ChatInline[] = [];
  let cursor = 0;
  for (const match of line.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    if (start > cursor) {
      inlines.push({ kind: 'text', text: line.slice(cursor, start), offset: cursor });
    }
    const [, strongStars, strongUnderscores, emphasis] = match;
    const strong = strongStars ?? strongUnderscores;
    inlines.push(
      strong !== undefined
        ? { kind: 'strong', text: strong, offset: start }
        : { kind: 'em', text: emphasis ?? '', offset: start },
    );
    cursor = start + match[0].length;
  }
  if (cursor < line.length) {
    inlines.push({ kind: 'text', text: line.slice(cursor), offset: cursor });
  }
  return inlines;
}

type ListLine = { ordered: boolean; number: number; content: string };

function readListLine(line: string): ListLine | null {
  const bullet = BULLET_PATTERN.exec(line);
  if (bullet) return { ordered: false, number: 1, content: bullet[1] ?? '' };
  const numbered = NUMBERED_PATTERN.exec(line);
  if (numbered) {
    return { ordered: true, number: Number(numbered[1]), content: numbered[2] ?? '' };
  }
  return null;
}

/** A heading becomes one bold line, the closest a chat bubble has to a heading. */
function headingLine(lineNumber: number, text: string): ChatLine {
  return { lineNumber, inlines: [{ kind: 'strong', text: text.replace(/\*\*/g, ''), offset: 0 }] };
}

export function parseChatMarkdown(source: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let current: ChatBlock | null = null;
  const close = (): void => {
    if (current) blocks.push(current);
    current = null;
  };

  source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((rawLine, lineNumber) => {
      const line = rawLine.trimEnd();
      if (line.trim() === '') {
        close();
        return;
      }
      const listLine = readListLine(line);
      if (listLine) {
        const item: ChatLine = { lineNumber, inlines: parseChatInlines(listLine.content) };
        if (current?.kind === 'list' && current.ordered === listLine.ordered) {
          current.items.push(item);
          return;
        }
        close();
        current = {
          kind: 'list',
          ordered: listLine.ordered,
          start: listLine.number,
          items: [item],
        };
        return;
      }
      const heading = HEADING_PATTERN.exec(line);
      const chatLine = heading
        ? headingLine(lineNumber, heading[1] ?? '')
        : { lineNumber, inlines: parseChatInlines(line.trim()) };
      if (current?.kind === 'paragraph') {
        current.lines.push(chatLine);
        return;
      }
      close();
      current = { kind: 'paragraph', lines: [chatLine] };
    });
  close();
  return blocks;
}
