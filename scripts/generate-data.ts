import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGeneratedWorkbook } from '../src/data/validate';
import type { GeneratedWorkbook } from '../src/domain/model';
import { parseWorkbook } from '../src/domain/workbook';
import { readWorkbookSheets } from './read-workbook';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workbookPath = resolve(root, process.argv[2] ?? 'JW3 Dino Habitat Planner.xlsx');
const outputPath = resolve(root, 'src/data/creatures.generated.json');

const sha256 = createHash('sha256').update(readFileSync(workbookPath)).digest('hex');
const workbook = parseWorkbook(readWorkbookSheets(workbookPath));

const payload: GeneratedWorkbook = {
  meta: { sourceFile: basename(workbookPath), sha256 },
  workbook,
};
parseGeneratedWorkbook(payload);

const errors = workbook.warnings.filter((warning) => warning.level === 'error');
if (errors.length > 0) {
  for (const error of errors) console.error(`error: ${error.sheet ?? ''} ${error.message}`);
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

for (const sheet of workbook.sheets) {
  console.log(`${sheet.name}: ${sheet.creatureCount} creatures, habitat fields: ${sheet.habitatFields.length}`);
}
for (const warning of workbook.warnings) {
  console.log(`${warning.level}: ${warning.sheet ?? '-'}${warning.row ? `:${warning.row}` : ''} ${warning.message}`);
}
console.log(`notes: ${workbook.notes.length}`);
console.log(`Wrote ${outputPath}`);
