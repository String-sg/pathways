"""One declarative definition per aggregate ID. Plain dicts only — exported to definitions.json.

ID scheme (see README): `LETTERS(YEAR)`, YEAR = the exam year whose results the rule applies to
(CLAUDE.md rule 3). When the same letters + year name two different rules, or the letters are only
used inside an eligibility check, a route tag goes before the year: `LETTERS:TAG(YEAR)`
(tags: POLY, ITE, DPP, PFP, 5Y).

Definition fields
  slots         ordered slots: name, label, accepts ({"any": true} | {"groups": [...]} | {"subjects": [...]}),
                scale (key into grades.SCALES), optional mer ({"max_points": n, "exclude_mer_unusable": bool}),
                source. A slot `mer` is only a tie-break inside the aggregate; hard checks live in `checks`.
  alternatives  separate computations that override some slots (EL vs HMTL as L1); the lowest gross is used.
  exclude_groups subjects that may never fill any slot (Religious Knowledge for JC / MI).
  mtl_rule      "same_language" (MTL + HMTL of one language not both), "any_language" (no HMTL with any MTL),
                or null (source silent).
  max_year      results from exam years after this are ignored; results from more than 2 exam years are
                combined 2 years at a time (best pair used).
  bonus         schedule (bonus.py), or null with `bonus_missing_reason`.
  checks        eligibility checks (eligibility.py).
  status        "implemented" | "stub" (stub => not computable, with `stub_reason`).
"""

RB = "source-pages/"


def src(file, heading):
    return {"file": RB + file, "heading": heading}


F_JC26 = "post_secondary_admissions_jae_junior_colleges_and_millennia_institute.md"
F_OLVL = "post_secondary_admissions_jae_gce_o_level_subjects_and_categories.md"
F_POLY26 = "post_secondary_admissions_jae_polytechnics.md"
F_POLYPDF = "pdf_transcribed__aggregate_types_2026_jae.md"
F_ITE26 = "post_secondary_admissions_jae_institute_of_technical_education.md"
F_ITEJIE = "ite__jie_aggregates.md"
F_DPP = "post_secondary_admissions_dpp_eligibility_criteria.md"
F_PFP26 = "post_secondary_admissions_pfp_eligibility_criteria.md"
F_PSE_JCMI = "post_secondary_admissions_pse_jc_and_mi.md"
F_PSE_POLY = "post_secondary_admissions_pse_polytechnic_diploma_course.md"
F_PSE_PFP = "post_secondary_admissions_pse_pfp.md"
F_PSE_ITE2 = "post_secondary_admissions_pse_ite_2_year_higher_nitec.md"
F_PSE_ITE3 = "post_secondary_admissions_pse_ite_3_year_higher_nitec.md"
F_PSE_ELIG = "post_secondary_admissions_pse_pse_eligibility.md"
F_PSE_PATH = "post_secondary_admissions_pse_explore_pathways.md"
F_FAQ = "psle_fsbb_full_subject_based_banding_faq.md"
F_JAE_ELIG = "post_secondary_admissions_jae_jae_eligibility.md"

ANY = {"any": True}

F_README = "README.md"  # the readings used where MOE's text is unclear


def reading(topic):
    """A reading where MOE's text is unclear: listed under Assumptions in README.md."""
    return {"file": F_README, "heading": "Assumptions: " + topic}


UNCLEAR = "Rules MOE leaves unclear"

F_ARTS = "data/locations/arts_institutions_2027.csv"
NAFA_DIP_SRC = {"file": F_ARTS, "url": "https://www.nafa.edu.sg/admissions/diploma-admissions/faculty-of-art-design",
                "heading": "NAFA diplomas: 'An aggregate score of 25 points or better in 4 GCE O-Level subjects, "
                           "excluding English'; English 'GCE O-Level/SEC at G3 English' C6; 'Up to 2 CCA bonus points "
                           "... are subtracted from your aggregate scores to obtain the net aggregate scores for "
                           "application' (A1-A2/Excellent 2, B3-C6/Good 1)"}
NAFA_GUIDE = RB + "nafa__admission_guide.md"
NAFA_CCA_SRC = {"file": NAFA_GUIDE,
                "heading": "Diploma, footnote *: 'Applicants who are active in their Secondary Schools' Co-curricular "
                           "Activities (CCA) may gain up to 2 CCA points. The CCA points can be used to improve their "
                           "aggregate score for admission consideration.' (applies to the O-Level 25 and the SEC 21; "
                           "CCA counts)"}
NAFA_NFP_SEC_SRC = {"file": NAFA_GUIDE,
                    "heading": "NFP, Singapore Secondary Education Certificate (SEC): 'An aggregate ELMAB3 (English "
                               "Language, Mathematics, Best 3 other subjects) score of 15 points or better, which is "
                               "computed with G2 subjects, excluding CCA points. For applicants who have taken subjects "
                               "at G3, these subjects will be mapped from G3 to G2'; Language Proficiency: 'SEC English "
                               "subject Grade (G2) 3'"}
LASALLE_SRC = {"file": F_ARTS, "url": "https://www.lasalle.edu.sg/study/admissions/diploma-admissions/",
               "heading": "LASALLE diplomas: 'GCE O-Level with a pass in English at Grade C6 or better, and an aggregate "
                          "score of 25 points or better in four other GCE O-Level subjects' (no bonus points mentioned)"}
NAFA_NFP_SRC = {"file": F_ARTS, "url": "https://www.nafa.edu.sg/admissions/foundation-admissions",
                "heading": "NAFA Foundation Programme: 'An aggregate ELMAB3 (English Language, Mathematics, Best 3 other "
                           "subjects) score of 15 points or better, excluding CCA Bonus Points'; N(A) and O-Level results "
                           "may be combined ('only the better grade will be used'; F9 does not count); English 'a minimum "
                           "of Grade 3' at N(A) (grade 4 or 5: interview, 'on a case-by-case basis'); N-Level results from "
                           "different years cannot be combined"}
# Soft requirement: the slot's pick should not be a grade that can never meet a subject requirement
# (G3 9 / G2 6 / G1 E on ITE scales, O-Level F9 for JIE 'H'). Used only to break ties inside the aggregate.
PRE = {"exclude_mer_unusable": True}


def G(*groups):
    return {"groups": list(groups)}


def slot(name, label, accepts, scale, source, mer=None):
    d = {"name": name, "label": label, "accepts": accepts, "scale": scale, "source": source}
    if mer is not None:
        d["mer"] = mer
    return d


def best_slots(prefix, n, scale, source, start=1, mer=None):
    return [slot("%s%d" % (prefix, i), "%s%d: best other subject" % (prefix, i), ANY, scale, source, mer)
            for i in range(start, start + n)]


EL_HMTL_ALTERNATIVES = [
    {"id": "EL", "label": "English Language as L1", "slot_overrides": {"L1": {"accepts": G("ENGLISH")}}},
    {"id": "HMTL", "label": "Higher Mother Tongue Language as L1", "slot_overrides": {"L1": {"accepts": G("HMTL")}}},
]

# ---------------------------------------------------------------------------------------------- bonus
CCA_JC = {"EXCELLENT": 2, "GOOD": 1}
CCA_POLY_ITE = {"EXCELLENT": 2, "A1": 2, "A2": 2, "GOOD": 1, "B3": 1, "B4": 1, "C5": 1, "C6": 1}

_EL_HMTL_ITEM = {"id": "el_hmtl", "label": "English Language and Higher MTL both A1 to C6", "type": "grades_all",
                 "requirements": [G("ENGLISH"), G("HMTL")], "level": "G3", "max_grade": "C6", "points": 2}
_SP_BI_ITEM = {"id": "sp_bi", "label": "Chinese (SP), Malay (SP) or Bahasa Indonesia A1 to C6", "type": "grades_any",
               "accepts": G("SP_OR_BI"), "level": "G3", "max_grade": "C6", "points": 2}

BONUS_JC_2026 = {
    "cap": 4,
    "source": src(F_JC26, "Bonus points for JC admission"),
    "also_sources": [src("pdf__news_press_2025_96136c92.md", "Annex B Bonus Point System (Additional 2 bonus points ... not included in bonus points cap)")],
    "items": [
        {"id": "cca", "label": "CCA grade (Excellent 2, Good 1)", "type": "cca", "table": CCA_JC},
        _EL_HMTL_ITEM, _SP_BI_ITEM,
        {"id": "affiliated_jc", "label": "Affiliated JC (1st, or 1st and 2nd, choice only)", "type": "flag",
         "flag": "affiliated_jc", "points": 2, "scope": "choice"},
    ],
    "uncapped": [
        {"id": "lep", "label": "CLEP / MLEP / TLEP (only if posted to the JC offering it)", "type": "flag",
         "flag": "lep", "points": 2, "scope": "choice",
         "note": "Outside the cap of 4 (MOE press release Annex B).",
         "sources": [src("pdf__news_press_2025_96136c92.md", "Annex B Bonus Point System (Additional 2 bonus points ... not included in bonus points cap)"), reading(UNCLEAR + " (LEP bonus)")]},
    ],
}
BONUS_MI_2026 = {
    "cap": 4,
    "source": src(F_JC26, "Bonus points for MI admission"),
    "items": [{"id": "cca", "label": "CCA grade (Excellent 2, Good 1)", "type": "cca", "table": CCA_JC},
              _EL_HMTL_ITEM, _SP_BI_ITEM],
    "uncapped": [],
}
BONUS_JCMI_2027 = {
    "cap": 3,
    "source": src(F_PSE_JCMI, "Bonus points criteria"),
    "also_sources": [src("pdf__news_press_2025_96136c92.md", "Annex B Bonus Point System (Additional 2 bonus points ... not included in bonus points cap)")],
    "items": [
        {"id": "cca", "label": "CCA grade (Excellent 2, Good 1)", "type": "cca", "table": CCA_JC},
        _EL_HMTL_ITEM, _SP_BI_ITEM,
        {"id": "affiliated_jc", "label": "Affiliated JC (JC choices only; 1st, or 1st and 2nd, choice)", "type": "flag",
         "flag": "affiliated_jc", "points": 2, "scope": "choice", "applies_to": "JC"},
    ],
    "uncapped": [
        {"id": "lep", "label": "CLEP / MLEP / TLEP (JC only, if selected for the programme)", "type": "flag",
         "flag": "lep", "points": 2, "scope": "choice", "applies_to": "JC",
         "note": "Outside the cap of 3 (MOE press release Annex B).",
         "sources": [src("pdf__news_press_2025_96136c92.md", "Annex B Bonus Point System (Additional 2 bonus points ... not included in bonus points cap)"), reading(UNCLEAR + " (LEP bonus)")]},
    ],
}


def bonus_cca_only(source):
    return {"cap": 2, "source": source,
            "items": [{"id": "cca", "label": "CCA grade (Excellent / A1-A2 = 2, Good / B3-C6 = 1)", "type": "cca",
                       "table": CCA_POLY_ITE}],
            "uncapped": []}


# ---------------------------------------------------------------------------------------------- checks
def gross_max(cid, label, mx, source):
    return {"id": cid, "type": "gross_max", "label": label, "max": mx, "source": source}


