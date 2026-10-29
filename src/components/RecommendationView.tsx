import type { Creature } from '../domain/model';
import type { CandidateResult, RecommendationResult, RecommendationStatus } from '../domain/recommend';
import { HABITAT_FIELDS } from '../domain/workbook';

const HEADINGS: Record<RecommendationStatus, string> = {
  recommended: 'Recommended cohabitation match',
  'no-explicit-likes': 'No recommendation',
  'no-eligible': 'No recommendation',
  'no-comparable-habitat': 'No cohabitation match can be scored',
};

const OUTCOME_LABEL: Record<CandidateResult['outcome'], string> = {
  scored: 'Scored',
  unscored: 'Not scored',
  excluded: 'Excluded',
};

function percent(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}

function formatHabitat(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

/** Lists the habitat/food fields that have a recorded value, in workbook order. */
function HabitatColumn({ creature }: { creature: Creature }) {
  const fields = HABITAT_FIELDS.flatMap((field) => {
    const value = creature.habitat[field.key];
    return value === null || value === undefined ? [] : [{ key: field.key, label: field.label, value }];
  });
  return (
    <div className="habitat-column">
      <h3>
        {creature.name} <span className="category">{creature.category}</span>
      </h3>
      {fields.length === 0 ? (
        <p className="muted">No dinosaur needs values recorded for this dinosaur.</p>
      ) : (
        <dl className="habitat-list">
          {fields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>{formatHabitat(field.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function CandidateTable({ candidates }: { candidates: CandidateResult[] }) {
  return (
    <table className="candidate-table">
      <caption>Liked dinosaurs considered</caption>
      <thead>
        <tr>
          <th scope="col">Dinosaur</th>
          <th scope="col">Outcome</th>
          <th scope="col">Similarity</th>
          <th scope="col">Detail</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate) => (
          <tr key={candidate.creature.id}>
            <td>
              {candidate.creature.name} <span className="category">{candidate.creature.category}</span>
            </td>
            <td>{OUTCOME_LABEL[candidate.outcome]}</td>
            <td>
              {candidate.comparison?.similarity != null ? percent(candidate.comparison.similarity) : 'n/a'}
            </td>
            <td>
              {candidate.outcome === 'scored'
                ? `${candidate.comparison?.sharedFields.length ?? 0} shared fields`
                : candidate.reason}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RecommendationView({ result }: { result: RecommendationResult }) {
  // Candidates are already ordered by similarity, highest first.
  const matches = result.candidates.flatMap((candidate) =>
    candidate.outcome === 'scored' && candidate.comparison?.similarity != null
      ? [{ candidate, similarity: candidate.comparison.similarity }]
      : [],
  );

  return (
    <section className="card" aria-labelledby="recommendation-heading">
      <h2 id="recommendation-heading">{HEADINGS[result.status]}</h2>
      <p role="status">{result.message}</p>

      {matches.map(({ candidate, similarity }) => (
        <div className="match" key={candidate.creature.id}>
          <p>
            <strong>{candidate.creature.name}</strong> <span className="category">{candidate.creature.category}</span> has
            a dinosaur needs similarity of <strong>{percent(similarity)}</strong> to {result.selected.name}.
          </p>
          <div className="habitat-compare">
            <HabitatColumn creature={result.selected} />
            <HabitatColumn creature={candidate.creature} />
          </div>
        </div>
      ))}

      <h3>Liked dinosaurs</h3>
      {result.candidates.length === 0 ? (
        <p className="muted">No explicit liked dinosaur was identified.</p>
      ) : (
        <CandidateTable candidates={result.candidates} />
      )}
    </section>
  );
}
