# Course matcher

```bash
python3 -m matcher demo                    # five made-up students: counts per exercise, then the top lines
python3 -m matcher demo JAE-2027 --full    # one exercise, every course with reasons
python3 -m matcher build                   # snapshot -> matcher/requirements.json (+ the data findings below)
python3 -m matcher findings                # CourseFinder vs the MER PDF, fallbacks, unresolved names
python3 -m matcher json FILE               # FILE = {"subjects": [...], "bonus": {...}, "exercises": [...]}
python3 -m unittest discover -s matcher/tests   # 65 tests
```

```python
from matcher import match, match_report
results = match(subjects, bonus_inputs={"cca": "Good"}, exercises=["JAE-2027"])   # list[CourseResult]
report = match_report(subjects, bonus)   # + input_problems, warnings, counts per exercise and stream
```

`subjects` and `bonus_inputs` are exactly the engine's (see `engine/README.md`). Show `input_problems` first: a
dropped row changes every aggregate and every MER line.

## What it covers

| Exercise id | Results it reads | Stream (institution type) | Engine aggregate | Courses |
|---|---|---|---|---:|
| `JAE-2027` | 2026 O-Level | Junior college | `L1R5(2026)` | 34 |
| | | Millennia Institute | `L1R4(2026)` | 3 |
| | | Polytechnic diploma | `ELR2B2-A/B/D(2026)`, `ELR2B2-C:POLY(2026)` | 195 |
| | | ITE 2-year Higher Nitec | `ELB4-A`, `ELR1B3-B`, `ELR2B2-C:ITE` (2026) | 74 |
| `DPP-2027` (JIE 'H', Dec 2026) | 2026 N(A) (+ O) | ITE 2-year Higher Nitec | `ELMAB3:DPP(2026)` | 34 |
| `JIE-N-2027` (Dec 2026) | 2026 N-Level (O-Level holders may apply) | ITE 3-year Higher Nitec | `MAS1B3`, `ELB3`, `B4`, `MAB3`, `ELMAB2` (2026) | 73 |
| `PFP-2027` (Jan 2027) | 2026 N(A) (+ O) | Polytechnic Foundation Programme | `ELMAB3:PFP(2026)` | 194 |
| `PSE-2028` | 2027 SEC (+ earlier GCE) | Junior college / MI | `L1R4(2027)` | 34 / 3 |
| | | Polytechnic diploma | `ELR2B2-A…D(2027)` | 195 |
| | | PFP | `ELMAB3:PFP(2027)` | 194 |
| | | ITE 2-year Higher Nitec | `ELMAB3:ITE(2027)` | 74 |
| | | ITE 3-year Higher Nitec | `R2B2`, `R1B3-A/B/C`, `B4` (2027) | 73 |

1,180 course results per student when all five exercises are asked for, from 607 requirement records (one per
offering per 2026 route; ITE counts course × college). Exercise ids follow `data/exercises/exercises_2026-10-17.csv`.
Singapore Polytechnic's Nautical Studies (DNS) is DAE-led in the data: it appears under PFP only.

PSE 2028: eligibility and thresholds only, no cut-off comparison.
MOE has not published 2028 courses or MER ("revisit … in mid-2027"), so the matcher lists the 2026 courses (flag
`course_list_2026`), marks every PSE Poly, PFP and ITE row `requirements_note` = "2028 entry requirements not yet
published", and leaves `net_range_2026` blank on every PSE row. For those rows `eligible` is False when the aggregate
gate fails and None otherwise. JC / MI have no course-level MER and MOE has published their 2028 criteria
(`post_secondary_admissions_pse_jc_and_mi.md`), so they are fully decided and carry no note.

Not in scope: likelihood of admission, cut-off prediction, posting, tie-breaks, the app. JIE 'O' (O-Level 3-year
Higher Nitec, `B5(2026)`) has no course rows in the snapshot, so it is not matched.

## How a course is matched

`eligible` combines the blocking reasons: False if any is False, else None if any is None, else True.

1. **The aggregate** (`reasons[0]`, information; `label` = the display name, `aggregate_id` = the engine ID): gross /
   net from `compute_all`, or "can't be worked out: <the engine's reason>" (`cant_be_worked_out: true`) - never a
   default score.
3. **Course MER** (`id: "mer"`, with `lines[]`), in one of two modes chosen by the rule text:
   - *independent* (Poly JAE, ITE JAE, JIE 'N'): MER is a separate criterion ("2 criteria": aggregate and MER), so
     each line is checked on the student's results in the aggregate's exam-year window, and each line needs its own
     subject. A full search finds an assignment whenever one exists. "Sat for" lines use no
     subject.
   - *slots* (JIE 'H' / DPP, PFP): the rule ties the grades to the subjects that make up ELMAB3, so the lines become
     hard floors on the ELMAB3 slots with the total ≤ 19 / ≤ 12, decided by the engine's own constrained search
     (`engine.eligibility.constrained`, the code behind `dpp_family_*` and `pfp_cluster_*`).
   - JIE 'N' adds ITE's alternative "Or 2 GCE 'O' Grades (Grade 1-8) in any two subjects" (B4 courses: "Or completed
     GCE O-Level"), which CourseFinder does not print (`ite__jie_aggregates.md` §1.2).
