# UI and File Contracts

## Current authorised availability entry (US1)

- Root `index.html` continues directly into Pathways.
- Pathways has a visible current-tool status; Atlas uses a legible grey treatment,
  the words "Coming soon" and a short results-exploration description.
- Atlas has no link, button, click handler or tab stop. Do not use a dead anchor or
  rely on colour alone. Its source/artifact stay in the repository.
- Availability entries stack on a phone; existing subject, results, reverse-planning
  and credit behaviour is unchanged by this PR.

## Planned readable summary (US4)

One user action opens a print-ready summary with a standard save-as-PDF path, clearly
labelled so users understand the browser's save/print step. It includes inputs,
selected comparisons, explanations, official references, exam/admissions years,
build/rules versions and limitations. It shows partial/unconfirmed information honestly.
Check pagination, long text, comparison labels, and absence of clipped controls/content.
A direct PDF library is not required unless this path fails the agreed phone acceptance.

## Planned editable plan (US4)

Use a downloaded JSON document with the fields and limits in [data-model.md](../data-model.md).
Suggested filename: `pathways-plan-YYYY-MM-DD.json`, without identity details.
Export reads application state; it does not submit it anywhere. Import treats the file
as untrusted input and follows validate → preview → confirm → replace. Render messages
as text, never as imported HTML. Provide clear errors and retain current work on failure.

## Planned return and replacement behaviour (US2/US3)

Returning from an explanation or comparison restores the current combination and
context. Applying a recommended combination must offer cancel or undo, rather than
immediately overwriting a parent's or young person's work. Reset identifies what
will be cleared. Storage failure does not block exploration or export.
