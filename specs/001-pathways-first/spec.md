# Feature Specification: Pathways First

**Feature Branch**: `codex/pathways-first-specs`

**Created**: 2026-10-28

**Status**: Draft for review; only the product availability placeholder is implemented here.

**Input**: Prioritise Pathways for parents and invested youth, show Atlas greyed out
as "Coming soon", document journeys and tests, improve mobile use, and save work by export.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know which tool is available (Priority: P1)

A visitor recognises Pathways as the current tool and Atlas as a future results-based
journey, then continues directly into subject planning.

**Why this priority**: Establish an honest first-release boundary without losing the
existing Pathways experience or the identity of either contributor-built prototype.

**Independent Test**: Open the public entry on a phone and desktop. Pathways is active;
Atlas is visibly unavailable and cannot navigate anywhere.

**Acceptance Scenarios**:

1. **Given** a new visitor, **When** the entry opens, **Then** Pathways is marked as
   current and its existing subject-planning controls remain available below it.
2. **Given** the Atlas entry, **When** a visitor reads or uses a keyboard to traverse
   the page, **Then** it says "Coming soon", uses muted grey styling with legible text,
   and presents no working link or control.
3. **Given** a narrow screen, **When** the entries reflow, **Then** both names and
   availability labels remain readable without horizontal scrolling.

### User Story 2 - Understand what subject choices keep open (Priority: P1)

A parent or young person selects subjects and levels, explores possible passes,
understands the explanation, and knows which official information to check next.

**Why this priority**: This is Pathways' core planning purpose. A simplified result
must not be mistaken for a confirmed admissions outcome.

**Independent Test**: Complete made-up subject combinations on a phone, change a level,
inspect the result and return to editing without losing the combination.

**Acceptance Scenarios**:

1. **Given** incomplete choices, **When** results are shown, **Then** incomplete inputs
   are identified and no unknown is silently treated as a pass or fail.
2. **Given** a complete supported combination, **When** results update, **Then** each
   pathway states the relevant prerequisites and the limits of the simplified model.
3. **Given** a phone or enlarged text, **When** using subject controls and explanations,
   **Then** essential actions and the unofficial-product notice remain reachable and readable.
4. **Given** school-specific subject availability, **When** exploring combinations,
   **Then** the profile's restrictions are explicit rather than presented as national rules.

### User Story 3 - Work backwards from a destination (Priority: P2)

A visitor explores a destination, inspects its subject requirements, compares options
and deliberately applies a suggested combination to the subject planner.

**Why this priority**: Connects interests to choices without requiring results-day data.

**Independent Test**: Search in reverse planning, inspect two destinations, compare
them, and apply a combination while retaining a clear way to return to the previous one.

**Acceptance Scenarios**:

1. **Given** a destination search, **When** there are no matches, **Then** the page
   explains the empty state and offers a way to change or clear the search.
2. **Given** two compared destinations, **When** reading on a phone, **Then** labels,
   differences and actions remain associated with the correct option.
3. **Given** existing work, **When** applying a suggested combination, **Then** the
   replacement is deliberate and the visitor can cancel or undo it.

### User Story 4 - Keep and resume a plan without an account (Priority: P2)

A visitor downloads a readable summary to discuss and a plan file to resume editing
later, including on another device.

**Why this priority**: Saving does not require sign-in or student records on a server.

**Independent Test**: Export a made-up plan, start a fresh session, import the file,
and verify that choices and comparisons are restored with the right version labels.

**Acceptance Scenarios**:

1. **Given** complete or partial work, **When** exporting a summary, **Then** it includes
   the chosen subjects, relevant explanations, comparison selections, years, rules
   version and limitations; partial work is labelled as such.
2. **Given** an exported plan file, **When** opening it in a fresh session, **Then**
   supported choices and comparisons can be restored after a replacement preview.
3. **Given** an invalid, unsupported or older file, **When** importing it, **Then** the
   page explains the problem or version mismatch and does not overwrite current work.

### Edge Cases

- Browser storage is unavailable: exploration and file export remain usable.
- An imported plan contains unknown subjects, duplicates or incompatible levels:
  reject before replacement and identify the issue.
- A plan uses an older rule version: identify it, preserve it until the user chooses
  to recalculate, and never imply that its earlier result is currently verified.