5. **Notes** (`notes[]`): colour vision, medical tests, vaccination, PFP Year-1 progression requirements, remarks.
   Shown for the student to check; they never block. A Year-1 progression requirement reads "Needed to progress to
   Year 1 of this diploma: …"; Chinese Studies (N70) and Chinese Media & Communication (N88) take their wording from
   `COURSE_REQUIREMENTS` (kind `progression`: one of B4 O-Level Higher Chinese, B3 O-Level Chinese, 1 N(A) Chinese).

Each result also carries `moe_url` (CourseFinder / SchoolFinder page) and `institution_url` (the institution's own
page) from the taxonomy, `net_range_2026` as published (blank if none; blank on PFP rows, whose snapshot range is the
JAE one), `net_range_basis`, and `data_flags` (the taxonomy's flags plus the matcher's).

### Result fields (`CourseResult`)

| Field | Meaning |
|---|---|
| `exercise`, `exercise_label`, `stream` | e.g. `JAE-2027`, "JAE 2027", "Polytechnic diploma" |
| `institution_type`, `institution`, `course_code`, `ite_course_code`, `course_name`, `field_of_study`, `jc_stream`, `pfp_cluster` | from the taxonomy (`jc_stream` = Arts / Science / IB / Commerce) |
| `aggregate_type` (as published), `aggregate_id` (engine ID, the key), `aggregate_display_name`, `gross`, `net`, `aggregate_status` | the student's score for the aggregate this course uses |
| `net_range_2026`, `net_range_basis` | the 2026 range as published and the display name of the aggregate it is on (blank on PFP and PSE rows) |
| `requirements_note` | PSE Poly / PFP / ITE rows: "2028 entry requirements not yet published"; blank elsewhere (incl. PSE JC / MI) |
| `eligible` | True / False / None |
| `reasons[]` | `{id, kind: aggregate / gate / mer, label, met, detail, blocking, source, lines[]?}` (order: aggregate, engine gates, application requirement, MER); MER lines are `{id, text (as printed), met, satisfied_by[{subject, level, grade, year}], detail}` |
| `notes[]`, `data_flags[]`, `moe_url`, `institution_url`, `requirement_key`, `route` | check-yourself notes, flags, both links, the record behind the result |

## MER notation and every interpretation (with sources)

