/**
 * How a chat reply may be formatted. The chat bubbles on the booking page and in the parent's chat
 * show **bold**, *italic*, line breaks and "- " lists, and print every other Markdown mark as
 * plain text, so every chat prompt asks for that subset and nothing more.
 */
export const CHAT_FORMATTING_RULE =
  'Format replies as plain sentences. When a short list helps, such as the items in a combo, put each item on its own line starting with "- ". Use **bold** only for a combo, room or pet name. Never use headings, tables, links, code or any other Markdown.';