def net_max(cid, label, mx, source):
    return {"id": cid, "type": "net_max", "label": label, "max": mx, "source": source}


def info(cid, label, source=None):
    return {"id": cid, "type": "info", "label": label, "source": source}


MER_NOT_CHECKED = info("course_mer", "Course minimum entry requirements (MER) are not checked by this engine")

JC_SUBJECTS_2026 = [
    {"label": "English Language A1 to C6", "options": [{"accepts": G("ENGLISH"), "max_grade": {"G3": "C6"}}]},
    {"label": "Any 1 Mathematics (Additional Mathematics or Mathematics) A1 to D7",
     "options": [{"accepts": G("MATHS_OR_AMATHS"), "max_grade": {"G3": "D7"}}]},
    {"label": "Any 1 MTL: MTL / MTL-in-lieu A1 to D7, Higher MTL A1 to E8, 'B' Syllabus Merit or Pass",
     "options": [{"accepts": G("MTL", "MTL_IN_LIEU"), "max_grade": {"G3": "D7"}},
                 {"accepts": G("HMTL"), "max_grade": {"G3": "E8"}},
                 {"accepts": G("MTL_B"), "grades": ["MERIT", "PASS"]}]},
]
JC_SUBJECTS_2027 = [
    {"label": "G3 English Language A1 to C6", "options": [{"accepts": G("ENGLISH"), "max_grade": {"G3": "C6"}}]},
    {"label": "Any 1 Mathematics (G3 Additional Mathematics or G3 Mathematics) A1 to D7",
     "options": [{"accepts": G("MATHS_OR_AMATHS"), "max_grade": {"G3": "D7"}}]},
    {"label": "Any 1 MTL / MTL-in-lieu: G3 A1 to D7, G2 1 to 5, G1 A to D; HMTL A1 to E8",
     "options": [{"accepts": G("MTL", "MTL_IN_LIEU"), "max_grade": {"G3": "D7", "G2": "5", "G1": "D"}},
                 {"accepts": G("HMTL"), "max_grade": {"G3": "E8"}}],
     # The 2028 table has no 'B' Syllabus row, yet the page says students 'offer either H1 MTL or MTL 'B' at JC and
     # MI': a 'B' Syllabus result makes this line "can't be worked out", not "not met".
     "silent_accepts": G("MTL_B")},
]


def subject_requirements(cid, label, items, source):
    return {"id": cid, "type": "subject_requirements", "label": label, "items": items, "source": source}


def conditional(cid, label, when_failed, gross_ok, band, rel_slots, source):
    return {"id": cid, "type": "conditional_admission", "label": label, "when_failed": when_failed,
            "gross_max": gross_ok, "band": band, "relevant_slots": rel_slots,
            "relevant_grades": {"G3": ["A1", "A2"]}, "source": source}


def constrained(cid, label, slot_mer, source, total_max=None, slot_accepts=None, provisional=None):
    d = {"id": cid, "type": "constrained", "label": label, "slot_mer": slot_mer, "total_max": total_max,
         "source": source}
    if slot_accepts:
        d["slot_accepts"] = slot_accepts
    if provisional:
        d["provisional"] = provisional
    return d


def passes(cid, label, any_of, source):
    return {"id": cid, "type": "passes", "label": label, "any_of": any_of, "source": source}


N_PASS = {"G2": "5", "G1": "D"}  # "3 GCE 'N' Passes (Grade A-D or Grade 1-5)"
O_GRADE_1_8 = {"label": "2 GCE O-Level grades 1-8 in any two subjects", "count": 2, "pass_grades": {"G3": "E8"},
               "must_include": []}


def jien_mer(prereqs, label):
    return passes("jien_mer", "JIE 'N' MER: " + label, [
        {"label": "3 GCE N-Level passes (A-D or 1-5) incl. " + label, "count": 3, "pass_grades": N_PASS,
         "must_include": prereqs},
        O_GRADE_1_8], src(F_ITEJIE, "1.2 Which courses have which prerequisite group"))


# ---------------------------------------------------------------------------------------------- definitions
DEFINITIONS = []


def add(d):
    d.setdefault("status", "implemented")
    d.setdefault("alternatives", [])
    d.setdefault("exclude_groups", [])
    d.setdefault("checks", [])
    d.setdefault("notes", [])
    d.setdefault("open_questions", [])
    DEFINITIONS.append(d)
    return d


# ===== 2026 GCE O-Level -> JAE 2027 ==========================================================================
S = src(F_JC26, "Junior college (JC) > Aggregate score computation for JC courses")
add({
    "id": "L1R5(2026)", "letters": "L1R5", "exam_year": 2026, "max_year": 2026, "exam": "GCE O-Level",
    "exam_key": "O", "pathway": "jc",
    "exercise": "JAE 2027 (also DSA-JC)", "institution": "JC", "route": "JC 2-year A-Level / IBDP",
    "slots": [
        slot("L1", "L1: English or Higher Mother Tongue Language", G("ENGLISH", "HMTL"), "O_POINTS", S),
        slot("R1", "R1: best Humanities", G("JAE_HUMANITIES"), "O_POINTS", S),
        slot("R2", "R2: best Mathematics or Science", G("JAE_MATHEMATICS", "JAE_SCIENCE"), "O_POINTS", S),
        slot("R3", "R3: best Humanities, Mathematics or Science", G("JAE_HUMANITIES", "JAE_MATHEMATICS", "JAE_SCIENCE"),
             "O_POINTS", S),
        slot("R4", "R4: best other subject", ANY, "O_POINTS", S),
        slot("R5", "R5: best other subject", ANY, "O_POINTS", S),
    ],
    "alternatives": EL_HMTL_ALTERNATIVES,
    "exclude_groups": ["RELIGIOUS_KNOWLEDGE"],
    "mtl_rule": "any_language",
    "bonus": BONUS_JC_2026,
    "checks": [
        gross_max("jc_gross", "JC: L1R5 gross <= 20", 20, src(F_JC26, "Junior college (JC) > criterion 1")),
        subject_requirements("jc_subjects", "JC: grade requirements for specific subjects", JC_SUBJECTS_2026,
                             src(F_JC26, "Junior college (JC) > Grade requirements for specific subjects")),
        conditional("jc_conditional", "JC: conditional admission (gross <= 15, or 16-20 with A1/A2 in all 5 relevant subjects)",
                    "jc_subjects", 15, [16, 20], ["R1", "R2", "R3", "R4", "R5"],
                    src(F_JC26, "Junior college (JC) > Conditional admission criteria")),
    ],
    "sources": [S, src(F_OLVL, "Humanities / Mathematics / Science / Religious Knowledge + earlier subjects"),
                src(F_JC26, "What cannot be used for aggregate computation")],
    "notes": ["Religious Knowledge cannot fill any slot.",
              "'Both Higher Mother Tongue and Mother Tongue' read literally: no HMTL with any MTL or MTL-in-lieu.",
              "MTL 'B' Merit / Pass grades carry no points.",
              "The other first language may fill R4/R5 (EL when HMTL is L1; HMTL when EL is L1)."],
    "open_questions": [],
})

S = src(F_JC26, "Millennia Institute (MI) > Aggregate score computation for MI courses")
add({
    "id": "L1R4(2026)", "letters": "L1R4", "exam_year": 2026, "max_year": 2026, "exam": "GCE O-Level",
    "exam_key": "O", "pathway": "mi",
    "exercise": "JAE 2027", "institution": "MI", "route": "MI 3-year A-Level",
    "slots": [
        slot("L1", "L1: English or Higher Mother Tongue Language", G("ENGLISH", "HMTL"), "O_POINTS", S),
        slot("R1", "R1: best Humanities, Mathematics or Science", G("JAE_HUMANITIES", "JAE_MATHEMATICS", "JAE_SCIENCE"),
             "O_POINTS", S),
        slot("R2", "R2: best Humanities, Mathematics or Science", G("JAE_HUMANITIES", "JAE_MATHEMATICS", "JAE_SCIENCE"),
             "O_POINTS", S),
        slot("R3", "R3: best other subject", ANY, "O_POINTS", S),
        slot("R4", "R4: best other subject", ANY, "O_POINTS", S),
    ],
    "alternatives": EL_HMTL_ALTERNATIVES,
    "exclude_groups": ["RELIGIOUS_KNOWLEDGE"],
    "mtl_rule": "any_language",
    "bonus": BONUS_MI_2026,
    "checks": [
        gross_max("mi_gross", "MI: L1R4 gross <= 20", 20, src(F_JC26, "Millennia Institute (MI) > criterion 1")),
        subject_requirements("mi_subjects", "MI: grade requirements for specific subjects", JC_SUBJECTS_2026,
                             src(F_JC26, "Millennia Institute (MI) > Grade requirements for specific subjects")),
        conditional("mi_conditional", "MI: conditional admission (gross <= 15, or 16-20 with A1/A2 in all 4 relevant subjects)",
                    "mi_subjects", 15, [16, 20], ["R1", "R2", "R3", "R4"],
                    src(F_JC26, "Millennia Institute (MI) > Conditional admission criteria")),
    ],
    "sources": [S, src(F_OLVL, "Humanities / Mathematics / Science / Religious Knowledge + earlier subjects")],
    "notes": ["MI's 2026 rule (R1, R2 from Humanities, Mathematics or Science) - not the 2027 SEC L1R4."],
    "open_questions": [],
})

POLY_2026_SRC = src(F_POLY26, "Aggregate computation for polytechnic diploma courses")
for suffix in "ABCD":
    pdf = src(F_POLYPDF, "Poly - ELR2B2-%s%s" % (suffix, " (Poly)" if suffix == "C" else ""))
    checks = [net_max("poly_net", "Poly diploma: ELR2B2 net <= 26", 26,
                      src(F_POLY26, "Admission matters and courses offered > criterion 1"))]
    if suffix == "C":
        checks.append(net_max("nursing_net", "Diploma in Nursing: ELR2B2-C net <= 28", 28,
                              src(F_POLY26, "Admission matters and courses offered > criterion 1 (Nursing)")))
    checks.append(MER_NOT_CHECKED)
    add({
        "id": ("ELR2B2-C:POLY(2026)" if suffix == "C" else "ELR2B2-%s(2026)" % suffix),
        "letters": "ELR2B2-" + suffix, "route_tag": "POLY" if suffix == "C" else None,
        "exam_year": 2026, "max_year": 2026, "exam": "GCE O-Level", "exam_key": "O", "pathway": "poly",
        "exercise": "JAE 2027",
        "institution": "Polytechnic", "route": "Polytechnic diploma",
        "slots": [
            slot("EL", "EL: English Language", G("ENGLISH"), "O_POINTS", pdf),
            slot("R1", "R1: best of the 1st group of relevant subjects", G("POLY_%s_G1" % suffix), "O_POINTS", pdf),
            slot("R2", "R2: best of the 2nd group of relevant subjects", G("POLY_%s_G2" % suffix), "O_POINTS", pdf),
            slot("B1", "B1: best other subject", ANY, "O_POINTS", pdf),
            slot("B2", "B2: best other subject", ANY, "O_POINTS", pdf),
        ],
        "mtl_rule": "same_language",
        "bonus": bonus_cca_only(src(F_POLY26, "Bonus points for polytechnic admission")),
        "checks": checks,
        "sources": [POLY_2026_SRC, pdf, src(F_POLY26, "What cannot be used for aggregate computation"),
                    reading(UNCLEAR + " (earlier O-Level subjects: Yes, by MOE category; grade 9 - see notes)"),
                    ],
        "notes": ["R1 = 1st group, R2 = 2nd group (the PDF splits the R2 row into two groups; ITE's own PDF says "
                  "'1 best-scoring subject from the 1st Group plus 1 from the 2nd Group').",
                  "Grade 9 is counted in the aggregate: the engine follows MOE's printed results. MER lines still need their own grade "
                  "ranges.",
                  "An earlier O-Level Humanities / Mathematics / Science subject may fill a group that holds a subject "
                  "of the same MOE category.",
                  "Religious Knowledge may fill a B slot - the RK exclusion is stated for JC / MI only."],
        "open_questions": [],
    })

