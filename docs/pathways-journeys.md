# Pathways user journeys

Planning baseline, 28 October 2026. Audience: parents and invested youth exploring subject choices together. Pathways is the first product to develop; Atlas has a grey **Coming soon** placeholder in the shared entry area. Its existing prototype and attribution remain in `student-pathway-atlas/` for later work.

This document separates source-observed behaviour from proposed acceptance criteria. It does not certify admissions rules or report completed feature work.

## Source and ownership

- [`index.html`](../index.html): `SUB`, `PATHS`, `evaluate()`, `COURSES_DATA`, `renderRows()`, `setMobTab()`, `setReverseMode()`, `loadSaved()`, `toggleCompare()`, `loadCourseIntoSubjects()`.
- [`README.md`](../README.md): prototype status, local opening instructions, intended benchmarking and attribution.
- [`student-pathway-atlas/README.md`](../student-pathway-atlas/README.md): the separate results-day Atlas prototype and its stated coverage; those claims have not been independently verified here.
- Preserve **Evan Liao** for the Sec 2 adaptation, reverse planning and interface; **Mathew Lim** for the original explorer, evaluation model and baseline data; **Koo Tiannuo** for Atlas. Keep original in-app credits identifiable when sharing components.

## Product contract to agree before implementation

- Exploration requires no login or String ID. Subject entries and saved plans stay on the device or in a file the user chooses to export.
- A parent and young person can understand an option, change an assumption, and discuss a next step. This is planning guidance; an output is not an admission offer or assurance of posting.
- Separate **examination year**, **admissions/intake year**, and **ruleset version**. The current heading says SEC 2028; it is not evidence that every embedded rule has been verified for that cohort.
- Make school scope explicit. Current subject options and science limits include school-specific assumptions; they must not silently become rules for every Singapore school.
- Validate factual requirements against dated official sources before accepting expected test outcomes. Record reviewed date, reviewer, source URL, applicable cohort and any estimate or unsupported case.

## J1 — Understand what this tool can help with

**Goal:** A parent/youth arriving on a phone understands Pathways, its cohort and its limits before entering a plan.

**Current:** `#mainView` supports subject-first exploration. `#rpOpen` switches to destination-first planning. The header states that this is not an MOE webapp, but `header p.subhead` is hidden by the mobile media rule. The review branch adds the Pathways/Atlas entry area.

**Proposed acceptance:**

- Given a first visit, the user can distinguish subject planning from a results-day eligibility tool, and sees Pathways as available and Atlas as Coming soon.
- The prototype/independent-tool notice and supported cohort remain readable on mobile. Official-source links and credits remain reachable.
- No login gate or misleading enabled Atlas action appears. Placeholder styling conveys status through text as well as grey colour.

## J2 — Explore how a subject combination changes options

**Goal:** Understand how selecting subjects at G1/G2/G3 affects possible routes, without needing an exact final results slip.

**Current:** `#rows` and `renderRows()` provide subject/level/pass-fail controls and electives. Presets populate sample combinations. `evaluate()` feeds prerequisite results and missing conditions into `#okCards` and `#badCards`. Mobile uses `setMobTab()` to move between subjects and results. The footer explains the pass/fail simplification.

**Proposed acceptance:**

- Given blank inputs, results explain what is missing; an unset field does not silently become a pass or a final rejection.
- Given a valid synthetic combination, changing one input updates the relevant explanation and counts consistently across mobile and desktop views.
- The user can distinguish a subject prerequisite, a simplified assumption, a required aggregate, a course-specific requirement and a competitive posting outcome.
- Invalid/duplicate subject selections and school-specific availability are explained at the input. Allowed combinations follow the selected, versioned school profile.
- Returning from results preserves the working combination and makes the changed control easy to find.

**Tests to specify:** blank/partial inputs; mixed levels; absent subjects; duplicate electives; pure/combined science; a boundary immediately above/below each verified requirement; preset/edit/reset; mobile subject → results → subjects.

## J3 — Start from an interest or destination

**Goal:** A young person explores a field, understands prerequisites and tries a suitable subject scenario.

**Current:** `#rpView`, `#rpSearchInput`, `#rpFilters`, `renderBubbles()` and `openInspector()` browse/search embedded course clusters and requirements. `loadCourseIntoSubjects()` replaces the working rows with `recommendedCombi`, writes them to local storage, and returns to subject planning. It does not preview the replacement or preserve the previous plan.

**Proposed acceptance:**

