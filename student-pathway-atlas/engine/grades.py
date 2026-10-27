"""Grade scales, mark -> grade bands, and the points tables every aggregate uses.

Everything here is plain data (dicts / lists) so `export_definitions.py` can dump it to JSON
for the JavaScript port. Each scale carries `source` = (reference file, heading).

Levels are normalised to G3 / G2 / G1:
  O-Level (GCE O, EXP) -> G3, N(A)-Level -> G2, N(T)-Level -> G1.
  Source: post_secondary_admissions_pse_pse_eligibility.md, "I am a Singapore Citizen or
  Permanent Resident" ("The subject levels, G1, G2 and G3, will be mapped from N(T)-, N(A)- and
  O-Level standards respectively").
"""

import re

RB = "source-pages/"

LEVEL_ALIASES = {
    "G3": "G3", "O": "G3", "O-LEVEL": "G3", "O LEVEL": "G3", "GCE O": "G3", "GCE O-LEVEL": "G3",
    "EXP": "G3", "SEC G3": "G3",
    "G2": "G2", "N(A)": "G2", "NA": "G2", "N(A)-LEVEL": "G2", "GCE N(A)": "G2", "SEC G2": "G2",
    "G1": "G1", "N(T)": "G1", "NT": "G1", "N(T)-LEVEL": "G1", "GCE N(T)": "G1", "SEC G1": "G1",
    "NORMAL (ACADEMIC)": "G2", "NORMAL (TECHNICAL)": "G1",
}

# How a level string is read (also exported for the JS port). After an exact alias miss: split on "/" (MOE writes
# "G3/O-Level", "G2/N(A)-Level", "G1/N(T)-Level"); drop a leading GCE / SEC word and a trailing "-Level(s)" from each
# part; every part must name the same level, otherwise the level is unreadable (e.g. "G3/N(A)") and the row is
# reported in input_problems. A bare "N-Level" is unreadable (N(A) or N(T)?).
LEVEL_NORMALISE = {
    "split_on": "/",
    "strip_prefix_regex": r"^(GCE|SEC|SINGAPORE-CAMBRIDGE)\s+",
    "strip_suffix_regex": r"[\s-]*LEVELS?$",
    "parts_must_agree": True,
    "source": {"file": RB + "post_secondary_admissions_pse_pse_eligibility.md",
               "heading": "If you have 2027 SEC and N-Level/O-Level results (levels written 'G2/N(A)-Level', 'G3/O-Level')"},
}

# Ordered best -> worst. Used for "A1 to C6"-style comparisons.
GRADE_ORDER = {
    "G3": ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "F9"],
    "G2": ["1", "2", "3", "4", "5", "6"],
    "G1": ["A", "B", "C", "D", "E", "U"],
}

# Grades that carry no points on any scale (MTL 'B' Merit/Pass, absent, ...).
NON_SCORING_GRADES = ["ABS", "MERIT", "PASS", "DISTINCTION", "UNGRADED", "X"]

GRADE_ALIASES = {
    "G3": {"9": "F9", "F": "F9", "F9": "F9", "1": "A1", "2": "A2", "3": "B3", "4": "B4", "5": "C5",
           "6": "C6", "7": "D7", "8": "E8"},
    # GCE N(A) prints "U" for ungraded; ITE's tables write it as "6 / U" (ite__jie_aggregates.md 1.3, 2.2),
    # so U and 6 are the same G2 grade here.
    "G2": {"U": "6"},
    "G1": {},
}

ABSENT_ALIASES = {"AB", "ABS", "ABSENT"}

# An Absent subject is still counted in the aggregate, at the lowest grade of its level (MOE's printed aggregates do
# this). It never meets a subject-specific requirement, and it closes conditional admission (eligibility.py).
# Where an aggregate cannot use the lowest grade (PFP: G3 9, G2 5 and 6), it cannot use an Absent either.
ABSENT_SCORES_AS = {"G3": "F9", "G2": "6", "G1": "E"}

# Words removed from a grade before it is read ("Grade B3" -> "B3"); exported for the JavaScript port.
GRADE_STRIP_WORDS = ["GRADE"]