ITE_JAE_SRC = src(F_ITE26, "Aggregate computation for 2-year Higher Nitec courses")
ITE_JAE_CHECKS = [
    {"id": "ite_sat5", "type": "min_subjects", "label": "Sat at least 5 O-Level subjects over a maximum of 2 years",
     "levels": ["G3"], "count": 5, "source": src(F_ITE26, "Admission matters and courses offered > criterion 1")},
    MER_NOT_CHECKED,
]
ITE_JAE_BONUS = bonus_cca_only(src(F_ITE26, "Bonus points for ITE admission"))
ITE_JAE_COMMON = {
    "exam_year": 2026, "max_year": 2026, "exam": "GCE O-Level", "exam_key": "O", "pathway": "ite",
    "exercise": "JAE 2027", "institution": "ITE",
    "route": "ITE 2-year Higher Nitec", "mtl_rule": "same_language", "bonus": ITE_JAE_BONUS,
    "checks": ITE_JAE_CHECKS, "open_questions": [],
}
S = src(F_POLYPDF, "ITE - ELB4-A")
add(dict(ITE_JAE_COMMON, **{
    "id": "ELB4-A(2026)", "letters": "ELB4-A",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "O_POINTS", S)] + best_slots("B", 4, "O_POINTS", S),
    "sources": [ITE_JAE_SRC, S, src(F_ITEJIE, "5. JAE (O-Level, 2-year Higher Nitec)")],
}))
S = src(F_POLYPDF, "ITE - ELR1B3-B")
add(dict(ITE_JAE_COMMON, **{
    "id": "ELR1B3-B(2026)", "letters": "ELR1B3-B",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "O_POINTS", S),
              slot("R1", "R1: best of Additional Mathematics, Mathematics, Principles of Accounts", G("ITE_R1B3B_R1"),
                   "O_POINTS", S)] + best_slots("B", 3, "O_POINTS", S),
    "sources": [ITE_JAE_SRC, S],
}))
S = src(F_POLYPDF, "ITE - ELR2B2-C (ITE)")
add(dict(ITE_JAE_COMMON, **{
    "id": "ELR2B2-C:ITE(2026)", "letters": "ELR2B2-C", "route_tag": "ITE",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "O_POINTS", S),
              slot("R1", "R1: best of the 1st group (Additional Mathematics, Mathematics)", G("ITE_C_G1"), "O_POINTS", S),
              slot("R2", "R2: best of the 2nd group (ITE list)", G("ITE_C_G2"), "O_POINTS", S)]
             + best_slots("B", 2, "O_POINTS", S),
    "sources": [ITE_JAE_SRC, S, src(F_ITEJIE, "5. JAE (O-Level, 2-year Higher Nitec)")],
    "notes": ["Different 2nd-group list from the Poly ELR2B2-C."],
}))

S = src(F_ITEJIE, "4. JIE 'O' (3-year Higher Nitec, O-Level)")
add({
    "id": "B5(2026)", "letters": "B5", "exam_year": 2026, "max_year": 2026, "exam": "GCE O-Level",
    "exam_key": "O", "pathway": "jie_o",
    "source_vintage": "ITE's JIE 'O' page describes the Jan 2026 intake (2025 O-Level); assumed unchanged.",
    "exercise": "JIE 'O' (Jan 2027 intake)", "institution": "ITE", "route": "ITE 3-year Higher Nitec (O-Level)",
    "slots": best_slots("B", 5, "JIEO_POINTS", S),
    "mtl_rule": None,
    "bonus": bonus_cca_only(S),
    "checks": [passes("o_grades", "MER (courses that ask for it): 2 GCE O-Level grades 1-8 in any two subjects",
                      [O_GRADE_1_8], S), MER_NOT_CHECKED],
    "sources": [S],
    "notes": ["'B5' is this engine's label: ITE says 'best 5 GCE O subjects'.",
              "ITE pages describe the Jan 2026 intake; assumed unchanged."],
    "open_questions": [],
})

VINTAGE_2025 = ("The source pages describe the 2025 N-Level cycle (Jan 2026 intake); the rule is assumed unchanged for "
                "the 2026 N-Level.")

# ===== 2026 GCE N-Level -> JIE 'H' / DPP, PFP, JIE 'N' ==========================================================
S = src(F_ITEJIE, "2. JIE 'H' (2-year Higher Nitec under DPP) - ELMAB3")
S_DPP = src(F_DPP, "Eligibility criteria")
dpp_floor = {"max_points": 5, "exclude_mer_unusable": True}
add({
    "id": "ELMAB3:DPP(2026)", "letters": "ELMAB3", "route_tag": "DPP", "exam_year": 2026, "max_year": 2026,
    "exam_key": "N", "pathway": "dpp",
    "source_vintage": VINTAGE_2025,
    "exam": "GCE N(A)-Level (+ O-Level subjects)", "exercise": "JIE 'H' / DPP (Dec 2026)", "institution": "ITE",
    "route": "ITE 2-year Higher Nitec under DPP",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "ITE_POINTS_JIEH", S, PRE),
              slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "ITE_POINTS_JIEH", S, PRE)]
             + best_slots("B", 3, "ITE_POINTS_JIEH", S, mer=PRE),
    "mtl_rule": "same_language",
    "bonus": bonus_cca_only(src(F_ITEJIE, "2.3 CCA bonus (PDF p.5)")),
    "checks": [
        {"id": "dpp_na", "type": "requires_level", "level": "G2",
         "label": "Has N(A)-Level results (DPP is for Secondary 4 N(A) students; N(T) students cannot apply)",
         "source": src(F_ITEJIE, "2.1 Slots and eligibility (FAQ A21, A22)")},
        gross_max("dpp_gross", "ELMAB3 raw (gross) <= 19", 19, S_DPP),
        constrained("dpp_family_asci", "Applied sciences / engineering / infocomm: EL 1-4, MA 1-4, 3 others 1-5 "
                    "(F9 cannot meet these)",
                    {"EL": {"max_points": 4, "exclude_mer_unusable": True},
                     "MA": {"max_points": 4, "exclude_mer_unusable": True},
                     "B1": dpp_floor, "B2": dpp_floor, "B3": dpp_floor}, S_DPP, total_max=19),
        constrained("dpp_family_bs", "Business & services / hospitality: EL 1-3, MA 1-4, 3 others 1-5 (F9 cannot meet these)",
                    {"EL": {"max_points": 3, "exclude_mer_unusable": True},
                     "MA": {"max_points": 4, "exclude_mer_unusable": True},
                     "B1": dpp_floor, "B2": dpp_floor, "B3": dpp_floor}, S_DPP, total_max=19),
        MER_NOT_CHECKED,
    ],
    "sources": [S, S_DPP],
    "notes": ["Rules from ITE's Jan 2026-intake documents and MOE's DPP page (2025 N-Level cycle); assumed unchanged "
              "for the 2026 N-Level.",
              "O-Level grades from the same year convert to N(A)-equivalent points; same subject at both levels: better grade.",
              "Bonus is not used for eligibility; net = gross - CCA bonus is the posting score."],
    "open_questions": [],
})

S = src(F_PFP26, "Eligibility criteria / Grade conversion")
pfp_b = {"max_points": 4}
add({
    "id": "ELMAB3:PFP(2026)", "letters": "ELMAB3", "route_tag": "PFP", "exam_year": 2026, "max_year": 2026,
    "exam_key": "N", "pathway": "pfp",
    "source_vintage": VINTAGE_2025,
    "exam": "GCE N(A)-Level (+ O-Level subjects)", "exercise": "PFP (Jan 2027)", "institution": "Polytechnic",
    "route": "Polytechnic Foundation Programme",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "PFP_2026", S),
              slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "PFP_2026", S)]
             + best_slots("B", 3, "PFP_2026", S),
    "mtl_rule": "same_language",
    "bonus": None,
    "bonus_missing_reason": "The 2026 PFP pages give no bonus schedule (raw ELMAB3 excludes CCA bonus); net not computed.",
    "checks": [
        {"id": "pfp_na", "type": "requires_level", "level": "G2",
         "label": "Has N(A)-Level results (PFP is for Secondary 4 N(A) students)",
         "source": src("post_secondary_admissions_pfp.md", "Who can apply")},
        gross_max("pfp_gross", "ELMAB3 raw (gross) <= 12", 12, S),
        constrained("pfp_cluster_sci",
                    "Sciences / Design, Engineering & Technology / Nursing: EL, MA and 1 relevant subject grade 3 or better, "
                    "2 others grade 4 or better, total <= 12",
                    {"EL": {"max_points": 3}, "MA": {"max_points": 3}, "B1": {"max_points": 3}, "B2": pfp_b, "B3": pfp_b},
                    S, total_max=12, slot_accepts={"B1": G("PFP_REL_SCI")}),
        constrained("pfp_cluster_hum",
                    "Humanities, Art, Media & Business / ECDE / Tamil Studies: EL, MA and 1 relevant subject grade 3 or "
                    "better, 2 others grade 4 or better, total <= 12",
                    {"EL": {"max_points": 3}, "MA": {"max_points": 3}, "B1": {"max_points": 3}, "B2": pfp_b, "B3": pfp_b},
                    S, total_max=12, slot_accepts={"B1": G("PFP_REL_HUM")}),
        MER_NOT_CHECKED,
    ],
    "sources": [S],
    "notes": ["MOE's PFP page describes the 2025 N-Level cycle; assumed unchanged for the 2026 N-Level.",
              "The relevant subject is read as one of the 3 B subjects making up ELMAB3.",
              "Tamil Studies / Chinese Studies extra MTL grade requirements are course-level and not checked."],
    "open_questions": [],
})

