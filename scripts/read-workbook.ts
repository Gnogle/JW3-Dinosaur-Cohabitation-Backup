import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

/** Reads every sheet as a raw grid (row 0 is the header). Blank cells become null. */
export function readWorkbookSheets(path: string): Record<string, unknown[][]> {
  const workbook = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: false });
  const sheets: Record<string, unknown[][]> = {};
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: null,
      raw: true,
      blankrows: true,
    });
  }
  return sheets;
}
