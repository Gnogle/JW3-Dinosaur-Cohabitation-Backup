import type { Creature } from '../src/domain/model';
import { normalizeKey } from '../src/domain/text';

/** Builds a creature for unit tests. Defaults to a Land record with no habitat values. */
export function makeCreature(name: string, overrides: Partial<Creature> = {}): Creature {
  const category = overrides.category ?? 'Land';
  const sourceRow = overrides.sourceRow ?? 1;
  return {
    id: `${category}:${sourceRow}`,
    name,
    nameKey: normalizeKey(name),
    category,
    sourceRow,
    diet: null,
    era: null,
    size: null,
    likes: [],
    dislikes: [],
    habitat: {},
    ...overrides,
  };
}