JIEN_SRC = src(F_ITEJIE, "1. JIE 'N' (3-year Higher Nitec) - 1.1 Slot rule, 1.2 groups, 1.3 points")
JIEN_READING = reading(UNCLEAR + " (JIE 'N' Mathematics / Science)")
JIEN_COMMON = {
    "source_vintage": VINTAGE_2025, "exam_key": "N", "pathway": "jie_n",
    "exam_year": 2026, "max_year": 2026, "exam": "GCE N-Level (+ O-Level subjects)", "exercise": "JIE 'N' (Dec 2026)",
    "institution": "ITE", "route": "ITE 3-year Higher Nitec", "mtl_rule": None,
    "bonus": bonus_cca_only(src(F_ITEJIE, "1.4 CCA bonus points (p.8)")),
    "sources": [JIEN_SRC, JIEN_READING],
    "notes": ["ITE's JIE 'N' documents describe the Jan 2026 intake (2025 N-Level); assumed unchanged.",
              "Letters are MOE CourseFinder labels; ITE says 'best 4 N-Level subjects including pre-requisites'.",
              "Mathematics slots take Mathematics or Additional Mathematics; 'Science' = MOE's Science category "
              "(incl. N(A) combined sciences) + N(T) Science, plus ITE's 5 substitute subjects.",
              "ITE states no MTL / HMTL or Religious Knowledge rule for JIE 'N'."],
    "open_questions": [],
}
MATH_OR_SCI = G("ITE_MATHEMATICS", "SCIENCE_ANY_LEVEL", "ITE_SCIENCE_SUBSTITUTES")
add(dict(JIEN_COMMON, **{
    "id": "MAS1B3(2026)", "letters": "MAS1B3",
    "slots": [slot("R1", "Mathematics or Science (or an ITE substitute subject)", MATH_OR_SCI, "ITE_POINTS_JIEN",
                   JIEN_SRC, PRE)] + best_slots("B", 3, "ITE_POINTS_JIEN", JIEN_SRC),
    "checks": [jien_mer([MATH_OR_SCI], "Mathematics or Science"), MER_NOT_CHECKED],
}))
add(dict(JIEN_COMMON, **{
    "id": "ELB3(2026)", "letters": "ELB3",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "ITE_POINTS_JIEN", JIEN_SRC, PRE)]
             + best_slots("B", 3, "ITE_POINTS_JIEN", JIEN_SRC),
    "checks": [jien_mer([G("ENGLISH")], "English Language"), MER_NOT_CHECKED],
}))
add(dict(JIEN_COMMON, **{
    "id": "B4(2026)", "letters": "B4",
    "slots": best_slots("B", 4, "ITE_POINTS_JIEN", JIEN_SRC),
    "checks": [info("jien_mer", "JIE 'N' MER for these courses: completed GCE N- or O-Level", JIEN_SRC), MER_NOT_CHECKED],
}))
add(dict(JIEN_COMMON, **{
    "id": "MAB3(2026)", "letters": "MAB3",
    "slots": [slot("MA", "MA: Mathematics", G("ITE_MATHEMATICS"), "ITE_POINTS_JIEN", JIEN_SRC, PRE)]
             + best_slots("B", 3, "ITE_POINTS_JIEN", JIEN_SRC),
    "checks": [jien_mer([G("ITE_MATHEMATICS")], "Mathematics"), MER_NOT_CHECKED],
}))
add(dict(JIEN_COMMON, **{
    "id": "ELMAB2(2026)", "letters": "ELMAB2",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "ITE_POINTS_JIEN", JIEN_SRC, PRE),
              slot("MA", "MA: Mathematics", G("ITE_MATHEMATICS"), "ITE_POINTS_JIEN", JIEN_SRC, PRE)]
             + best_slots("B", 2, "ITE_POINTS_JIEN", JIEN_SRC),
    "checks": [passes("jien_mer", "JIE 'N' MER: 3 N-Level passes in English Language, Mathematics and one other subject", [
        {"label": "3 GCE N-Level passes (A-D or 1-5) incl. English Language and Mathematics", "count": 3,
         "pass_grades": N_PASS, "must_include": [G("ENGLISH"), G("ITE_MATHEMATICS")]}, O_GRADE_1_8],
        src(F_ITEJIE, "1.2 Group NURS")), MER_NOT_CHECKED],
}))

# ===== 2027 SEC -> PSE 2028 =====================================================================================
S = src(F_PSE_JCMI, "Aggregate score computation (L1R4, G3 subject level)")
add({
    "id": "L1R4(2027)", "letters": "L1R4", "exam_year": 2027, "max_year": 2027, "exam_key": "SEC", "pathway": "jc_mi",
    "exam": "SEC (G3) + earlier GCE O-Level, any 2 years", "exercise": "PSE 2028", "institution": "JC / MI",
    "route": "JC 2-year A-Level / IBDP; MI 3-year A-Level",
    "slots": [
        slot("L1", "L1: G3 English or Higher Mother Tongue Language", G("ENGLISH", "HMTL"), "G3_POINTS", S),
        slot("R1", "R1: best G3 Humanities", G("PSE_HUMANITIES"), "G3_POINTS", S),
        slot("R2", "R2: best G3 Mathematics or Science", G("PSE_MATHEMATICS", "PSE_SCIENCE"), "G3_POINTS", S),
        slot("R3", "R3: best G3 Humanities, Mathematics or Science", G("PSE_HUMANITIES", "PSE_MATHEMATICS", "PSE_SCIENCE"),
             "G3_POINTS", S),
        slot("R4", "R4: best other G3 subject", ANY, "G3_POINTS", S),
    ],
    "alternatives": EL_HMTL_ALTERNATIVES,
    "exclude_groups": ["RELIGIOUS_KNOWLEDGE"],
    "mtl_rule": "same_language",
    "bonus": BONUS_JCMI_2027,
    "checks": [
        gross_max("jc_gross", "JC: L1R4 gross <= 16", 16, src(F_PSE_JCMI, "Admission criteria starting from 2028 PSE")),
        gross_max("mi_gross", "MI: L1R4 gross <= 20", 20, src(F_PSE_JCMI, "Admission criteria starting from 2028 PSE")),
        subject_requirements("jcmi_subjects", "JC / MI: grade requirements for specific subjects", JC_SUBJECTS_2027,
                             src(F_PSE_JCMI, "Grade requirements for specific subjects")),
        conditional("jc_conditional", "JC: conditional admission (gross <= 12, or 13-16 with A1/A2 in all 4 relevant subjects)",
                    "jcmi_subjects", 12, [13, 16], ["R1", "R2", "R3", "R4"],
                    src(F_PSE_JCMI, "Conditional admission criteria > For JC")),
        conditional("mi_conditional", "MI: conditional admission (gross <= 15, or 16-20 with A1/A2 in all 4 relevant subjects)",
                    "jcmi_subjects", 15, [16, 20], ["R1", "R2", "R3", "R4"],
                    src(F_PSE_JCMI, "Conditional admission criteria > For MI")),
    ],
    "sources": [S, src(F_PSE_JCMI, "G3 subjects for L1R4 aggregate computation"),
                src("post_secondary_admissions_jae_changes_from_2028.md", "Rule statements found inside worked examples")],
    "notes": ["G3 only (O-Level = G3). An O-Level MTL taken in Sec 3 in 2026 can be combined with 2027 SEC results.",
              "EL-as-L1 and HMTL-as-L1 are computed separately; the lower is used.",
              "Affiliated-JC and language-elective bonus apply to JC choices only (net_variants).",
              "G3 grade 9 counts 9 points: the page does not exclude it."],
    "open_questions": [],
})

PSE_POLY = src(F_PSE_POLY, "Aggregate computation (EL, R1, R2, B1 at G3; B2 at G2-equivalent)")
for suffix in "ABCD":
    pdf = src(F_POLYPDF, "Poly - ELR2B2-%s%s (lists 'based on 2026 JAE')" % (suffix, " (Poly)" if suffix == "C" else ""))
    checks = [net_max("poly_net", "Poly diploma: ELR2B2 net <= 22", 22, src(F_PSE_POLY, "criterion 1"))]
    if suffix == "C":
        checks.append(net_max("nursing_net", "Diploma in Nursing: ELR2B2-C net <= 24", 24, src(F_PSE_POLY, "criterion 1 (Nursing)")))
    checks.append(MER_NOT_CHECKED)
    add({
        "id": "ELR2B2-%s(2027)" % suffix, "letters": "ELR2B2-" + suffix, "exam_year": 2027, "max_year": 2027,
        "exam_key": "SEC", "pathway": "poly",
        "exam": "SEC + earlier GCE O/N(A)-Level, any 2 years", "exercise": "PSE 2028", "institution": "Polytechnic",
        "route": "Polytechnic diploma",
        "slots": [
            slot("EL", "EL: G3 English Language", G("ENGLISH"), "G3_POINTS_NO9", PSE_POLY),
            slot("R1", "R1: best G3 subject of the 1st group", G("POLY_%s_G1" % suffix), "G3_POINTS_NO9", pdf),
            slot("R2", "R2: best G3 subject of the 2nd group", G("POLY_%s_G2" % suffix), "G3_POINTS_NO9", pdf),
            slot("B1", "B1: best other G3 subject", ANY, "G3_POINTS_NO9", PSE_POLY),
            slot("B2", "B2: 2nd best subject at G2 or G3, G2-equivalent grade", ANY, "G2EQ_NO_FAIL", PSE_POLY),
        ],
        "mtl_rule": "same_language",
        "bonus": bonus_cca_only(src(F_PSE_POLY, "Bonus points for admission")),
        "checks": checks,
        "sources": [PSE_POLY, pdf, src(F_PSE_POLY, "Rule statements found inside worked examples (R1 of ELR2B2-B)")],
        "notes": ["G3 grade 9 and G2 grade 5-6 cannot be used. Two G3 subjects for B1/B2: the better one is B1.",
                  "Same subject at G2 and G3: the better G2-equivalent grade is used for B2.",
                  "Subject lists are the 2026 JAE lists the PSE page links to; earlier O-Level subjects join them by "
                  "MOE category as for 2026."],
        "open_questions": [],
    })

S = src(F_PSE_PFP, "Aggregate computation for PFP cluster")
pfp27_b = {"max_points": 4}
add({
    "id": "ELMAB3:PFP(2027)", "letters": "ELMAB3", "route_tag": "PFP", "exam_year": 2027, "max_year": 2027,
    "exam_key": "SEC", "pathway": "pfp",
    "exam": "SEC (G2/G3) + earlier GCE, any 2 years", "exercise": "PSE 2028", "institution": "Polytechnic",
    "route": "Polytechnic Foundation Programme",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "G2EQ_NO_FAIL", S),
              slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "G2EQ_NO_FAIL", S)]
             + best_slots("B", 3, "G2EQ_NO_FAIL", S),
    "mtl_rule": "same_language",
    "bonus": bonus_cca_only(src(F_PSE_PFP, "Bonus points (maximum of 2 bonus points from CCA grade)")),
    "checks": [
        gross_max("pfp_gross", "ELMAB3 (G2-equivalent) gross <= 12", 12, src(F_PSE_PFP, "criterion 1")),
        constrained("pfp_cluster_sci",
                    "Sciences / DET / Nursing cluster MER: EL, MA, 1 relevant subject G2 grade 3 or better, 2 best grade 4 "
                    "or better, total <= 12",
                    {"EL": {"max_points": 3}, "MA": {"max_points": 3}, "B1": {"max_points": 3}, "B2": pfp27_b, "B3": pfp27_b},
                    src(F_FAQ, "What are the PFP eligibility criteria?"), total_max=12,
                    slot_accepts={"B1": G("PFP_REL_SCI")},
                    provisional="Relevant-subject lists are the 2026 PFP lists; MOE says to revisit in mid-2027."),
        constrained("pfp_cluster_hum",
                    "Humanities, Art, Media & Business / ECDE / Tamil Studies cluster MER: EL, MA, 1 relevant subject G2 "
                    "grade 3 or better, 2 best grade 4 or better, total <= 12",
                    {"EL": {"max_points": 3}, "MA": {"max_points": 3}, "B1": {"max_points": 3}, "B2": pfp27_b, "B3": pfp27_b},
                    src(F_FAQ, "What are the PFP eligibility criteria?"), total_max=12,
                    slot_accepts={"B1": G("PFP_REL_HUM")},
                    provisional="Relevant-subject lists are the 2026 PFP lists; MOE says to revisit in mid-2027."),
        MER_NOT_CHECKED,
    ],
    "sources": [S, src(F_PSE_PFP, "Mapping of G3/O-Level grade to G2/N(A)-Level grade"),
                src(F_PSE_PFP, "Rule statements found inside worked examples (G1 cannot be used)")],
    "notes": ["G3 grade 9, G2 grade 5-6 and all G1 grades cannot be used (PSE PFP page; the FSBB FAQ's table maps 9 -> 5 "
              "instead)."],
    "open_questions": [],
})

