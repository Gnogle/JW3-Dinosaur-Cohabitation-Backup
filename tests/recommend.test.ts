import { describe, expect, it } from 'vitest';
import type { Creature, WorkbookNote } from '../src/domain/model';
import { recommendForCreature } from '../src/domain/recommend';
import { buildIndex } from '../src/domain/tokens';
import { makeCreature } from './fixtures';

const NOTE_HEADER = 'Therizinosaurs & Carnivores are universally hated unless indicated';

/** Selector likes Beta, Alpha (tied with Beta), Gamma, plus group and unknown tokens. */
function baseRoster(selectorOverrides: Partial<Creature> = {}): Creature[] {
  return [
    makeCreature('Selector', {
      sourceRow: 2,
      size: 'Medium',
      likes: ['Beta', 'Gamma', 'Alpha', 'Medium', 'Large', 'Stegpceratpops'],
      habitat: { cover: 0.5, pasture: 0.5, wetland: 0.5 },
      ...selectorOverrides,
    }),
    makeCreature('Beta', {
      sourceRow: 3,
      habitat: { cover: 0.5, pasture: 0.5, wetland: 0.4 },
    }),
    makeCreature('Gamma', {
      sourceRow: 4,
      size: 'Large',
      habitat: { cover: 0.1, pasture: 0.1, wetland: 0.1 },
    }),
    makeCreature('Alpha', {
      sourceRow: 5,
      habitat: { cover: 0.5, pasture: 0.5, wetland: 0.4 },
    }),
  ];
}

function run(creatures: Creature[], selectedName: string, notes: WorkbookNote[] = []) {
  const index = buildIndex(creatures);
  const selected = creatures.find((creature) => creature.name === selectedName);
  if (!selected) throw new Error(`fixture missing ${selectedName}`);
  return recommendForCreature(selected.id, index, notes);
}

