import type { Creature, WorkbookNote } from './model';
import { findDislikeConflict } from './dislikes';
import { compareHabitats, type HabitatComparison } from './habitat';
import { compareText } from './text';
import { classifyToken, type CreatureIndex } from './tokens';

/** Land notes are only shown when the creature's diet matches the note's subject. */
const NOTE_SUBJECT = /carnivore|therizinosaur/i;

export type CandidateOutcome = 'scored' | 'unscored' | 'excluded';

export interface CandidateResult {
  creature: Creature;
  outcome: CandidateOutcome;
  reason: string | null;
  comparison: HabitatComparison | null;
}

export type RecommendationStatus = 'recommended' | 'no-explicit-likes' | 'no-eligible' | 'no-comparable-habitat';

export interface RecommendationResult {
  selected: Creature;
  likedCreatures: Creature[];
  /** Likes entries that name no record, or name more than one record. */
  unresolvedLikes: string[];
  /** Likes entries that are Size/Diet values; not used for matching. */
  groupLikes: string[];
  /** Dislikes entries that name no record, or name more than one; not applied. */
  unresolvedDislikes: string[];
  /** Workbook notes surfaced for the selected creature and the recommendation. Not applied as rules. */
  annotations: string[];
  /** Ordered: scored (best first), then unscored, then excluded. Ties are ordered by name. */
  candidates: CandidateResult[];
  recommendation: CandidateResult | null;
  tiedWith: CandidateResult[];
  nextBest: CandidateResult | null;
  status: RecommendationStatus;
  message: string;
}

/** Rounding used so floating-point noise does not split identical scores. */
function scoreKey(result: CandidateResult): number {
  return Math.round((result.comparison?.similarity ?? 0) * 1e9);
}

const RANK: Record<CandidateOutcome, number> = { scored: 0, unscored: 1, excluded: 2 };

function annotationsFor(creature: Creature, notes: WorkbookNote[]): string[] {
  const subject = creature.diet !== null && NOTE_SUBJECT.test(creature.diet);
  if (!subject) return [];
  return notes
    .filter((note) => note.sheet === creature.category && NOTE_SUBJECT.test(note.column))
    .map((note) => `Workbook note for ${creature.name}: "${note.text}" (shown for information; not applied as a rule).`);
}

export function recommendForCreature(
  selectedId: string,
  index: CreatureIndex,
  notes: WorkbookNote[] = [],
): RecommendationResult {
  const selected = index.byId.get(selectedId);
  if (!selected) throw new Error(`Unknown creature id: ${selectedId}`);

  const unresolvedDislikes = selected.dislikes.filter((token) => {
    const kind = classifyToken(token, index).kind;
    return kind === 'unresolved' || kind === 'ambiguous';
  });

  const likedCreatures: Creature[] = [];
  const unresolvedLikes: string[] = [];
  const groupLikes: string[] = [];
  for (const token of selected.likes) {
    const match = classifyToken(token, index);
    if (match.kind === 'creature') {
      const liked = match.creature;
      if (liked.id !== selected.id && !likedCreatures.some((creature) => creature.id === liked.id)) {
        likedCreatures.push(liked);
      }
    } else if (match.kind === 'group') {
      groupLikes.push(token);
    } else {
      unresolvedLikes.push(token);
    }
  }

  const candidates: CandidateResult[] = likedCreatures.map((candidate) => {
    const reason = findDislikeConflict(selected, candidate, index);
    if (reason) return { creature: candidate, outcome: 'excluded', reason, comparison: null };
    const comparison = compareHabitats(selected, candidate);
    if (!comparison.scored) {
      return { creature: candidate, outcome: 'unscored', reason: comparison.reason, comparison };
    }
    return { creature: candidate, outcome: 'scored', reason: null, comparison };
  });

  candidates.sort(
    (a, b) =>
      RANK[a.outcome] - RANK[b.outcome] ||
      scoreKey(b) - scoreKey(a) ||
      compareText(a.creature.name, b.creature.name) ||
      compareText(a.creature.id, b.creature.id),
  );

  const scored = candidates.filter((candidate) => candidate.outcome === 'scored');
  const top = scored[0] ?? null;
  const topKey = top ? scoreKey(top) : null;
  const tiedWith = top ? scored.slice(1).filter((candidate) => scoreKey(candidate) === topKey) : [];
  const nextBest = top ? scored.find((candidate) => scoreKey(candidate) !== topKey) ?? null : null;

  const groupNote = groupLikes.length > 0 ? ` Group-based likes (${groupLikes.join(', ')}) are not used for matching.` : '';

  let status: RecommendationStatus;
  let message: string;
  if (likedCreatures.length === 0) {
    status = 'no-explicit-likes';
    message = `No explicit liked creature could be identified from the Likes field.${groupNote}`;
  } else if (candidates.every((candidate) => candidate.outcome === 'excluded')) {
    status = 'no-eligible';
    message = 'Every liked creature is excluded by a dislike.';
  } else if (!top) {
    status = 'no-comparable-habitat';
    message = 'Eligible liked creatures have no comparable habitat record, so no habitat match can be scored.';
  } else {
    status = 'recommended';
    message =
      tiedWith.length > 0
        ? `${tiedWith.length + 1} liked creatures tie on similarity; ${top.creature.name} is listed first by name.`
        : `Best habitat match: ${top.creature.name}.`;
  }

  const annotations = [
    ...annotationsFor(selected, notes),
    ...(top ? annotationsFor(top.creature, notes) : []),
  ];

  return {
    selected,
    likedCreatures,
    unresolvedLikes,
    groupLikes,
    unresolvedDislikes,
    annotations,
    candidates,
    recommendation: top,
    tiedWith,
    nextBest,
    status,
    message,
  };
}
