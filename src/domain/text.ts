const INVISIBLE_CHARS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** Removes invisible characters, normalizes spaces and collapses all whitespace (including line breaks). */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(INVISIBLE_CHARS, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Case-insensitive comparison key. */
export function normalizeKey(value: unknown): string {
  return cleanText(value).toLowerCase();
}

/** Splits a multi-line workbook cell into trimmed, non-empty entries. */
export function splitLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  return String(value)
    .split(/\r\n|\r|\n/)
    .map(cleanText)
    .filter((entry) => entry.length > 0);
}

export function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
