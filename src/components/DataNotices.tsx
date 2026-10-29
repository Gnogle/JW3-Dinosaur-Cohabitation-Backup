import type { ParsedWorkbook } from '../domain/model';

export function DataNotices({ workbook }: { workbook: ParsedWorkbook }) {
  return (
    <details className="card">
      <summary>Data sources and notices</summary>
      <table>
        <caption>Dino Data loaded</caption>
        <thead>
          <tr>
            <th scope="col">Habitat type</th>
            <th scope="col">Dinosaur count</th>
            <th scope="col">Dinosaur needs</th>
          </tr>
        </thead>
        <tbody>
          {workbook.sheets.map((sheet) => (
            <tr key={sheet.name}>
              <th scope="row">{sheet.name}</th>
              <td>{sheet.creatureCount}</td>
              <td>{sheet.habitatFields.length > 0 ? sheet.habitatFields.join(', ') : 'None'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Similarity formula</h3>
      <p className="formula">
        Similarity = 1 - mean of |selected - candidate| over the dinosaur needs fields that have a number on both records (at
        least 2 required). Blank values are excluded, not treated as 0. Records from different sheets are not compared.
        Lagoon has no dinosaur needs fields, so Lagoon records are never scored.
      </p>

      <h3>Warnings</h3>
      {workbook.warnings.length === 0 ? (
        <p className="muted">No warnings.</p>
      ) : (
        <ul>
          {workbook.warnings.map((warning, index) => (
            <li key={index}>
              [{warning.level}] {warning.sheet ? `${warning.sheet}${warning.row ? ` row ${warning.row}` : ''}: ` : ''}
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
