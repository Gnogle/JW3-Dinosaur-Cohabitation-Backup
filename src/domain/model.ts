export const CATEGORIES = ['Land', 'Aviary', 'Lagoon'] as const;
export type Category = (typeof CATEGORIES)[number];

export type GroupType = 'Size' | 'Diet';

export interface Creature {
  /** Stable key: sheet name and 1-based sheet row, e.g. "Land:12". */
  id: string;
  name: string;
  nameKey: string;
  category: Category;
  sourceRow: number;
  diet: string | null;
  era: string | null;
  size: string | null;
  /** Trimmed Likes entries, one per line in the workbook cell. */
  likes: string[];
  /** Trimmed Dislikes entries, one per line in the workbook cell. */
  dislikes: string[];
  /** Keyed by normalized habitat field key. Null means blank (not specified), never zero. */
  habitat: Record<string, number | null>;
}

export interface DataWarning {
  level: 'info' | 'warning' | 'error';
  sheet: string | null;
  row: number | null;
  message: string;
}

export interface WorkbookNote {
  sheet: string;
  /** Column header the note came from. */
  column: string;
  /** 1-based sheet row, or null for a note carried by the column header itself. */
  row: number | null;
  text: string;
}

export interface SheetSummary {
  name: string;
  category: Category;
  creatureCount: number;
  habitatFields: string[];
}

export interface ParsedWorkbook {
  creatures: Creature[];
  sheets: SheetSummary[];
  warnings: DataWarning[];
  notes: WorkbookNote[];
}

export interface GeneratedWorkbook {
  meta: {
    sourceFile: string;
    sha256: string;
  };
  workbook: ParsedWorkbook;
}
