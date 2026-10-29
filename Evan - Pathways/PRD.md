# Product Requirements Document (PRD)

## Evolution & Prompt History


### [2026-10-29 09:19] Prompt: "the background.png and logo.png are all in the root folder"
- Moved `background.png` and `logo.png` to the project root directory.


### [2026-10-29 09:30] Prompt: "in the course chart, when i select a course to see it, it appears above the course selections, and when i scroll down, it gets covered. i wanted to be able to see the courses on the left, and the course i selected to see will be displayed on the right"
- Redesigned the course chart layout from a stacked view to a side-by-side interface.
- Positioned course selections on the left and the selected course details on the right to eliminate scrolling overlap issues.


### [2026-10-29 10:54] Prompt: "Manual Patch applied"
- Applied a manual patch to implement necessary system updates and fixes.


### [2026-10-29 11:38] Prompt: "Upgrade dark glassmorphic styling, fix syntax issue, and enhance footer encapsulation"
- Upgraded surface CSS variables (`--surface`, `--surface-2`) in `css/variables.css` to deeper glassmorphic tones (`rgba(13, 20, 36, 0.88)` and `rgba(20, 32, 52, 0.88)`).
- Cleaned up stray `backlog-filter` property in `css/views.css`.
- Synchronized `.rp-macro-bubble`, `.career-summary-box`, and `.career-stage-row` backgrounds with dark glassmorphic surfaces.
- Upgraded pathway card gradient termination in `css/components.css` to `rgba(13, 20, 36, 0.9)`.
- Encapsulated footer with glassmorphism and wrapped the footnote in `.footer-footnote` in `index.html` and `css/views.css`.
- Upgraded course inspector empty state with glassmorphic styling.


### [2026-10-29 11:40] Prompt: "Manual Patch applied"
- Applied a manual patch to address specific system updates or hotfixes.
- Recorded direct modifications made outside the standard deployment workflow.


### [2026-10-29 11:58] Prompt: "Refactor css/views.css and index.html to eliminate the conflicting grid definitions on .rp-view-card that were constraining .rp-split-layout into the left half of the card. Establish a spacious, balanced two-column desktop layout where course selection bubbles expand across the left column with multi-column child grids, and the selected course inspector/empty state docks on the right as a sticky glassmorphic sidebar. Update PRD.md with the prompt history."
- Eliminated conflicting `display: grid`, `grid-template-areas`, and obsolete `:has(#rpInspector[hidden])::after` on `.rp-view-card` in `css/views.css` that was constraining `.rp-split-layout` to the left half.
- Transferred and consolidated Course Planning two-column split layout, inspector sidebar, scrollbar styling, and empty state guides into `css/views.css`.
- Configured spacious multi-column child grids (`repeat(auto-fill, minmax(230px, 1fr))`) allowing course selection bubbles to expand naturally across the desktop viewport.
- Cleaned up redundant inline style definitions in `index.html` while preserving global background configuration.


### [2026-10-29 11:58] Prompt: "Manual Patch applied"
- Applied manual patch modifications based on user request.


### [2026-10-29 11:59] Prompt: "Manual Patch applied"
- Applied a manual patch to implement direct system updates and fixes.


### [2026-10-29 12:09] Prompt: "In src/engine/evaluate.js, update the 2-Year Higher Nitec (hn2) evaluation logic. When a student offers at least 4 subjects at any level (including 4 G1 subjects) but does not meet the 5 G2/G3 subjects requirement for direct Year 2 entry, set r.state = 'amber' (Conditional) instead of 'bad'. Populate r.what, r.req, and r.note with the accelerated 2-year route details (Year 1 Sem 1 exam performance criteria, skipping Year 1 Sem 2, and caveats distinguishing this from direct SEC ELMAB3 ≤ 19 entry). Keep the existing direct entry checks when 5 G2/G3 subjects are offered, and keep state = 'bad' only when fewer than 4 subjects are offered overall. Update PRD.md with the prompt entry."
- Updated the 2-Year Higher Nitec (`hn2`) evaluation logic in `src/engine/evaluate.js` to recognize the accelerated 2-year pathway for students offering at least 4 subjects at any level (including 4 G1 subjects).
- Configured conditional status (`r.state = 'amber'`) with comprehensive details in `r.what`, `r.req`, and `r.note` detailing Year 1 Semester 1 academic performance criteria, skipping Year 1 Semester 2 into Year 2, and highlighting the distinction from direct SEC ELMAB3 ≤ 19 admission.
- Maintained existing direct entry checks when 5 G2/G3 subjects are offered, while ensuring ineligible status (`r.state = 'bad'`) is strictly reserved for instances where fewer than 4 subjects are offered overall.


