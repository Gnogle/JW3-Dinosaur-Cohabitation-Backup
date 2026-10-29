import { describe, expect, it } from 'vitest';
import { cleanText, normalizeKey, splitLines } from '../src/domain/text';
import { parseFraction, parseSheet, parseWorkbook } from '../src/domain/workbook';

describe('text helpers', () => {
  it('splits multi-line cells into trimmed, non-empty entries', () => {
    expect(splitLines(' Beta \r\nGamma\n\n  Delta  ')).toEqual(['Beta', 'Gamma', 'Delta']);
  });

  it('collapses whitespace and compares keys case-insensitively', () => {
    expect(cleanText('Ground\nNut')).toBe('Ground Nut');
    expect(normalizeKey('  TALL   leaf ')).toBe('tall leaf');
  });

  it('treats null and undefined as empty', () => {
    expect(splitLines(null)).toEqual([]);
    expect(cleanText(undefined)).toBe('');
  });
});

describe('parseFraction', () => {
  it('keeps blank as unknown (null) without a problem', () => {
    expect(parseFraction(null)).toEqual({ value: null, problem: null });
    expect(parseFraction('   ')).toEqual({ value: null, problem: null });
  });

  it('keeps an explicit zero distinct from blank', () => {
    expect(parseFraction(0)).toEqual({ value: 0, problem: null });
    expect(parseFraction('0')).toEqual({ value: 0, problem: null });
  });

  it('reports malformed and out-of-range values and treats them as unknown', () => {
    const malformed = parseFraction('abc');
    expect(malformed.value).toBeNull();
    expect(malformed.problem).not.toBeNull();

    const outOfRange = parseFraction(1.5);
    expect(outOfRange.value).toBeNull();
    expect(outOfRange.problem).not.toBeNull();
  });
});

describe('parseSheet', () => {
  const landHeader = [
    'DINO',
    'Diet',
    'Era',
    'Size',
    'Likes',
    'Dislikes',
    'Cover',
    'Ground\nNut',
    'Tall leaf',
    'Therizinosaurs & Carnivores are universally hated unless indicated ',
  ];

  it('splits multi-line Likes, keeps blank habitat as null and 0 as 0, and normalizes headers', () => {
    const rows = [
      landHeader,
      ['Alpha', 'Carnivore', 'Late', 'Large', 'Beta\nGamma', 'Delta', 0, 0.5, '', null],
    ];
    const parsed = parseSheet('Land', rows);

    expect(parsed.creatures).toHaveLength(1);
    const alpha = parsed.creatures[0];
    expect(alpha.id).toBe('Land:2');
    expect(alpha.likes).toEqual(['Beta', 'Gamma']);
    expect(alpha.dislikes).toEqual(['Delta']);
    expect(alpha.habitat).toEqual({ cover: 0, 'ground nut': 0.5, 'tall leaf': null });
    expect(parsed.summary.habitatFields).toEqual(['cover', 'ground nut', 'tall leaf']);
  });

  it('keeps the Land notes column as a header-level note and row-level notes when a cell has text', () => {
    const rows = [landHeader, ['Alpha', null, null, null, null, null, null, null, null, null], ['Beta', null, null, null, null, null, null, null, null, 'Only for test']];
    const parsed = parseSheet('Land', rows);

    expect(parsed.notes).toContainEqual({
      sheet: 'Land',
      column: 'Therizinosaurs & Carnivores are universally hated unless indicated',
      row: null,
      text: 'Therizinosaurs & Carnivores are universally hated unless indicated',
    });
    expect(parsed.notes).toContainEqual(expect.objectContaining({ row: 3, text: 'Only for test' }));
  });

  it('parses a Lagoon sheet with no habitat columns and no habitat values', () => {
    const rows = [
      ['DINO', 'Diet', 'Era', 'Size', 'Likes', 'Dislikes'],
      ['Mosa', 'Carnivore', 'Late Cretaceous', 'Large', 'Shark', ''],
    ];
    const parsed = parseSheet('Lagoon', rows);

    expect(parsed.summary.habitatFields).toEqual([]);
    expect(parsed.creatures[0].habitat).toEqual({});
    expect(parsed.creatures[0].dislikes).toEqual([]);
  });

  it('reports an error and returns no creatures when a required column is missing', () => {
    const parsed = parseSheet('Aviary', [['DINO', 'Likes'], ['Pteranodon', 'Fish']]);

    expect(parsed.creatures).toEqual([]);
    expect(parsed.warnings).toContainEqual(expect.objectContaining({ level: 'error', sheet: 'Aviary' }));
  });

  it('warns about a data row without a name and skips it', () => {
    const parsed = parseSheet('Aviary', [
      ['DINO', 'Likes', 'Dislikes'],
      [null, 'Fish', null],
    ]);

    expect(parsed.creatures).toEqual([]);
    expect(parsed.warnings).toContainEqual(expect.objectContaining({ level: 'warning', row: 2 }));
  });

  it('warns about malformed habitat values and treats them as unknown', () => {
    const parsed = parseSheet('Aviary', [
      ['DINO', 'Likes', 'Dislikes', 'Cover'],
      ['Pteranodon', '', '', 'n/a'],
    ]);

    expect(parsed.creatures[0].habitat).toEqual({ cover: null });
    expect(parsed.warnings).toContainEqual(expect.objectContaining({ level: 'warning', row: 2 }));
  });
});

describe('parseWorkbook', () => {
  it('reports a missing sheet as an error', () => {
    const parsed = parseWorkbook({
      Land: [['DINO', 'Likes', 'Dislikes'], ['Alpha', '', '']],
      Aviary: [['DINO', 'Likes', 'Dislikes'], ['Beta', '', '']],
    });

    expect(parsed.warnings).toContainEqual(expect.objectContaining({ level: 'error', sheet: 'Lagoon' }));
  });

  it('flags duplicate creature names across sheets as ambiguous', () => {
    const parsed = parseWorkbook({
      Land: [['DINO', 'Likes', 'Dislikes'], ['Twin', '', '']],
      Aviary: [['DINO', 'Likes', 'Dislikes'], ['twin', '', '']],
      Lagoon: [['DINO', 'Likes', 'Dislikes'], ['Other', '', '']],
    });

    expect(parsed.creatures).toHaveLength(3);
    expect(parsed.warnings).toContainEqual(expect.objectContaining({ level: 'info', message: expect.stringContaining('ambiguous') }));
  });
});
