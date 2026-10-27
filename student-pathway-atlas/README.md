# Student Pathway Atlas

A page where a student keys in their N-Level, O-Level or 2027 SEC results and sees their aggregates, the pathways open to
them, and the courses within reach. Built by Koo Tiannuo, an educator in Singapore, with Claude
Code. It is one of the prototypes in this repository; please keep this credit when you adapt it.

## Who it is for

Secondary 4 and 5 students on results day, and the form teachers, Year Heads and ECG counsellors who talk them through
their options.

## Open it

Download this folder and double-click `Student Pathway Atlas v0.14.4.html`. It needs no install, no server and no login, and it works offline.
Nothing is sent anywhere: a student's entries stay in their own browser. It works on a phone and on a laptop.

## What it covers

- **Results:** 2026 O-Level, 2026 N(A)- and N(T)-Level, and 2027 SEC (G1, G2 and G3), including mixed levels.
- **Aggregates:** every aggregate MOE, ITE, NAFA and LASALLE use for these exams, among them L1R5, L1R4, ELR2B2-A to D,
  ELMAB3, ELB4-A, ELR1B3-B, R2B2, R1B3-A to C and B4, with the bonus points (CCA, Higher Mother Tongue, affiliation,
  LEP).
- **Routes:** JC, MI, polytechnic, PFP, DPP, ITE (JAE, JIE and PSE 2028), NAFA and LASALLE, and the 5th year.
- **Courses:** 414 courses from MOE CourseFinder, each with its 2026 net aggregate range. For 2027 SEC results, MOE has
  not published PSE 2028 ranges yet, so the page shows estimates worked out from the 2026 ranges, marked "Est.".

## Sources and admissions year

- Rules: MOE's JAE and PSE pages, ITE's JIE pages, and the NAFA and LASALLE admission pages. Every rule in
  `engine/definitions.py` names the page it comes from as `source-pages/<name>`. The table at the end links each one.
- Course list and 2026 ranges: MOE CourseFinder, downloaded on 17 Oct 2026 (`data/snapshots/2026-10-17/`).
- Secondary schools and affiliations: MOE SchoolFinder (`data/schools/`).
- Dates: MOE's press releases on school terms, and each exercise's own page (`data/calendar/`).

## How it was checked

- 67 worked examples from MOE's own pages give the same aggregates. They quote MOE's text, so they are not in this
  folder; they could become shared scenarios, rewritten as made-up students.
- 214 engine tests and 65 matcher tests on made-up students, worked out by hand from the rule text.
- The Python engine and the JS engine (`pse_core.js`) agree on 2,700 random students (`app/tools/parity.py`).
- `tests/qa_data.mjs` runs 69 checks of the built page in Chrome against the data and the engine.

## Rebuild and test

Python 3 and Node, standard library only, no packages.

```bash
python3 engine/export_definitions.py          # rules -> engine/definitions.json
python3 app/tools/build_data.py               # -> app/build/data.json
python3 app/tools/build_app.py                # -> app/dist/Student Pathway Atlas vX.Y.Z.html
(cd engine && python3 -m unittest discover -s tests)
(cd matcher && python3 -m unittest discover -s tests)
python3 app/tools/parity.py                   # the Python and JS engines agree (needs Node)
CHROME=/path/to/chrome node tests/qa_data.mjs http://127.0.0.1:8000/page.html   # the built page, served over http
```

`qa_data.mjs` reads the page over http (serve the built file with any static server), and needs Chrome.

## Assumptions

Where MOE's text is unclear, the engine uses the readings below. Each one is cited in the rules as
"Assumptions: ...", so a search for its title finds every rule that uses it.

### Rules MOE leaves unclear

- **Earlier O-Level subjects:** "Yes", by MOE category. An earlier O-Level Humanities, Mathematics or Science subject can
  fill a polytechnic relevant-subject group that holds a subject of the same MOE category.
- **JIE 'N' Mathematics / Science:** a Mathematics slot takes Mathematics or Additional Mathematics. Science is MOE's
  Science category, N(T) Science, and the five subjects ITE allows in lieu of Science. The 2027 ITE 3-year Mathematics
  slots use the same reading.
