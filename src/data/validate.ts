import type { GeneratedWorkbook } from '../domain/model';

const CATEGORY_NAMES = new Set(['Land', 'Aviary', 'Lagoon']);
const LEVELS = new Set(['info', 'warning', 'error']);

function fail(message: string): never {
  throw new Error(`Invalid generated workbook data: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, context: string): void {
  if (typeof value !== 'string') fail(`${context} must be a string`);
}

function expectNullableString(value: unknown, context: string): void {
  if (value !== null && typeof value !== 'string') fail(`${context} must be a string or null`);
}

function expectStringArray(value: unknown, context: string): void {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    fail(`${context} must be an array of strings`);
  }
}

/** Checks the shape of the generated JSON before the UI relies on it. */
export function parseGeneratedWorkbook(value: unknown): GeneratedWorkbook {
  if (!isRecord(value)) fail('root is not an object');
  const { meta, workbook } = value;
  if (!isRecord(meta)) fail('meta is missing');
  expectString(meta.sourceFile, 'meta.sourceFile');
  expectString(meta.sha256, 'meta.sha256');
  if (!isRecord(workbook)) fail('workbook is missing');
  if (!Array.isArray(workbook.creatures)) fail('workbook.creatures must be an array');
  if (!Array.isArray(workbook.sheets)) fail('workbook.sheets must be an array');
  if (!Array.isArray(workbook.warnings)) fail('workbook.warnings must be an array');
  if (!Array.isArray(workbook.notes)) fail('workbook.notes must be an array');

  const seenIds = new Set<string>();
  for (const [index, creature] of workbook.creatures.entries()) {
    const ctx = `creatures[${index}]`;
    if (!isRecord(creature)) fail(`${ctx} is not an object`);
    expectString(creature.id, `${ctx}.id`);
    if (seenIds.has(creature.id as string)) fail(`duplicate id ${String(creature.id)}`);
    seenIds.add(creature.id as string);
    expectString(creature.name, `${ctx}.name`);
    expectString(creature.nameKey, `${ctx}.nameKey`);
    if (typeof creature.category !== 'string' || !CATEGORY_NAMES.has(creature.category)) {
      fail(`${ctx}.category is not a known category`);
    }
    if (typeof creature.sourceRow !== 'number') fail(`${ctx}.sourceRow must be a number`);
    expectNullableString(creature.diet, `${ctx}.diet`);
    expectNullableString(creature.era, `${ctx}.era`);
    expectNullableString(creature.size, `${ctx}.size`);
    expectStringArray(creature.likes, `${ctx}.likes`);
    expectStringArray(creature.dislikes, `${ctx}.dislikes`);
    if (!isRecord(creature.habitat)) fail(`${ctx}.habitat must be an object`);
    for (const [key, amount] of Object.entries(creature.habitat)) {
      if (amount !== null && typeof amount !== 'number') fail(`${ctx}.habitat.${key} must be a number or null`);
    }
  }

  for (const warning of workbook.warnings) {
    if (!isRecord(warning) || typeof warning.level !== 'string' || !LEVELS.has(warning.level)) {
      fail('warning has an unknown level');
    }
  }

  return value as unknown as GeneratedWorkbook;
}
