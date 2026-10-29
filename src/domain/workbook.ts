import { CATEGORIES, type Category, type Creature, type DataWarning, type ParsedWorkbook, type SheetSummary, type WorkbookNote } from './model';
import { cleanText, normalizeKey, splitLines } from './text';

/** Habitat columns in workbook order. Land has all of them; Aviary has the first six; Lagoon has none. */
const HABITAT_LABELS = [
  'Arid', 'Barren', 'Cover', 'Pasture', 'Wetland', 'Water', 'Deep Water',
  'Ground Leaf', 'Ground Fiber', 'Ground Fruit', 'Ground Nut',
  'Tall leaf', 'Tall Fiber', 'Tall Fruit',
] as const;

export const HABITAT_FIELDS: readonly { key: string; label: string }[] = HABITAT_LABELS.map((label) => ({
  key: normalizeKey(label),
  label,
}));

const REQUIRED_KEYS = ['dino', 'likes', 'dislikes'] as const;
const KNOWN_KEYS = new Set<string>([
  'dino', 'diet', 'era', 'size', 'likes', 'dislikes',
  ...HABITAT_FIELDS.map((field) => field.key),
]);

export function habitatLabel(key: string): string {
  return HABITAT_FIELDS.find((field) => field.key === key)?.label ?? key;
}

export interface FractionResult {
  value: number | null;
  problem: string | null;
}

/**
 * Parses a habitat cell. Blank means not specified (null). Numeric zero stays 0.
 * Values must be finite and within 0-1.
 */
export function parseFraction(raw: unknown): FractionResult {
  if (raw === null || raw === undefined) return { value: null, problem: null };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? checkRange(raw) : { value: null, problem: 'not a finite number' };
  }
  const text = cleanText(raw);
  if (text === '') return { value: null, problem: null };
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return { value: null, problem: `"${text}" is not a number` };
  return checkRange(parsed);
}

function checkRange(value: number): FractionResult {
  return value < 0 || value > 1
    ? { value: null, problem: `${value} is outside the 0-1 range` }
    : { value, problem: null };
}

interface SheetParseResult {
  creatures: Creature[];
  summary: SheetSummary;
  warnings: DataWarning[];
  notes: WorkbookNote[];
}

/** Parses one category sheet. `rows` is the raw grid with the header in row 0. */
export function parseSheet(category: Category, rows: unknown[][]): SheetParseResult {
  const warnings: DataWarning[] = [];
  const notes: WorkbookNote[] = [];

  const columns = new Map<string, number>();
  const unknownColumns: { index: number; header: string }[] = [];
  (rows[0] ?? []).forEach((rawHeader, index) => {
    const header = cleanText(rawHeader);
    const key = normalizeKey(header);
    if (!key) {
      unknownColumns.push({ index, header: '(untitled)' });
      return;
    }
    if (columns.has(key)) {
      warnings.push({ level: 'warning', sheet: category, row: 1, message: `Duplicate column "${header}" ignored.` });
      return;
    }
    columns.set(key, index);
    if (!KNOWN_KEYS.has(key)) {
      unknownColumns.push({ index, header });
      notes.push({ sheet: category, column: header, row: null, text: header });
    }
  });

  const habitatColumns = HABITAT_FIELDS.flatMap((field) => {
    const index = columns.get(field.key);
    return index === undefined ? [] : [{ ...field, index }];
  });
  const summary: SheetSummary = {
    name: category,
    category,
    creatureCount: 0,
    habitatFields: habitatColumns.map((field) => field.key),
  };

  const missing = REQUIRED_KEYS.filter((key) => !columns.has(key));
  if (missing.length > 0) {
    warnings.push({
      level: 'error',
      sheet: category,
      row: 1,
      message: `Missing required column(s): ${missing.map((key) => key.toUpperCase()).join(', ')}.`,
    });
    return { creatures: [], summary, warnings, notes };
  }

  const cell = (row: unknown[], key: string): unknown => {
    const index = columns.get(key);
    return index === undefined ? undefined : row[index];
  };
  const optionalText = (value: unknown): string | null => cleanText(value) || null;

  const creatures: Creature[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 1;

    for (const column of unknownColumns) {
      const text = splitLines(row[column.index]).join(' ');
      if (text) notes.push({ sheet: category, column: column.header, row: rowNumber, text });
    }

    const name = cleanText(cell(row, 'dino'));
    if (!name) {
      if (row.some((value) => cleanText(value) !== '')) {
        warnings.push({ level: 'warning', sheet: category, row: rowNumber, message: 'Row has data but no DINO name; skipped.' });
      }
      continue;
    }

    const habitat: Record<string, number | null> = {};
    for (const field of habitatColumns) {
      const { value, problem } = parseFraction(row[field.index]);
      habitat[field.key] = value;
      if (problem) {
        warnings.push({
          level: 'warning',
          sheet: category,
          row: rowNumber,
          message: `${field.label}: ${problem}; treated as not specified.`,
        });
      }
    }

    creatures.push({
      id: `${category}:${rowNumber}`,
      name,
      nameKey: normalizeKey(name),
      category,
      sourceRow: rowNumber,
      diet: optionalText(cell(row, 'diet')),
      era: optionalText(cell(row, 'era')),
      size: optionalText(cell(row, 'size')),
      likes: splitLines(cell(row, 'likes')),
      dislikes: splitLines(cell(row, 'dislikes')),
      habitat,
    });
  }

  summary.creatureCount = creatures.length;
  return { creatures, summary, warnings, notes };
}

/** Converts raw sheet grids (sheet name to rows) into the app's parsed workbook model. */
export function parseWorkbook(sheets: Record<string, unknown[][]>): ParsedWorkbook {
  const creatures: Creature[] = [];
  const summaries: SheetSummary[] = [];
  const warnings: DataWarning[] = [];
  const notes: WorkbookNote[] = [];

  for (const category of CATEGORIES) {
    const rows = sheets[category];
    if (!rows) {
      warnings.push({ level: 'error', sheet: category, row: null, message: `Sheet "${category}" is missing.` });
      continue;
    }
    const parsed = parseSheet(category, rows);
    creatures.push(...parsed.creatures);
    summaries.push(parsed.summary);
    warnings.push(...parsed.warnings);
    notes.push(...parsed.notes);
  }

  for (const name of Object.keys(sheets)) {
    if (!(CATEGORIES as readonly string[]).includes(name)) {
      warnings.push({ level: 'info', sheet: name, row: null, message: `Sheet "${name}" is not used.` });
    }
  }

  const byName = new Map<string, Creature[]>();
  for (const creature of creatures) {
    const group = byName.get(creature.nameKey) ?? [];
    group.push(creature);
    byName.set(creature.nameKey, group);
  }
  for (const group of byName.values()) {
    if (group.length > 1) {
      warnings.push({
        level: 'info',
        sheet: null,
        row: null,
        message: `"${group[0].name}" appears ${group.length} times; likes naming it are treated as ambiguous.`,
      });
    }
  }

  return { creatures, sheets: summaries, warnings, notes };
}
