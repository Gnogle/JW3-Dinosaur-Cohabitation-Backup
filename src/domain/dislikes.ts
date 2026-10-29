import type { Creature } from './model';
import { classifyToken, type CreatureIndex } from './tokens';

/**
 * Returns a reason when `holder` dislikes `target` by name, by a duplicate-name token
 * that could be `target`, or by a Size/Diet group containing `target`.
 */
export function dislikeReason(holder: Creature, target: Creature, index: CreatureIndex): string | null {
  for (const token of holder.dislikes) {
    const match = classifyToken(token, index);
    if (match.kind === 'creature' && match.creature.id === target.id) {
      return `${holder.name} dislikes ${target.name}`;
    }
    if (match.kind === 'ambiguous' && match.creatures.some((creature) => creature.id === target.id)) {
      return `${holder.name} dislikes "${token}", which may refer to ${target.name} (ambiguous name)`;
    }
    if (match.kind === 'group') {
      const group = match.groups.find((candidate) => candidate.memberIds.includes(target.id));
      if (group) return `${holder.name} dislikes ${group.type.toLowerCase()} "${group.label}"`;
    }
  }
  return null;
}

/** Checks both directions: either creature disliking the other excludes the pair. */
export function findDislikeConflict(selected: Creature, candidate: Creature, index: CreatureIndex): string | null {
  return dislikeReason(selected, candidate, index) ?? dislikeReason(candidate, selected, index);
}
