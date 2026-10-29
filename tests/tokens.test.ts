import { describe, expect, it } from 'vitest';
import { buildIndex, classifyToken } from '../src/domain/tokens';
import { makeCreature } from './fixtures';

const index = buildIndex([
  makeCreature('Alpha', { sourceRow: 2, size: 'Large' }),
  makeCreature('Twin', { sourceRow: 3 }),
  makeCreature('Twin', { sourceRow: 4, category: 'Aviary' }),
  makeCreature('Beta', { sourceRow: 5, category: 'Lagoon', diet: 'Carnivore' }),
]);

describe('classifyToken', () => {
  it('matches a species name case-insensitively', () => {
    const match = classifyToken('  ALPHA ', index);
    expect(match.kind).toBe('creature');
    if (match.kind === 'creature') expect(match.creature.name).toBe('Alpha');
  });

  it('reports a duplicate name as ambiguous rather than picking one', () => {
    const match = classifyToken('Twin', index);
    expect(match.kind).toBe('ambiguous');
    if (match.kind === 'ambiguous') expect(match.creatures).toHaveLength(2);
  });

  it('classifies Size and Diet values as groups', () => {
    const size = classifyToken('large', index);
    expect(size.kind).toBe('group');
    if (size.kind === 'group') expect(size.groups[0].type).toBe('Size');

    const diet = classifyToken('carnivore', index);
    expect(diet.kind).toBe('group');
    if (diet.kind === 'group') expect(diet.groups.map((group) => group.type)).toEqual(['Diet']);
  });

  it('leaves unknown and empty tokens unresolved', () => {
    expect(classifyToken('Stegpceratpops', index).kind).toBe('unresolved');
    expect(classifyToken('   ', index).kind).toBe('unresolved');
  });
});
