import type { Creature, GroupType } from './model';
import { normalizeKey } from './text';

export interface GroupRef {
  type: GroupType;
  label: string;
  memberIds: string[];
}

export interface CreatureIndex {
  creatures: Creature[];
  byId: Map<string, Creature>;
  byNameKey: Map<string, Creature[]>;
  groupsByKey: Map<string, GroupRef[]>;
}

export type TokenMatch =
  | { kind: 'creature'; creature: Creature }
  | { kind: 'ambiguous'; creatures: Creature[] }
  | { kind: 'group'; groups: GroupRef[] }
  | { kind: 'unresolved' };

const GROUP_FIELDS: { type: GroupType; read: (creature: Creature) => string | null }[] = [
  { type: 'Size', read: (creature) => creature.size },
  { type: 'Diet', read: (creature) => creature.diet },
];

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndex(creatures: Creature[]): CreatureIndex {
  const byId = new Map<string, Creature>();
  const byNameKey = new Map<string, Creature[]>();
  const groupsByKey = new Map<string, GroupRef[]>();
  const groupLookup = new Map<string, GroupRef>();

  for (const creature of creatures) {
    byId.set(creature.id, creature);
    push(byNameKey, normalizeKey(creature.name), creature);

    for (const { type, read } of GROUP_FIELDS) {
      const label = read(creature);
      if (!label) continue;
      const key = normalizeKey(label);
      const lookup = `${type}|${key}`;
      let group = groupLookup.get(lookup);
      if (!group) {
        group = { type, label, memberIds: [] };
        groupLookup.set(lookup, group);
        push(groupsByKey, key, group);
      }
      group.memberIds.push(creature.id);
    }
  }

  return { creatures, byId, byNameKey, groupsByKey };
}

/**
 * Classifies one Likes/Dislikes entry. Creature names win over group values.
 * Group values (Size, Diet) are not species names and are reported separately.
 */
export function classifyToken(token: string, index: CreatureIndex): TokenMatch {
  const key = normalizeKey(token);
  if (!key) return { kind: 'unresolved' };

  const named = index.byNameKey.get(key) ?? [];
  if (named.length === 1) return { kind: 'creature', creature: named[0] };
  if (named.length > 1) return { kind: 'ambiguous', creatures: named };

  const groups = index.groupsByKey.get(key);
  if (groups && groups.length > 0) return { kind: 'group', groups };

  return { kind: 'unresolved' };
}