S = src(F_PSE_ITE2, "Aggregate computation for 2-Year Higher Nitec courses")
add({
    "id": "ELMAB3:ITE(2027)", "letters": "ELMAB3", "route_tag": "ITE", "exam_year": 2027, "max_year": 2027,
    "exam_key": "SEC", "pathway": "ite_2y",
    "exam": "SEC (G2/G3) + earlier GCE, any 2 years", "exercise": "PSE 2028", "institution": "ITE",
    "route": "ITE 2-year Higher Nitec",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "G2EQ_FULL", S, PRE),
              slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "G2EQ_FULL", S, PRE)]
             + best_slots("B", 3, "G2EQ_FULL", S, mer=PRE),
    "mtl_rule": "same_language",
    "bonus": bonus_cca_only(src(F_PSE_ITE2, "Bonus points")),
    "checks": [gross_max("ite2_gross", "ELMAB3 (G2-equivalent) gross <= 19", 19, src(F_PSE_ITE2, "criterion 1")),
               MER_NOT_CHECKED],
    "sources": [S, src(F_PSE_ITE2, "Mapping of G3/O-Level grade to G2/N(A)-Level grade"),
                src(F_PSE_ITE2, "Rule statements found inside worked examples (G1 cannot be used)")],
    "notes": ["G3 grade 9 (=5) and G2 grade 6 (=6) count in the aggregate but cannot meet subject MER.",
              "Differs from ELMAB3:PFP(2027): different grade floors and threshold."],
    "open_questions": [],
})

S3 = src(F_PSE_ITE3, "Aggregate computation for 3-Year Higher Nitec courses")
ITE3_COMMON = {
    "exam_key": "SEC", "pathway": "ite_3y",
    "exam_year": 2027, "max_year": 2027, "exam": "SEC (G1/G2/G3) + earlier GCE, any 2 years", "exercise": "PSE 2028",
    "institution": "ITE", "route": "ITE 3-year Higher Nitec", "mtl_rule": "same_language",
    "bonus": bonus_cca_only(src(F_PSE_ITE3, "Bonus points for ITE admission")),
    "sources": [S3, src(F_PSE_ITE3, "Grade conversion to ITE aggregate points"),
                reading(UNCLEAR + " (JIE 'N' Mathematics: A Maths counts - applied here by analogy)")],
    "notes": ["'Mathematics' slots take Mathematics or Additional Mathematics: the JIE 'N' reading applied by analogy "
              "to its 2028 successor."],
    "open_questions": [],
}


def ite3(did, letters, lead_slots, n_best, mer_slots):
    slots = list(lead_slots)
    for i in range(1, n_best + 1):
        name = "B%d" % i
        slots.append(slot(name, "%s: best other subject" % name, ANY, "ITE_POINTS_PSE", S3,
                          PRE if name in mer_slots else None))
    checks = []
    if mer_slots:
        checks.append(constrained("ite3_mer", "MER of the aggregate type: %s at G3 A1-E8 / G2 1-5 / G1 A-D"
                                  % ", ".join(mer_slots), {n: PRE for n in mer_slots}, S3))
    else:
        checks.append(info("ite3_mer", "No grade requirement for this aggregate type", S3))
    checks.append(MER_NOT_CHECKED)
    return add(dict(ITE3_COMMON, **{"id": did, "letters": letters, "slots": slots, "checks": checks}))


ite3("R2B2(2027)", "R2B2",
     [slot("R1", "R1: English Language", G("ENGLISH"), "ITE_POINTS_PSE", S3, PRE),
      slot("R2", "R2: Mathematics", G("ITE_MATHEMATICS"), "ITE_POINTS_PSE", S3, PRE)], 2, ["R1", "R2", "B1"])
ite3("R1B3-A(2027)", "R1B3-A",
     [slot("R1", "R1: Mathematics", G("ITE_MATHEMATICS"), "ITE_POINTS_PSE", S3, PRE)], 3, ["R1", "B1", "B2"])
ite3("R1B3-B(2027)", "R1B3-B",
     [slot("R1", "R1: Mathematics or Science", G("ITE_MATHEMATICS", "SCIENCE_ANY_LEVEL"), "ITE_POINTS_PSE", S3, PRE)],
     3, ["R1", "B1", "B2"])
ite3("R1B3-C(2027)", "R1B3-C",
     [slot("R1", "R1: English Language", G("ENGLISH"), "ITE_POINTS_PSE", S3, PRE)], 3, ["R1", "B1", "B2"])
ite3("B4(2027)", "B4", [], 4, [])

S5 = src(F_PSE_PATH, "5th year in secondary school")
FIVE_COMMON = {
    "exam_key": "SEC", "pathway": "5y",
    "exam_year": 2027, "max_year": 2027, "exam": "SEC (G2/G3), computed at G2", "exercise": "5th year eligibility (2028)",
    "institution": "Secondary school", "route": "5th year in secondary school", "mtl_rule": "same_language",
    "bonus": None, "bonus_missing_reason": "Gross only: the 5th-year criteria use gross aggregates.",
    "sources": [S5, src(F_FAQ, "Grade Mapping Table (G3 to G2)")],
    "notes": ["Engine label: the page names ELMAB3 / ELB3 / MAB3 'computed at G2'; MA read as Mathematics or "
              "Additional Mathematics as in the PSE ELMAB3 pages.",
              "Every subject used must be at least Grade 5 at G2 (G2 grade 6 cannot be used)."],
    "open_questions": [],
}
EL5 = slot("EL", "EL: English Language", G("ENGLISH"), "G2EQ_5Y", S5)
MA5 = slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "G2EQ_5Y", S5)
add(dict(FIVE_COMMON, **{
    "id": "ELMAB3:5Y(2027)", "letters": "ELMAB3", "route_tag": "5Y",
    "slots": [EL5, MA5] + best_slots("B", 3, "G2EQ_5Y", S5),
    "checks": [gross_max("fifth_year", "5th year (2 or fewer G3 passes): gross ELMAB3 <= 21", 21, S5),
               gross_max("fifth_year_all_g3", "May offer all subjects at G3 in the 5th year: gross ELMAB3 <= 19", 19, S5)],
}))
add(dict(FIVE_COMMON, **{
    "id": "ELB3:5Y(2027)", "letters": "ELB3", "route_tag": "5Y",
    "slots": [EL5] + best_slots("B", 3, "G2EQ_5Y", S5),
    "checks": [gross_max("fifth_year", "5th year (2 or fewer G3 passes): gross ELB3 <= 14", 14, S5)],
}))
add(dict(FIVE_COMMON, **{
    "id": "MAB3:5Y(2027)", "letters": "MAB3", "route_tag": "5Y",
    "slots": [MA5] + best_slots("B", 3, "G2EQ_5Y", S5),
    "checks": [gross_max("fifth_year", "5th year (2 or fewer G3 passes): gross MAB3 <= 14", 14, S5)],
}))

# The 5th-year eligibility summary combines several results; its thresholds live here as data.
FIFTH_YEAR_2027 = {
    "id": "5TH-YEAR(2027)", "exam_year": 2027, "exercise": "5th year eligibility (2028)",
    "institution": "Secondary school", "route": "5th year in secondary school",
    "source": S5,
    "g3_pass_max_grade": "C6",
    "g3_pass_note": "A G3 pass is A1-C6 (50 marks and above). Where a G2 or G1 result is asked, G3 grades are first "
                    "converted down (MOE's Full SBB conversion table).",
    "criterion_a": {"label": "3 or more G3 passes, and not qualified for JC, MI or a polytechnic diploma",
                    "min_g3_passes": 3, "jcmi_aggregate": "L1R4(2027)",
                    "jc_ok": [["jc_gross", "jcmi_subjects"], ["jc_conditional"]],
                    "mi_ok": [["mi_gross", "jcmi_subjects"], ["mi_conditional"]],
                    "poly_aggregates": ["ELR2B2-A(2027)", "ELR2B2-B(2027)", "ELR2B2-C(2027)", "ELR2B2-D(2027)"],
                    "poly_fail_net_from": 23},
    "criterion_b": {"label": "2 or fewer G3 passes, and gross ELMAB3 <= 21, ELB3 <= 14 or MAB3 <= 14 at G2",
                    "max_g3_passes": 2,
                    "any_of": [{"aggregate": "ELMAB3:5Y(2027)", "max": 21}, {"aggregate": "ELB3:5Y(2027)", "max": 14},
                               {"aggregate": "MAB3:5Y(2027)", "max": 14}]},
    "all_g3": {"label": "May offer all subjects at G3 in the 5th year (gross ELMAB3 at G2 <= 19)",
               "aggregate": "ELMAB3:5Y(2027)", "max": 19},
    "open_questions": [],
}
SUMMARIES = [FIFTH_YEAR_2027]

# ===== stubs ==================================================================================================
STUB_COMMON = {"slots": [], "mtl_rule": None, "bonus": None, "status": "stub", "max_year": None,
               "exam_key": None, "pathway": None}
