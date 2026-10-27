# Aggregate engine

```bash
python3 -m engine demo --slots                # four made-up students, every aggregate, slot by slot
python3 -m unittest discover -s engine/tests  # the engine tests
python3 -m engine.export_definitions          # rewrite engine/definitions.json (tests fail if it is stale)
python3 engine/tests/test_search.py survey 3000   # greedy-vs-exact disagreement survey on random students
```

## Calling it

```python
from engine import compute_all, compute

results = compute_all(subjects, bonus)        # list[Result], one per definition + the 5th-year summary
r = compute("L1R5(2026)", subjects, bonus)    # one aggregate
r.to_dict                                   # JSON-ready
check_inputs(subjects)                        # read the rows only: {entries, input_problems, warnings}
```

- `level`: `O` / `G3`, `N(A)` / `G2`, `N(T)` / `G1` (O-Level = G3, N(A) = G2, N(T) = G1). MOE's combined labels
  (`G3/O-Level`, `G2/N(A)-Level`, `G1/N(T)-Level`) and variants (`O-Level`, `GCE O-Level`, `N(A) Level`, any case)
  are read too; a combined label whose parts disagree (`G3/N(A)`) or a bare `N-Level` is unreadable.
  A missing level is filled in only from a `G1 ` / `G2 ` / `G3 ` prefix in the name, or for a subject SEAB examines
  at one level in that exam year (engine 0.1.6: `data/taxonomy/subjects_by_level.csv`, e.g. Physics in 2026 → G3,
  Retail Operations → G1; subjects not in SEAB's lists fall back to the catalogue's `only_level`: earlier O-Level
  subjects → G3) — with a warning ("no level given - Physics is examined at O-Level only, so G3 is assumed").
- Levels SEAB examines (engine 0.1.6): each subject carries `levels_by_system` from SEAB's lists (2026 GCE O-Level,
  N(A), N(T); 2027 SEC G1 / G2 / G3). A row's year picks the list (2026 or earlier → the GCE lists, 2027 or later →
  SEC, no year → both). A row at a level SEAB does not examine for that year is kept as given and reported in
  `input_problems` — "Science (Syllabus T) is examined at G1 only.", "Physics is examined at O-Level only.",
  "Bengali is examined at G2 and G3 only.", "Combined Science was examined at O-Level only." (earlier subjects).
  A subject with no rows for that year's lists (a 'B' Syllabus in 2027, ITE's substitute subjects) is not checked.
- `grade`: G3 `A1`…`F9` (`9` accepted), G2 `1`…`6` (`U` = 6), G1 `A`…`E`, `U`; `ABS`. MTL 'B' Syllabus subjects
  (`Chinese B`, `CHINESE 'B'`, `Malay B Syllabus` …) take `Merit` / `M`, `Pass` / `P`, `Ungraded` / `U` (any case;
  `Ungraded` was misread before 0.1.5 because it contains the word "GRADE"):
  these never fill a slot but `Merit` / `Pass` meet the 2026 JC / MI MTL requirement (the 2027 PSE table has no
  'B' row). Any other grade on a 'B' Syllabus row is an input problem.
- `year`: the exam year. 2026 aggregates use results from 2026 or earlier; 2027 aggregates from 2027 or earlier.
  Results from more than two exam years are combined two years at a time and the best pair is used.
  A row without a year is used by every aggregate.
- SEAB's own names read too (engine 0.1.6): `Basic Chinese` / `Basic Malay` / `Basic Tamil` (the N(T) mother tongue;
  SEC G1 Chinese / Malay / Tamil), `Design and Technology Syllabus T`, `English Language Syllabus A / T`,
  `Mathematics Syllabus A / T`, `Science Syllabus T`, `Arabic / Bahasa Indonesia as a 3rd Language`, `Business`.
  `Elements of Business Skills` and `Retail Operations` (N(T) / G1) are catalogue subjects; no rule names them in a
  slot list, so they fill "any subject" slots only.