# Grades that depend on the subject, not the level. MTL 'B' Syllabus is graded Merit / Pass (Ungraded otherwise):
# valid grades that never score ("'Merit' and 'Pass' grades for the Mother Tongue 'B' Syllabus" cannot be used for
# aggregate computation) but meet the 2026 JC / MI MTL requirement ("'B' Syllabus: Merit or Pass").
GRADES_BY_KIND = {
    "MTL_B": {
        "grades": {"M": "MERIT", "MERIT": "MERIT", "P": "PASS", "PASS": "PASS", "U": "UNGRADED", "UNGRADED": "UNGRADED"},
        "only_these": True,
        "source": {"file": RB + "post_secondary_admissions_jae_junior_colleges_and_millennia_institute.md",
                   "heading": "What cannot be used for aggregate computation / Grade requirements ('B' Syllabus: Merit or Pass)"},
    },
}

SCHOOL_COCKPIT_MARK_BANDS = {
    "_note": ("The usual school mark bands (Results Compiler, `Added Grade` step). NOT MOE text - used only "
              "when a caller passes marks instead of grades."),
    "source": {"file": "README.md", "heading": "Assumptions: school mark bands"},
    "G3": [[75, "A1"], [70, "A2"], [65, "B3"], [60, "B4"], [55, "C5"], [50, "C6"], [45, "D7"], [40, "E8"], [0, "F9"]],
    "G2": [[75, "1"], [70, "2"], [65, "3"], [60, "4"], [50, "5"], [0, "6"]],
    "G1": [[75, "A"], [70, "B"], [60, "C"], [50, "D"], [0, "E"]],
}


def _g3(a1a2b3, b4c5c6, d7, e8, f9=None):
    d = {"A1": a1a2b3, "A2": a1a2b3, "B3": a1a2b3, "B4": b4c5c6, "C5": b4c5c6, "C6": b4c5c6, "D7": d7, "E8": e8}
    if f9 is not None:
        d["F9"] = f9
    return d


G3_FACE = {"A1": 1, "A2": 2, "B3": 3, "B4": 4, "C5": 5, "C6": 6, "D7": 7, "E8": 8, "F9": 9}
G3_FACE_NO9 = {k: v for k, v in G3_FACE.items() if k != "F9"}

