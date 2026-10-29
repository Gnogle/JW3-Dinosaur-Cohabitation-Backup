# JW3 Dino Cohabitation Planner

A small React app that lets you pick a dinosaur from the JW3 workbook, shows its dinosaur needs, and recommends the eligible liked dinosaur with the most similar dinosaur needs requirements.

The workbook `JW3 Dino Habitat Planner.xlsx` (sheets `Land`, `Aviary`, `Lagoon`) is the source of the dinosaurs data. The workbook is read only at build time and is never modified.

## Setup

Requires Node.js 22 or later.

```
npm install
```

## Run

```
npm run dev        # development server
npm run build      # typecheck, then production build into dist/
npm run preview    # serve the production build
npm run typecheck  # TypeScript check only
npm test           # Vitest unit and data tests
```

## Workbook and data refresh

The app loads `src/data/creatures.generated.json`, which is generated from the workbook. To rebuild it after the workbook changes:

```
npm run data
```

This reads `JW3 Dino Habitat Planner.xlsx` from the project root. To use another file, pass its path: `npm run data -- "path\to\other.xlsx"`. The generator writes the JSON with a SHA-256 of the source file, and the data test checks that hash against the workbook when the workbook is present.

Dinosaur data is not hardcoded in the UI or the domain code.

## How matching works

1. **Find the selected record.** Each dinosaur has a stable id `Sheet:row` (for example `Land:45`). Duplicate names are shown with their category.
2. **Interpret Likes.** Each Likes cell is split on line breaks and trimmed. Each entry is classified in this order:
   - a dinosaur name (case-insensitive) is an explicit liked dinosaur;
   - a name that matches two or more records is ambiguous and is reported as unresolved, not chosen;
   - a Size or Diet value (for example `Medium`, `Carnivore`) is a group value. It is shown but not used for matching;
   - anything else is unresolved (for example the typo `Stegpceratpops`). Typos are not corrected.
3. **Filter by Dislikes.** A candidate is excluded when the selected dinosaur dislikes it, or it dislikes the selected dinosaur. Dislikes are checked by name and by group (Size, Diet). Unresolved dislike entries (for example `Everything`) are listed but not applied.
4. **Compare dinosaur needs.** Only comparable dinosaur needs are used:
   - Land and Aviary records are compared only within the same sheet, and only on dinosaur needs that are numeric on both records.
   - Records from different sheets are never compared.
   - Lagoon has no dinosaur needs, so Lagoon records are never scored.
5. **Choose the best match.** Among scored candidates, the highest similarity wins. Ties are broken by name, then by id. Tied candidates are listed.

### Scoring formula

For a candidate, let $S$ be the set of dinosaur needs that are numeric on both records, with $|S| \ge 2$. Then

$$\text{similarity} = 1 - \frac{1}{|S|}\sum_{f \in S} \left| a_f - b_f \right|$$

Every dinosaur need value is in the range 0 to 1, so similarity is between 0 and 1. A score of 1 means identical needs on the shared dinosaur needs.

- A blank cell means not specified. It is excluded from $S$ and is never treated as 0.
- An explicit `0` is a real value and is compared.
- If fewer than two dinosaur needs are shared, the candidate is shown as unscored with the reason.

## Interface

- A searchable combobox lists every dinosaur with its category. It supports arrow keys, Enter, and Escape.
- The details panel shows the name, category, era, diet, size, and a Dinosaur Needs table. Blank dinsoaur need values are omitted from the table.
- The recommendation panel shows a status heading and message. The message explains when no explicit liked dinosaur was found, when every liked dinosaur is excluded, when no dinosaur need match can be scored, and when candidates tie on similarity. For each scored candidate it shows a match block with both creatures' recorded needs. A table lists every liked dinosaur with its outcome (scored, not scored, or excluded), its similarity, and either the number of shared dinosaur needs or the reason it was not scored.
- The data panel lists the sheets, the dinosaur needs used per sheet, the similarity formula, and the loading warnings.