- School offerings differ: explain the configured profile and do not silently widen it.
- Analytics is blocked or the device is offline: the main journeys remain usable.
- A user cancels a print/save dialog or file import: current work remains intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entry MUST identify Pathways as current and Atlas as a grey,
  non-interactive "Coming soon" placeholder with a description of its future purpose.
- **FR-002**: Planning MUST be accessible without sign-in and MUST retain visible
  attribution to Evan Liao, Mathew Lim and Koo Tiannuo in the appropriate contexts.
- **FR-003**: Subjects, levels and illustrative outcomes MUST remain editable;
  unset values MUST remain distinguishable from failed or not-taken subjects.
  Existing browser Save/restore/reset MUST explain device-local scope, validate
  restored choices, and report storage failure without silently discarding current work.
- **FR-004**: Results MUST distinguish planning prerequisites from final admissions,
  identify the applicable years, and expose assumptions and official references.
- **FR-005**: School-profile restrictions MUST be visible and separately identified
  from national admissions requirements before the public release is generalised.
- **FR-006**: Core journeys MUST support touch and keyboard at 320, 360, 375, 390,
  430, 768 and 1440 CSS-pixel widths, with no clipped essential controls or text.
  Test 200% text enlargement, landscape and the on-screen keyboard; aim for 44px
  primary touch controls and provide context when returning from details.
- **FR-007**: Reverse planning MUST support discovery, clear empty states, inspection,
  readable comparison and deliberate replacement of current choices with cancel or undo.
- **FR-008**: Visitors MUST be able to download a readable summary suitable for PDF
  saving/printing with inputs, comparisons, explanations, limitations and version labels.
- **FR-009**: Visitors MUST be able to export and import an editable plan locally,
  validating format/version/content before confirming replacement of current work.
- **FR-010**: Saving MUST NOT require accounts or remote persistence. Student inputs,
  saved plans and summary contents MUST NOT be transmitted as analytics.
- **FR-011**: Authoritative expectations MUST be independently reviewed for supported
  scenarios; shared engines MUST NOT be consolidated based only on mutual agreement.

### Key Entities *(include if feature involves data)*

- **Product availability**: current Pathways entry and unavailable Atlas entry.
- **Planning profile**: subject offerings, restrictions, exam/admission-year labels and rules version.
- **Subject choice**: subject, offered level, taken/unset state and illustrative pass/fail choice.
- **Destination comparison**: selected destination identifiers with requirements and source references.
- **Saved plan**: versioned inputs and comparisons, without identity details or trusted computed outcomes.
- **Readable summary**: dated explanation of the plan, sources and its limits for discussion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All tested widths show the current and coming-soon statuses completely;
  Atlas has zero navigation targets and Pathways remains directly usable.
- **SC-002**: Every core scenario in the test matrix completes without unreachable
  actions, loss of choices, hidden essential explanations or document-wide overflow.
- **SC-003**: All supported export/import fixtures restore the same inputs and
  comparisons; all invalid or incompatible fixtures leave existing work unchanged.
- **SC-004**: All rule cases selected for release have a dated source, independent
  reviewer and passing expected outcome. Unresolved cases are explicitly unsupported.
- **SC-005**: During a proposed five-person parent/youth pilot, at least four can
  complete the planning-and-summary journey without help and explain that the result
  is not a confirmed admission. Record the sample and findings; this is not achieved yet.

## Assumptions

- The default language is English. Pathways' current Sec 2 purpose guides the first slice.
- "Export" is provisionally a readable PDF/print summary plus an editable plan file;
  this is a reviewable proposal rather than an implemented feature.
- Preserve current year labels while auditing their intended meaning; do not infer
  cohort correctness from the page title. Named admissions reviewer and launch cohort
  remain release dependencies, not blockers to this planning/placeholder PR.
- Atlas's original folder and downloadable artifact remain in the repository; "Coming
  soon" describes availability in the shared entry, not deletion or access control.
- Hosted metrics are a separate later slice after the primary journey is stable.
  Start with coarse GA4 events; defer Neon, accounts and engine consolidation.
- This change authorises the placeholder and planning artifacts. Export/import,
  mobile redesign, rule changes, analytics activation and deployment remain planned.
