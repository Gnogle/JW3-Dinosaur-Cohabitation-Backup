import { describe, expect, it } from 'vitest';
import { compareHabitats, MIN_SHARED_HABITAT_FIELDS } from '../src/domain/habitat';
import { makeCreature } from './fixtures';

describe('compareHabitats', () => {
  it('scores identical habitats as 1', () => {
    const a = makeCreature('A', { habitat: { cover: 0.5, pasture: 0.2 } });
    const b = makeCreature('B', { sourceRow: 2, habitat: { cover: 0.5, pasture: 0.2 } });
    const result = compareHabitats(a, b);
    expect(result.scored).toBe(true);
    expect(result.similarity).toBeCloseTo(1);
  });

  it('uses 1 minus the mean absolute difference over shared fields', () => {
    const a = makeCreature('A', { habitat: { cover: 0.5, pasture: 0.2, wetland: 0.1 } });
    const b = makeCreature('B', { sourceRow: 2, habitat: { cover: 0.3, pasture: 0.2, wetland: 0.1 } });
    const result = compareHabitats(a, b);
    expect(result.meanAbsoluteDifference).toBeCloseTo(0.2 / 3);
    expect(result.similarity).toBeCloseTo(1 - 0.2 / 3);
  });

  it('excludes blank fields instead of treating them as zero', () => {
    const a = makeCreature('A', { habitat: { cover: 0.5, pasture: null, wetland: 0.4 } });
    const blank = makeCreature('B', { sourceRow: 2, habitat: { cover: 0.5, pasture: null, wetland: 0.4 } });
    const zero = makeCreature('C', { sourceRow: 3, habitat: { cover: 0.5, pasture: 0, wetland: 0.4 } });

    const withBlank = compareHabitats(a, blank);
    expect(withBlank.sharedFields.map((field) => field.key)).toEqual(['cover', 'wetland']);
    expect(withBlank.missingFields).toEqual(['Pasture']);

    // An explicit 0 is a number, so pasture is compared when the other record is numeric.
    const withZero = compareHabitats(zero, makeCreature('D', { sourceRow: 4, habitat: { cover: 0.5, pasture: 0.9, wetland: 0.4 } }));
    expect(withZero.sharedFields.map((field) => field.key)).toEqual(['cover', 'pasture', 'wetland']);
    expect(withZero.missingFields).toEqual([]);
  });

  it('refuses to score when fewer than the minimum number of fields are shared', () => {
    const a = makeCreature('A', { habitat: { cover: 0.5, pasture: null, wetland: null } });
    const b = makeCreature('B', { sourceRow: 2, habitat: { cover: 0.5, pasture: 0.1, wetland: null } });
    const result = compareHabitats(a, b);
    expect(MIN_SHARED_HABITAT_FIELDS).toBe(2);
    expect(result.scored).toBe(false);
    expect(result.similarity).toBeNull();
    expect(result.reason).toContain('at least 2');
  });

  it('never compares records from different sheets', () => {
    const land = makeCreature('A', { habitat: { cover: 0.5, pasture: 0.2 } });
    const aviary = makeCreature('B', { sourceRow: 2, category: 'Aviary', habitat: { cover: 0.5, pasture: 0.2 } });
    const result = compareHabitats(land, aviary);
    expect(result.scored).toBe(false);
    expect(result.reason).toContain('not compared');
  });

  it('reports Lagoon records (no habitat fields) as unscored', () => {
    const lagoon = makeCreature('L1', { category: 'Lagoon', sourceRow: 2 });
    const other = makeCreature('L2', { category: 'Lagoon', sourceRow: 3 });
    const result = compareHabitats(lagoon, other);
    expect(result.scored).toBe(false);
    expect(result.reason).toContain('no numeric habitat fields');
  });
});