## Reporting problems

Click **Report a problem** at the top right of the page to open the report dialog. Close it with the Close button or Escape. Both forms open a pre-filled GitHub new-issue page on the project repository. The app does not store or send anything itself. You submit the issue on GitHub (a GitHub account is required), and the owner reviews it before the workbook is changed.

- **Report a stat issue**: choose a dinosaur and review its recorded values under Current values. Tick **Changing an existing stat** to correct a stat that already has a value, or leave it unticked to add a stat that is missing.
  - Adding (unticked): the form starts with one correction row, and Add a stat correction adds one row.
  - Changing (ticked): the form starts with two correction rows. The second row lists only stats that have a recorded value for that dinosaur. Add a stat correction adds a pair of rows in the same format.
  - Pick a stat from the list and enter the corrected percentage (0 to 100). Each stat can appear once. Remove a row with its Remove button.
- **Report a missing dinosaur**: enter a name (required). The category and all dinosaur needs values are optional. Leave a value blank if it is unknown.

A preview of the issue text is available before submitting. Invalid input shows an error and no issue is opened.

The report logic is in `src/domain/report.ts` and is covered by `tests/report.test.ts`.

## Known data issues

These are shown or handled as described above. They are not corrected in the data.

- 20 distinct Likes and Dislikes entries do not match a dinosaur name, Size value, or Diet value in the current workbook. They are unresolved and not applied. Examples include `Amargasaurus`, `Carcharodontosaurus`, `Titanosaurus`, `Tarbosaurus`, and `Torosaurus`.
- The workbook has no Family column, and the app has no family-based rules. An entry that names a family is unresolved.
- Most of the 18 Land records with dinosaur needs values do not sum to exactly 1, typically by 0.01 from rounding. Four differ more: Psittacosaurus (1.24), Parasaurolophus (0.90), Deinocheirus (0.48), and Lystrosaurus (1.02). Values are used as given.
- Lagoon has no dinosaur data, so no Lagoon dinosaur score exists.

## Limitations

- Typos and unresolved names are not guessed. A liked or disliked name that does not exactly match a record is not applied.
- The Likes and Dislikes lists are not displayed in the UI. Matching still uses them, but the unresolved and group entries that were classified are not shown on the page.
- The Land notes column (about Therizinosaurs and carnivores) is read as an annotation but is not displayed.
- The workbook's notes are not displayed in the data panel.
- The similarity score compares only the dinosaur needs recorded in the workbook. It does not model game rules beyond the Likes and Dislikes entries.
- `npm audit` reports one high-severity vulnerability in `xlsx` (two advisories, no fix available). `xlsx` is used only by `npm run data` on a trusted local workbook. `npm audit --omit=dev` (runtime dependencies) reports no vulnerabilities.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs on every push to `main` and can also be started from the Actions tab. It runs the tests, builds the app, and publishes `dist/` to GitHub Pages.

- In the repository settings, set Pages > Build and deployment > Source to **GitHub Actions**.
- CI builds from the committed `src/data/creatures.generated.json`. The `.xlsx` is git-ignored and is not needed in CI. After the workbook changes, run `npm run data` and commit the regenerated JSON.
- `vite.config.ts` sets the base path to `/JW3-Dinosaur-Cohabitation/` only when `GITHUB_ACTIONS` is set. Local `npm run dev` and `npm run preview` use `/`.

## Project layout

- `src/domain/`: pure logic (parsing, token classification, dislikes, dinosaur needs comparison, recommendation, report building). No React.
- `src/data/`: generated JSON, loader, and runtime validation.
- `src/components/`: combobox, details, recommendation, data, and report panels.
- `scripts/`: workbook reader and data generator.
- `tests/`: Vitest tests for each domain module and the generated data.

## Stack

React 19 and Vite 8 for the UI and build, TypeScript pinned to the 5.9 line (`~5.9`), Vitest for tests, and `xlsx` at build time to read the workbook.