- **'Standard N-Level core Science (Physics, Chemistry, Biology) subjects count as Science'.**
- **LEP bonus:** the 2 LEP points sit outside the bonus cap (MOE press release, Annex B).
- **EL vs HMTL as L1:** both are worked out and the lower is used; a tie goes to English.
- **G3 pass:** A1 to C6. Where a G2 or G1 result is asked for, a G3 grade is first converted down with MOE's Full SBB
  table (A1–B3 → 1, B4–C6 → 2, D7 → 3, E8 → 4, 9 → 5). Grades convert down a level, never up.
- **Conditional admission to JC and MI:** it needs a result in the subject at the level asked. A G2 Mathematics does not
  open it where G3 Mathematics is asked, and an Absent grade never does.
- **Grade floors inside an aggregate:** G3 9, G2 6 and G1 E cannot meet a subject-specific requirement, but they still
  count in a slot that has no grade floor (ITE's PSE pages).
- **PFP for 2027 SEC:** G3 9, and G2 5 and 6, cannot be used (MOE's PSE PFP page).
- **Religious Knowledge:** excluded for JC and MI only; it counts for polytechnic, ITE and JIE.
- **2026 N-Level rules:** the same as the pages for the 2025 cycle, to be checked again in December.
- **The same subject at N- and O-Level in one year (JIE 'N'):** the better grade is used.
- **LASALLE:** uses the gross aggregate, as it mentions no bonus points. NAFA's minimum is checked on the net.
- **NAFA Foundation Programme for SEC:** when its ELMAB3 cannot be worked out, the page says to check with NAFA.

### When no subject can fill a slot

The aggregate shows "can't be worked out", with the reason, and no default score. An Absent subject is different: it
counts as the lowest grade of its level (G3 9, G2 6, G1 E), and it never meets a subject-specific requirement.

### Naming an aggregate on screen

`LETTERS (YEAR EXAM)`, for example `L1R4 (2027 SEC)`, named for the year the student sits the exam.

### Who the first version serves

For PSE 2028 the course matcher checks eligibility and thresholds only. The page adds the estimated ranges, marked "Est.".

### PFP extra MTL grades

A Mother Tongue grade beyond the five subjects counted does not change the PFP aggregate.

### School mark bands

When marks are typed instead of grades, the usual school mark bands turn them into grades (G3: 75 and above A1, 70 A2,
65 B3, 60 B4, 55 C5, 50 C6, 45 D7, 40 E8). These are not MOE text.

## Known gaps

- Course-specific entry requirements beyond the aggregate are checked where CourseFinder states them; a few are shown as
  "can't tell".
- Tie-breaks, posting order, and the portfolio, audition and interview routes are not covered. Neither are JPAE, DAE,
  EAE or the IB.
- The 2028 ranges are estimates until MOE publishes them in mid-2027.
- The data is a snapshot of 17 Oct 2026. The scrapers that refresh it are not in this folder.
- `matcher/requirements.json` ships ready. Rebuilding it (`python3 -m matcher build`) also reads MOE's aggregate-type PDF,
  which is not in this folder.
- EMB1, an aggregate some schools compute, has no source page, so the engine keeps it as a stub.

## Made-up students to try

| Student | Results | What the page shows |
|---|---|---|
| A | 2026 O-Level, CCA Good: English A2, Chinese B3, Mathematics A1, Additional Mathematics A2, Physics B3, Chemistry B4, Geography A2 | L1R5 gross 13, net 12; MI L1R4 net 9; Poly ELR2B2-C net 9 |
| B | 2027 SEC, CCA Excellent: G3 English B4, G2 Mathematics 2, G3 Chinese A2, G3 Science (Physics, Chemistry) C5, G2 Humanities 3, G3 Art B3 | JC and MI closed (L1R4 needs G3 Mathematics and Humanities); Poly ELR2B2-A net 14; PFP ELMAB3 8; ITE 2-year ELMAB3 8 |
| C | 2027 SEC: G3 English Absent, and A1 in Mathematics, Chinese, Physics, History and Geography | L1R4 13 (English counted as 9); JC and MI closed, with no conditional admission |

## Licence

The code is under the MIT licence (`LICENSE`). Course lists, ranges and dates belong to MOE and the institutions.

## Source pages

| Name | Page |
|---|---|
| `education_in_sg_our_programmes_clep_jc` | https://www.moe.gov.sg/education-in-sg/our-programmes/clep-jc |
| `education_in_sg_our_programmes_mlep_jc` | https://www.moe.gov.sg/education-in-sg/our-programmes/mlep-jc |
| `education_in_sg_our_programmes_tlep_jc` | https://www.moe.gov.sg/education-in-sg/our-programmes/tlep-jc |
| `ite__jie_aggregates` | https://www.ite.edu.sg/secondary-school-students/admissions/entry-qualifications/gce-n-level/for-gce-n-and-gce-o-students-jie-n/<br>https://www.ite.edu.sg/secondary-school-students/admissions/entry-qualifications/gce-n-level/for-gce-n-students-jie-h/<br>https://www.ite.edu.sg/secondary-school-students/admissions/entry-qualifications/gce-n-level/for-gce-n-students-jie-e/ |
| `nafa__admission_guide` | https://www.nafa.edu.sg/docs/default-source/corp-docs/course-brochures/admission-guide.pdf |
| `pdf__news_press_2025_96136c92` | https://www.moe.gov.sg/media/files/news/press/2025/96136c92-4c40-4052-8758-82f4e7bbf1d6.pdf |
| `pdf__post_secondary_2027_jae_240be16f_8870_4b37_821e_4ae50200285a_pdf` | https://www.moe.gov.sg/media/files/post-secondary/2027-jae/240be16f-8870-4b37-821e-4ae50200285a.pdf |
| `pdf__post_secondary_343f646d_986a_4496_b981_063d6d9346cc_pdf` | https://www.moe.gov.sg/media/files/post-secondary/343f646d-986a-4496-b981-063d6d9346cc.pdf |
| `pdf_transcribed__aggregate_types_2026_jae` | https://www.moe.gov.sg/media/files/post-secondary/2027-jae/b491ae0b-2e5b-4a6c-af74-25c6228e71c1.pdf<br>https://www.moe.gov.sg/media/files/post-secondary/2027-jae/2d3870c5-2a13-438a-8a4d-4d966581f9fd.pdf |
| `post_secondary_a_level_curriculum_and_subject_syllabuses` | https://www.moe.gov.sg/post-secondary/a-level-curriculum-and-subject-syllabuses |
| `post_secondary_admissions_dae` | https://www.moe.gov.sg/post-secondary/admissions/dae |
| `post_secondary_admissions_dpp` | https://www.moe.gov.sg/post-secondary/admissions/dpp |
| `post_secondary_admissions_dpp_apply` | https://www.moe.gov.sg/post-secondary/admissions/dpp/apply |
| `post_secondary_admissions_dpp_eligibility_criteria` | https://www.moe.gov.sg/post-secondary/admissions/dpp/eligibility-criteria |
| `post_secondary_admissions_dsa` | https://www.moe.gov.sg/post-secondary/admissions/dsa |
| `post_secondary_admissions_dsa_apply` | https://www.moe.gov.sg/post-secondary/admissions/dsa/apply |
| `post_secondary_admissions_dsa_receive_school_allocation_outcome` | https://www.moe.gov.sg/post-secondary/admissions/dsa/receive-school-allocation-outcome |
| `post_secondary_admissions_dsa_receive_selection_outcomes` | https://www.moe.gov.sg/post-secondary/admissions/dsa/receive-selection-outcomes |
| `post_secondary_admissions_dsa_withdraw` | https://www.moe.gov.sg/post-secondary/admissions/dsa/withdraw |
| `post_secondary_admissions_ite_eae` | https://www.moe.gov.sg/post-secondary/admissions/ite-eae |
| `post_secondary_admissions_ite_eae_apply` | https://www.moe.gov.sg/post-secondary/admissions/ite-eae/apply |
| `post_secondary_admissions_jae` | https://www.moe.gov.sg/post-secondary/admissions/jae |
| `post_secondary_admissions_jae_changes_from_2028` | https://www.moe.gov.sg/post-secondary/admissions/jae/changes-from-2028 |
| `post_secondary_admissions_jae_gce_o_level_subjects_and_categories` | https://www.moe.gov.sg/post-secondary/admissions/jae/gce-o-level-subjects-and-categories |
| `post_secondary_admissions_jae_institute_of_technical_education` | https://www.moe.gov.sg/post-secondary/admissions/jae/institute-of-technical-education |
| `post_secondary_admissions_jae_jae_eligibility` | https://www.moe.gov.sg/post-secondary/admissions/jae/jae-eligibility |
| `post_secondary_admissions_jae_junior_colleges_and_millennia_institute` | https://www.moe.gov.sg/post-secondary/admissions/jae/junior-colleges-and-millennia-institute |
| `post_secondary_admissions_jae_polytechnics` | https://www.moe.gov.sg/post-secondary/admissions/jae/polytechnics |
| `post_secondary_admissions_jae_release_of_posting_results` | https://www.moe.gov.sg/post-secondary/admissions/jae/release-of-posting-results |
| `post_secondary_admissions_jae_release_of_posting_results_submit_an_appeal` | https://www.moe.gov.sg/post-secondary/admissions/jae/release-of-posting-results/submit-an-appeal |
| `post_secondary_admissions_jae_request_assistance_for_jae_application` | https://www.moe.gov.sg/post-secondary/admissions/jae/request-assistance-for-jae-application |
| `post_secondary_admissions_jie_apply` | https://www.moe.gov.sg/post-secondary/admissions/jie/apply |
| `post_secondary_admissions_jpae` | https://www.moe.gov.sg/post-secondary/admissions/jpae |
| `post_secondary_admissions_jpae_apply` | https://www.moe.gov.sg/post-secondary/admissions/jpae/apply |
| `post_secondary_admissions_jpae_eligibility_criteria` | https://www.moe.gov.sg/post-secondary/admissions/jpae/eligibility-criteria |
| `post_secondary_admissions_pfp` | https://www.moe.gov.sg/post-secondary/admissions/pfp |
| `post_secondary_admissions_pfp_accept_reject_appeal` | https://www.moe.gov.sg/post-secondary/admissions/pfp/accept-reject-appeal |
| `post_secondary_admissions_pfp_apply` | https://www.moe.gov.sg/post-secondary/admissions/pfp/apply |
| `post_secondary_admissions_pfp_eligibility_criteria` | https://www.moe.gov.sg/post-secondary/admissions/pfp/eligibility-criteria |
| `post_secondary_admissions_pfp_release_of_appeal_outcome` | https://www.moe.gov.sg/post-secondary/admissions/pfp/release-of-appeal-outcome |
| `post_secondary_admissions_poly_eae` | https://www.moe.gov.sg/post-secondary/admissions/poly-eae |
| `post_secondary_admissions_poly_eae_apply` | https://www.moe.gov.sg/post-secondary/admissions/poly-eae/apply |
| `post_secondary_admissions_poly_eae_eligibility_criteria` | https://www.moe.gov.sg/post-secondary/admissions/poly-eae/eligibility-criteria |
| `post_secondary_admissions_pse` | https://www.moe.gov.sg/post-secondary/admissions/pse |
| `post_secondary_admissions_pse_explore_pathways` | https://www.moe.gov.sg/post-secondary/admissions/pse/explore-pathways |
| `post_secondary_admissions_pse_how_posting_works` | https://www.moe.gov.sg/post-secondary/admissions/pse/how-posting-works |
| `post_secondary_admissions_pse_how_to_apply` | https://www.moe.gov.sg/post-secondary/admissions/pse/how-to-apply |
| `post_secondary_admissions_pse_ite_2_year_higher_nitec` | https://www.moe.gov.sg/post-secondary/admissions/pse/ite-2-year-higher-nitec |
| `post_secondary_admissions_pse_ite_3_year_higher_nitec` | https://www.moe.gov.sg/post-secondary/admissions/pse/ite-3-year-higher-nitec |
| `post_secondary_admissions_pse_jc_and_mi` | https://www.moe.gov.sg/post-secondary/admissions/pse/jc-and-mi |
| `post_secondary_admissions_pse_pfp` | https://www.moe.gov.sg/post-secondary/admissions/pse/pfp |
| `post_secondary_admissions_pse_polytechnic_diploma_course` | https://www.moe.gov.sg/post-secondary/admissions/pse/polytechnic-diploma-course |
| `post_secondary_admissions_pse_pse_eligibility` | https://www.moe.gov.sg/post-secondary/admissions/pse/pse-eligibility |
| `psle_fsbb_full_subject_based_banding_faq` | https://www.moe.gov.sg/psle-fsbb/full-subject-based-banding/faq |
