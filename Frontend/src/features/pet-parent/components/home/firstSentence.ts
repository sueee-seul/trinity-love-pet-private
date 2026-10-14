/** The first sentence of the update, up to its first full stop, question mark or exclamation mark. */
export function firstSentence(body: string): string {
  const match = /^.*?[.!?](?=\s|$)/.exec(body);
  return match ? match[0] : body;
}