# A scale = which (level, grade) pairs carry how many points. A grade missing from a scale cannot be used
# in that aggregate. `mer_unusable` = grades that count in the aggregate but can never meet a
# subject-specific minimum entry requirement.
SCALES = {
    "O_POINTS": {
        "label": "O-Level grade = points (A1=1 ... F9=9); O-Level (G3) subjects only",
        "levels": {"G3": dict(G3_FACE)},
        "mer_unusable": {},
        "source": {"file": RB + "post_secondary_admissions_jae.md",
                   "heading": "KEY DATES > Verify your CCA records (Gross aggregate score = Sum of all O-Level subject grades)"},
        "note": ("JAE pages do not exclude grade 9, so F9 counts 9 points; MOE's printed results "
                 "count it for Poly ELR2B2 too. N-Level grades cannot be used (the JAE "
                 "aggregates are O-Level aggregates)."),
    },
    "G3_POINTS": {
        "label": "G3 grade = points (A1=1 ... 9=9); G3 / O-Level subjects only",
        "levels": {"G3": dict(G3_FACE)},
        "mer_unusable": {},
        "source": {"file": RB + "post_secondary_admissions_pse_jc_and_mi.md",
                   "heading": "Aggregate score computation (All subjects used ... must be taken at G3)"},
    },
    "G3_POINTS_NO9": {
        "label": "G3 grade = points (A1=1 ... E8=8); grade 9 cannot be used",
        "levels": {"G3": dict(G3_FACE_NO9)},
        "mer_unusable": {},
        "source": {"file": RB + "post_secondary_admissions_pse_polytechnic_diploma_course.md",
                   "heading": "Mapping of G3/O-Level grade to G2/N(A)-Level grade (G3 grade 9 ... cannot be used for ELR2B2)"},
    },
    "G2EQ_NO_FAIL": {
        "label": "G2-equivalent points: G3 A1-B3=1, B4-C6=2, D7=3, E8=4; G2 1-4 = 1-4; G3 9, G2 5-6 and G1 unusable",
        "levels": {"G3": _g3(1, 2, 3, 4), "G2": {"1": 1, "2": 2, "3": 3, "4": 4}},
        "mer_unusable": {},
        "source": {"file": RB + "post_secondary_admissions_pse_polytechnic_diploma_course.md",
                   "heading": "Mapping of G3/O-Level grade to G2/N(A)-Level grade"},
        "also_source": {"file": RB + "post_secondary_admissions_pse_pfp.md",
                        "heading": "Mapping of G3/O-Level grade to G2/N(A)-Level grade (+ rule from a worked example: G1 cannot be used)"},
    },
    "G2EQ_FULL": {
        "label": "G2-equivalent points: G3 A1-B3=1, B4-C6=2, D7=3, E8=4, 9=5; G2 grade = points (1-6); G1 unusable",
        "levels": {"G3": _g3(1, 2, 3, 4, 5), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6}},
        "mer_unusable": {"G3": ["F9"], "G2": ["6"]},
        "source": {"file": RB + "post_secondary_admissions_pse_ite_2_year_higher_nitec.md",
                   "heading": "Mapping of G3/O-Level grade to G2/N(A)-Level grade (G3 grade 9 and G2 grade 6 can be used)"},
        "note": ("G2 grade 6 is worth 6: the page prints no value, but the PSE page defines the gross aggregate as "
                 "the 'Sum of subject grades used' (post_secondary_admissions_pse.md, Verify your CCA records)."),
    },
    "G2EQ_5Y": {
        "label": "G2-equivalent points for the 5th-year check: G3 A1-B3=1, B4-C6=2, D7=3, E8=4, 9=5; G2 1-5; "
                 "G2 grade 6 and G1 unusable",
        "levels": {"G3": _g3(1, 2, 3, 4, 5), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}},
        "mer_unusable": {},
        "source": {"file": RB + "post_secondary_admissions_pse_explore_pathways.md",
                   "heading": "5th year in secondary school (computed at G2; at least Grade 5 at G2 for all subjects used)"},
        "also_source": {"file": RB + "psle_fsbb_full_subject_based_banding_faq.md",
                        "heading": "Grade Mapping Table (G3 to G2) - 9 maps to 5"},
        "note": "Which G3->G2 table applies (9 -> 5, or 9 unusable as for PFP) is a reading (see the README).",
    },
    "ITE_POINTS_PSE": {
        "label": "ITE aggregate points (G1-based): G3 A1-D7=1, E8=2, 9=3; G2 1-3=1, 4=2, 5=3, 6=4; G1 A-E = 1-5",
        "levels": {
            "G3": {"A1": 1, "A2": 1, "B3": 1, "B4": 1, "C5": 1, "C6": 1, "D7": 1, "E8": 2, "F9": 3},
            "G2": {"1": 1, "2": 1, "3": 1, "4": 2, "5": 3, "6": 4},
            "G1": {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5},
        },
        "mer_unusable": {"G3": ["F9"], "G2": ["6"], "G1": ["E"]},
        "source": {"file": RB + "post_secondary_admissions_pse_ite_3_year_higher_nitec.md",
                   "heading": "Grade conversion to ITE aggregate points"},
    },
    "ITE_POINTS_JIEN": {
        "label": "ITE aggregate points (JIE 'N'): N(T) A-E/U = 1-5; N(A) 1-3=1, 4=2, 5=3, 6/U=4; O A1-D7=1, E8=2, F9=3",
        "levels": {
            "G3": {"A1": 1, "A2": 1, "B3": 1, "B4": 1, "C5": 1, "C6": 1, "D7": 1, "E8": 2, "F9": 3},
            "G2": {"1": 1, "2": 1, "3": 1, "4": 2, "5": 3, "6": 4},
            "G1": {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "U": 5},
        },
        "mer_unusable": {"G3": ["F9"], "G2": ["6"], "G1": ["E", "U"]},
        "source": {"file": RB + "ite__jie_aggregates.md", "heading": "1.3 Grade scale and points (p.8)"},
        "note": "ITE pages describe the Jan 2026 intake (2025 N-Level); assumed unchanged for the 2026 N-Level.",
    },
    "ITE_POINTS_JIEH": {
        "label": "ITE aggregate points (JIE 'H' / DPP): N(A) 1-5 = 1-5, 6/U unusable; O A1-B3=1, B4-C6=2, D7=3, E8=4, F9=5",
        "levels": {"G3": _g3(1, 2, 3, 4, 5), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}},
        "mer_unusable": {"G3": ["F9"]},
        "source": {"file": RB + "ite__jie_aggregates.md", "heading": "2.2 Grade scale and conversion (PDF p.5)"},
        "also_source": {"file": RB + "post_secondary_admissions_dpp_eligibility_criteria.md", "heading": "Grade conversion"},
    },
    "PFP_2026": {
        "label": "PFP 2026 points: N(A) grade 1-5 = points; O A1-B3=1, B4-C6=2, D7=3, E8=4; O grade 9 and N(A) 6/U unusable",
        "levels": {"G3": _g3(1, 2, 3, 4), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}},
        "mer_unusable": {},
        "source": {"file": RB + "post_secondary_admissions_pfp_eligibility_criteria.md", "heading": "Grade conversion"},
        "note": "The page is silent on N(A) 6/U; treated as ungraded (no points).",
    },
    "JIEO_POINTS": {
        "label": "JIE 'O' points: O-Level grade = points (A1=1 ... F9=9)",
        "levels": {"G3": dict(G3_FACE)},
        "mer_unusable": {"G3": ["F9"]},
        "source": {"file": RB + "ite__jie_aggregates.md", "heading": "4. JIE 'O' (3-year Higher Nitec, O-Level)"},
    },
    # Arts institutions (engine 0.1.5). The 2026 rules are the colleges' own pages (not MOE), saved with quotes in
    # data/locations/arts_institutions_2027.csv; the 2028-intake rule is MOE's FSBB FAQ.
    "AI_O_POINTS": {
        "label": "Arts institutions: O-Level grade = points (A1=1 ... F9=9); O-Level subjects only",
        "levels": {"G3": dict(G3_FACE)},
        "mer_unusable": {},
        "source": {"file": "data/locations/arts_institutions_2027.csv",
                   "url": "https://www.lasalle.edu.sg/study/admissions/diploma-admissions/",
                   "heading": "LASALLE / NAFA diploma rows: 'an aggregate score of 25 points or better in four other "
                              "GCE O-Level subjects' (O-Level points, A1=1 ... F9=9)"},
        "note": "Neither college excludes F9, so it counts 9 points.",
    },
    "AI_G3_2027": {
        "label": "Arts institutions 2028 intake: G3 grade = points (A1=1 ... 9=9); G3 subjects only",
        "levels": {"G3": dict(G3_FACE)},
        "mer_unusable": {},
        "source": {"file": RB + "psle_fsbb_full_subject_based_banding_faq.md",
                   "heading": "What are the changes to the Arts Institutions' (AIs) diploma admission criteria? "
                              "(three G3 subjects and one G2 subject)"},
        "note": "The FAQ does not exclude G3 grade 9, so it counts 9 points.",
    },
    "AI_G2EQ_2027": {
        "label": "Arts institutions 2028 intake, 4th subject: G2 grade = points (1-6); G3 mapped A1-B3=1, B4-C6=2, "
                 "D7=3, E8=4, 9=5",
        "levels": {"G3": _g3(1, 2, 3, 4, 5), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6}},
        "mer_unusable": {},
        "source": {"file": RB + "psle_fsbb_full_subject_based_banding_faq.md",
                   "heading": "What are the changes to the Arts Institutions' (AIs) diploma admission criteria? "
                              "(Grade Mapping Table from G3 to G2; 'Students who offer all four subjects at G3 will "
                              "have the subject with the lowest grade mapped from G3 to G2')"},
        "note": "The table lists G2 grade 6 and does not exclude it, so it counts 6 points.",
    },
    "NFP_2026": {
        "label": "NFP points: N(A) grade 1-5 = points; O A1-B3=1, B4-C6=2, D7=3, E8=4; O F9 and N(A) 6/U unusable",
        "levels": {"G3": _g3(1, 2, 3, 4), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}},
        "mer_unusable": {},
        "source": {"file": "data/locations/arts_institutions_2027.csv",
                   "url": "https://www.nafa.edu.sg/admissions/foundation-admissions",
                   "heading": "NFP row: N(A) and O-Level results may be combined ('only the better grade will be "
                              "used'; O-Level A1-B3=1, B4-C6=2, D7=3, E8=4; F9 does not count)"},
        "note": "NAFA's page is silent on N(A) grade 6 / U; treated as not counted.",
    },
    "NFP_2027": {
        "label": "NFP points (SEC): G2 grade 1-5 = points; G3 mapped A1-B3=1, B4-C6=2, D7=3, E8=4, 9=5; G2 6 and G1 "
                 "not counted",
        "levels": {"G3": _g3(1, 2, 3, 4, 5), "G2": {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5}},
        "mer_unusable": {},
        "source": {"file": RB + "nafa__admission_guide.md",
                   "heading": "NFP, SEC: 'computed with G2 subjects ... subjects at G3 ... will be mapped from G3 to G2'"},
        "also_source": {"file": RB + "psle_fsbb_full_subject_based_banding_faq.md",
                        "heading": "What are the changes to the NFP admission criteria? (Grade Mapping Table from G3 to "
                                   "G2: A1-B3 1, B4-C6 2, D7 3, E8 4, 9 5)"},
        "note": "G2 grade 6 and G1 grades: NAFA gives no value; not counted.",
    },
}


