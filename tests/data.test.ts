import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadWorkbookData } from '../src/data/loadWorkbookData';
import { recommendForCreature } from '../src/domain/recommend';
import { buildIndex } from '../src/domain/tokens';

const WORKBOOK = resolve(process.cwd(), 'JW3 Dino Habitat Planner.xlsx');

describe('generated workbook data', () => {
  it('loads and validates the generated JSON', async () => {
    const data = await loadWorkbookData();
    expect(data.workbook.creatures.length).toBeGreaterThan(0);
    for (const category of ['Land', 'Aviary', 'Lagoon'] as const) {
      expect(data.workbook.creatures.some((creature) => creature.category === category)).toBe(true);
    }
  });

  it.skipIf(!existsSync(WORKBOOK))('matches the SHA-256 of the source workbook', async () => {
    const data = await loadWorkbookData();
    const hash = createHash('sha256').update(readFileSync(WORKBOOK)).digest('hex');
    expect(data.meta.sha256).toBe(hash);
  });

  it('keeps Lagoon records free of habitat values', async () => {
    const data = await loadWorkbookData();
    const lagoon = data.workbook.creatures.filter((creature) => creature.category === 'Lagoon');
    expect(lagoon.length).toBeGreaterThan(0);
    for (const creature of lagoon) expect(creature.habitat).toEqual({});
  });

  it('keeps every recommendation internally consistent for every creature', async () => {
    const data = await loadWorkbookData();
    const index = buildIndex(data.workbook.creatures);

    for (const creature of data.workbook.creatures) {
      const result = recommendForCreature(creature.id, index, data.workbook.notes);
      const scored = result.candidates.filter((candidate) => candidate.outcome === 'scored');

      for (const candidate of scored) {
        expect(candidate.comparison?.similarity).toBeGreaterThanOrEqual(0);
        expect(candidate.comparison?.similarity).toBeLessThanOrEqual(1);
        expect(candidate.creature.category).toBe(creature.category);
      }
      if (result.recommendation) {
        const best = Math.max(...scored.map((candidate) => candidate.comparison?.similarity ?? 0));
        expect(result.recommendation.comparison?.similarity).toBe(best);
      }
      expect(result.status === 'recommended').toBe(result.recommendation !== null);
    }
  });

  it('recommends the highest-scoring explicit liked creature for Triceratops', async () => {
    const data = await loadWorkbookData();
    const index = buildIndex(data.workbook.creatures);
    const triceratops = data.workbook.creatures.find((creature) => creature.name === 'Triceratops');
    expect(triceratops).toBeDefined();
    if (!triceratops) return;

    const result = recommendForCreature(triceratops.id, index, data.workbook.notes);
    expect(result.likedCreatures.map((creature) => creature.name)).toEqual(
      expect.arrayContaining(['Stegoceratops', 'Microceratus']),
    );
    expect(result.recommendation?.creature.name).toBe('Ankylosaurus');

    // Stegoceratops is explicitly liked and scored, but ranks below Ankylosaurus on the shared habitat fields.
    const stegoceratops = result.candidates.find((candidate) => candidate.creature.name === 'Stegoceratops');
    expect(stegoceratops?.outcome).toBe('scored');

    // Microceratus shares water and ground fiber with Triceratops, so it is scored but ranks lower.
    const microceratus = result.candidates.find((candidate) => candidate.creature.name === 'Microceratus');
    expect(microceratus?.outcome).toBe('scored');
    expect(microceratus?.comparison?.sharedFields.map((field) => field.key)).toEqual(['water', 'ground fiber']);
    expect(microceratus?.comparison?.similarity ?? 0).toBeLessThan(result.recommendation?.comparison?.similarity ?? 0);
  });
});
