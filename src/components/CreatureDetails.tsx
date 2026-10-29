import type { Creature } from '../domain/model';
import { HABITAT_FIELDS } from '../domain/workbook';

interface CreatureDetailsProps {
  creature: Creature;
}

function displayValue(value: string | null): string {
  return value ?? 'Not specified';
}

function HabitatTable({ habitat }: { habitat: Record<string, number | null> }) {
  const fields = HABITAT_FIELDS.flatMap((field) => {
    const value = habitat[field.key];
    return value === null || value === undefined ? [] : [{ key: field.key, label: field.label, value }];
  });
  if (fields.length === 0) return <p className="muted">No dinosaur needs recorded for this dinosaur.</p>;
  return (
    <table>
      <caption>Dinosaur Needs</caption>
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={field.key}>
            <th scope="row">{field.label}</th>
            <td>{field.value * 100}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CreatureDetails({ creature }: CreatureDetailsProps) {
  return (
    <section className="card" aria-labelledby="details-heading">
      <h2 id="details-heading">
        {creature.name} <span className="category">{creature.category}</span>
      </h2>
      <dl className="facts">
        <div>
          <dt>Era</dt>
          <dd>{displayValue(creature.era)}</dd>
        </div>
        <div>
          <dt>Diet</dt>
          <dd>{displayValue(creature.diet)}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{displayValue(creature.size)}</dd>
        </div>
      </dl>
      <HabitatTable habitat={creature.habitat} />
    </section>
  );
}