def _level_part(part):
    if part in LEVEL_ALIASES:
        return LEVEL_ALIASES[part]
    p = re.sub(LEVEL_NORMALISE["strip_prefix_regex"], "", part)
    p = re.sub(LEVEL_NORMALISE["strip_suffix_regex"], "", p).strip()
    return LEVEL_ALIASES.get(p)


def normalise_level(level):
    """'O' / 'G3/O-Level' / 'GCE N(A)-Level' / 'g2' ... -> 'G3' / 'G2' / 'G1'. Returns None if unreadable."""
    if level is None:
        return None
    key = " ".join(str(level).strip().upper().split())
    if not key:
        return None
    if key in LEVEL_ALIASES:
        return LEVEL_ALIASES[key]
    parts = [p.strip() for p in key.split(LEVEL_NORMALISE["split_on"]) if p.strip()]
    found = {_level_part(p) for p in parts}
    if not parts or None in found or len(found) != 1:
        return None
    return found.pop()


def normalise_grade(level, grade, kind=None):
    """Canonical grade string for a level (or for a subject kind such as MTL_B), or one of NON_SCORING_GRADES.
    Returns None if unreadable - for MTL_B anything but Merit / Pass / Ungraded / Absent is unreadable."""
    if grade is None:
        return None
    raw = str(grade).strip().upper()
    g = raw
    for w in GRADE_STRIP_WORDS:
        g = g.replace(w, "")
    g = g.strip()
    if g in ABSENT_ALIASES:
        return "ABS"
    by_kind = GRADES_BY_KIND.get(kind)
    if by_kind is not None:
        if raw in by_kind["grades"]:  # before stripping: "UNGRADED" holds the word "GRADE" (engine 0.1.5)
            return by_kind["grades"][raw]
        if g in by_kind["grades"]:
            return by_kind["grades"][g]
        if by_kind.get("only_these"):
            return None
    if g in NON_SCORING_GRADES:
        return g
    if level in GRADE_ALIASES:
        g = GRADE_ALIASES[level].get(g, g)
    if level in GRADE_ORDER and g in GRADE_ORDER[level]:
        return g
    return None


def mark_to_grade(level, mark):
    """The usual school mark bands (Results Compiler) - not MOE text."""
    bands = SCHOOL_COCKPIT_MARK_BANDS.get(level)
    if bands is None or mark is None:
        return None
    m = float(mark)
    for floor, grade in bands:
        if m >= floor:
            return grade
    return bands[-1][1]


def points(scale, level, grade):
    """Points for (level, grade) on a scale dict, or None if that grade cannot be used."""
    if grade == "ABS":
        grade = ABSENT_SCORES_AS.get(level)
    return scale["levels"].get(level, {}).get(grade)


def is_mer_unusable(scale, level, grade):
    return grade in scale.get("mer_unusable", {}).get(level, [])


def grade_at_or_better(level, grade, worst_allowed):
    """True if `grade` is `worst_allowed` or better on the level's order (e.g. B4 vs C6)."""
    order = GRADE_ORDER.get(level, [])
    if grade not in order or worst_allowed not in order:
        return False
    return order.index(grade) <= order.index(worst_allowed)