add(dict(STUB_COMMON, **{
    "id": "EMB1", "letters": "EMB1", "exam_year": None, "exam": None, "exercise": None, "institution": None, "route": None,
    "stub_reason": "rule source missing: no MOE or ITE page defines EMB1 (it appears only in a school's own results spreadsheet)",
    "sources": [{"file": "README.md", "heading": "Known gaps"}], "open_questions": [],
}))
# ===== arts institutions (engine 0.1.5) =========================================================================
# 2026 O-Level -> NAFA / LASALLE diplomas (2027 intake): the colleges' own pages, not MOE. No cut-offs are published;
# 25 points is a minimum, never a cut-off.
AI_APTITUDE = "Portfolio, admission test, audition or personal statement, by programme: not checked"
add({
    "id": "AI4(2026)", "letters": "AI4", "exam_year": 2026, "max_year": 2026, "exam": "GCE O-Level",
    "exam_key": "O", "pathway": "ai",
    "exercise": "NAFA / LASALLE diplomas (2027 intake)", "institution": "Arts institution",
    "route": "Arts institution diploma", "rule_owner": "NAFA and LASALLE (not MOE)",
    "slots": [slot("B%d" % i, "B%d: best other O-Level subject (English is not one of the 4)" % i, ANY, "AI_O_POINTS",
                   LASALLE_SRC) for i in range(1, 5)],
    "exclude_groups": ["ENGLISH"],
    "mtl_rule": None,
    "bonus": bonus_cca_only(NAFA_DIP_SRC),
    "checks": [
        subject_requirements("ai_english", "O-Level English Language C6 or better (NAFA and LASALLE)",
                             [{"label": "O-Level English Language C6 or better",
                               "options": [{"accepts": G("ENGLISH"), "max_grade": {"G3": "C6"}}]}], LASALLE_SRC),
        gross_max("lasalle_min", "LASALLE: 4 other O-Level subjects, 25 points or better", 25, LASALLE_SRC),
        net_max("nafa_min", "NAFA: 4 other O-Level subjects, 25 points or better after up to 2 CCA points", 25,
                NAFA_CCA_SRC),
        info("ai_aptitude", AI_APTITUDE, NAFA_DIP_SRC),
    ],
    "sources": [LASALLE_SRC, NAFA_DIP_SRC, NAFA_CCA_SRC],
    "notes": ["'AI4' is this engine's label: the colleges say 'an aggregate score of 25 points or better in four other "
              "GCE O-Level subjects', excluding English.",
              "net = gross minus NAFA's CCA points (up to 2); NAFA's minimum is checked on the net ('The CCA points can "
              "be used to improve their aggregate score'). LASALLE mentions no bonus points, so "
              "LASALLE uses the gross.",
              "No cut-off is published; 25 points is a minimum. Each programme also asks for a portfolio, test, audition "
              "or statement.",
              "Neither college states an MTL / HMTL or Religious Knowledge rule; none is applied."],
    "open_questions": [],
})

S_AI27 = src(F_FAQ, "What are the changes to the Arts Institutions' (AIs) diploma admission criteria?")
NAFA_DIP_SEC_SRC = {"file": NAFA_GUIDE,
                    "heading": "Diploma, SEC: 'An aggregate score of 21 points or better in 4 subjects (3 subjects at G3 "
                               "and 1 subject at G2), excluding English; For applicants with all four subjects at G3, the "
                               "subject with the lowest grade will be mapped from G3 to G2'"}
add({
    "id": "AI4(2027)", "letters": "AI4", "exam_year": 2027, "max_year": 2027, "exam": "SEC (G3 + one G2 subject)",
    "exam_key": "SEC", "pathway": "ai",
    "exercise": "NAFA / LASALLE diplomas (2028 intake)", "institution": "Arts institution",
    "route": "Arts institution diploma",
    "slots": [slot("S%d" % i, "S%d: best other G3 subject" % i, ANY, "AI_G3_2027", S_AI27) for i in range(1, 4)]
             + [slot("S4", "S4: a G2 subject, or a G3 subject mapped to G2", ANY, "AI_G2EQ_2027", S_AI27)],
    "exclude_groups": ["ENGLISH"],
    "mtl_rule": None,
    "bonus": bonus_cca_only(NAFA_CCA_SRC),
    "checks": [
        subject_requirements("ai_english", "G3 English Language C6 or better",
                             [{"label": "G3 English Language C6 or better",
                               "options": [{"accepts": G("ENGLISH"), "max_grade": {"G3": "C6"}}]}], S_AI27),
        gross_max("lasalle_min", "LASALLE: 4 other subjects (3 G3 + 1 G2), 21 points or better", 21, S_AI27),
        net_max("nafa_min", "NAFA: 4 other subjects (3 G3 + 1 G2), 21 points or better after up to 2 CCA points", 21,
                NAFA_CCA_SRC),
        info("ai_aptitude", AI_APTITUDE, S_AI27),
    ],
    "sources": [S_AI27, NAFA_DIP_SEC_SRC, NAFA_CCA_SRC],
    "notes": ["MOE: 'a pass in G3 English at C6 or better, and an aggregate score of 21 points or better in four other "
              "subjects (three G3 subjects and one G2 subject)'.",
              "All four at G3: MOE maps the lowest grade to G2. The engine takes the lowest total over every choice of "
              "the G2-equivalent subject, which gives the same total.",
              "G3 grade 9 counts 9 and G2 grade 6 counts 6: the FAQ excludes neither.",
              "NAFA's guide words the SEC rule the same way as MOE's FAQ. net = gross minus NAFA's CCA points (up to "
              "2, the same CCA table as for 2026); NAFA's minimum is checked on the net, LASALLE's on the gross "
              "(LASALLE mentions no bonus points).",
              "The FAQ states no MTL / HMTL rule; none is applied. No cut-off is published."],
    "open_questions": [],
})

# 2026 N(A)-Level -> NAFA Foundation Programme (March 2027 intake): NAFA's own page, not MOE.
S_NFP = NAFA_NFP_SRC
add({
    "id": "ELMAB3:NFP(2026)", "letters": "ELMAB3", "route_tag": "NFP", "exam_year": 2026, "max_year": 2026,
    "exam_key": "N", "pathway": "nfp",
    "exam": "GCE N(A)-Level (+ O-Level subjects)", "exercise": "NAFA Foundation Programme (Mar 2027 intake)",
    "institution": "Arts institution", "route": "NAFA Foundation Programme", "rule_owner": "NAFA (not MOE)",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "NFP_2026", S_NFP),
              slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "NFP_2026", S_NFP)]
             + best_slots("B", 3, "NFP_2026", S_NFP),
    "single_year_levels": ["G2", "G1"],
    "mtl_rule": None,
    "bonus": None,
    "bonus_missing_reason": "NAFA's NFP minimum excludes CCA bonus points and gives no bonus table; net not computed.",
    "checks": [
        {"id": "nfp_na", "type": "requires_level", "level": "G2",
         "label": "Has N(A)-Level results (the NFP is for Secondary 4 N(A) students)", "source": S_NFP},
        gross_max("nfp_gross", "ELMAB3 gross <= 15 (excluding CCA bonus points)", 15, S_NFP),
        subject_requirements("nfp_english", "English Language: N(A) grade 3 or better", [
            {"label": "English Language: N(A) grade 3 or better (O-Level A1 to D7 converts to 1 to 3)",
             "options": [{"accepts": G("ENGLISH"), "max_grade": {"G2": "3", "G3": "D7"}}],
             "near": {"options": [{"accepts": G("ENGLISH"), "max_grade": {"G2": "5", "G3": "E8"}}],
                      "note": "NAFA may still consider an N(A) grade 4 or 5 in English, with an interview, case by case."}}],
            S_NFP),
        info("nfp_aptitude", AI_APTITUDE, S_NFP),
    ],
    "sources": [S_NFP],
    "notes": ["N(A) and O-Level results may be combined; the better grade is used; an O-Level F9 does not count.",
              "N-Level results from different years are not combined: the best single N-Level year is used.",
              "MA read as Mathematics or Additional Mathematics, as on the DPP and PFP pages.",
              "No cut-off is published; 15 points is a minimum ('selection is competitive and based on merit').",
              "NAFA states no MTL / HMTL rule; none is applied."],
    "open_questions": [],
})

# 2027 SEC -> NAFA Foundation Programme (2028 intake): NAFA's own guide, not MOE; G3 -> G2 mapping from MOE's FSBB FAQ
# (its NFP section).
S_NFP27 = NAFA_NFP_SEC_SRC
S_NFP27_MAP = src(F_FAQ, "What are the changes to the NFP admission criteria? (Grade Mapping Table from G3 to G2)")
add({
    "id": "ELMAB3:NFP(2027)", "letters": "ELMAB3", "route_tag": "NFP", "exam_year": 2027, "max_year": 2027,
    "exam_key": "SEC", "pathway": "nfp",
    "exam": "SEC (G2, G3 mapped to G2)", "exercise": "NAFA Foundation Programme (2028 intake)",
    "institution": "Arts institution", "route": "NAFA Foundation Programme", "rule_owner": "NAFA (not MOE)",
    "slots": [slot("EL", "EL: English Language", G("ENGLISH"), "NFP_2027", S_NFP27),
              slot("MA", "MA: Mathematics or Additional Mathematics", G("MATHS_OR_AMATHS"), "NFP_2027", S_NFP27)]
             + best_slots("B", 3, "NFP_2027", S_NFP27),
    "mtl_rule": None,
    "bonus": None,
    "bonus_missing_reason": "NAFA's NFP minimum excludes CCA points; net not computed.",
    "checks": [
        gross_max("nfp_gross", "ELMAB3 gross <= 15, computed at G2 (excluding CCA points)", 15, S_NFP27),
        subject_requirements("nfp_english", "English Language: G2 grade 3 or better", [
            {"label": "English Language: G2 grade 3 or better (G3 A1 to D7 maps to 1 to 3)",
             "options": [{"accepts": G("ENGLISH"), "max_grade": {"G2": "3", "G3": "D7"}}]}], S_NFP27),
        info("nfp_aptitude", AI_APTITUDE, S_NFP27),
    ],
    "sources": [S_NFP27, S_NFP27_MAP],
    "notes": ["Computed with G2 grades; a G3 grade maps A1-B3 = 1, B4-C6 = 2, D7 = 3, E8 = 4, 9 = 5 (MOE's FSBB FAQ, "
              "NFP section; the PSE polytechnic table has no row for 9).",
              "G1 grades and G2 grade 6 are not counted: NAFA names only G2 and G3, and gives no value for a grade 6 "
              ".",
              "NAFA's interview note for an English grade 4 or above is written for N(A) only; it is not applied to SEC "
              ".",
              "MA read as Mathematics or Additional Mathematics, as for the 2026 NFP.",
              "No cut-off is published; 15 points is a minimum. NAFA states no MTL / HMTL rule; none is applied."],
    "open_questions": [],
})

# ===== display names ===========================================================================================
# Naming an aggregate on screen: "name the year of the exam ... based on the year they sit for it".
# Format: LETTERS (YEAR EXAM), plus " · PATHWAY" only where the same letters + year + exam would clash, or where the
# pathway is marked `always` (check-only letters such as the 5th-year aggregates). Definitions carry codes only.
DISPLAY_NAME_RULE = {
    "format": "{letters} ({year} {exam})",
    "pathway_suffix": " · {pathway}",
    "exams": {"O": "O-Level", "N": "N-Level", "SEC": "SEC"},
    "pathways": {
        "jc": {"label": "JC"}, "mi": {"label": "MI"}, "jc_mi": {"label": "JC / MI"},
        "poly": {"label": "Poly"}, "ite": {"label": "ITE"}, "jie_o": {"label": "JIE 'O'"},
        "dpp": {"label": "DPP"}, "pfp": {"label": "PFP"}, "jie_n": {"label": "JIE 'N'"},
        "ite_2y": {"label": "ITE 2-year"}, "ite_3y": {"label": "ITE 3-year"},
        "5y": {"label": "5th year", "always": True}, "ai": {"label": "Arts institutions"}, "nfp": {"label": "NFP"},
    },
    "source": reading("Naming an aggregate on screen"),
}


