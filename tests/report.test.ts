import { describe, expect, it } from 'vitest';
import {
  buildIssueUrl,
  buildMissingReport,
  buildStatReport,
  formatPercent,
  parsePercentInput,
  REPORT_REPOSITORY,
} from '../src/domain/report';
import { makeCreature } from './fixtures';

describe('parsePercentInput', () => {
  it('treats blank as no entry, not zero', () => {
    expect(parsePercentInput('')).toEqual({ value: null, error: null });
    expect(parsePercentInput('   ')).toEqual({ value: null, error: null });
  });

  it('keeps an explicit 0 as 0', () => {
    expect(parsePercentInput('0')).toEqual({ value: 0, error: null });
  });

  it('converts percent to a fraction', () => {
    expect(parsePercentInput('23')).toEqual({ value: 0.23, error: null });
    expect(parsePercentInput('100')).toEqual({ value: 1, error: null });
  });

  it('rejects non-numbers and values outside 0-100', () => {
    expect(parsePercentInput('abc').error).toContain('not a number');
    expect(parsePercentInput('-1').error).toContain('0-100');
    expect(parsePercentInput('101').error).toContain('0-100');
  });
});

describe('formatPercent', () => {
  it('removes float artifacts', () => {
    expect(formatPercent(0.23)).toBe('23%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('buildStatReport', () => {
  const creature = makeCreature('Triceratops', {
    category: 'Land',
    sourceRow: 12,
    habitat: { cover: 0.5, pasture: null },
  });

  it('requires a dinosaur', () => {
    const draft = buildStatReport(null, [{ key: 'cover', value: '10' }]);
    expect(draft.errors).toContain('Choose a dinosaur.');
  });

  it('requires at least one corrected value', () => {
    const draft = buildStatReport(creature, []);
    expect(draft.errors).toEqual(['Add at least one stat correction.']);
  });

  it('requires a stat to be chosen and a value to be entered', () => {
    const draft = buildStatReport(creature, [
      { key: '', value: '10' },
      { key: 'pasture', value: '' },
    ]);
    expect(draft.errors).toEqual([
      'Choose a stat for each correction.',
      'Enter a corrected value for Pasture, or remove that row.',
    ]);
  });

  it('rejects a stat that is listed twice', () => {
    const draft = buildStatReport(creature, [
      { key: 'cover', value: '10' },
      { key: 'cover', value: '20' },
    ]);
    expect(draft.errors).toEqual(['Cover is listed more than once.']);
  });

  it('reports invalid entries', () => {
    const draft = buildStatReport(creature, [{ key: 'cover', value: '150' }]);
    expect(draft.errors.some((error) => error.startsWith('Cover:'))).toBe(true);
  });

  it('lists current and corrected values, including a corrected 0', () => {
    const draft = buildStatReport(creature, [
      { key: 'cover', value: '0' },
      { key: 'pasture', value: '20' },
    ]);
    expect(draft.errors).toEqual([]);
    expect(draft.title).toBe('Stat issue: Triceratops (Land)');
    expect(draft.body).toContain('| Cover | 50% | 0% (0) |');
    expect(draft.body).toContain('| Pasture | Not specified | 20% (0.2) |');
    expect(draft.body).toContain('row 12');
  });

  it('leaves out fields that were not entered', () => {
    const draft = buildStatReport(creature, [{ key: 'cover', value: '10' }]);
    expect(draft.body).not.toContain('Pasture');
  });
});

describe('buildMissingReport', () => {
  const existing = [makeCreature('Triceratops')];

  it('requires a name', () => {
    const draft = buildMissingReport({ name: '   ', category: '', entries: {} }, existing);
    expect(draft.errors).toEqual(['Enter the dinosaur name.']);
  });

  it('rejects a name that already exists, ignoring case and spacing', () => {
    const draft = buildMissingReport({ name: '  triceratops ', category: '', entries: {} }, existing);
    expect(draft.errors.length).toBe(1);
    expect(draft.errors[0]).toContain('already in the workbook');
  });

  it('accepts a new name with no habitat values', () => {
    const draft = buildMissingReport({ name: 'Spinosaurus', category: 'Lagoon', entries: {} }, existing);
    expect(draft.errors).toEqual([]);
    expect(draft.title).toBe('Missing dinosaur: Spinosaurus');
    expect(draft.body).toContain('- Category: Lagoon');
    expect(draft.body).toContain('No habitat or food values were provided.');
  });

  it('marks an unknown category as not specified and includes entered values', () => {
    const draft = buildMissingReport({ name: 'Ichthyovenator', category: '', entries: { wetland: '0' } }, existing);
    expect(draft.errors).toEqual([]);
    expect(draft.body).toContain('- Category: Not specified');
    expect(draft.body).toContain('| Wetland | 0% (0) |');
  });
});

describe('buildIssueUrl', () => {
  it('points at the project repository and encodes title and body', () => {
    const url = buildIssueUrl({ title: 'Stat issue: A & B', body: 'line 1\nline 2 #3' });
    expect(url.startsWith(`https://github.com/${REPORT_REPOSITORY}/issues/new?`)).toBe(true);
    expect(url).toContain('title=Stat%20issue%3A%20A%20%26%20B');
    expect(url).toContain('body=line%201%0Aline%202%20%233');
  });
});
