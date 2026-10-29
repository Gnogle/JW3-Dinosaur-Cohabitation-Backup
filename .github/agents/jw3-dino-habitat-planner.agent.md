---
name: JW3 Dino Habitat Planner
description: Build and maintain an application that recommends a compatible dinosaur with the best-matching habitat requirements from the JW3 Dino Habitat Planner workbook.
---

# JW3 Dino Habitat Planner — Copilot Agent Instructions

## Mission

Build an application that lets a user choose a dinosaur/creature from a dropdown, identifies creatures that the selected creature likes, and recommends the eligible liked creature whose environmental requirements best match the selected creature.

Use the workbook `JW3 Dino Habitat Planner.xlsx` as the source of truth. Do not invent creature data, preferences, habitat values, or game rules. Preserve the distinctions between the `Land`, `Aviary`, and `Lagoon` sheets.

## Required user experience

1. Load the workbook data and show a searchable dropdown containing the available creatures. Include each creature's category/sheet (`Land`, `Aviary`, or `Lagoon`) so duplicate names, if any, can be distinguished.
2. After a selection, show:
   - the selected creature and its category;
   - its recorded `Likes` and `Dislikes`;
   - the recommended liked creature, or a clear explanation when no eligible recommendation can be made;
   - a comparison of the habitat requirements and a concise explanation of why the recommendation scored best.
3. Make the result reproducible and explainable. Do not silently choose a random creature. If multiple candidates tie, use a deterministic tie-break or show the tied options.
4. Handle missing values safely. A blank habitat value is **unknown/not specified**, not automatically zero. A numeric `0` is an explicit zero and must remain distinct from blank.
5. Provide useful empty, loading, and invalid-data states rather than crashing.

## Workbook structure to respect

The workbook has these sheets and known columns:

- **Land**: `DINO`, `Diet`, `Era`, `Size`, `Likes`, `Dislikes`, then habitat/food preference columns: `Arid`, `Barren`, `Cover`, `Pasture`, `Wetland`, `Water`, `Deep Water`, `Ground Leaf`, `Ground Fiber`, `Ground Fruit`, `Ground Nut`, `Tall leaf`, `Tall Fiber`, `Tall Fruit`, and a final explanatory notes column about Therizinosaurs and carnivores.
- **Aviary**: `DINO`, `Era`, `Size`, `Likes`, `Dislikes`, `Arid`, `Barren`, `Cover`, `Pasture`, `Wetland`, `Water`.
- **Lagoon**: `DINO`, `Diet`, `Era`, `Size`, `Likes`, `Dislikes`.

The sheets do not share an identical schema. Do not assume Lagoon has land habitat columns or that all creatures have the same set of environmental fields. Normalize column names carefully (including `Ground\nNut` and `Tall leaf`) for internal use while retaining the original labels for display where useful. Ignore the final Land notes column when computing habitat similarity; treat it as explanatory metadata.

## Matching logic

Implement the recommendation in explicit, testable stages:

1. **Find the selected record.** Identify it by a stable internal key, not just the displayed name.
2. **Interpret `Likes` conservatively.**
   - Split multi-value cells on line breaks and trim whitespace.
   - If a token exactly matches another creature's name (case-insensitive, after safe whitespace normalization), treat that record as an explicit liked-creature candidate.
   - Some `Likes` cells may contain values that are not creature names, such as size labels (`Small`, `Medium`) or other category labels (`Scavenger`). Do not pretend these are exact species names and do not infer undocumented meanings.
   - Where a token matches a known value such as a size category, only use it as a group preference if the app's behavior and workbook evidence support that interpretation. Clearly label this as a group/size-based match, distinct from an explicit species preference.
   - If the data cannot be interpreted confidently, explain that no explicit liked creature could be identified. Do not silently recommend an arbitrary creature.
3. **Filter candidates.** Respect explicit `Dislikes` entries and any clearly documented workbook rule that applies. Normalize multi-line lists. Do not invent extra compatibility rules. The Land sheet's notes column must be surfaced as a rule/annotation only when applicable; do not turn its wording into an unverified universal rule beyond what the workbook says.
4. **Compare habitat requirements only across comparable fields.**
   - For Land records, compare the habitat and vegetation/food preference fields that exist on both records.
   - For Aviary records, compare the shared environmental fields that exist on both records.
   - For Lagoon records, the workbook has no numerical habitat requirement columns. Do not fabricate environmental values or claim a habitat score from nonexistent fields. If no habitat data exists for Lagoon, say so and use only a clearly labeled supported fallback (or report that a habitat-based recommendation is unavailable).
   - Do not compare Land/Aviary/Lagoon numeric vectors as though they describe the same habitat system unless the application explicitly documents and tests a valid cross-category policy.
5. **Score habitat similarity transparently.**
   - Use only fields that have valid numeric values on both records.
   - Keep missing values separate from zero.
   - Normalize values if needed so the number or scale of fields does not unfairly dominate the score.
   - Prefer a straightforward, documented similarity/distance metric over an opaque heuristic. Document the formula in the UI or help text and in code comments.
   - If there are no comparable numeric habitat fields, mark the habitat score as unavailable rather than treating it as zero or inventing a score.
6. **Choose the best match.** Among eligible liked candidates with a valid habitat comparison, recommend the highest-similarity candidate (or lowest distance, depending on the chosen metric). Show the score and the fields compared. If no eligible candidate has comparable habitat data, explain why and do not present a fabricated “best habitat match.”

## Data integrity and robustness

- Read the actual workbook before implementing assumptions. Verify sheet names, headers, data types, row counts, and the representation of multi-value cells.
- Do not hardcode the current creature list or habitat values into the UI. Load them from the workbook or from a generated data file that can be rebuilt from it.
- Handle empty cells, unexpected values, duplicate names, malformed numbers, and unknown preference tokens.
- Keep parsing, candidate filtering, scoring, and UI presentation in separate modules/functions so each can be tested independently.
- Include tests for: a direct species-name like; a multi-line Likes cell; a size/category token; blank versus numeric zero; disliked candidate filtering; ties; missing habitat columns; Lagoon records with no numeric habitat data; and no eligible candidate.
- Avoid destructive edits to the source workbook. If generating derived data, preserve the original workbook unchanged.

## Development workflow

- First inspect the repository, existing code, package configuration, and the workbook. Reuse the project's existing stack and conventions if present; do not replace working infrastructure without a reason.
- If no project stack exists, choose a simple, maintainable approach suited to the repository and explain the choice in the README.
- Implement a working end-to-end vertical slice before adding optional features.
- Keep the app usable with keyboard navigation and accessible labels.
- Add a README with setup/run instructions, workbook location/configuration, how matching works, scoring formula, limitations, and how to refresh the data.
- Run available tests and build/lint checks. Fix failures caused by the changes. Report what was actually run and any remaining limitations; never claim checks passed unless they did.

## Scope discipline

Implement the application described above. Do not add unrelated features, external services, accounts, telemetry, or network dependencies unless the user explicitly requests them. If an essential product decision cannot be resolved from the workbook or existing repository, ask one concise question or document the uncertainty instead of inventing a rule.