def format_display_name(letters, year, exam_key, pathway=None, show_pathway=False, rule=DISPLAY_NAME_RULE):
    if year is None or exam_key is None:
        return letters
    name = rule["format"].format(letters=letters, year=year, exam=rule["exams"][exam_key])
    if pathway and (show_pathway or rule["pathways"][pathway].get("always")):
        name += rule["pathway_suffix"].format(pathway=rule["pathways"][pathway]["label"])
    return name


def _assign_display_names(defs):
    clash = {}
    for d in defs:
        clash.setdefault((d.get("letters"), d.get("exam_year"), d.get("exam_key")), []).append(d["id"])
    for d in defs:
        key = (d.get("letters"), d.get("exam_year"), d.get("exam_key"))
        d["display_name"] = format_display_name(d.get("letters"), d.get("exam_year"), d.get("exam_key"),
                                                d.get("pathway"), show_pathway=len(clash[key]) > 1)


_assign_display_names(DEFINITIONS)
FIFTH_YEAR_2027["display_name"] = format_display_name("5th year eligibility", 2027, "SEC")

# ===== grades an aggregate does not use ("ignored"; engine 0.1.5) ======================================
# Every typed grade an aggregate cannot use is listed on the Result (`ignored`), never dropped silently. state "rule":
# the source says it is not used; state "silent": the source does not say, so it is not counted, and a subject
# requirement that rests on it is "can't be worked out" (the empty-slot rule). The texts are shown to students:
# whole sentences, plain words. Placeholders: {used} (the grade used instead),
# {max_year}, {years}. `floor: false` = the grade could never meet a grade floor, so a floor check never rests on it.
F_PSE = "post_secondary_admissions_pse_pse_eligibility.md"
IGNORED_REASONS = {
    # engine-wide
    "absent": {"state": "rule", "text": "Marked absent. An absent subject counts as the lowest grade, which this "
                                     "aggregate can't use.", "sources": []},
    "later_year": {"state": "rule", "text": "This aggregate uses results from {max_year} or earlier.", "sources": []},
    "not_best_years": {"state": "rule", "text": "Results from two exam years can be combined. The best two, {years}, are used.",
                       "sources": [src(F_JAE_ELIG, "You have 2025 or earlier O-Level results (any 2 years)"),
                                   src(F_PSE, "any combined 2 years")]},
    "duplicate": {"state": "rule", "text": "This subject is entered twice. Only the better grade counts.", "sources": []},
    "no_slot": {"state": "rule", "text": "This aggregate has no place for this subject.", "sources": []},
    "no_points": {"state": "silent", "text": "This grade has no points in this aggregate.", "sources": []},
    "unlisted": {"state": "silent", "text": "This grade is not in the aggregate's grade table.", "sources": []},
    # 2026 O-Level: JAE
    "jae_o_only": {"state": "silent",
                   "text": "MOE's JAE aggregates are worked out from O-Level results. MOE does not say whether other grades count.",
                   "sources": [src(F_JAE_ELIG, "You can participate in the JAE by using O-Level examination results"),
                               src("post_secondary_admissions_jae.md", "Gross aggregate score = Sum of all O-Level subject grades")]},
    "jae_mtl_b": {"state": "rule", "text": "MOE does not count 'B' Syllabus grades (Merit or Pass) in the aggregate.",
                  "sources": [src(F_JC26, "What cannot be used for aggregate computation ('Merit' and 'Pass' grades for the Mother Tongue 'B' Syllabus)"),
                              src(F_POLY26, "What cannot be used for aggregate computation"),
                              src(F_ITE26, "What cannot be used for aggregate computation")]},
    "jcmi_rk": {"state": "rule", "text": "MOE does not count Religious Knowledge for JC and MI admission.",
                "sources": [src(F_OLVL, "Religious Knowledge subject cannot be used ... for junior college and Millennia Institute admission"),
                            src(F_PSE_JCMI, "Religious Knowledge cannot be used as one of the best-scoring subjects")]},
    "moe_better_years": {"state": "rule",
                         "text": "{used} is used instead. MOE uses the better grade when a subject is taken in two years.",
                         "sources": [src(F_JAE_ELIG, "the better grade of the 2 sittings will be used"),
                                     src(F_PSE, "the better grade of the 2 sittings will be used")]},
    # 2026 O-Level: JIE 'O' (ITE)
    "jieo_o_only": {"state": "silent",
                    "text": "ITE's JIE 'O' uses the best 5 O-Level subjects. ITE does not say whether other grades count.",
                    "sources": [src(F_ITEJIE, "4. JIE 'O' ('aggregate score of best 5 GCE 'O' subjects')")]},
    "ite_mtl_b": {"state": "silent", "text": "ITE does not say whether a 'B' Syllabus Merit or Pass counts.",
                  "sources": [src(F_ITEJIE, "1.3 / 2.2 / 4 grade tables (no 'B' Syllabus grades)")]},
    "ite_sittings": {"state": "silent",
                     "text": "{used} is used instead. ITE does not say which grade counts when a subject is taken twice.",
                     "sources": [src(F_ITEJIE, "1.5 / 9 item 2 (combining two sittings: apply over the counter)")]},
    "jien_levels": {"state": "silent",
                    "text": "{used} is used instead. ITE does not say which grade counts when a subject is taken at two levels.",
                    "sources": [src(F_ITEJIE, "9 item 2 (same subject at N- and O-Level: JIE 'N' documents are silent)")]},
    # 2026 N(A)-Level: DPP, PFP (MOE)
    "dpp_nt": {"state": "silent", "text": "DPP is for Secondary 4 N(A) students. MOE does not say whether an N(T) grade counts.",
               "sources": [src(F_DPP, "Grade conversion (O-Level to N(A) only)"), src(F_ITEJIE, "2.1 (FAQ A22: N(T) students cannot apply)")]},
    "dpp_na_6": {"state": "rule", "text": "MOE does not count an N(A) grade 6 or U for DPP.",
                 "sources": [src(F_DPP, "The N(A)-Level grade of U will not be considered for computation of the ELMAB3 aggregate score"),
                             src(F_ITEJIE, "2.2 ('The GCE 'N(A)' grade of 6/U will not be considered')")]},
    "pfp_nt": {"state": "silent", "text": "PFP is for Secondary 4 N(A) students. MOE does not say whether an N(T) grade counts.",
               "sources": [src("post_secondary_admissions_pfp.md", "Who can apply"), src(F_PFP26, "Grade conversion (O-Level only)")]},
    "pfp_o9": {"state": "rule", "text": "MOE does not count an O-Level grade 9 for PFP.",
               "sources": [src(F_PFP26, "A Grade 9 at O-Level would not count towards your ELMAB3 aggregate score")]},
    "pfp_na_6": {"state": "silent", "floor": False, "text": "MOE's PFP page does not say how an N(A) grade 6 or U counts.",
                 "sources": [src(F_PFP26, "Eligibility criteria / Grade conversion (no value for N(A) 6 / U)")]},
    "moe_mtl_b": {"state": "silent", "text": "MOE does not say whether a 'B' Syllabus Merit or Pass counts here.",
                  "sources": [src(F_DPP, "Grade conversion"), src(F_PFP26, "Grade conversion")]},
    "moe_sittings": {"state": "silent",
                     "text": "{used} is used instead. MOE does not say which grade counts when a subject is taken twice.",
                     "sources": []},
    "moe_better_na_o": {"state": "rule",
                        "text": "{used} is used instead. MOE uses the better grade when a subject is taken at N(A) and O-Level.",
                        "sources": [src(F_DPP, "the better of the two grades will be used"),
                                    src(F_PFP26, "the better grade will be used")]},
    # 2026 N(A)-Level: NAFA Foundation Programme (NAFA, not MOE)
    "nfp_nt": {"state": "silent", "text": "The NFP is for Secondary 4 N(A) students. NAFA does not say whether an N(T) grade counts.",
               "sources": [NAFA_NFP_SRC]},
    "nfp_o9": {"state": "rule", "text": "NAFA does not count an O-Level F9 for the NFP.", "sources": [NAFA_NFP_SRC]},
    "nfp_na_6": {"state": "silent", "floor": False, "text": "NAFA does not say how an N(A) grade 6 or U counts.",
                 "sources": [NAFA_NFP_SRC]},
    "nfp_one_n_year": {"state": "rule", "text": "NAFA does not combine N-Level results from different years.",
                       "sources": [NAFA_NFP_SRC]},
    "nafa_mtl_b": {"state": "silent", "text": "NAFA does not say whether a 'B' Syllabus Merit or Pass counts.",
                   "sources": [NAFA_NFP_SRC]},
    "nafa_sittings": {"state": "silent",
                      "text": "{used} is used instead. NAFA does not say which grade counts when a subject is taken twice.",
                      "sources": [NAFA_NFP_SRC]},
    "nafa_better": {"state": "rule",
                    "text": "{used} is used instead. NAFA uses the better grade when N(A) and O-Level results are combined.",
                    "sources": [NAFA_NFP_SRC]},
    # 2026 O-Level: NAFA / LASALLE diplomas (the colleges, not MOE)
    "ai_not_o": {"state": "silent",
                 "text": "NAFA and LASALLE count O-Level subjects. They do not say whether other grades count.",
                 "sources": [LASALLE_SRC, NAFA_DIP_SRC]},
    "ai_english_apart": {"state": "rule", "text": "English is checked on its own (C6 or better). It is not one of the 4 subjects.",
                         "sources": [LASALLE_SRC, NAFA_DIP_SRC]},
    "ai_mtl_b": {"state": "silent", "text": "NAFA and LASALLE do not say whether a 'B' Syllabus Merit or Pass counts.",
                 "sources": [LASALLE_SRC, NAFA_DIP_SRC]},
    "ai_sittings": {"state": "silent",
                    "text": "{used} is used instead. NAFA and LASALLE do not say which grade counts when a subject is taken twice.",
                    "sources": [LASALLE_SRC, NAFA_DIP_SRC]},
    # 2027 SEC: PSE 2028 (MOE)
    "jcmi27_g3_only": {"state": "rule", "text": "MOE counts only G3 subjects for JC and MI admission.",
                       "sources": [src(F_PSE_JCMI, "All subjects used in aggregate score computation for JC and MI admissions must be taken at G3")]},
    "pse_mtl_b": {"state": "silent", "text": "MOE's PSE pages do not say whether a 'B' Syllabus Merit or Pass counts.",
                  "sources": [src(F_PSE_JCMI, "Grade requirements for specific subjects (no 'B' Syllabus row)")]},
    "pse_better_g2": {"state": "rule",
                      "text": "{used} is used instead. MOE uses the better G2 grade when a subject is taken at two levels.",
                      "sources": [src(F_PSE, "the better grade at G2 level will be used"),
                                  src(F_PSE_POLY, "The better G2 equivalent grade will be used")]},
    "ite3_better": {"state": "rule",
                    "text": "{used} is used instead. MOE uses the better ITE point when a subject is taken at two levels.",
                    "sources": [src(F_PSE_ITE3, "we will map both grades to the ITE aggregate score and use the better one with the lower point")]},
    "poly27_9_56": {"state": "rule", "text": "MOE does not count a G3 grade 9, or a G2 grade 5 or 6, for ELR2B2.",
                    "sources": [src(F_PSE_POLY, "G3/O-Level grade 9 and G2/N(A)-Level grade 5 and 6 cannot be used for ELR2B2")]},
    "poly27_g1": {"state": "rule",
                  "text": "ELR2B2 counts G3 subjects, and a G2 or G3 subject for B2. G1 subjects are not part of it.",
                  "sources": [src(F_PSE_POLY, "EL, R1, R2 and B1 will use G3 subject grade, while B2 will use G2 equivalent grade (B2 at either G2 or G3)")]},
    "pfp27_9_56": {"state": "rule", "text": "MOE does not count a G3 grade 9, or a G2 grade 5 or 6, for PFP.",
                   "sources": [src(F_PSE_PFP, "G3/O-Level grade 9 and G2/N(A)-Level grade 5 and 6 cannot be used")]},
    "pfp27_g1": {"state": "rule", "text": "MOE does not count G1 grades for PFP.",
                 "sources": [src(F_PSE_PFP, "G1 grades cannot be used for PFP ELMAB3 aggregate score computation")]},
    "ite2_g1": {"state": "rule", "text": "MOE does not count G1 grades for 2-year Higher Nitec courses.",
                "sources": [src(F_PSE_ITE2, "G1 grade cannot be considered for ITE 2-Year Higher Nitec ELMAB3 aggregate score")]},
    "ite3_g1_u": {"state": "silent", "floor": False,
                  "text": "MOE's 3-year Higher Nitec table gives points for G1 grades A to E only. It does not say how a U counts.",
                  "sources": [src(F_PSE_ITE3, "Grade conversion to ITE aggregate points (G1 A to E)")]},
    "fifth_g2_6": {"state": "rule", "text": "Every subject used for the 5th-year check must be G2 grade 5 or better.",
                   "sources": [src(F_PSE_PATH, "Students will need at least Grade 5 at G2 for all subjects used")]},
    "fifth_g1": {"state": "rule",
                 "text": "The 5th-year check is worked out at G2 from G2 and G3 subjects. G1 subjects are not part of it.",
                 "sources": [src(F_PSE_PATH, "computed at G2; 'Students who do not offer sufficient G2 or G3 subjects'")]},
    # 2027 SEC: NAFA / LASALLE 2028 intake (MOE's FAQ)
    "ai27_g1": {"state": "rule",
                "text": "MOE's rule counts 3 G3 subjects and 1 G2 subject. G1 subjects are not part of it.",
                "sources": [src(F_FAQ, "Arts Institutions: four other subjects (three G3 subjects and one G2 subject)")]},
    "ai27_english_apart": {"state": "rule",
                           "text": "English is checked on its own (G3, C6 or better). It is not one of the 4 subjects.",
                           "sources": [src(F_FAQ, "a pass in G3 English at C6 or better, and ... four other subjects")]},
    "ai27_mtl_b": {"state": "silent",
                   "text": "MOE does not say whether a 'B' Syllabus Merit or Pass counts for the arts institutions.",
                   "sources": [src(F_FAQ, "Arts Institutions' Diploma Admissions Criteria")]},
    "nfp27_g1": {"state": "silent",
                 "text": "NAFA's NFP rule for SEC counts G2 subjects, with G3 subjects mapped to G2. NAFA does not say "
                         "whether a G1 grade counts.",
                 "sources": [NAFA_NFP_SEC_SRC]},
    "nfp27_g2_6": {"state": "silent", "floor": False, "text": "NAFA does not say how a G2 grade 6 counts.",
                   "sources": [NAFA_NFP_SEC_SRC]},
    "nafa_levels": {"state": "silent",
                    "text": "{used} is used instead. NAFA does not say which grade counts when a subject is taken at two "
                            "levels.",
                    "sources": [NAFA_NFP_SEC_SRC]},
    "ai27_levels": {"state": "silent",
                    "text": "{used} is used instead. MOE does not say which grade counts when a subject is taken at two levels.",
                    "sources": [src(F_FAQ, "Arts Institutions' Diploma Admissions Criteria")]},
}

