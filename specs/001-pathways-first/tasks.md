# Tasks: Pathways First

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md),
[UI/file contract](contracts/ui-and-files.md), [test matrix](test-matrix.md).

Checked items are the planning/placeholder work actually delivered in this PR.
Unchecked items are future implementation or release gates, not completed features.
Only US1 is authorised for application changes in this pass.

## Phase 1: Setup

- [x] T001 Initialise the tracked Codex Spec Kit workflow in `.specify/` and `.agents/skills/`; record the installed CLI version in `specs/001-pathways-first/research.md`.
- [x] T002 Write the constitution, specification, design and dependency-ordered plan in `.specify/memory/constitution.md` and `specs/001-pathways-first/`.
- [x] T003 Document current/proposed journeys and prioritised issues in `docs/pathways-journeys.md` and `docs/pathways-ux-backlog.md`.

## Phase 2: Foundation for later implementation

US1 needs only the reviewed baseline; the remaining tasks block rule/mobile/export release.

- [ ] T004 Confirm launch exam/admission years, school-profile scope and named source reviewer in `specs/001-pathways-first/research.md` before changing public rule/year claims (FR-004, FR-005).
- [ ] T005 Record independent expected outcomes and dated official references in `tests/pathways/fixtures/rules.json`, covering incomplete inputs, mixed levels, fail boundaries and profile restrictions (FR-003, FR-004, FR-005, FR-011).
- [ ] T006 Add a meaningful runner in `tests/pathways/rules.test.mjs` that checks the reviewed fixtures against Pathways evaluation; extract a pure evaluator only if necessary, preserving behaviour in `index.html` (FR-011).

## Phase 3: US1 — Available product and Atlas placeholder (P1)

**Independent test**: Root remains directly usable as Pathways; Atlas has readable grey
coming-soon status, no action target and no clipping in the availability section.

- [x] T007 [US1] Add the current Pathways and non-interactive Atlas availability entries in `index.html` without changing evaluation or saving scripts (FR-001, FR-002).
- [x] T008 [US1] Verify availability at 320, 375 and 1440 CSS pixels and record current-PR evidence in `specs/001-pathways-first/test-matrix.md` (FR-001, FR-006, SC-001).

## Phase 4: US2 — Understand subject choices on mobile (P1)

**Independent test**: A fictional combination can be entered, understood and edited
with touch and keyboard, without turning missing choices into confident results.

- [ ] T009 [US2] Add primary-flow browser scenarios in `tests/pathways/journeys.spec.mjs` for incomplete/supported combinations, existing Save/reload/reset, blocked/corrupt storage and the mobile widths in FR-006; exercise meaningful user actions rather than mirroring markup (FR-003, FR-004, FR-006).
- [ ] T010 [US2] Make applicable years, simplified-model limits, unofficial-product notice, school-profile scope and source access visible across screen sizes in `index.html` (FR-002, FR-004, FR-005).
- [ ] T011 [US2] Improve subject controls, input validation, result explanations, keyboard/focus and return context in `index.html`; validate `loadSaved()` restoration and add truthful device-local Save/reset and recoverable storage-error feedback; validate the full FR-006 width/text/keyboard matrix (FR-003, FR-006).

## Phase 5: US3 — Destination-first exploration and comparison (P2)

**Independent test**: Search, inspect and compare two destinations; cancel or undo an
applied combination while retaining the current work.

- [ ] T012 [US3] Add reverse-search empty-state, compare and replacement scenarios in `tests/pathways/journeys.spec.mjs` (FR-007).
- [ ] T013 [US3] Improve the reverse-planning comparison and return behaviour in `index.html`, with deliberate apply/cancel or undo and readable phone labels/actions (FR-006, FR-007).

## Phase 6: US4 — Export, discuss and resume (P2)

**Independent test**: Export a partial/complete plan and readable summary, then restore
in a fresh context; invalid files and cancellation preserve current work.

- [ ] T014 [P] [US4] Add round-trip and invalid-file cases in `tests/pathways/plan-files.test.mjs`: format `string-pathways-plan`, integer schemaVersion `1`, 64 KiB maximum, reject unsupported fields/schema/profile and preserve work on error, immutable profile revisions, and canonical adapter cases (implicit taken, unset, None retaining level, stale failedGrade) from `specs/001-pathways-first/data-model.md` (FR-009, FR-010).
- [ ] T015 [P] [US4] Add summary content/pagination and fresh-context import scenarios in `tests/pathways/export.spec.mjs`, including unknown years, rules mismatch and cancellation (FR-008, FR-009).
- [ ] T016 [US4] Implement local plan validation/export/import in `index.html` or an extracted helper: version labels non-empty at most 64 characters, UTC ISO timestamp, years integer 2000–2100 or null, exactly eight unique slots 0–7, at most 100 distinct known comparison IDs, immutable versioned profile IDs and a canonical runtime-row adapter with subject/level/state rules from `specs/001-pathways-first/data-model.md`; preview and atomically replace only on confirmation (FR-009, FR-010).
- [ ] T017 [US4] Add readable print/PDF summary and clear export/import controls in `index.html`, including comparisons, limitations, sources, rules/build labels and partial/unconfirmed states; verify on phone browsers (FR-008, FR-010).

## Phase 7: Cross-cutting verification and release

- [ ] T018 Run the full implemented journey/fixture suite, keyboard/text/physical-device checks and network privacy checks; record browser versions and results in `specs/001-pathways-first/test-matrix.md` (FR-002, FR-006, FR-010, FR-011, SC-002, SC-003, SC-004).
- [ ] T019 Run the proposed five-person parent/youth pilot and record task completion and understanding of admissions limits in `docs/pathways-pilot.md`; target at least four unassisted completions without claiming population-wide validation (SC-005).
- [ ] T020 Reconcile delivered behaviour in `README.md`, `docs/pathways-journeys.md` and `docs/pathways-ux-backlog.md`; verify intended production deployment separately before claiming publication (FR-002, FR-004).

## Dependencies and Execution Order

T001–T003 establish the planning baseline. US1 T007–T008 can ship independently and
do not depend on admissions-rule research. After plan review, T004 → T005 → T006
precedes any rule changes. US2 follows that foundation; US3 and US4 follow the agreed
state vocabulary. T014 and T015 can run in parallel in different files. Implement
T016 before integrating T017, then complete T018 → T019 → T020 for release.

For US2, implement T010/T011 after T009 defines the meaningful journey checks. US3
uses the same `index.html` and journey-test file, so coordinate it after US2 rather
than marking conflicting edits parallel. US4 file tests can be written independently
of its summary browser tests; integration into `index.html` remains sequential.

## Implementation Strategy

This PR delivers setup and the availability placeholder only. After review, deliver
one journey at a time: trust and mobile subject planning, reverse planning, then local
exports. GA4 gets a later bounded measurement spec after domain/stream/privacy decisions;
Neon, account saving, Atlas launch and engine consolidation remain deferred.