- Common student spellings are aliases in the catalogue (`subjects.COMMON_SPELLINGS`, merged into each subject's
  `aliases`, so the JS port reads them from `definitions.json`): `E Math` / `EMath` / `E-Math`, `A Math` / `Add Maths`,
  `Pure Chem` / `Phys` / `Pure Bio`, `Sci (Phy/Chem)` / `Combined Science (Physics, Chemistry)` (either order),
  `Humanities (SS/Hist)` / `Combined Humanities (SS, Geog)`, `Lit (Eng)` / `Eng Lit` / `Literature (Chinese)`,
  `F&N` / `FN` → Nutrition & Food Science, `CPA` → Computer Applications (an N(T) / G1 subject), `DT`, `POA`, `CL`,
  `HCL`, `EL` … A hyphen reads as a space. A bare `Social Studies` / `SS` is reported ("examined with an elective").
  Deliberately left as MOE's own names: `Food & Nutrition` (earlier subject), `Combined Science` and `Combined
  Humanities` (earlier subjects), even though students may use them loosely.

### Input problems (loud)

Every `Result` carries the same `input_problems` list. Show it before any score: a dropped row silently changes
every aggregate. Each item is `{row, subject, field, value, problem, action}`.

| Problem | Action |
|---|---|
| unreadable level, no level (and the subject exists at more than one level), unreadable grade, no subject name | row ignored |
| subject not in the catalogue; name ambiguous at that level (bare `Science` at G2 / G3) | kept as an "Others" subject |
| a level SEAB does not examine for that subject in the row's exam year ("Higher Chinese is examined at O-Level only."), or a level that contradicts the level in the name | kept as given / level column used |
| unreadable year | used for every exam year |

Quiet `warnings` remain for things that are expected: a defaulted level, a level taken from the name, a grade
derived from a mark, a missing CCA grade, a greedy-vs-exact difference.

### Result fields

| Field | Meaning |
|---|---|
| `id`, `letters`, `exam_year`, `exercise`, `institution`, `route` | what the aggregate is (see the ID table) |
| `status` | `computed`, `not_computable` (reason given), `not_applicable` (no usable results), `stub`, `summary` |
| `gross`, `net` | net = gross − base bonus; `net` is `None` where no bonus schedule exists |
| `bonus` | `{base, cap, items[...], variants}` — every bonus item with points and why |
| `net_variants` | net for particular choices only (affiliated JC, CLEP/MLEP/TLEP) |
| `slots` | `[{slot, label, subject_id, subject, input_name, level, grade, year, points, scale, meets_slot_requirement}]` |
| `ignored` | typed grades this aggregate does not use: `[{subject, level, grade, year, row, input_name, state, code, reason}]` — `state` `rule` (the source says so) or `silent` (it does not say); `reason` is a sentence for students (see "Grades an aggregate does not use") |
| `alternatives`, `chosen_alternative` | EL-as-L1 and HMTL-as-L1 computed separately; the lower gross is used |
| `eligibility` | `[{id, label, met: True/False/None, detail, source, …}]` |
| `input_problems` | rows dropped or possibly misread (same list on every Result) — see above |
| `years_used`, `warnings`, `sources`, `notes`, `open_questions` | traceability |

## ID table

ID scheme: `LETTERS(YEAR)` where YEAR is the **exam year** of the results (CLAUDE.md rule 3). When the same letters and
year name two different rules, or the letters are only used inside an eligibility check, a route tag goes before
the year: `LETTERS:TAG(YEAR)`.

**Display name** (Assumptions: "name the year of the exam … the year they sit for it"): `LETTERS (YEAR EXAM)`,
plus ` · PATHWAY` only where the same letters, year and exam would clash, or for check-only letters (5th year).
One function (`definitions.format_display_name`) builds it from per-definition codes (`exam_key`, `pathway`) and the
`DISPLAY_NAME_RULE` table; it is on every definition, every `Result` and in `definitions.json` (`id_table`,
`display_name_rule`). Engine IDs are unchanged.

| ID | Display name | Exercise / route | Institution | Scale (`grades.SCALES`) |
|---|---|---|---|---|
| `L1R5(2026)` | L1R5 (2026 O-Level) | JAE 2027 (also DSA-JC) | JC | O_POINTS |
| `L1R4(2026)` | L1R4 (2026 O-Level) | JAE 2027 | MI | O_POINTS |
| `ELR2B2-A(2026)` | ELR2B2-A (2026 O-Level) | JAE 2027 | Polytechnic | O_POINTS |
| `ELR2B2-B(2026)` | ELR2B2-B (2026 O-Level) | JAE 2027 | Polytechnic | O_POINTS |
| `ELR2B2-C:POLY(2026)` | ELR2B2-C (2026 O-Level) · Poly | JAE 2027 | Polytechnic | O_POINTS |
| `ELR2B2-D(2026)` | ELR2B2-D (2026 O-Level) | JAE 2027 | Polytechnic | O_POINTS |
| `ELB4-A(2026)` | ELB4-A (2026 O-Level) | JAE 2027 | ITE | O_POINTS |
| `ELR1B3-B(2026)` | ELR1B3-B (2026 O-Level) | JAE 2027 | ITE | O_POINTS |
| `ELR2B2-C:ITE(2026)` | ELR2B2-C (2026 O-Level) · ITE | JAE 2027 | ITE | O_POINTS |
| `B5(2026)` | B5 (2026 O-Level) | JIE 'O' (Jan 2027 intake) | ITE | JIEO_POINTS |
| `ELMAB3:DPP(2026)` | ELMAB3 (2026 N-Level) · DPP | JIE 'H' / DPP (Dec 2026) | ITE | ITE_POINTS_JIEH |
| `ELMAB3:PFP(2026)` | ELMAB3 (2026 N-Level) · PFP | PFP (Jan 2027) | Polytechnic | PFP_2026 |
| `MAS1B3(2026)` | MAS1B3 (2026 N-Level) | JIE 'N' (Dec 2026) | ITE | ITE_POINTS_JIEN |
| `ELB3(2026)` | ELB3 (2026 N-Level) | JIE 'N' (Dec 2026) | ITE | ITE_POINTS_JIEN |
| `B4(2026)` | B4 (2026 N-Level) | JIE 'N' (Dec 2026) | ITE | ITE_POINTS_JIEN |
| `MAB3(2026)` | MAB3 (2026 N-Level) | JIE 'N' (Dec 2026) | ITE | ITE_POINTS_JIEN |
| `ELMAB2(2026)` | ELMAB2 (2026 N-Level) | JIE 'N' (Dec 2026) | ITE | ITE_POINTS_JIEN |
| `L1R4(2027)` | L1R4 (2027 SEC) | PSE 2028 | JC / MI | G3_POINTS |
| `ELR2B2-A(2027)` | ELR2B2-A (2027 SEC) | PSE 2028 | Polytechnic | G2EQ_NO_FAIL, G3_POINTS_NO9 |
| `ELR2B2-B(2027)` | ELR2B2-B (2027 SEC) | PSE 2028 | Polytechnic | G2EQ_NO_FAIL, G3_POINTS_NO9 |
| `ELR2B2-C(2027)` | ELR2B2-C (2027 SEC) | PSE 2028 | Polytechnic | G2EQ_NO_FAIL, G3_POINTS_NO9 |
| `ELR2B2-D(2027)` | ELR2B2-D (2027 SEC) | PSE 2028 | Polytechnic | G2EQ_NO_FAIL, G3_POINTS_NO9 |
| `ELMAB3:PFP(2027)` | ELMAB3 (2027 SEC) · PFP | PSE 2028 | Polytechnic | G2EQ_NO_FAIL |
| `ELMAB3:ITE(2027)` | ELMAB3 (2027 SEC) · ITE 2-year | PSE 2028 | ITE | G2EQ_FULL |
| `R2B2(2027)` | R2B2 (2027 SEC) | PSE 2028 | ITE | ITE_POINTS_PSE |
| `R1B3-A(2027)` | R1B3-A (2027 SEC) | PSE 2028 | ITE | ITE_POINTS_PSE |
| `R1B3-B(2027)` | R1B3-B (2027 SEC) | PSE 2028 | ITE | ITE_POINTS_PSE |
| `R1B3-C(2027)` | R1B3-C (2027 SEC) | PSE 2028 | ITE | ITE_POINTS_PSE |
| `B4(2027)` | B4 (2027 SEC) | PSE 2028 | ITE | ITE_POINTS_PSE |
| `ELMAB3:5Y(2027)` | ELMAB3 (2027 SEC) · 5th year | 5th year eligibility (2028) | Secondary school | G2EQ_5Y |
| `ELB3:5Y(2027)` | ELB3 (2027 SEC) · 5th year | 5th year eligibility (2028) | Secondary school | G2EQ_5Y |
| `MAB3:5Y(2027)` | MAB3 (2027 SEC) · 5th year | 5th year eligibility (2028) | Secondary school | G2EQ_5Y |
| `AI4(2026)` | AI4 (2026 O-Level) | NAFA / LASALLE diplomas (2027 intake) — the colleges' rule | Arts institution | AI_O_POINTS |
| `AI4(2027)` | AI4 (2027 SEC) | NAFA / LASALLE diplomas (2028 intake) — MOE's FSBB FAQ | Arts institution | AI_G3_2027, AI_G2EQ_2027 |
| `ELMAB3:NFP(2026)` | ELMAB3 (2026 N-Level) · NFP | NAFA Foundation Programme (Mar 2027) — NAFA's rule | Arts institution | NFP_2026 |
| `EMB1` | EMB1 | **stub** — rule source missing | — | — |
| `ELMAB3:NFP(2027)` | ELMAB3 (2027 SEC) · NFP | NAFA Foundation Programme (2028 intake) — NAFA's guide | Arts institution | NFP_2027 |
| `5TH-YEAR(2027)` | 5th year eligibility (2027 SEC) | summary: combines the three `:5Y` aggregates with L1R4 / ELR2B2 | Secondary school | — |

Pairs that share letters but are different rules, modelled separately on purpose:
`ELR2B2-C:POLY(2026)` vs `ELR2B2-C:ITE(2026)` (different 2nd-group lists); `ELMAB3:PFP(2027)` vs `ELMAB3:ITE(2027)`
(PFP: G3 9 and G2 5–6 unusable, ≤ 12; ITE: 9 → 5 and G2 6 = 6 usable, ≤ 19); `ELMAB3:DPP(2026)` vs `ELMAB3:PFP(2026)`;
`ELB3 / MAB3 / B4(2026)` (ITE points on N-Level) vs `ELB3:5Y / MAB3:5Y(2027)` (G2 grades) and `B4(2027)`;
`ELMAB3:NFP(2026)` (NAFA: O F9 not counted, ≤ 15) vs `ELMAB3:DPP(2026)` and `ELMAB3:PFP(2026)`.

- `AI4(2026)` — the colleges' rule: O-Level English C6 or better (`ai_english`) and the best 4 other O-Level subjects
  (English excluded, A1=1 … F9=9) at 25 or better. LASALLE mentions no bonus (`lasalle_min`: gross ≤ 25). NAFA
  counts up to 2 CCA points ("The CCA points can be used to improve their aggregate score for admission
  consideration"), so `net` is NAFA's net and `nafa_min` is net ≤ 25.
- `AI4(2027)` — MOE's FAQ: G3 English C6 or better and 4 other subjects, three at G3 (A1=1 … 9=9) and one at G2
  (a G3 grade mapped A1–B3=1, B4–C6=2, D7=3, E8=4, 9=5), 21 or better; NAFA's guide words it the same way. All four
  at G3: the lowest total over the choice of mapped subject equals MOE's "lowest grade mapped". G3 9 counts 9 and G2 6
  counts 6 (neither is excluded). LASALLE: `lasalle_min` gross ≤ 21 (was `ai_gross` before 0.1.7); NAFA: the same CCA
  points as 2026, `nafa_min` net ≤ 21.
- `ELMAB3:NFP(2026)` — NAFA's page: ELMAB3 (MA = Mathematics or Additional Mathematics) 15 or better excluding CCA
  bonus (`nfp_gross`); N(A) and O-Level combined, better grade, O-Level A1–B3=1, B4–C6=2, D7=3, E8=4, F9 not
  counted; N(A) 6 / U not counted (silent); N-Level results of different years are not combined (`single_year_levels`:
  the best single N-Level year is used, the other year's N-Level rows are listed as ignored); English N(A) grade 3 or
  better (`nfp_english`; an O-Level A1–D7 converts to 1–3), with NAFA's note that a 4 or 5 may still be considered with
  an interview (`near`).
- `ELMAB3:NFP(2027)` (engine 0.1.7) — NAFA's guide: ELMAB3 "computed with G2 subjects, excluding CCA points", 15 or
  better (`nfp_gross`); a G3 grade maps A1–B3=1, B4–C6=2, D7=3, E8=4, 9=5 (MOE's FSBB FAQ table for the NFP); G1 grades
  and G2 grade 6 are not counted (silent); English "SEC English subject Grade (G2) 3" (`nfp_english`; a G3 English
  A1–D7 maps to 1–3). No net. NAFA's N(A) interview note is not applied to SEC.

The N-Level definitions (`ELMAB3:DPP`, `ELMAB3:PFP`, JIE 'N', `B5`, all 2026) come from pages that describe the
2025 cycle; each carries a `source_vintage` note.

## How every aggregate is computed

1. **Entries** — rows are normalised (level, grade, subject id). A subject sat twice, or at two levels, stays one
   subject; for each slot the engine uses that subject's best entry **on that slot's scale** (PSE: "the better G2
   equivalent grade").
2. **Candidates per slot** — subjects the slot accepts (a group, named subjects, or any), whose grade the slot's scale
   lists, not in the definition's excluded groups (Religious Knowledge for JC / MI).
3. **Exact search** — depth-first over every assignment, each subject used once, MTL / HMTL rule enforced
   (`same_language`, or `any_language` for the 2026 JC / MI wording). Ranking: lowest total, then fewest soft
   requirement misses, then the better grade in the earlier slot (so "the better G3 subject is B1"), then input order.
   Identical consecutive slots are filled in candidate order only (removes permutations, keeps the optimum).
   Tests check it against a no-pruning brute force on random students.
4. **Greedy** — slots in order, each takes the lowest-points unused subject. Reported beside the
   exact total; `greedy_differs` flags a disagreement.
5. **Alternatives** — EL-as-L1 and HMTL-as-L1 are separate computations; the lower gross is used (ties: EL).
   The other first language can fill an open "any subject" slot.
6. **Bonus** (`bonus.py`) — schedule per definition, capped; affiliated-JC and language-elective points only in
   `net_variants`.
7. **Eligibility** (`eligibility.py`) — thresholds, JC / MI specific-subject grades and conditional admission, DPP
   families, PFP clusters, ITE 3-year aggregate-type MER, JIE 'N' passes, ITE JAE "5 O-Level subjects", the arts
   minimums. Course-level MER is not checked.

## Grades an aggregate does not use (`ignored`, engine 0.1.5)

| Mixed levels (2026) | O-Level | N(A) | N(T) | Same subject at two levels |
|---|---|---|---|---|
| JAE (L1R5, L1R4, Poly ELR2B2, ITE JAE) | counted | silent `jae_o_only` | silent `jae_o_only` | — (one level counts); two years: better, `moe_better_years` |
| JIE 'O' `B5` | counted | silent `jieo_o_only` | silent `jieo_o_only` | two sittings: better, silent `ite_sittings` |
| DPP / JIE 'H' | converted, F9 = 5 (aggregate only) | 1–5; 6 / U rule `dpp_na_6` | silent `dpp_nt` | better, rule `moe_better_na_o` |
| PFP | converted; 9 rule `pfp_o9` | 1–5; 6 / U silent `pfp_na_6` | silent `pfp_nt` | better, rule `moe_better_na_o` |
| JIE 'N' | A1–D7=1, E8=2, F9=3 | 1–3=1, 4=2, 5=3, 6/U=4 | A–E/U = 1–5 | better point, silent `jien_levels` |
| NFP | converted; F9 rule `nfp_o9` | 1–5; 6 / U silent `nfp_na_6` | silent `nfp_nt` | better, rule `nafa_better` |
| `AI4(2026)` | counted (English apart, `ai_english_apart`) | silent `ai_not_o` | silent `ai_not_o` | two sittings: silent `ai_sittings` |

PSE 2028 (rule unless marked): `L1R4(2027)` G2 / G1 `jcmi27_g3_only`; Poly ELR2B2 G3 9 and G2 5–6 `poly27_9_56`,
G1 `poly27_g1`; PFP G3 9 and G2 5–6 `pfp27_9_56`, G1 `pfp27_g1`; ITE 2-year G1 `ite2_g1`; ITE 3-year G1 U silent
`ite3_g1_u`; 5th year G2 6 `fifth_g2_6`, G1 `fifth_g1`; `AI4(2027)` G1 `ai27_g1`, English `ai27_english_apart`, a
subject at two levels silent `ai27_levels`; NFP (SEC, 0.1.7) G1 silent `nfp27_g1`, G2 6 silent `nfp27_g2_6`, two levels
silent `nafa_levels`; two levels `pse_better_g2` (ITE 3-year `ite3_better`); two years
`moe_better_years`. MTL 'B' Merit / Pass: rule `jae_mtl_b` for every 2026 JAE aggregate, silent elsewhere
(`ite_mtl_b`, `moe_mtl_b`, `nafa_mtl_b`, `ai_mtl_b`, `pse_mtl_b`, `ai27_mtl_b`); for the 2028 JC / MI MTL line a
'B' result makes the line "can't be worked out" (`silent_accepts`). Engine-wide: `absent`, `later_year`,
`not_best_years`, `duplicate` (rule), `no_points` (a Merit-type grade on another subject), `unlisted` (fallback, never
expected; silent).

## Module map

| File | What it holds |
|---|---|
| `subjects.py` | name matching (`_norm`, level-aware `resolve_subject_at`), subject catalogue (110 subjects, aliases, kind, language family, earlier-subject flag, `only_level`, `levels_by_system` from SEAB's lists; `examined_levels` / `examined_text` / `default_level`) and 30 named groups (`group_members` = as printed, `slot_members` = with earlier subjects by category) (MOE categories, PSE categories, Poly / ITE relevant-subject groups, PFP cluster lists) |
| `engine.py` | entry preparation (`prepare_entries` → entries, warnings, input_problems), candidate building, exact search, greedy, brute force (tests), per-definition `solve`, `year_sets` (2-year windows; single-year levels) |
| `ignored.py` | the `ignored` list and the silent entries a requirement may rest on |
| `bonus.py` | net = gross − bonus, caps, choice-only variants |
| `eligibility.py` | the check types listed below |
| `api.py` | `compute_all`, `compute`, `check_inputs`, `Result`, the 5th-year summary |
| `export_definitions.py` | writes `definitions.json` |
| `__main__.py` | CLI (`demo`, `json FILE`) |

Check types: `gross_max`, `net_max` (NAFA's minimums from 0.1.7; 0.1.5–0.1.6 had a `gross_max_or_net` type, now gone),
`subject_requirements` (with `no_result`, optional `near` note, `silent_accepts`, and `rests_on` when unknown),
`conditional_admission`, `constrained` (exact search with hard per-slot grade floors and optional slot overrides),
`min_subjects`, `passes`, `requires_level`, `info`.

## Porting to JavaScript

`definitions.json` holds every rule as data: `levels` (aliases, the `normalise` steps, grade order, `grade_strip_words`),
`mark_bands`, `scales`, `subjects`, `subject_name_matching` (separator rule, the `normalise` steps of `_norm`, the
`level_prefix` regex, level-specific names, only-level sources), `groups`
(with `effective_members`), `earlier_by_category`, `combine_rule`, `alternative_rule`, `empty_slot_rule`,
`display_name_rule`, `ignored_reasons`, `level_labels`, `examined_levels` (SEAB list groups, labels and the problem
text; each subject's `levels_by_system`), `id_table`, `definitions`, `summaries`. The code to port is small and has no rule data
in it: `prepare_entries`, `build_candidates`, `exact_search` (≈ 40 lines), `greedy_search`, `compute_bonus`, the
nine check types, and `fifth_year_summary` (reads `summaries[0]`). A Python test fails if the JSON is stale.
The port is done: `app/src/pse_core.js`, checked against this engine field by field (`app/README.md`).

## Not in scope (this build)

Course-level minimum entry requirements, tie-breaks and posting order, the arts
institutions' portfolio / audition / Higher Nitec routes, JPAE / DAE / EAE (no O/N aggregate), IB. Other small choices: JC CCA bonus reads only "Excellent" / "Good" (the JC
table has no A1–C6 CCA rows, unlike Poly / ITE); "English as a First / Second Language" (earlier subjects) cannot
fill an English slot.