# Level names inside the {used} text, by the definition's exam_key.
LEVEL_LABELS = {"O": {"G3": "O-Level", "G2": "N(A)", "G1": "N(T)"}, "N": {"G3": "O-Level", "G2": "N(A)", "G1": "N(T)"},
                "SEC": {"G3": "G3", "G2": "G2", "G1": "G1"}}

# Per definition: which reason applies. levels = a level no slot can use; grades = "LEVEL:GRADE" a slot scale lacks;
# non_scoring = Merit / Pass / Ungraded and the like; excluded = exclude_groups; same_level / cross_level = the same
# subject taken twice (cross_level falls back to same_level); single_year = single_year_levels dropped.
_JAE = {"levels": {"G2": "jae_o_only", "G1": "jae_o_only"}, "non_scoring": "jae_mtl_b", "same_level": "moe_better_years"}
_JCMI26 = dict(_JAE, excluded={"RELIGIOUS_KNOWLEDGE": "jcmi_rk"})
_DPP = {"levels": {"G1": "dpp_nt"}, "grades": {"G2:6": "dpp_na_6"}, "non_scoring": "moe_mtl_b",
        "same_level": "moe_sittings", "cross_level": "moe_better_na_o"}
_PFP26 = {"levels": {"G1": "pfp_nt"}, "grades": {"G3:F9": "pfp_o9", "G2:6": "pfp_na_6"}, "non_scoring": "moe_mtl_b",
          "same_level": "moe_sittings", "cross_level": "moe_better_na_o"}
_JIEN = {"non_scoring": "ite_mtl_b", "same_level": "ite_sittings", "cross_level": "jien_levels"}
_B5 = {"levels": {"G2": "jieo_o_only", "G1": "jieo_o_only"}, "non_scoring": "ite_mtl_b", "same_level": "ite_sittings"}
_NFP26 = {"levels": {"G1": "nfp_nt"}, "grades": {"G3:F9": "nfp_o9", "G2:6": "nfp_na_6"}, "non_scoring": "nafa_mtl_b",
          "same_level": "nafa_sittings", "cross_level": "nafa_better", "single_year": "nfp_one_n_year"}
_AI26 = {"levels": {"G2": "ai_not_o", "G1": "ai_not_o"}, "non_scoring": "ai_mtl_b", "excluded": {"ENGLISH": "ai_english_apart"},
         "same_level": "ai_sittings"}
_PSE = {"non_scoring": "pse_mtl_b", "same_level": "moe_better_years", "cross_level": "pse_better_g2"}
_JCMI27 = dict(_PSE, levels={"G2": "jcmi27_g3_only", "G1": "jcmi27_g3_only"}, excluded={"RELIGIOUS_KNOWLEDGE": "jcmi_rk"})
_POLY27 = dict(_PSE, levels={"G1": "poly27_g1"}, grades={"G3:F9": "poly27_9_56", "G2:5": "poly27_9_56", "G2:6": "poly27_9_56"})
_PFP27 = dict(_PSE, levels={"G1": "pfp27_g1"}, grades={"G3:F9": "pfp27_9_56", "G2:5": "pfp27_9_56", "G2:6": "pfp27_9_56"})
_ITE2Y27 = dict(_PSE, levels={"G1": "ite2_g1"})
_ITE3Y27 = dict(_PSE, grades={"G1:U": "ite3_g1_u"}, cross_level="ite3_better")
_FIVE27 = dict(_PSE, levels={"G1": "fifth_g1"}, grades={"G2:6": "fifth_g2_6"})
_AI27 = {"levels": {"G1": "ai27_g1"}, "non_scoring": "ai27_mtl_b", "excluded": {"ENGLISH": "ai27_english_apart"},
         "same_level": "moe_sittings", "cross_level": "ai27_levels"}
_NFP27 = {"levels": {"G1": "nfp27_g1"}, "grades": {"G2:6": "nfp27_g2_6"}, "non_scoring": "nafa_mtl_b",
          "same_level": "nafa_sittings", "cross_level": "nafa_levels"}
IGNORED_POLICY_BY_ID = {
    "L1R5(2026)": _JCMI26, "L1R4(2026)": _JCMI26,
    "ELR2B2-A(2026)": _JAE, "ELR2B2-B(2026)": _JAE, "ELR2B2-C:POLY(2026)": _JAE, "ELR2B2-D(2026)": _JAE,
    "ELB4-A(2026)": _JAE, "ELR1B3-B(2026)": _JAE, "ELR2B2-C:ITE(2026)": _JAE, "B5(2026)": _B5,
    "ELMAB3:DPP(2026)": _DPP, "ELMAB3:PFP(2026)": _PFP26,
    "MAS1B3(2026)": _JIEN, "ELB3(2026)": _JIEN, "B4(2026)": _JIEN, "MAB3(2026)": _JIEN, "ELMAB2(2026)": _JIEN,
    "L1R4(2027)": _JCMI27,
    "ELR2B2-A(2027)": _POLY27, "ELR2B2-B(2027)": _POLY27, "ELR2B2-C(2027)": _POLY27, "ELR2B2-D(2027)": _POLY27,
    "ELMAB3:PFP(2027)": _PFP27, "ELMAB3:ITE(2027)": _ITE2Y27,
    "R2B2(2027)": _ITE3Y27, "R1B3-A(2027)": _ITE3Y27, "R1B3-B(2027)": _ITE3Y27, "R1B3-C(2027)": _ITE3Y27,
    "B4(2027)": _ITE3Y27,
    "ELMAB3:5Y(2027)": _FIVE27, "ELB3:5Y(2027)": _FIVE27, "MAB3:5Y(2027)": _FIVE27,
    "AI4(2026)": _AI26, "AI4(2027)": _AI27, "ELMAB3:NFP(2026)": _NFP26, "ELMAB3:NFP(2027)": _NFP27,
}
for _d in DEFINITIONS:
    _d["ignored_policy"] = None if _d["status"] == "stub" else IGNORED_POLICY_BY_ID[_d["id"]]

DEFINITIONS_BY_ID = {d["id"]: d for d in DEFINITIONS}

# Two engine-wide behaviours, recorded with their source.
ALTERNATIVE_RULE = {
    "rule": "EL-as-L1 and HMTL-as-L1 computed separately; the lower is used (no bonus depends on which language "
            "is L1, so the lower gross is also the lower net); ties go to EL",
    "sources": [src(F_PSE_JCMI, "Aggregate score computation (computed separately ... lower score will be used)"),
                reading(UNCLEAR + " (EL vs HMTL as L1)")],
}
EMPTY_SLOT_RULE = {
    "rule": "a slot no usable subject can fill makes the aggregate not computable, with the reason shown; no default "
            "score (an Absent subject is different: it counts as the lowest grade)",
    "sources": [reading("When no subject can fill a slot")],
}

# Exam-year combination rule (used by the engine for every definition).
COMBINE_RULE = {
    "max_years": 2,
    "same_subject": "better grade (per slot's scale) across sittings and levels",
    "sources": [src(F_JAE_ELIG, "You have 2025 or earlier O-Level results (any 2 years; better grade)"),
                src(F_PSE_ELIG, "any combined 2 years; same subject: better grade; different levels: better G2 grade")],
}
