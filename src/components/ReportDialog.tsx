import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { CATEGORIES, type Category, type Creature } from '../domain/model';
import {
  buildIssueUrl,
  buildMissingReport,
  buildStatReport,
  formatPercent,
  type HabitatEntries,
  type ReportDraft,
  type StatCorrection,
} from '../domain/report';
import { compareText } from '../domain/text';
import { HABITAT_FIELDS } from '../domain/workbook';

type ReportKind = 'stat' | 'missing';

interface CorrectionRow extends StatCorrection {
  /** Stable React key that survives edits and removals. */
  rowId: number;
  /** Changing mode: offer only stats with a recorded value. */
  recordedOnly: boolean;
}

function sortCreatures(creatures: Creature[]): Creature[] {
  return [...creatures].sort(
    (a, b) => compareText(a.name, b.name) || compareText(a.category, b.category) || compareText(a.id, b.id),
  );
}

/** Modal dialog for reporting a wrong stat or a missing dinosaur. Closes with Escape or the Close button. */
export function ReportDialog({ creatures, onClose }: { creatures: Creature[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ReportKind>('stat');

  useEffect(() => {
    // Remember the opener so focus returns to it once the dialog is removed.
    const opener = document.activeElement;
    dialogRef.current?.showModal();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="report-dialog" aria-labelledby="report-heading" onClose={onClose}>
      <div className="report-dialog-header">
        <h2 id="report-heading">Report a problem</h2>
        <button type="button" onClick={() => dialogRef.current?.close()}>
          Close
        </button>
      </div>
      <p className="hint">
        Reports open as a pre-filled GitHub issue on the project repository. Submit it there so the owner can review
        it before the workbook is updated.
      </p>
      <p className="hint">
        Report missing dinosaurs or incorrect dinosaur needs values.
      </p>
      <div className="report-type" role="group" aria-label="Report type">
        <button type="button" aria-pressed={kind === 'stat'} onClick={() => setKind('stat')}>
          Report a stat issue
        </button>
        <button type="button" aria-pressed={kind === 'missing'} onClick={() => setKind('missing')}>
          Report a missing dinosaur
        </button>
      </div>
      {kind === 'stat' ? <StatIssueForm creatures={creatures} /> : <MissingDinosaurForm creatures={creatures} />}
    </dialog>
  );
}

interface HabitatFieldsProps {
  idPrefix: string;
  legend: string;
  entries: HabitatEntries;
  onChange: (key: string, value: string) => void;
}

function HabitatFields({ idPrefix, legend, entries, onChange }: HabitatFieldsProps) {
  return (
    <fieldset className="report-fields">
      <legend>{legend}</legend>
      <div className="report-grid">
        {HABITAT_FIELDS.map((field) => {
          const id = `${idPrefix}-${field.key}`;
          return (
            <div className="report-field" key={field.key}>
              <label htmlFor={id}>{field.label}</label>
              <input
                id={id}
                type="number"
                min={0}
                max={100}
                step="any"
                inputMode="decimal"
                placeholder="%"
                value={entries[field.key] ?? ''}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Lists the recorded values for the chosen dinosaur. Blank values are left out. */
function CurrentValues({ creature }: { creature: Creature | null }) {
  if (!creature) return <p className="hint">Choose a dinosaur to see its current dinosaur needs values.</p>;

  const recorded = HABITAT_FIELDS.flatMap((field) => {
    const value = creature.habitat[field.key];
    return value === null || value === undefined ? [] : [{ key: field.key, label: field.label, value }];
  });
  if (recorded.length === 0) {
    return <p className="hint">No dinosaur needs values are recorded for this dinosaur.</p>;
  }

  return (
    <dl className="current-values">
      {recorded.map((item) => (
        <div key={item.key}>
          <dt>{item.label}</dt>
          <dd>{formatPercent(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface ReportFooterProps {
  draft: ReportDraft;
  attempted: boolean;
}

/** Shows validation errors after the first submit attempt, a preview, and the submit button. */
function ReportFooter({ draft, attempted }: ReportFooterProps) {
  return (
    <div className="report-footer">
      {attempted && draft.errors.length > 0 && (
        <ul className="report-errors" role="alert">
          {draft.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {draft.body && (
        <details>
          <summary>Preview issue text</summary>
          <p className="muted">Title: {draft.title}</p>
          <pre className="report-preview">{draft.body}</pre>
        </details>
      )}
      <button type="submit">Open GitHub issue</button>
    </div>
  );
}

function openIssue(draft: ReportDraft) {
  window.open(buildIssueUrl(draft), '_blank', 'noopener,noreferrer');
}

/** Default correction rows: one when adding a stat, two when changing one. */
const ADDING_ROWS = 1;
const CHANGING_ROWS = 2;

function StatIssueForm({ creatures }: { creatures: Creature[] }) {
  const formId = useId();
  const sorted = useMemo(() => sortCreatures(creatures), [creatures]);
  const nextRowId = useRef(0);
  const [creatureId, setCreatureId] = useState('');
  const [changing, setChanging] = useState(false);
  const [rows, setRows] = useState<CorrectionRow[]>(() => createRows(ADDING_ROWS));
  const [attempted, setAttempted] = useState(false);

  const creature = sorted.find((item) => item.id === creatureId) ?? null;
  const draft = buildStatReport(creature, rows);
  const chosenKeys = new Set(rows.map((row) => row.key));

  function createRow(recordedOnly: boolean): CorrectionRow {
    nextRowId.current += 1;
    return { rowId: nextRowId.current, key: '', value: '', recordedOnly };
  }

  function createRows(count: number): CorrectionRow[] {
    return Array.from({ length: count }, () => createRow(false));
  }

  /** Changing mode adds rows in pairs: every stat, then only recorded stats. */
  function createPair(): CorrectionRow[] {
    return [createRow(false), createRow(true)];
  }

  function handleChangingToggle(checked: boolean) {
    setChanging(checked);
    if (checked) {
      const missing = Math.max(0, CHANGING_ROWS - rows.length);
      const added = Array.from({ length: missing }, (_, offset) => createRow(rows.length + offset === 1));
      setRows([...rows, ...added]);
      return;
    }
    // Drop trailing blank rows back to the adding default; rows with data are kept.
    let next = rows;
    while (next.length > ADDING_ROWS && next[next.length - 1].key === '' && next[next.length - 1].value === '') {
      next = next.slice(0, -1);
    }
    setRows(next);
  }

  function addRow() {
    const added = changing ? createPair() : createRows(1);
    setRows([...rows, ...added]);
  }

  function availableStats(row: CorrectionRow) {
    const recordedOnly = changing && row.recordedOnly && creature !== null;
    return HABITAT_FIELDS.filter((field) => {
      if (field.key === row.key) return true;
      if (chosenKeys.has(field.key)) return false;
      return !recordedOnly || creature?.habitat[field.key] != null;
    });
  }

  function updateRow(rowId: number, changes: Partial<StatCorrection>) {
    setRows((previous) => previous.map((row) => (row.rowId === rowId ? { ...row, ...changes } : row)));
  }

  function removeRow(rowId: number) {
    setRows((previous) => previous.filter((row) => row.rowId !== rowId));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (draft.errors.length === 0) openIssue(draft);
  }

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <div className="report-select">
        <label htmlFor={`${formId}-creature`}>Dinosaur</label>
        <select
          id={`${formId}-creature`}
          value={creatureId}
          onChange={(event) => {
            setCreatureId(event.target.value);
            setRows(createRows(changing ? CHANGING_ROWS : ADDING_ROWS));
          }}
        >
          <option value="">Choose a dinosaur</option>
          {sorted.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.category})
            </option>
          ))}
        </select>
      </div>

      <div className="report-check">
        <input
          id={`${formId}-changing`}
          type="checkbox"
          checked={changing}
          onChange={(event) => handleChangingToggle(event.target.checked)}
        />
        <label htmlFor={`${formId}-changing`}>Changing an existing stat</label>
        <span className="hint">Unchecked means adding a stat.</span>
      </div>

      <section className="report-section" aria-labelledby={`${formId}-current`}>
        <h3 id={`${formId}-current`} className="report-subheading">
          Current values
        </h3>
        <CurrentValues creature={creature} />
      </section>

      <section className="report-section" aria-labelledby={`${formId}-corrections`}>
        <h3 id={`${formId}-corrections`} className="report-subheading">
          Corrections
        </h3>
        {rows.length === 0 && <p className="hint">No corrections added yet.</p>}
        {rows.map((row) => {
          const rowId = `${formId}-row-${row.rowId}`;
          const recorded = creature && row.key ? creature.habitat[row.key] : undefined;
          const recordedText =
            recorded === undefined ? null : recorded === null ? 'Not specified' : formatPercent(recorded);
          return (
            <div className="correction-row" key={row.rowId}>
              <div className="report-select">
                <label htmlFor={`${rowId}-stat`}>Stat</label>
                <select
                  id={`${rowId}-stat`}
                  value={row.key}
                  onChange={(event) => updateRow(row.rowId, { key: event.target.value })}
                >
                  <option value="">Choose a stat</option>
                  {availableStats(row).map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="report-select">
                <label htmlFor={`${rowId}-value`}>Corrected value (%)</label>
                <input
                  id={`${rowId}-value`}
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  placeholder="%"
                  value={row.value}
                  onChange={(event) => updateRow(row.rowId, { value: event.target.value })}
                />
                {recordedText && <span className="hint">Current: {recordedText}</span>}
              </div>
              <div className="correction-action">
                <span aria-hidden="true">&nbsp;</span>
                <button type="button" onClick={() => removeRow(row.rowId)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className="add-correction" onClick={addRow}>
          Add a stat correction
        </button>
      </section>

      <ReportFooter draft={draft} attempted={attempted} />
    </form>
  );
}

function MissingDinosaurForm({ creatures }: { creatures: Creature[] }) {
  const formId = useId();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'' | Category>('');
  const [entries, setEntries] = useState<HabitatEntries>({});
  const [attempted, setAttempted] = useState(false);

  const draft = buildMissingReport({ name, category, entries }, creatures);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (draft.errors.length === 0) openIssue(draft);
  }

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <div className="report-select">
        <label htmlFor={`${formId}-name`}>Dinosaur name (required)</label>
        <input
          id={`${formId}-name`}
          type="text"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="report-select">
        <label htmlFor={`${formId}-category`}>Category (optional)</label>
        <select
          id={`${formId}-category`}
          value={category}
          onChange={(event) => setCategory(event.target.value as '' | Category)}
        >
          <option value="">Not sure</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <HabitatFields
        idPrefix={`${formId}-missing`}
        legend="Dinosaur needs values (optional; leave blank if unknown)"
        entries={entries}
        onChange={(key, value) => setEntries((previous) => ({ ...previous, [key]: value }))}
      />
      <ReportFooter draft={draft} attempted={attempted} />
    </form>
  );
}
