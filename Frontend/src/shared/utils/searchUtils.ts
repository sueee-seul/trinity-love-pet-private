/**
 * Exact Match Search:
 * Checks if the query exists as a contiguous substring within the text.
 * Case-insensitive by default to provide good UX for general search bars.
 */
export const exactMatch = (text: string, query: string, caseSensitive = false): boolean => {
  if (!query) return true;
  if (caseSensitive) {
    return text.includes(query);
  }
  return text.toLowerCase().includes(query.toLowerCase());
};

/**
 * Fuzzy Match Search:
 * Checks if all characters of the query appear in the text in the exact order,
 * but they do not need to be contiguous (e.g., "elvn" matches "Eleanor Vance").
 * Always case-insensitive.
 */
export const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;

  const t = text.toLowerCase();
  const q = query.toLowerCase();

  let qIdx = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
    }
    if (qIdx === q.length) {
      return true; // All characters found in order
    }
  }

  return false;
};