### [2026-10-29 12:14] Prompt: "Manual Patch applied"
- Applied a manual patch to implement targeted system updates and fixes.


### [2026-10-29 13:33] Prompt: "i would like to now take this to the next level without compromising on its simplicity.

right now this is a pass/fail only system. i would like a checkbox on the top to expand this app to take in clear results (A1, A2, B3 etc for G3, 1,2,3 for G2 and abc for G1. initially, this app is designed for sec 2s trying to figure out which subject combi to take - this checkbox will turn this app into a full fledged planner with clear marks, which will then most accurately reflect the full sbb situation.

help me connect this app up, take 3-4 prompts if necessary"
- Added an expandable toggle to transition from a pass/fail format to a detailed grade-input planner.
- Integrated tiered grading scales (G3, G2, G1) to support full Subject-Based Banding (SBB) planning.


### [2026-10-29 16:03] Prompt: "i would like to now take this to the next level without compromising on its simplicity.

right now this is a pass/fail only system. i would like a checkbox on the top to expand this app to take in clear results (A1, A2, B3 etc for G3, 1,2,3 for G2 and abc for G1. initially, this app is designed for sec 2s trying to figure out which subject combi to take - this checkbox will turn this app into a full fledged planner with clear marks, which will then most accurately reflect the full sbb situation.

help me connect this app up, take 3-4 prompts if necessary

Explanation: Introduced an interactive Detailed Grades Mode toggle at the top of the planner. When unchecked (default), the app maintains its simple Pass/Fail interface for Sec 2 subject combination planning. When checked, the app expands into a full-fledged SEC planner featuring individual subject grade pickers (A1–E8, 9 for G3; 1–6 for G2; A–E for G1), CCA bonus points selection, quick grade presets, and a live Full SBB Aggregate Dashboard computing L1R4 (JC/MI), ELR2B2 (Polytechnic), ELMAB3 (PFP & ITE 2-Year), ITE 3-Year aggregates, and 5th year secondary eligibility according to official MOE 2028 rules."
- Added an optional "Detailed Grades Mode" toggle to expand the app from a basic pass/fail checker into a comprehensive SBB planner.
- Integrated tiered grade pickers (G1–G3), CCA bonus points, and live aggregate score calculations (L1R4, ELR2B2, ELMAB3) aligned with official MOE 2028 rules.


### [2026-10-29 16:04] Prompt: "Manual Patch applied"
- Applied a manual patch to implement targeted updates or fixes.


### [2026-10-29 16:05] Prompt: "Manual Patch applied"
- Applied a manual patch to update system configurations and address targeted fixes.


### [2026-10-29 16:07] Prompt: "Manual Patch applied"
- Applied a manual patch to resolve targeted system updates or hotfixes.


### [2026-10-29 16:08] Prompt: "Manual Patch applied"
- Applied a manual patch to implement targeted system updates and fixes.


### [2026-10-29 17:15] Prompt: "i would like to now take this to the next level without compromising on its simplicity.

right now this is a pass/fail only system. i would like a checkbox on the top to expand this app to take in clear results (A1, A2, B3 etc for G3, 1,2,3 for G2 and abc for G1. initially, this app is designed for sec 2s trying to figure out which subject combi to take - this checkbox will turn this app into a full fledged planner with clear marks, which will then most accurately reflect the full sbb situation.

help me connect this app up, take 3-4 prompts if necessary"
- Added an expansion toggle to transition the evaluation model from a binary pass/fail to a granular grade-input system (supporting specific G3, G2, and G1 grades).
- Upgraded the Sec 2 subject combination tool into a comprehensive SBB planner for precise academic modeling.


### [2026-10-29 17:25] Prompt: "Manual Patch applied"
- Applied a manual patch to update project configurations or implementation.


### [2026-10-29 17:28] Prompt: "Execute Step 1: In `src/main.js`, implement full reactivity for Detailed Grades Mode. (1) Track `detailedGradesMode` and `ccaGrade` in state with localStorage persistence. (2) Wire event listeners for `#toggleGradeMode` and `#ccaGradeSelect`. (3) In `renderRows()`, when `detailedGradesMode` is active, replace the binary `.pf` button group with a `<select class="grade-select">` offering tiered options based on the subject's band (G3: A1, A2, B3, B4, C5, C6, D7, E8, 9; G2: 1, 2, 3, 4, 5, 6; G1: A, B, C, D, E), updating available grades when bands change and suppressing redundant fail grade selectors. (4) Pass `{ cca: ccaGrade }` to `evaluate()`. (5) In `render()`, toggle and populate `#aggregateDashboard` with live computed L1R4, ELR2B2, ELMAB3, and ITE scores. Update `PRD.md` with the prompt entry."
- Implemented full reactivity for Detailed Grades Mode in `src/main.js` with persistent state for `detailedGradesMode` and `ccaGrade`.
- Replaced binary Pass/Fail button group with dynamic `<select class="grade-select">` reflecting tiered grading scales (G3: A1–9, G2: 1–6, G1: A–E) based on subject band, dynamically adapting when levels change and suppressing redundant fail grade mapping.
- Wired event listeners for `#toggleGradeMode` and `#ccaGradeSelect`, passing active CCA bonus points to `evaluate()`.
- Implemented live aggregate dashboard rendering to display computed L1R4, ELR2B2, ELMAB3, and ITE 3-Year aggregates with cut-off compliance.


### [2026-10-29 17:35] Prompt: "Manual Patch applied"
- Applied a manual patch to implement targeted system fixes and updates.


### [2026-10-29 17:42] Prompt: "In the detailed grades, I would like the grades to be displayed as toggle boxes rather than a dropdown menu, allowing me to see the full range of grades. If I fail any of them at a G3 level, I should be able to see its translation to a G2 grade pass in the same subject. Additionally, I would like the aggregate dashboard to look more professional, like the rest of the app, i'll provide a picture"
- Replaced `<select class="grade-select">` with segmented toggle button groups (`.seg.grade-seg`) displaying full tiered grade scales (G3: A1–9, G2: 1–6, G1: A–E, and 'None' for optional subjects) with active state reactivity.
- Added inline Full SBB G3-to-G2 grade conversion callouts whenever a G3 subject is failed (D7, E8, 9), explaining the exact G2 equivalent pass.
- Excluded `#aggregateDashboard` and `.grade-seg` elements from glossary tooltip text walking in `annotateGlossary()`.
- Redesigned and styled the Full SBB Aggregate Dashboard into a glassmorphic 4-card responsive grid with luminous status indicators, score callouts, and clean metadata matching the application aesthetic.


### [2026-10-29 17:46] Prompt: "Manual Patch applied"
- Applied a manual patch to update system configurations and implement direct fixes.
- Updated the project baseline to reflect the manual interventions.


### [2026-10-29 17:50] Prompt: "I really like the full SBB aggregate dashboard, but I'm wondering now if it's possible to put it below the header \"Subject and Results\" but above all the subjects. Also, I think it's not very well designed. Would it be possible for these four—the L1R4, the Polytechnic, PFP IT 2-Year, and IT 3-Year—to be smaller instead? Right now, it doesn't show very nicely. I can show you a screenshot."
- Relocated `#aggregateDashboard` from `#results` panel into `#subjects` panel, positioned directly below the panel header and above the subject configuration rows (`#rows`).
- Redesigned the aggregate dashboard and cards into compact, sleek mini stat tiles with smaller padding (8px–10px), refined typography, compact 21px score numbers, and non-colliding status indicator pills.
- Eliminated redundant bottom error notes to prevent text overlapping and visual clutter on narrow column viewports.


### [2026-10-29 17:55] Prompt: "Manual Patch applied"
- Applied a manual patch to implement direct system updates and fixes.


### [2026-10-29 18:09] Prompt: "could you help me look at the PFP and ITE numbers, it doesn't seem to be moving... could you also check if the JC and poly numbers look correct too"
- Fixed PFP / 2-Year and ITE 3-Year cards remaining static with '–' by ensuring calculateELMAB3 and calculateIte3Year return top-level gross, net, eligible, and backward-compatible alias keys (ite3yr and ite3Year, points and netPoints).
- Verified JC / MI L1R4 (net: 10) and Poly ELR2B2 (net: 8) scores as mathematically accurate under official MOE 2028 rules, and updated the status pills from 'Prereqs' to dynamic context-aware indicators ('JC (≤16)', 'MI (≤20)', 'Poly (≤22)', 'Nursing (≤24)', 'PFP (≤12)', '2-Yr (≤19)', and best ITE aggregate type) with glowing '.is-ok' states.


### [2026-10-29 20:52] Prompt: "Manual Patch applied"
- Applied a manual patch to resolve targeted issues and update system components.


### [2026-10-29 21:20] Prompt: "It seems I'm only able to activate these subjects if I use the sample combinations buttons, which is sad because I want to be able to just select G1, G2, or G3 depending. Also, some of these are wrong in terms of what is offered. Computing definitely is offered at G1 and G2. Could you please fix this properly? essentially i would still like to be able to select the G1/2/3 status first before the grade automatically comes out."
- Enabled G1, G2, and G3 level selector buttons on inactive subjects based directly on subject curriculum offerings (`SUB[r.k].lv`), resolving false 'Not offered at G2' disabled states on Computing and other electives.
- Decoupled level selection from automatic grade selection in Detailed Grades Mode, allowing students to select their subject level first before picking their grade.
- Updated `render()` grade assignment loop to populate default grades only when `r.pass === true` (e.g. presets), keeping grades unset when `r.pass == null`.
- Updated 'None' button click handlers to cleanly reset `taken = false`, `lv = null`, `pass = null`, `grade = null`, and `fg = null`.
- Updated `ELECTIVE_OPTIONS` labels in `src/data/subjects.js` to explicitly indicate offered subject bands (e.g., Computing (G1/G2/G3), Art (G1/G2/G3), D&T (G1/G2/G3)).


### [2026-10-29 21:20] Prompt: "Manual Patch applied"
- Implemented: Manual Patch applied


### [2026-10-29 21:56] Prompt: "i would like to explore specifics in terms of mother tongue at g1 for entry to junior college, MI, poly, pfp etc"
- Integrated comprehensive G1 Mother Tongue (G1 MTL) Full SBB 2028 rules across engine, UI, reference tables, and glossary.
- In `src/engine/aggregates.js`, updated `calculateL1R4` to verify G1 MTL Grade A–D (itePts ≤ 4) satisfies the JC/MI Mother Tongue MER while ensuring G1 subjects cannot enter L1 or R1–R4.
- In `src/engine/evaluate.js`, updated JC/MI cards to state that passing G1 MTL fulfills entry requirements (routing to MTL 'B') and added contextual advisory notes to Poly, PFP, and ITE 2-Year cards clarifying G1 MTL's exclusion from ELR2B2/ELMAB3 aggregates.
- In `src/main.js`, added an inline badge and explanatory text under the MTL row whenever G1 is selected and updated the summary pill to show `(JC Met/MTL 'B')`.
- In `src/data/glossary.js`, registered entries and regex matching for 'G1 Mother Tongue' and 'MTL B'.
- In `index.html`, added a 'Mother Tongue at G1: Pathway Rules' reference table, footnote clarifications, and modal glossary terms.


### [2026-10-29 21:59] Prompt: "Manual Patch applied"
- Applied a manual patch to update system configurations and requirements.


### [2026-10-29 22:04] Prompt: "when i select any subject's G1/2/3 could you automatically put the highest grade for me (an A1, 1 or A) also remember any settings for me, save in indexdb automatically"
- Created `src/utils/db.js` providing IndexedDB persistence (`PathwayExplorerDB`, store: `settings`) with `saveSettings`, `loadSettings`, and `clearSettings`.
- Updated G1/G2/G3 level selector buttons in `src/main.js` to automatically set the highest grade (G3 -> 'A1', G2 -> '1', G1 -> 'A'), set `r.pass = true`, and clear `r.fg = null`.
- Implemented automatic saving to IndexedDB (with localStorage fallback) across all state changes (level selection, grade toggle, elective change, CCA selection, detailed mode switch, presets, and reset).
- Implemented asynchronous application initialization (`initApp()`) to load and restore saved rows, detailed mode, and CCA grade from IndexedDB on page launch.


### [2026-10-29 22:07] Prompt: "when i select any subject's G1/2/3 could you automatically put the highest grade for me (an A1, 1 or A) also remember any settings for me, save in indexdb automatically"
- Implemented: when i select any subject's G1/2/3 could you automatically put the highest grade for me (an A1, 1 or A) and auto-save in IndexedDB.


### [2026-10-29 22:18] Prompt: "Align codebase with official MOE 2028 PSE guidelines. (1) In `src/engine/aggregates.js`, update `calculateL1R4` so that `hmtlBonus` (2 pts) is strictly added only when `l1Type === 'EL'` and not when HMTL is chosen as L1; ensure ordinary bonus points cap at 3. (2) In `src/engine/evaluate.js`, refine `hn2` evaluation to explicitly report PSE direct entry eligibility (Gross ELMAB3 ≤ 19 using G2 equivalent grades) while maintaining the conditional internal acceleration note for G1 students; fix subject counting so G3 D7/E8 passes count towards 4 G3 + 1 G2 Poly requirements; ensure PFP checks block G2 Grade 5 passes. (3) In `src/main.js` and `index.html`, display the computed 5th Year Secondary School eligibility status card under Results when students do not qualify for JC/MI/Poly direct entry. (4) Update `PRD.md` with prompt history."
- In `src/engine/aggregates.js`, updated `calculateL1R4` so that the 2-point HMTL bonus is strictly applied only when English is selected as L1 (and not when HMTL serves as L1), with ordinary bonus points capped at 3.
- In `src/engine/evaluate.js`, ensured G3 D7 and E8 fail grades properly normalize and convert to G2 Grade 3 and Grade 4 passes, allowing them to count towards the 4 G3 + 1 G2 Polytechnic entry combination.
- Updated PFP evaluation in `src/engine/evaluate.js` to strictly reject G2 Grade 5 and 6 passes in compliance with MOE criteria requiring G2 Grades 1–4.
- Refined 2-Year Higher Nitec (`hn2`) evaluation to explicitly report PSE direct entry eligibility based on Gross ELMAB3 ≤ 19 (using G2-equivalent grades), while retaining the conditional internal acceleration guidance for students offering 4 G1 subjects.
- In `index.html` and `src/main.js`, integrated the computed 5th Year Secondary School (Sec 5) eligibility status card under Results when students do not qualify for JC/MI/Poly direct entry, highlighting eligibility under Criteria 1 or Criteria 2 and the ELMAB3 ≤ 19 all-G3 study threshold.


### [2026-10-29 22:25] Prompt: "Manual Patch applied"
- Applied a manual patch to update project specifications and requirements.
