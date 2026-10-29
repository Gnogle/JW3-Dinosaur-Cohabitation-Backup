import type { Creature } from './model';
import { habitatLabel } from './workbook';

/** Minimum number of fields that must be numeric on both records before a score is produced. */
export const MIN_SHARED_HABITAT_FIELDS = 2;

export interface SharedHabitatField {
  key: string;
  label: string;
  selected: number;
  candidate: number;
  difference: number;
}

export interface HabitatComparison {
  scored: boolean;
  reason: string | null;
  sharedFields: SharedHabitatField[];
  /** Fields present on both sheets but blank on at least one record (not treated as zero). */
  missingFields: string[];
  meanAbsoluteDifference: number | null;
  /** 1 - meanAbsoluteDifference, from 0 (opposite) to 1 (identical). */
  similarity: number | null;
}

/**
 * Similarity = 1 - mean(|selected - candidate|) over the fields that have a number on both records.
 * Blank values are excluded from the comparison, never treated as 0.
 * Records from different categories are never compared.
 */
export function compareHabitats(selected: Creature, candidate: Creature): HabitatComparison {
  const sharedFields: SharedHabitatField[] = [];
  const missingFields: string[] = [];

  const finish = (reason: string | null, meanAbsoluteDifference: number | null): HabitatComparison => ({
    scored: reason === null,
    reason,
    sharedFields,
    missingFields,
    meanAbsoluteDifference,
    similarity: meanAbsoluteDifference === null ? null : 1 - meanAbsoluteDifference,
  });

  if (selected.category !== candidate.category) {
    return finish(`${selected.category} and ${candidate.category} records use different habitat data and are not compared.`, null);
  }

  const keys = Object.keys(selected.habitat);
  if (keys.length === 0) {
    return finish(`${selected.category} records have no numeric habitat fields.`, null);
  }

  for (const key of keys) {
    const a = selected.habitat[key];
    const b = candidate.habitat[key];
    if (typeof a !== 'number' || typeof b !== 'number') {
      missingFields.push(habitatLabel(key));
      continue;
    }
    sharedFields.push({ key, label: habitatLabel(key), selected: a, candidate: b, difference: Math.abs(a - b) });
  }

  if (sharedFields.length < MIN_SHARED_HABITAT_FIELDS) {
    return finish(
      `Only ${sharedFields.length} habitat field(s) are numeric on both records; at least ${MIN_SHARED_HABITAT_FIELDS} are needed.`,
      null,
    );
  }

  const total = sharedFields.reduce((sum, field) => sum + field.difference, 0);
  return finish(null, total / sharedFields.length);
}
