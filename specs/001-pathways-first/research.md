# Research and Decisions

Reviewed 2026-10-28 against repository baseline `c9eb764`.

| Decision | Reason | Alternative considered |
| --- | --- | --- |
| Pathways first; Atlas grey coming soon | Explicit user priority | Atlas-first mobile release |
| Keep root entry and add availability cards | Small reversible change; preserve saved-work behaviour | New landing route or move prototype |
| Preserve separate engines | Simplified pass/fail and exact aggregates serve different purposes | Immediate engine consolidation |
| Local summary + editable plan proposal | Export-based saving without accounts | Server profiles or Neon solely for saving |
| Keep static architecture | Current feature does not require a framework | Rewrite before verifying journeys |
| Defer GA activation | Event dictionary, stream and accurate privacy wording need a later slice | Add a tag during placeholder work |

## Evidence

- `index.html`: `evaluate`, `loadSaved`, `setReverseMode`, `compareList`,
  `loadCourseIntoSubjects`; current comparison is not saved across reloads and applying
  a suggestion replaces current choices. School offerings are embedded in the profile.
- `student-pathway-atlas/README.md`: separate engines, tests, dated snapshots and
  missing refresh dependencies; its offline privacy promise requires preservation.
- [Existing-project Spec Kit guide](https://github.github.com/spec-kit/guides/existing-projects.html):
  adopt in place and specify the next bounded change, not every existing function.
- [Google privacy guidance](https://support.google.com/analytics/answer/6366371?hl=en):
  safe event payloads also require safe URLs, titles and automatic-collection settings.

## Tooling and provenance

Initialised with the already installed `specify` CLI, version `1.2.3.dev0`, using
`specify init --here --force --non-interactive --integration codex --ignore-agent-tools --script sh`.
No CLI package or global environment was installed or upgraded. Generated files and
version manifests are committed for review; this is a development version, not a
claim that the newest stable release has been installed. No extensions/hooks were installed.

## Release dependencies

Confirm launch exam/admissions cohort, a named admissions/source reviewer, intended
school-profile scope, production hostname and GA property/stream. These do not block
specification or the unavailable Atlas entry. Do not silently treat them as settled.