describe('recommendForCreature', () => {
  it('recommends the best scored explicit liked creature and breaks ties by name', () => {
    const result = run(baseRoster(), 'Selector');

    expect(result.status).toBe('recommended');
    expect(result.recommendation?.creature.name).toBe('Alpha');
    expect(result.tiedWith.map((candidate) => candidate.creature.name)).toEqual(['Beta']);
    expect(result.candidates.map((candidate) => candidate.creature.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(result.nextBest?.creature.name).toBe('Gamma');
    expect(result.message).toContain('tie');
  });

  it('uses only explicit species names and reports group and unknown likes separately', () => {
    const result = run(baseRoster(), 'Selector');

    expect(result.likedCreatures.map((creature) => creature.name).sort()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(result.groupLikes).toEqual(['Medium', 'Large']);
    expect(result.unresolvedLikes).toEqual(['Stegpceratpops']);
  });

  it('excludes a liked creature that the selected creature dislikes by name', () => {
    const creatures = baseRoster({ dislikes: ['Alpha'] });
    const result = run(creatures, 'Selector');

    const alpha = result.candidates.find((candidate) => candidate.creature.name === 'Alpha');
    expect(alpha?.outcome).toBe('excluded');
    expect(alpha?.reason).toContain('Selector dislikes Alpha');
    expect(result.recommendation?.creature.name).toBe('Beta');
  });

  it('excludes a liked creature when the liked creature dislikes the selected creature', () => {
    const creatures = baseRoster();
    creatures[1] = { ...creatures[1], dislikes: ['Selector'] };
    const result = run(creatures, 'Selector');

    const beta = result.candidates.find((candidate) => candidate.creature.name === 'Beta');
    expect(beta?.outcome).toBe('excluded');
    expect(beta?.reason).toContain('Beta dislikes Selector');
    expect(result.recommendation?.creature.name).toBe('Alpha');
  });

  it('excludes a liked creature through a group dislike (Size)', () => {
    const result = run(baseRoster({ dislikes: ['Large'] }), 'Selector');

    const gamma = result.candidates.find((candidate) => candidate.creature.name === 'Gamma');
    expect(gamma?.outcome).toBe('excluded');
    expect(gamma?.reason).toContain('size "Large"');
  });

  it('keeps unresolved dislikes visible without applying them', () => {
    const result = run(baseRoster({ dislikes: ['Everything'] }), 'Selector');

    expect(result.unresolvedDislikes).toEqual(['Everything']);
    expect(result.recommendation?.creature.name).toBe('Alpha');
  });

  it('reports no explicit likes when Likes contains only group values', () => {
    const creatures = [makeCreature('Lonely', { likes: ['Medium'] })];
    const result = run(creatures, 'Lonely');

    expect(result.status).toBe('no-explicit-likes');
    expect(result.recommendation).toBeNull();
    expect(result.message).toContain('No explicit liked creature');
  });

  it('reports no eligible candidate when every liked creature is excluded', () => {
    const creatures = [
      makeCreature('Selector', { sourceRow: 2, likes: ['Beta'], habitat: { cover: 0.5, pasture: 0.5 } }),
      makeCreature('Beta', { sourceRow: 3, dislikes: ['Selector'], habitat: { cover: 0.5, pasture: 0.5 } }),
    ];
    const result = run(creatures, 'Selector');

    expect(result.status).toBe('no-eligible');
    expect(result.recommendation).toBeNull();
  });

  it('does not invent a habitat match for Lagoon records and marks them unscored', () => {
    const creatures = [
      makeCreature('Pool', { sourceRow: 2, category: 'Lagoon', likes: ['Reef'] }),
      makeCreature('Reef', { sourceRow: 3, category: 'Lagoon' }),
    ];
    const result = run(creatures, 'Pool');

    expect(result.status).toBe('no-comparable-habitat');
    expect(result.recommendation).toBeNull();
    expect(result.candidates[0].outcome).toBe('unscored');
  });

  it('never recommends a creature from another sheet', () => {
    const creatures = [
      makeCreature('Selector', { sourceRow: 2, likes: ['Glider'], habitat: { cover: 0.5, pasture: 0.5 } }),
      makeCreature('Glider', { sourceRow: 3, category: 'Aviary', habitat: { cover: 0.5, pasture: 0.5 } }),
    ];
    const result = run(creatures, 'Selector');

    expect(result.status).toBe('no-comparable-habitat');
    expect(result.candidates[0].outcome).toBe('unscored');
    expect(result.candidates[0].reason).toContain('not compared');
  });

  it('keeps a liked name that matches two records as unresolved, not as a choice', () => {
    const creatures = [
      makeCreature('Selector', { sourceRow: 2, likes: ['Twin'], habitat: { cover: 0.5, pasture: 0.5 } }),
      makeCreature('Twin', { sourceRow: 3, habitat: { cover: 0.5, pasture: 0.5 } }),
      makeCreature('Twin', { sourceRow: 4, category: 'Aviary', habitat: { cover: 0.5, pasture: 0.5 } }),
    ];
    const result = run(creatures, 'Selector');

    expect(result.likedCreatures).toEqual([]);
    expect(result.unresolvedLikes).toEqual(['Twin']);
    expect(result.status).toBe('no-explicit-likes');
  });

  it('surfaces a Land carnivore note only for a carnivore or therizinosaur', () => {
    const notes: WorkbookNote[] = [{ sheet: 'Land', column: NOTE_HEADER, row: null, text: NOTE_HEADER }];

    const carnivore = run(
      baseRoster({ diet: 'Carnivore', likes: ['Beta'] }),
      'Selector',
      notes,
    );
    expect(carnivore.annotations).toHaveLength(1);
    expect(carnivore.annotations[0]).toContain('not applied as a rule');

    const herbivore = run(baseRoster({ diet: 'Ground Palaeobotany', likes: ['Beta'] }), 'Selector', notes);
    expect(herbivore.annotations).toEqual([]);
  });
});