- Given a field or category, results identify the scope of each destination and explain an empty search with a clear recovery action.
- Details distinguish broad course clusters, specific courses, prerequisites and illustrative subject combinations. Each factual claim has the applicable source/version or an explicit unverified label.
- Before applying a suggested combination over existing work, show what will change and allow cancellation or recovery of the previous plan.
- A suggested combination is presented as an example to explore, with school availability checked separately. It is not described as the only way to reach a destination.
- Returning to discovery or subject planning retains the user's relevant context; focus and scroll position remain usable on a small screen.

**Tests to specify:** filter plus search; no matches; inspect/close; apply to blank plan; replace/cancel/recover an existing plan; unsupported destination/ruleset.

## J4 — Compare possible destinations

**Goal:** A parent and young person compare options using consistent, understandable criteria.

**Current:** `compareList` is held in memory. `toggleCompare()` adds/removes destinations; `renderCompareTable()` shows metrics, subject requirements and combinations in `#rpCompareTableWrap`. `.rp-compare-table` has a 600px minimum width inside a horizontal scrolling region. The Save button does not save the comparison list.

**Proposed acceptance:**

- Add/remove/clear actions update the badge, inspector and comparison view consistently; empty comparison provides a useful next action.
- The supported comparison size is explicit. Criteria retain their labels on mobile; content is readable without clipping primary actions or causing page-wide horizontal overflow.
- Different cohorts, estimates or school assumptions are visible rather than compared as equivalent facts.
- A comparison can be included in the planned summary/export; its persistence behaviour is explained.

**Tests to specify:** zero/one/multiple items; repeated add/remove; long labels; comparison after filtering; mobile and keyboard access to every criterion and action.

## J5 — Save, discuss and reopen a plan

**Goal:** Keep a plan without an account, share a readable summary with family, and reopen an editable copy later.

**Current:** `#save` writes subject rows under `sec_pathway_grades`; `loadSaved()` restores a compatible row count. `#reset` clears the subject save. Storage failures are caught without a user-facing explanation. There is no plan-file import/export or dedicated summary PDF flow in the source.

**Proposed acceptance:**

- Explain that browser Save is local to this browser/device and can be removed by Reset or browser data clearing. Show success or a recoverable storage error truthfully.
- Offer a readable summary PDF, initially through a tested print/save-to-PDF layout, and a separate structured plan-file export for reopening. PDF import is outside the initial scope.
- The summary includes subject assumptions, selected destinations/comparison, limitations, source references, creation date, exam year, admissions year, ruleset version and app version. Names and contact details are not required.
- The structured file has an explicit schema version and the same cohort/rules provenance, plus the subject and comparison state needed for a round trip. Saving uses local browser/file APIs; Neon is unnecessary for this journey.
- Import validates file size, format, schema, allowed subject keys/levels and field types before changing a plan. Unknown future schemas and malformed files produce readable errors and preserve existing work.
- Preview a valid import before replacement. If its ruleset differs, explain the mismatch and require an explicit supported recalculation choice. Profile identifiers are immutable/versioned; reject incompatible profiles unless a tested migration is explicitly supported. Use the normalised effective-state adapter in the data model when serialising runtime rows, rather than exporting stale hidden fields. Do not present an imported result snapshot as freshly verified output.
- Import/export works without uploading the plan. A user can inspect/share/delete the exported file themselves.

**Tests to specify:** save/reload/reset; blocked/corrupt storage; structured export/import round trip; malformed/oversize/future-version files; mismatched cohort/rules; cancelled import; PDF pagination, long subject names, comparison and source links.

## Cross-journey acceptance and measurement

- Test core journeys at 320, 375, 390 and 768 CSS px, plus desktop, portrait/landscape and 200% zoom. Primary text/actions must remain readable and unclipped; wide data regions require a labelled usable alternative or intentional local scrolling.
- Provide readable control labels, visible keyboard focus, logical focus order, usable touch targets, working dialog close/return focus, and clear back actions. Browser Back must not unexpectedly discard entered work; define and test its relationship to internal modes.
- Use synthetic plans for tests and screenshots. Each rule fixture records its official source and version; passing regression tests alone does not verify admissions accuracy.
- Plan hosted-production-only GA4 for coarse journey counts, such as `planning_mode_open`, `comparison_open`, `summary_export` and `plan_import_complete`, with allowlisted mode/format/count buckets only. Do not send subjects, grades, search text, plan contents, filenames or plan identifiers.
- GA property/stream choice, consent behaviour, stream-level automatic collection settings, payload inspection, duplicate prevention and received-event checks remain implementation gates. Local files, localhost and previews must not collect production analytics.

## Decisions still to settle

Confirm supported examination/admissions cohort, general versus selected-school profiles, reviewed rules/source owner, the proposed limit of 100 comparison entries, and the PDF plus editable plan-file format before implementation. The format and numeric limits are design defaults for review, not additional user decisions already made.