| MER text | Reading | Source |
|---|---|---|
| `1-7` on a Poly / ITE JAE course | O-Level grade 7 or better (A1 … D7); N-Level grades do not meet it | O-Level grades are counted by number: JAE page "Gross aggregate score = Sum of all O-Level subject grades" (`post_secondary_admissions_jae.md`); the MER PDF's own notes say "grade 1 to 4 for O-level English Language" (N14, T01) |
| `Higher Chinese or Chinese (1-4 or 1-3)` | Higher Chinese 1-4, or Chinese 1-3 (grades pair with subjects in printed order) | MER PDF N70 / N88 / N95 cells print "Higher Chinese or 1-4 / Chinese 1-3"; the PFP page gives the same pair as "B4 for O-Level Higher Chinese / B3 for O-Level Chinese" |
| `A-D or 1-5` (JIE 'N') | N(T) grade A-D or N(A) grade 1-5 | ITE JIE 'N' PDF: "3 GCE 'N' Passes (Grade A-D or Grade 1-5)" (`ite__jie_aggregates.md` §1.2-1.3) |
| `1-3`, `1-4`, `1-5` (JIE 'H') | N(A) grade n or better; O-Level grades converted by the DPP table (A1-B3=1 … E8=4, F9=5) and F9 never meets a line | `post_secondary_admissions_dpp_eligibility_criteria.md` ("Grade conversion", "The O-Level grade of F9 will not be considered for subject specific requirements") |
| `1-3`, `1-4` (PFP) | N(A) grade n or better; O-Level grades converted by the PFP table, grade 9 unusable | `post_secondary_admissions_pfp_eligibility_criteria.md`; the conversion is stated for the aggregate and applied to the floors as the engine does |
| `Any one of the following subjects` + list (source) | CourseFinder JSON list (preferred); the MER PDF list where CourseFinder has none (C23, T72) | `pdf_mer.py` |
| `Any 2 other subjects`, `One other subject`, `Any 2 other subjects excluding CCA` | that many subjects not used by the other lines | literal |
| `Additional Mathematics, Mathematics or Principles of Accounts`; `Computing/Computer Studies`; `Science (Physics, Chemistry)/Physical Science` | alternatives split on top-level " or ", "," and "/" (inside parentheses the engine's own rule) | literal |
| `Media Studies (English/Chinese)`, `Art/Higher Art` | either subject | MOE's aggregate-type PDF lists them separately |
| `Mathematics (Elementary/Additional)` (ITE notes) | Mathematics or Additional Mathematics | the MER PDF prints "Additional Mathematics / Mathematics" for the same note |
| `Mathematics or Science*` (JIE 'N') | Mathematics or Additional Mathematics, the engine's `SCIENCE_ANY_LEVEL`, or one of the five subjects the footnote allows in lieu of Science | `ite__jie_aggregates.md` §1.2 footnote |
| Diploma in Nursing | `nursing_net` (≤ 28; PSE ≤ 24) for the Poly courses named "Nursing" (C97, N69) | JAE Poly page; MER PDF footnotes "28 points or better to be eligible for C97 / N69" |
| colour vision, medical, eyesight, swimming, vaccination | a note; never blocks | brief |

Every subject name is resolved through the engine's catalogue (`engine.subjects`). The snapshot has no name the
catalogue cannot resolve; an unresolved name would be listed in `requirements.json` → `findings.unresolved_names`
and flagged `mer_subject_unresolved` on the course.

## Data findings

- **1,830 MER lines** in 570 course records (Poly + ITE JAE 827 incl. 32 "sat for", PFP 776, JIE 'H' 102,
  JIE 'N' 125):
  1,823 read cleanly from the CourseFinder JSON, 7 taken from MOE's consolidated MER PDF, **0 left unknown**.
- **CourseFinder vs the MER PDF** (`matcher/pdf_mer.py` parses the PDF tables, merged cells inherited within a
  table): 258 of 269 Poly / ITE JAE courses agree. Unreadable in CourseFinder, PDF used: C23 and T72 (no subject
  list), T66 (no slot-2 subject name), V14 / V15 / V41 / V43 (English printed in N-Level notation "A-D or 1-5"; PDF
  1-8). Disagreeing: V37 (any two others 1-8 vs 1-7, PDF adds "sat for A Maths / Maths"), V38 and V55 (PDF adds the
  "sat for" note), V83 (different b and c lines). For these four both readings are evaluated, and `eligible` is
  definite only when they agree. Flags: `mer_line_from_pdf`, `mer_json_pdf_differ`.
- PFP: R68 has no relevant-subject list; the Sciences/DET or HAMB list from MOE's PFP page is used by cluster
  (`pfp_list_from_cluster`).

## `requirements.json` (for the JS port)

Written by `python3 -m matcher build`; a test fails when it is stale. One line per record:
`{key, route, institution_type, institution, course_code, ite_course_code, course_name, field_of_study, stream,
pfp_cluster, pfp_subcluster, duration, aggregate_type, net_range_2026, moe_url, institution_url,
is_nursing_diploma, mer: {mode, lines, alternatives, pdf_variant, status, source, pdf_check, rule_source,
aggregate_id?}, notes, data_flags, application_requirements? [{id, label, lines, source, decision}]}`. Line kinds: `subject` (`options[{subjects, groups, max_grade{G3/G2/G1: worst
grade}}]`), `any_other` (`count`, `max_grade`), `sat_for` (`subjects`), `completed` (`levels`), `slot` (`slots`,
`accepts` or null, `max_points`), `unknown` (`unknown_reason`). Also `exercises` (the stream table, incl.
`nursing_replaces` and PSE 2028's `requirements_note_detail / _source / _decision`) and `findings`.
Code to port: `evaluate.eval_independent` (≈ 60 lines), `eval_slots` (calls the engine's constrained search, which
the engine port already needs) and `match._course_result`. The port is done: `app/src/pse_core.js` (`app/README.md`).

## Module map

| File | What it holds |
|---|---|
| `names.py` | MER subject names → engine ids / groups; grade notation |
| `pdf_mer.py` | the consolidated MER PDF text → MER per course code |
| `parse.py` | snapshot JSON + taxonomy → requirement records; PDF fallback and cross-check; slot binding |
| `exercises.py` | exercises, streams, engine aggregate per published type, gates |
| `evaluate.py` | MER evaluation (independent lines, alternatives, PDF variants, ELMAB3 slots) |
| `match.py` | `match`, `match_report`, `CourseResult` |
| `__main__.py` | CLI (`demo`, `build`, `findings`, `json`) |
| `tests/` | 65 tests on invented students, incl. 1,600 random students checked against the engine's DPP / PFP / JIE 'N' checks (400 of them with N(T) grades for DPP) |
