import type { Category, Creature } from './model';
import { cleanText, normalizeKey } from './text';
import { HABITAT_FIELDS, habitatLabel } from './workbook';

/** GitHub repository that receives report issues. */
export const REPORT_REPOSITORY = 'Gnogle/JW3-Dinosaur-Cohabitation';

/** Raw form entries keyed by habitat field key. An empty string means no value was entered. */
export type HabitatEntries = Record<string, string>;

export interface ReportDraft {
  /** Empty when the report can be submitted. */
  errors: string[];
  title: string;
  body: string;
}

export interface PercentParse {
  /** Fraction between 0 and 1, or null when blank or invalid. */
  value: number | null;
  error: string | null;
}

/**
 * Parses a percent typed by the user (0-100) into a fraction (0-1).
 * Blank means "no value entered" (null, no error). Numeric 0 stays 0.
 */
export function parsePercentInput(raw: unknown): PercentParse {
  const text = cleanText(raw);
  if (text === '') return { value: null, error: null };
  const percent = Number(text);
  if (!Number.isFinite(percent)) return { value: null, error: `"${text}" is not a number` };
  if (percent < 0 || percent > 100) return { value: null, error: `${text} is outside 0-100` };
  return { value: Number((percent / 100).toFixed(6)), error: null };
}

/** Formats a 0-1 fraction as a percent for display, e.g. 0.23 becomes "23%". */
export function formatPercent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(1))}%`;
}

function readEntries(entries: HabitatEntries): { values: Record<string, number>; errors: string[] } {
  const values: Record<string, number> = {};
  const errors: string[] = [];
  for (const field of HABITAT_FIELDS) {
    const parsed = parsePercentInput(entries[field.key]);
    if (parsed.error) {
      errors.push(`${field.label}: ${parsed.error}.`);
    } else if (parsed.value !== null) {
      values[field.key] = parsed.value;
    }
  }
  return { values, errors };
}

function valueRows(values: Record<string, number>): string[] {
  return HABITAT_FIELDS.filter((field) => values[field.key] !== undefined).map(
    (field) => `| ${field.label} | ${formatPercent(values[field.key])} (${values[field.key]}) |`,
  );
}

/** One correction row in the stat issue form. An empty key means no stat has been chosen yet. */
export interface StatCorrection {
  key: string;
  value: string;
}

/**
 * Builds a stat-correction issue from one or more corrections. Each stat may appear once and needs a valid value.
 * Stats that are not corrected are left out of the table.
 */
export function buildStatReport(creature: Creature | null, corrections: StatCorrection[]): ReportDraft {
  const errors: string[] = [];
  const addError = (message: string) => {
    if (!errors.includes(message)) errors.push(message);
  };
  if (!creature) addError('Choose a dinosaur.');
  if (corrections.length === 0) addError('Add at least one stat correction.');

  const values: Record<string, number> = {};
  const chosen = new Set<string>();
  for (const correction of corrections) {
    if (correction.key === '') {
      addError('Choose a stat for each correction.');
      continue;
    }
    const label = habitatLabel(correction.key);
    if (chosen.has(correction.key)) {
      addError(`${label} is listed more than once.`);
      continue;
    }
    chosen.add(correction.key);
    const parsed = parsePercentInput(correction.value);
    if (parsed.error) {
      addError(`${label}: ${parsed.error}.`);
    } else if (parsed.value === null) {
      addError(`Enter a corrected value for ${label}, or remove that row.`);
    } else {
      values[correction.key] = parsed.value;
    }
  }

  if (!creature) return { errors, title: 'Stat issue', body: '' };

  const rows = HABITAT_FIELDS.filter((field) => values[field.key] !== undefined).map((field) => {
    const current = creature.habitat[field.key];
    const currentText = current === null || current === undefined ? 'Not specified' : formatPercent(current);
    return `| ${field.label} | ${currentText} | ${formatPercent(values[field.key])} (${values[field.key]}) |`;
  });

  const body = [
    '## Stat issue',
    '',
    `- Dinosaur: ${creature.name}`,
    `- Category: ${creature.category}`,
    `- Workbook location: ${creature.category} sheet, row ${creature.sourceRow}`,
    '',
    '| Field | Current value | Corrected value |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');

  return { errors, title: `Stat issue: ${creature.name} (${creature.category})`, body };
}

export interface MissingDinosaurInput {
  name: string;
  /** Empty string means the category is not known. */
  category: '' | Category;
  entries: HabitatEntries;
}

/**
 * Builds a missing-dinosaur issue. Requires a name that does not already exist in the workbook
 * (case-insensitive). Habitat values are optional.
 */
export function buildMissingReport(input: MissingDinosaurInput, existing: Creature[]): ReportDraft {
  const name = cleanText(input.name);
  const { values, errors: entryErrors } = readEntries(input.entries);
  const errors = [...entryErrors];

  if (name === '') {
    errors.unshift('Enter the dinosaur name.');
  } else {
    const key = normalizeKey(name);
    const duplicate = existing.find((creature) => creature.nameKey === key);
    if (duplicate) {
      errors.unshift(
        `"${duplicate.name}" is already in the workbook (${duplicate.category}). Use the stat issue report to correct it.`,
      );
    }
  }

  const category = input.category === '' ? 'Not specified' : input.category;
  const rows = valueRows(values);
  const body = [
    '## Missing dinosaur',
    '',
    `- Name: ${name}`,
    `- Category: ${category}`,
    '',
    rows.length > 0 ? '| Field | Value |' : 'No habitat or food values were provided.',
    ...(rows.length > 0 ? ['| --- | --- |', ...rows] : []),
  ].join('\n');

  return { errors, title: `Missing dinosaur: ${name || '(no name)'}`, body };
}

/** Builds a GitHub new-issue URL with the title and body pre-filled. */
export function buildIssueUrl(draft: Pick<ReportDraft, 'title' | 'body'>): string {
  return (
    `https://github.com/${REPORT_REPOSITORY}/issues/new` +
    `?title=${encodeURIComponent(draft.title)}&body=${encodeURIComponent(draft.body)}`
  );
}
