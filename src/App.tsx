import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CreatureCombobox } from './components/CreatureCombobox';
import { CreatureDetails } from './components/CreatureDetails';
import { DataNotices } from './components/DataNotices';
import { RecommendationView } from './components/RecommendationView';
import { ReportDialog } from './components/ReportDialog';
import { loadWorkbookData } from './data/loadWorkbookData';
import type { GeneratedWorkbook } from './domain/model';
import { recommendForCreature } from './domain/recommend';
import { REPORT_REPOSITORY } from './domain/report';
import { buildIndex } from './domain/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GeneratedWorkbook };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadWorkbookData().then(
      (data) => {
        if (active) setLoad({ status: 'ready', data });
      },
      (error: unknown) => {
        if (active) {
          setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (load.status === 'loading') {
    return (
      <Shell>
        <p role="status">Loading workbook data...</p>
      </Shell>
    );
  }
  if (load.status === 'error') {
    return (
      <Shell>
        <p role="alert">
          Could not load workbook data: {load.message}. Run <code>npm run data</code> and reload the page.
        </p>
      </Shell>
    );
  }
  return <Planner data={load.data} />;
}

function Shell({ children, headerAction }: { children: ReactNode; headerAction?: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <h1>JW3 Dino Cohabitation Planner</h1>
        {headerAction}
      </header>
      <main className="app-main">
        <p className="intro">
          JW3 Dino Cohabitation Planner (JWE3) helps you plan dinosaur cohabitation and build habitats for Jurassic World
          Evolution 3. Pick a dinosaur to see its best cohabitation match.
        </p>
        {children}
      </main>
      <footer className="app-footer">
        <a href={`https://github.com/${REPORT_REPOSITORY}`} target="_blank" rel="noreferrer">
          View source on GitHub
        </a>
      </footer>
    </>
  );
}

function Planner({ data }: { data: GeneratedWorkbook }) {
  const { workbook } = data;
  const index = useMemo(() => buildIndex(workbook.creatures), [workbook.creatures]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const result = useMemo(
    () => (selectedId ? recommendForCreature(selectedId, index, workbook.notes) : null),
    [selectedId, index, workbook.notes],
  );

  return (
    <Shell
      headerAction={
        <button type="button" className="header-action" aria-haspopup="dialog" onClick={() => setReportOpen(true)}>
          Report a problem
        </button>
      }
    >
      <section className="card" aria-labelledby="pick-heading">
        <h2 id="pick-heading">Choose a dinosaur</h2>
        {workbook.creatures.length === 0 ? (
          <p role="alert">The workbook contains no dinosaurs. Check the source file and run npm run data.</p>
        ) : (
          <CreatureCombobox creatures={workbook.creatures} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </section>

      {result ? (
        <>
          <CreatureDetails creature={result.selected} />
          <RecommendationView result={result} />
        </>
      ) : (
        <p className="empty">Select a dinosaur to see its best cohabitation match.</p>
      )}

      {reportOpen && <ReportDialog creatures={workbook.creatures} onClose={() => setReportOpen(false)} />}

      <DataNotices workbook={workbook} />
    </Shell>
  );
}
