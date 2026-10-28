# Pathways UX backlog and prioritisation

Planning baseline, 28 October 2026. Work is ordered by decision harm, task completion, reach and then convenience. These are proposed implementation priorities; this planning PR does not claim that the backlog is fixed or that embedded admissions data is accurate.

See [journeys and acceptance criteria](pathways-journeys.md). Source references use functions/selectors in [`index.html`](../index.html) so small layout changes do not invalidate line numbers.

## Evidence boundary

- **Browser observation:** the earlier 375 × 812 CSS px inspection showed a crowded Pathways header/tool cluster and small subject controls. This was a limited inspection, not a completed mobile usability study.
- **Confirmed by source and that inspection:** `header p.subhead`, including the independent-tool notice, is hidden in the mobile media rule. Responsive CSS and a mobile three-tab navigator already exist; Pathways should not be described as wholly lacking mobile support.
- **Confirmed by source:** compact control rules use heights down to 26–28px; the comparison table has `min-width: 600px` inside `.rp-table-scroll`; school-specific subject assumptions exist; applying a reverse-planning combination overwrites saved subject rows.
- **To verify:** touch error rate, screen-reader announcements, contrast, zoom, full comparison/keyboard journeys, PDF layout and performance. A CSS finding is a risk indicator, not proof of every browser symptom.
- Atlas mobile improvement is deferred. Its original files and Koo Tiannuo's credit remain; the first shared entry presents Atlas only as Coming soon.

## P0 — Make guidance and scope trustworthy

### UX-01: Version the rules and separate facts from assumptions

**Evidence:** `evaluate()`, `PATHS`, `COURSES_DATA`, the SEC 2028 heading and the pass/fail footer contain requirements and explanatory claims. This audit has not independently checked their official accuracy.

**Impact:** A polished result can be mistaken for a verified recommendation about a consequential choice.

**Work:** Inventory claims and sources, distinguish examination year from admissions year, record a ruleset/review version, and label estimates/unsupported cases. Verify expected results against dated official sources before using them as test fixtures. Make prerequisite checks and competitive posting outcomes visibly distinct.

**Acceptance:** Every supported rule in the agreed first-release scope is traceable to a source and reviewed fixture, or explicitly marked unverified/unsupported. Forward results, reverse details, glossary and future exports use consistent terminology and provenance. No verified-accuracy claim precedes that review.

### UX-02: Keep limitations visible on a phone

**Evidence:** Mobile CSS hides `header p.subhead`; explanatory pass/fail limits are separated from the main input/results interaction. Result labels include “Not Eligible” and “Can Apply”.

**Work:** Put a short independent-tool/cohort notice and the simplification caveat where users encounter results; link to fuller explanations and sources. Review labels so missing inputs and unmet prerequisites are distinguishable from final admissions outcomes.

**Acceptance:** At 320–390px, users can reach the notice and interpret each status without relying on colour or the desktop-only header. Notices remain visible in reverse planning and printed summaries where relevant.

## P1 — Complete the core journeys reliably on mobile

### UX-03: Rework controls, navigation and comparison for narrow screens

**Evidence:** Limited 375 × 812 observation of crowding/small controls; compact `.seg`, `.fg`, `.reset` rules; mobile state in `setMobTab()`; wide `.rp-compare-table`.

**Work:** Test J1–J4 end to end; simplify header action hierarchy, size controls for touch, keep input context visible, and provide a readable comparison treatment. Audit tab keyboard behaviour, dialogs/tooltips, focus/scroll restoration and back navigation.

**Acceptance:** Journeys pass at the widths/zoom in the journey document, with readable labels, visible focus, no clipped primary controls or page-wide horizontal overflow. Comparison labels and all actions remain accessible. Record actual browser findings before treating every suspected issue as confirmed.

### UX-04: Expose school scope before generalising

**Evidence:** `SUB`, `ELECTIVE_OPTIONS`, `evaluate()`, `renderRows()` and `GLOSSARY_MAP` include “our school” availability and a maximum-two-pure-sciences assumption. This is an existing school scope, not an established admissions-rule defect.

**Work:** Agree the launch audience. Make any school profile explicit and versioned; separate school subject availability from national pathway rules. Audit presets, suggested combinations and glossary together. A general mode must describe the limits of its subject catalogue.

**Acceptance:** No unnamed school's offering is silently enforced for every user. A reverse suggestion cannot imply that their school offers those subjects. Existing scoped behaviour remains identifiable until replacement rules are reviewed.

### UX-05: Protect the working plan and explain local saving

**Evidence:** `loadCourseIntoSubjects()` replaces rows and saves immediately; presets/reset replace input; `#save` catches storage failure silently. `loadSaved()` has limited structural checks; compare state is in-memory only.

**Work:** Add clear replacement/recovery behaviour, truthful save/error feedback and local-device wording. Define what a saved plan contains; validate restored state before use. Keep anonymous/local saving as the default.

**Acceptance:** Applying a suggestion or importing cannot silently destroy the previous plan. Blocked/corrupt storage gives a recoverable message. Save/reload/reset and comparison persistence behave as documented; no login or database is required.

## P2 — Help families take a plan away and return

### UX-06: Add a summary PDF and structured plan export/import

**Evidence:** These flows are absent from the current source; browser Save stores only rows. This is proposed functionality.

**Work:** Implement J5 after rule provenance and working-state behaviour are defined. Start with a print/save-to-PDF summary and a versioned structured file, validate imports locally, preview replacement and handle stale rules explicitly.

**Acceptance:** The summary is readable across multiple pages and contains assumptions, comparison and versions. A structured round trip restores supported editable state. Invalid or incompatible files preserve the current plan. Test mismatch/recalculation and cancellation; do not implement PDF parsing or cloud accounts for the initial release.

### UX-07: Measure useful hosted journeys with GA4

**Evidence:** No GA integration is present in the inspected baseline. Measurement is planned, not enabled.

**Work:** Agree a small event dictionary tied to the journeys. Measure mode entry, comparison and successful local import/export using coarse allowlisted parameters. Keep analytics independent of app function; inspect automatic URL/form/search collection as well as custom payloads.

**Acceptance:** Correct production property/stream confirmed; local files/previews excluded; no plan contents or identifying fields sent; no duplicate views/events; actual receipt verified in Realtime/DebugView. Define consent/disclosure and stream settings before activation. Do not equate GA visitor estimates with unique families.

## P3 — Consolidate only after Pathways works

Shared components/data contracts can follow reviewed behaviour and tests. Preserve Evan Liao, Mathew Lim and Koo Tiannuo's visible provenance; use selected reusable Atlas ideas only when their scope and rules match. Keep Atlas as Coming soon until its separate results-day/mobile journey meets an agreed release bar.

Neon is not needed for local saves, PDF or structured plan files. Reconsider persistence infrastructure only for a concrete durable server-side need with ownership, access, retention and deletion requirements. Do not create a second analytics event store by default.

## Suggested delivery slices

1. Agree J1–J5, scope, rules owner and acceptance bar; finish Spec Kit specification, plan and task review.
2. Validate the initial rules/source fixtures and repair mobile trust notices; address confirmed mobile task blockers.
3. Generalise school scope and protect working/saved plans; then deliver local summary/export/import.
4. Activate verified privacy-scoped hosted analytics; use observed task outcomes to reprioritise polish and future Atlas work.

Dependencies are explicit: print/import depend on versioned state; verified output claims depend on source review; Atlas release depends on its own audit. None is satisfied merely by installing Spec Kit or adding unchecked tasks.
