#!/usr/bin/env python3
"""Parity harness, Python side: random students -> Python engine + matcher -> app/tools/_parity/.

    python3 app/tools/parity.py                 # 27,000 students, matcher on 3,000 of them (all 1,180 courses each)
    node app/tools/parity.js                    # runs app/src/pse_core.js on the same inputs and compares

    python3 app/tools/parity.py --students 2700 --match 300     # a quick run
    python3 app/tools/parity.py --digest-only   # Python outputs -> one sha256 (to prove a Python refactor changed nothing)

Students are generated from (seed, index) alone, so a run is reproducible and independent of the worker count.
Every 9th student by category is in the matcher subset (equal share of each category); the first --full-match of
those also get the full match_report (every CourseResult field) compared.

Output (gitignored): _parity/shard_NNN.jsonl.gz, one JSON line per student:
  {i, category, subjects, bonus, check_inputs, problems, results[...compute_all without input_problems...],
   compute: {id, result}, match_compact?: [...], match_report?: {...}}
plus _parity/manifest.json (counts, seed, digest). Standard library only.
"""

import argparse
import gzip
import hashlib
import json
import os
import random
import sys
import time
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(HERE, "_parity")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

CATEGORIES = ["o2026", "o_hmtl_mtl_2y", "mtl_b", "o_earlier", "n2026", "sec2027", "odd", "three_years", "mixed",
              "mixed_levels"]

# ----------------------------------------------------------------------------------------------- name pools
EL = ["English Language", "English", "EL", "ENGLISH LANGUAGE", "english language", "English Language (Syllabus A)"]
MTL = {"chinese": ["Chinese", "CL", "Chinese Language", "CHINESE"], "malay": ["Malay", "ML", "Malay Language"],
       "tamil": ["Tamil", "TL", "Tamil Language"]}
HMTL = {"chinese": ["Higher Chinese", "HCL", "Higher Chinese Language", "HIGHER CHINESE"],
        "malay": ["Higher Malay", "HML", "Higher Malay Language"], "tamil": ["Higher Tamil", "HTL"]}
MTLB = {"chinese": ["Chinese B", "CHINESE 'B'", "Chinese 'B' Syllabus", "CLB", "Chinese Language B"],
        "malay": ["Malay B", "Malay B Syllabus", "MALAY 'B'"], "tamil": ["Tamil B", "Tamil 'B'", "TLB"]}
IN_LIEU = ["French", "German", "Japanese", "Arabic", "Hindi", "Urdu", "Bengali", "Gujarati", "Panjabi", "Thai",
           "Burmese", "Arabic as a Third Language"]
MATHS = ["Mathematics", "Maths", "E Maths", "MATHEMATICS", "Elementary Mathematics"]
AMATHS = ["Additional Mathematics", "A Maths", "Add Maths", "ADDITIONAL MATHEMATICS", "AMath"]
SCI_PURE = ["Physics", "Chemistry", "Biology", "Pure Physics", "Chem", "Bio", "PHYSICS"]
SCI_COMB = ["Science (Physics, Chemistry)", "Science (Chemistry, Biology)", "Science (Physics, Biology)",
            "SCIENCE (PHYSICS & CHEMISTRY)", "Sci (P,B)", "Science (Chem, Bio)", "Science (Physics/Chemistry)"]
HUM = ["Geography", "History", "Humanities (Social Studies, Geography)", "Humanities (Social Studies, History)",
       "Hum(SS, Lit in EL)", "Literature in English", "Literature in Chinese",
       "Humanities (Social Studies/Literature in Malay)", "Higher Art", "Higher Music", "Chinese (Special Programme)",
       "Malay (Special Programme)", "Bahasa Indonesia", "Lit Eng", "Literature in Tamil", "Hum (SS, Geog)"]
OTHERS = ["Art", "Music", "Design & Technology", "Design and Technology", "Nutrition & Food Science",
          "Principles of Accounts", "POA", "Computing", "Economics", "Drama", "Electronics", "Biotechnology",
          "Business Studies", "Exercise and Sports Science", "Design Studies", "Islamic Religious Knowledge",
          "Spanish", "D&T"]
EARLIER = ["Combined Science", "Mathematics (Syllabus D)", "Mathematics (Syllabus B)", "Combined Humanities",
           "Food & Nutrition", "Physical Science", "Computer Studies", "Media Studies (English)",
           "Media Studies (Chinese)", "Commerce", "Bible Knowledge", "Art & Design", "English as a First Language",
           "Integrated Science", "Engineering Science", "Human & Social Biology", "Additional Science",
           "Science (Physics, Chemistry, Biology)", "Fundamentals of Electronics",
           "Introduction to Enterprise Development", "Music (MEP)", "Art & Design (AEP)", "Creative 3D Animation",
           "Physical Education", "Buddhist Studies", "Geometrical & Mechanical Drawing", "General Science",
           "Additional Combined Science", "Electricity & Electronics", "Commercial Studies"]
NA_SUBJ = ["Science (Chemistry, Biology)", "Science (Physics, Chemistry)", "Science (Physics, Biology)",
           "Humanities (Social Studies, Geography)", "Humanities (Social Studies, History)",
           "Humanities (Social Studies, Literature in English)", "Principles of Accounts", "Literature in English",
           "Geography", "History", "Art", "Design & Technology", "Nutrition & Food Science", "Computing",
           "Additional Mathematics", "Music", "Physics", "Chemistry", "Biology"]
NT_SUBJ = ["Science", "Science (Syllabus T)", "Mobile Robotics", "Smart Electrical Technology", "IoT Applications",
           "Mobile Web Applications", "Mechanical Design & Automation", "Computer Applications", "Basic Chinese",
           "Elements of Business Skills", "Design & Technology", "Nutrition & Food Science", "Art",
           "Retail Operations", "G1 Science", "Science (T)"]
UNKNOWN = ["Underwater Basket Weaving", "Computer Applications", "Basic Chinese", "Retail Operations",
           "Physics & Astronomy", "Social Studies", "Pure Chem", "Combined Sci", "Science", "Robotics",
           "Literature", "Hum", "Maths (Syllabus Z)", "123", "Chinese Language 'C'"]

O_LEVELS = ["O", "O", "O", "G3", "O-Level", "GCE O-Level", "o", "G3/O-Level", "EXP", "O LEVEL", "g3"]
NA_LEVELS = ["N(A)", "N(A)", "G2", "NA", "N(A)-Level", "G2/N(A)-Level", "GCE N(A)", "Normal (Academic)", "n(a)"]
NT_LEVELS = ["N(T)", "N(T)", "G1", "NT", "G1/N(T)-Level", "Normal (Technical)", "n(t)", "GCE N(T)"]
SEC_LEVELS = {"G3": ["G3", "G3", "G3", "SEC G3", "G3/O-Level", "g3"], "G2": ["G2", "G2", "G2", "SEC G2", "G2/N(A)-Level"],
              "G1": ["G1", "G1", "G1", "SEC G1", "G1/N(T)-Level"]}
ODD_LEVELS = ["N-Level", "G3/N(A)", "Sec 5", "", None, "A-Level", "G4", "Gce o-levels", "  g2 ", "N(A) Level",
              "SEC G3", "O Level", "N(T)-levels", "Singapore-Cambridge O-Level", "G3 / O-Level", "IP", 3,
              "constructor", "toString", "__proto__"]

O_GRADES = ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "F9"]
G3_SEC_GRADES = ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "9"]
NA_GRADES = ["1", "2", "3", "4", "5", "6", "U"]
NT_GRADES = ["A", "B", "C", "D", "E", "U"]
ODD_GRADES = ["A0", "Z", "", None, "MERIT", "M", "P", "Distinction", "X", "abs", "Absent", "AB", "grade b3",
              " b4 ", "9", 7, "1", "Grade 3", "PASS", "constructor", "U", "F", "a 1", "7"]
MTLB_GRADES = ["Merit", "Pass", "Ungraded", "M", "P", "U", "MERIT", "pass", "merit ", "ABS", "Distinction", "A1"]

CCA = [None, None, "Excellent", "Good", "Fair", "Poor", "excellent", " GOOD ", "A1", "A2", "B3", "C6", "D7", "",
       "Very Good", "constructor"]


def pick_grade(rng, grades, centre=None):
    """Weighted towards the middle of the list."""
    n = len(grades)
    k = int(rng.triangular(0, n, centre if centre is not None else n * 0.35))
    return grades[min(k, n - 1)]


def o_grade(rng, centre=None):
    g = pick_grade(rng, O_GRADES, centre)
    r = rng.random()
    if r < 0.05:
        return g.lower()
    if r < 0.08:
        return str(O_GRADES.index(g) + 1)
    if r < 0.09:
        return "ABS"
    if r < 0.10:
        return "Grade " + g
    return g


def row(name, level, grade, year, rng=None):
    d = {"subject": name, "level": level, "grade": grade}
    if year is not None:
        d["year"] = year
    return d


def o_core(rng, year=2026, n_extra=None):
    """A typical O-Level set (EL, MTL/HMTL, Maths, sciences, humanities, others)."""
    lv = lambda: rng.choice(O_LEVELS)  # noqa: E731
    centre = rng.uniform(0.5, 7.5)
    rows = [row(rng.choice(EL), lv(), o_grade(rng, centre), year)]
    fam = rng.choice(["chinese", "chinese", "malay", "tamil"])
    r = rng.random()
    if r < 0.45:
        rows.append(row(rng.choice(MTL[fam]), lv(), o_grade(rng, centre), year))
    elif r < 0.65:
        rows.append(row(rng.choice(HMTL[fam]), lv(), o_grade(rng, centre), year))
    elif r < 0.85:
        rows.append(row(rng.choice(HMTL[fam]), lv(), o_grade(rng, centre), year))
        rows.append(row(rng.choice(MTL[rng.choice([fam, fam, "malay", "tamil"])]), lv(), o_grade(rng, centre),
                        rng.choice([year, year, year - 1])))
    elif r < 0.93:
        rows.append(row(rng.choice(IN_LIEU), lv(), o_grade(rng, centre), year))
    if rng.random() < 0.95:
        rows.append(row(rng.choice(MATHS), lv(), o_grade(rng, centre), year))
    if rng.random() < 0.55:
        rows.append(row(rng.choice(AMATHS), lv(), o_grade(rng, centre), year))
    for _ in range(rng.choice([0, 1, 1, 2, 2, 3])):
        rows.append(row(rng.choice(SCI_PURE + SCI_COMB), lv(), o_grade(rng, centre), year))
    for _ in range(rng.choice([0, 1, 1, 1, 2])):
        rows.append(row(rng.choice(HUM), lv(), o_grade(rng, centre), year))
    for _ in range(rng.choice([0, 0, 1, 1, 2]) if n_extra is None else n_extra):
        rows.append(row(rng.choice(OTHERS), lv(), o_grade(rng, centre), year))
    return rows


def cat_o2026(rng):
    rows = o_core(rng)
    if rng.random() < 0.1:
        for r in rows:
            r.pop("year", None)
    return rows


def cat_hmtl_mtl(rng):
    fam = rng.choice(["chinese", "chinese", "malay", "tamil"])
    rows = [r for r in o_core(rng) if not any(r["subject"] in v for v in list(MTL.values()) + list(HMTL.values()))]
    lv = lambda: rng.choice(O_LEVELS)  # noqa: E731
    pattern = rng.randrange(5)
    if pattern == 0:  # MTL in Sec 3 (2025), HMTL in 2026
        rows += [row(rng.choice(MTL[fam]), lv(), o_grade(rng), 2025), row(rng.choice(HMTL[fam]), lv(), o_grade(rng), 2026)]
    elif pattern == 1:  # MTL sat twice
        rows += [row(rng.choice(MTL[fam]), lv(), o_grade(rng), 2025), row(rng.choice(MTL[fam]), lv(), o_grade(rng), 2026)]
    elif pattern == 2:  # HMTL in 2025, MTL in 2026 (other family sometimes)
        rows += [row(rng.choice(HMTL[fam]), lv(), o_grade(rng), 2025),
                 row(rng.choice(MTL[rng.choice([fam, "malay", "tamil"])]), lv(), o_grade(rng), 2026)]
    elif pattern == 3:  # HMTL + MTL + in-lieu
        rows += [row(rng.choice(HMTL[fam]), lv(), o_grade(rng), 2026), row(rng.choice(MTL[fam]), lv(), o_grade(rng), 2025),
                 row(rng.choice(IN_LIEU), lv(), o_grade(rng), 2026)]
    else:  # two HMTLs / MTLs of different families
        f2 = rng.choice([f for f in MTL if f != fam])
        rows += [row(rng.choice(HMTL[fam]), lv(), o_grade(rng), 2026), row(rng.choice(HMTL[f2]), lv(), o_grade(rng), 2025),
                 row(rng.choice(MTL[f2]), lv(), o_grade(rng), 2026)]
    rng.shuffle(rows)
    return rows


def cat_mtl_b(rng):
    fam = rng.choice(["chinese", "chinese", "malay", "tamil"])
    rows = [r for r in o_core(rng) if not any(r["subject"] in v for v in list(MTL.values()) + list(HMTL.values()))]
    lv = rng.choice(O_LEVELS + [None, None])
    rows.append(row(rng.choice(MTLB[fam]), lv, rng.choice(MTLB_GRADES), rng.choice([2026, 2026, 2025, None])))
    r = rng.random()
    if r < 0.2:
        rows.append(row(rng.choice(MTL[fam]), rng.choice(O_LEVELS), o_grade(rng), 2026))
    elif r < 0.35:
        rows.append(row(rng.choice(IN_LIEU), rng.choice(O_LEVELS), o_grade(rng), 2026))
    elif r < 0.45:
        rows.append(row(rng.choice(HMTL[fam]), rng.choice(O_LEVELS), o_grade(rng), 2026))
    if rng.random() < 0.3:  # an N(A) student with MTL B
        rows = [dict(r, level=rng.choice(NA_LEVELS), grade=pick_grade(rng, NA_GRADES)) if "B" not in r["subject"]
                and rng.random() < 0.7 else r for r in rows]
    return rows


def cat_earlier(rng):
    yr = rng.choice([2024, 2025, 2026])
    rows = o_core(rng, year=2026)
    for _ in range(rng.choice([1, 1, 2, 3, 4])):
        rows.append(row(rng.choice(EARLIER), rng.choice(O_LEVELS + [None]), o_grade(rng), rng.choice([yr, 2026, 2025])))
    if rng.random() < 0.3:  # an older candidate: drop the current Maths / sciences
        rows = [r for r in rows if r["subject"] not in MATHS + SCI_PURE + SCI_COMB or rng.random() < 0.3]
    rng.shuffle(rows)
    return rows


def na_grade(rng, centre=None):
    g = pick_grade(rng, NA_GRADES, centre)
    return int(g) if (g.isdigit() and rng.random() < 0.15) else g


def nt_grade(rng, centre=None):
    g = pick_grade(rng, NT_GRADES, centre)
    return g.lower() if rng.random() < 0.05 else g


def cat_n2026(rng):
    rows = []
    if rng.random() < 0.65:  # N(A)
        c = rng.uniform(0.3, 5.5)
        lv = lambda: rng.choice(NA_LEVELS)  # noqa: E731
        rows.append(row(rng.choice(EL), lv(), na_grade(rng, c), 2026))
        rows.append(row(rng.choice(MATHS), lv(), na_grade(rng, c), 2026))
        fam = rng.choice(["chinese", "malay", "tamil"])
        if rng.random() < 0.8:
            rows.append(row(rng.choice(MTL[fam]), lv(), na_grade(rng, c), 2026))
        for _ in range(rng.choice([1, 2, 3, 3, 4])):
            rows.append(row(rng.choice(NA_SUBJ), lv(), na_grade(rng, c), 2026))
        for _ in range(rng.choice([0, 0, 1, 1, 2, 3])):  # O-Level subjects taken in Sec 4 N(A)
            rows.append(row(rng.choice(EL + MATHS + SCI_COMB + HUM + MTL[fam] + AMATHS), rng.choice(O_LEVELS),
                            o_grade(rng, rng.uniform(2, 8)), rng.choice([2026, 2026, 2025])))
        if rng.random() < 0.1:
            rows.append(row(rng.choice(NT_SUBJ), rng.choice(NT_LEVELS), nt_grade(rng), 2026))
    else:  # N(T)
        c = rng.uniform(0.3, 4.5)
        lv = lambda: rng.choice(NT_LEVELS)  # noqa: E731
        rows.append(row(rng.choice(EL), lv(), nt_grade(rng, c), 2026))
        rows.append(row(rng.choice(MATHS), lv(), nt_grade(rng, c), 2026))
        for _ in range(rng.choice([1, 2, 3, 4])):
            rows.append(row(rng.choice(NT_SUBJ), lv(), nt_grade(rng, c), 2026))
        if rng.random() < 0.6:
            rows.append(row(rng.choice(MTL[rng.choice(["chinese", "malay", "tamil"])]), lv(), nt_grade(rng, c), 2026))
        for _ in range(rng.choice([0, 0, 0, 1, 2])):  # N(A) subjects taken by N(T) students
            rows.append(row(rng.choice(NA_SUBJ + EL + MATHS), rng.choice(NA_LEVELS), na_grade(rng), 2026))
        if rng.random() < 0.05:
            rows.append(row(rng.choice(EL + MATHS), rng.choice(O_LEVELS), o_grade(rng, 6), 2026))
    rng.shuffle(rows)
    return rows


def sec_grade(rng, level, centre=None):
    if level == "G3":
        return pick_grade(rng, G3_SEC_GRADES, centre)
    if level == "G2":
        return na_grade(rng, None if centre is None else centre * 0.7)
    return nt_grade(rng, None if centre is None else centre * 0.6)


def cat_sec2027(rng):
    base = rng.choice(["G3", "G3", "G2", "G2", "G1"])
    c = rng.uniform(0.5, 7.5)

    def lvl():
        r = rng.random()
        if base == "G3":
            return "G3" if r < 0.8 else ("G2" if r < 0.97 else "G1")
        if base == "G2":
            return "G2" if r < 0.55 else ("G3" if r < 0.85 else "G1")
        return "G1" if r < 0.6 else ("G2" if r < 0.9 else "G3")

    rows = []
    fam = rng.choice(["chinese", "chinese", "malay", "tamil"])
    pool = [rng.choice(EL), rng.choice(MATHS)]
    if rng.random() < 0.85:
        pool.append(rng.choice(MTL[fam]))
    if rng.random() < 0.25:
        pool.append(rng.choice(HMTL[fam]))
    if rng.random() < 0.4:
        pool.append(rng.choice(AMATHS))
    pool += rng.sample(SCI_PURE + SCI_COMB + HUM + OTHERS + NA_SUBJ, rng.choice([2, 3, 3, 4, 5]))
    if base == "G1" or rng.random() < 0.1:
        pool += rng.sample(NT_SUBJ, rng.choice([1, 2]))
    for name in pool:
        lv = lvl()
        rows.append(row(name, rng.choice(SEC_LEVELS[lv]), sec_grade(rng, lv, c), 2027))
    for _ in range(rng.choice([1, 1, 2])):  # a subject at two levels (G2 and G3 / G1 and G2)
        src = rng.choice(rows)
        lv = rng.choice(["G2", "G3", "G1"])
        rows.append(row(src["subject"], rng.choice(SEC_LEVELS[lv]), sec_grade(rng, lv, c), rng.choice([2027, 2027, 2026])))
    r = rng.random()
    if r < 0.25:  # O-Level MTL taken in Sec 3 (2026)
        rows.append(row(rng.choice(MTL[fam] + HMTL[fam]), rng.choice(O_LEVELS), o_grade(rng), 2026))
    elif r < 0.35:  # earlier GCE N(A) results
        rows.append(row(rng.choice(NA_SUBJ + EL + MATHS), rng.choice(NA_LEVELS), na_grade(rng), 2026))
    elif r < 0.4:  # 2028 results (outside every window)
        rows.append(row(rng.choice(HUM), "G3", sec_grade(rng, "G3"), 2028))
    rng.shuffle(rows)
    return rows


def corrupt(rng, r):
    r = dict(r)
    k = rng.randrange(12)
    if k == 0:
        r["subject"] = rng.choice(["  " + str(r["subject"]).lower() + "  ", str(r["subject"]).upper().replace(" ", "  "),
                                   str(r["subject"]).replace(" ", " "), str(r["subject"]).replace(" ", " "),
                                   str(r["subject"]).replace(" ", "\x1f"), str(r["subject"]).replace("'", "’"),
                                   str(r["subject"]) + "\n"])
    elif k == 1:
        r["subject"] = rng.choice(UNKNOWN)
    elif k == 2:
        r["subject"] = rng.choice(["", None, "   ", 0, 123])
    elif k == 3:
        r["level"] = rng.choice(ODD_LEVELS)
        if r["level"] is None:
            r.pop("level")
    elif k == 4:
        r["grade"] = rng.choice(ODD_GRADES)
    elif k == 5:
        r.pop("grade", None)
        r["mark"] = rng.choice([rng.randrange(0, 101), rng.randrange(0, 100) + 0.5, str(rng.randrange(0, 101)), 0])
    elif k == 6:
        r["year"] = rng.choice(["2026", " 2025 ", "twenty", "", None, 2024, "2_026", True, 2026.0, "2026.0", "+2026"])
    elif k == 7:
        r["subject"] = rng.choice(["G3 Mathematics", "G2 Geography", "g1 science", "G3 Computing", "G2 Science",
                                   "G1 English Language", "G3  History", "G2 Unknown Subject", "Science",
                                   "Science (Physics and Chemistry)", "SCIENCE (PHYSICS / CHEMISTRY)",
                                   "Chinese ‘B’", "Humanities (Social Studies & Geography)",
                                   "Design & Technology", "English  Language", "Higher  Chinese",
                                   "Science (Physics,Chemistry)", "Science ( Physics , Chemistry )"])
        if rng.random() < 0.5:
            r.pop("level", None)
    elif k == 8:
        r["name"] = r.pop("subject")
    elif k == 9:
        r.pop("level", None)
        r["subject"] = rng.choice(["Higher Chinese", "Combined Science", "Science (Syllabus T)", "Mathematics",
                                   "Higher Tamil", "Commerce", "Mobile Robotics", "English Language"])
    elif k == 10:
        r["grade"] = rng.choice(MTLB_GRADES)
    else:
        r.pop("year", None)
    return r


def cat_odd(rng):
    base = [cat_o2026, cat_hmtl_mtl, cat_mtl_b, cat_earlier, cat_n2026, cat_sec2027][rng.randrange(6)](rng)
    n = min(len(base), rng.choice([1, 1, 2, 2, 3, 4]))
    idx = rng.sample(range(len(base)), n)
    rows = [corrupt(rng, r) if i in idx else r for i, r in enumerate(base)]
    for _ in range(rng.choice([0, 0, 1, 2])):
        rows.insert(rng.randrange(len(rows) + 1), corrupt(rng, row(rng.choice(UNKNOWN + HUM + OTHERS), rng.choice(O_LEVELS),
                                                                    o_grade(rng), 2026)))
    return rows


def cat_three_years(rng):
    rows = []
    years = rng.sample([2023, 2024, 2025, 2026], rng.choice([3, 3, 4]))
    core = o_core(rng, year=2026)
    for r in core:
        r = dict(r)
        r["year"] = rng.choice(years)
        rows.append(r)
        if rng.random() < 0.3:  # retake in another year
            rows.append(dict(r, year=rng.choice(years), grade=o_grade(rng)))
    for r in rows:
        x = rng.random()
        if x < 0.08:
            r.pop("year", None)
        elif x < 0.16:
            r.pop("grade", None)
            r["mark"] = rng.choice([rng.randrange(20, 100), rng.randrange(20, 99) + 0.5])
    if rng.random() < 0.3:  # plus SEC 2027 rows
        for name in rng.sample(EL + MATHS + HUM + SCI_PURE, 3):
            lv = rng.choice(["G3", "G2"])
            rows.append(row(name, lv, sec_grade(rng, lv), 2027))
    if rng.random() < 0.2:  # plus N(A) rows
        rows.append(row(rng.choice(NA_SUBJ), rng.choice(NA_LEVELS), na_grade(rng), rng.choice(years)))
    rng.shuffle(rows)
    return rows


def cat_mixed(rng):
    rows = []
    for _ in range(rng.randrange(1, 14)):
        lv = rng.choice(["O", "N(A)", "N(T)", "G3", "G2", "G1"])
        name = rng.choice(EL + MATHS + AMATHS + SCI_PURE + SCI_COMB + HUM + OTHERS + EARLIER + NA_SUBJ + NT_SUBJ
                          + IN_LIEU + sum(MTL.values(), []) + sum(HMTL.values(), []) + sum(MTLB.values(), []))
        if lv in ("O", "G3"):
            g = rng.choice(O_GRADES + G3_SEC_GRADES)
        elif lv in ("N(A)", "G2"):
            g = rng.choice(NA_GRADES)
        else:
            g = rng.choice(NT_GRADES)
        if "B" in name.upper().split() or "'B'" in name.upper():
            g = rng.choice(MTLB_GRADES)
        rows.append(row(name, lv, g, rng.choice([2024, 2025, 2026, 2026, 2027, 2027, None])))
    if rng.random() < 0.05:
        rows = []
    return rows


def cat_mixed_levels(rng):
    """Engine 0.1.5 cases: an O-Level set with an N(A) / N(T) paper (usually the MTL); an N(A) set with O-Level
    subjects, N(A) 6 / U, an N(T) paper, or N-Level results from two years (NFP); a subject at two levels; no MTL /
    Absent / no Maths (conditional admission); English and gross near the arts minimums; SEC with MTL 'B' and G1 U."""
    k = rng.randrange(9)
    fam = rng.choice(["chinese", "chinese", "malay", "tamil"])
    if k == 0:  # O-Level student, MTL (or another paper) at N(A) / N(T)
        rows = [r for r in o_core(rng) if not any(r["subject"] in v for v in list(MTL.values()) + list(HMTL.values()))]
        lv = rng.choice(NA_LEVELS + NT_LEVELS[:3])
        g = na_grade(rng) if lv in NA_LEVELS else nt_grade(rng)
        rows.append(row(rng.choice(MTL[fam]), lv, g, rng.choice([2026, 2026, 2025])))
        if rng.random() < 0.3:
            rows.append(row(rng.choice(MTL[fam] + HMTL[fam]), rng.choice(O_LEVELS), o_grade(rng), 2026))
        if rng.random() < 0.25:
            src = rng.choice(rows)
            rows.append(row(src["subject"], rng.choice(NA_LEVELS), na_grade(rng), 2026))
    elif k == 1:  # N(A) student with O-Level subjects (Maths under subject-based banding, Sec 3 MTL ...)
        c = rng.uniform(0.5, 5)
        rows = [row(rng.choice(EL), "N(A)", na_grade(rng, c), 2026), row(rng.choice(MATHS), "N(A)", na_grade(rng, c), 2026)]
        for _ in range(rng.choice([2, 3, 3, 4])):
            rows.append(row(rng.choice(NA_SUBJ), rng.choice(NA_LEVELS), rng.choice(NA_GRADES), 2026))
        for _ in range(rng.choice([1, 1, 2, 3])):
            rows.append(row(rng.choice(EL + MATHS + AMATHS + SCI_COMB + HUM + MTL[fam] + HMTL[fam]), rng.choice(O_LEVELS),
                            o_grade(rng, rng.uniform(1, 9)), rng.choice([2026, 2026, 2025])))
        if rng.random() < 0.3:
            rows.append(row(rng.choice(NT_SUBJ + MTL[fam]), rng.choice(NT_LEVELS), nt_grade(rng), 2026))
    elif k == 2:  # N(A) results from two years (NFP: not combined) and O-Level F9s
        rows = []
        for yr in (2025, 2026):
            for name in rng.sample(EL[:1] + MATHS[:1] + NA_SUBJ, rng.choice([3, 4, 5])):
                rows.append(row(name, rng.choice(NA_LEVELS), rng.choice(NA_GRADES[:5] + ["6", "U"]), yr))
        if rng.random() < 0.5:
            rows.append(row(rng.choice(EL + MATHS + HUM), rng.choice(O_LEVELS), rng.choice(["F9", "E8", "D7", "B3"]), 2026))
    elif k == 3:  # N(T) student with N(A) papers, the same subject at two levels
        rows = [row(rng.choice(EL), "N(T)", nt_grade(rng), 2026), row(rng.choice(MATHS), "N(T)", nt_grade(rng), 2026)]
        for _ in range(rng.choice([1, 2, 3])):
            rows.append(row(rng.choice(NT_SUBJ), rng.choice(NT_LEVELS), rng.choice(NT_GRADES), 2026))
        for _ in range(rng.choice([1, 2])):
            src = rng.choice(rows)
            rows.append(row(src["subject"], rng.choice(NA_LEVELS), na_grade(rng), 2026))
        if rng.random() < 0.3:
            rows.append(row(rng.choice(EL + MATHS), rng.choice(O_LEVELS), o_grade(rng, 7), 2026))
    elif k == 4:  # JC / MI specific subjects: no MTL, an Absent MTL, no Maths, a 'B' Syllabus Ungraded
        rows = [r for r in o_core(rng) if not any(r["subject"] in v for v in list(MTL.values()) + list(HMTL.values()))]
        x = rng.random()
        if x < 0.25:
            rows.append(row(rng.choice(MTL[fam]), rng.choice(O_LEVELS), rng.choice(["ABS", "Absent", "AB"]), 2026))
        elif x < 0.45:
            rows = [r for r in rows if r["subject"] not in MATHS + AMATHS] + [row(rng.choice(MTL[fam]), "O", o_grade(rng), 2026)]
        elif x < 0.6:
            rows.append(row(rng.choice(MTLB[fam]), "O", rng.choice(["Ungraded", "UNGRADED", "U", "Merit", "Pass"]), 2026))
        elif x < 0.75:
            rows.append(row(rng.choice(MTL[fam]), "O", rng.choice(["E8", "F9", "D7"]), 2026))
    elif k == 5:  # around the arts minimums: English C6 / D7 / N(A), gross near 25, CCA bonus
        c = rng.uniform(4, 8)
        rows = [row(rng.choice(EL), rng.choice(["O", "O", "O", "N(A)"]), rng.choice(["B4", "C5", "C6", "D7", "E8", "3"]), 2026)]
        for name in rng.sample(MATHS[:1] + HUM[:4] + OTHERS[:6] + SCI_PURE[:3], rng.choice([3, 4, 5])):
            rows.append(row(name, "O", o_grade(rng, c), 2026))
        if rng.random() < 0.3:
            rows.append(row(rng.choice(MTL[fam]), rng.choice(O_LEVELS + NA_LEVELS), rng.choice(O_GRADES), 2026))
    elif k == 7:  # engine 0.1.7: SEC around NAFA's NFP (G2 English 3 / 4, G3 9 and E8, G1 and G2 6 not counted)
        rows = [row(rng.choice(EL), rng.choice(["G2", "G2", "G3", "G1"]), rng.choice(["2", "3", "4", "D7", "E8", "A"]), 2027)]
        for name in rng.sample(MATHS[:1] + AMATHS[:1] + HUM[:4] + OTHERS[:6] + NA_SUBJ[:6], rng.choice([4, 5, 6])):
            lv = rng.choice(["G2", "G2", "G3", "G1"])
            g = rng.choice(["1", "2", "3", "4", "5", "6"]) if lv == "G2" else (
                rng.choice(G3_SEC_GRADES) if lv == "G3" else rng.choice(NT_GRADES))
            rows.append(row(name, lv, g, 2027))
    elif k == 8:  # engine 0.1.7: totals around NAFA's 25 / 21, where the CCA points decide (bonus is random)
        sec_ = rng.random() < 0.5
        yr = 2027 if sec_ else 2026
        rows = [row(rng.choice(EL), "G3" if sec_ else "O", rng.choice(["B4", "C5", "C6"]), yr)]
        for name in rng.sample(MATHS[:1] + HUM[:4] + OTHERS[:6] + SCI_PURE[:3], 4):
            rows.append(row(name, "G3" if sec_ else "O", rng.choice(["C5", "C6", "C6", "D7", "D7", "E8"]), yr))
        if sec_ and rng.random() < 0.6:
            rows.append(row(rng.choice(NA_SUBJ[:6]), "G2", rng.choice(["2", "3", "4", "5"]), yr))
    else:  # SEC 2027: MTL 'B', G1 U, G2 6, no MTL, the arts 2028 rule
        rows = []
        for name in [rng.choice(EL), rng.choice(MATHS)] + rng.sample(SCI_PURE + HUM + OTHERS + NA_SUBJ, rng.choice([2, 3, 4])):
            lv = rng.choice(["G3", "G3", "G2", "G1"])
            rows.append(row(name, lv, rng.choice(["U", "E", "A"]) if lv == "G1" and rng.random() < 0.3 else
                            ("6" if lv == "G2" and rng.random() < 0.2 else sec_grade(rng, lv)), 2027))
        x = rng.random()
        if x < 0.3:
            rows.append(row(rng.choice(MTLB[fam]), rng.choice(["G3", "G2", None]), rng.choice(MTLB_GRADES[:6]), 2027))
        elif x < 0.6:
            rows.append(row(rng.choice(MTL[fam]), rng.choice(["G3", "G2", "G1"]), sec_grade(rng, "G2"), 2027))
    rng.shuffle(rows)
    return rows


GEN = [cat_o2026, cat_hmtl_mtl, cat_mtl_b, cat_earlier, cat_n2026, cat_sec2027, cat_odd, cat_three_years, cat_mixed,
       cat_mixed_levels]


def bonus_inputs(rng):
    r = rng.random()
    if r < 0.05:
        return None
    if r < 0.1:
        return {}
    b = {}
    cca = rng.choice(CCA)
    if cca is not None or rng.random() < 0.3:
        b["cca"] = cca
    x = rng.random()
    if x < 0.25:
        b["affiliated_jc"] = True
    elif x < 0.35:
        b["affiliated_jc"] = False
    elif x < 0.38:
        b["affiliated_jc"] = rng.choice([1, 0, "yes", ""])
    y = rng.random()
    if y < 0.2:
        b["lep"] = True
    elif y < 0.3:
        b["lep"] = False
    return b


def student(seed, i):
    rng = random.Random("%d:%d" % (seed, i))
    cat = i % len(CATEGORIES)
    return CATEGORIES[cat], GEN[cat](rng), bonus_inputs(rng), rng


def in_match_subset(i, every):
    """1 in `every` students: one per block of `every` consecutive indices, at a rotating position, so every
    category gets its share."""
    return i % every == (i // every) % every


# ------------------------------------------------------------------------------------------------ workers
_ENGINE = {}


def _init():
    from engine import check_inputs, compute, compute_all
    from engine.definitions import DEFINITIONS
    from matcher import match, match_report
    _ENGINE.update(check_inputs=check_inputs, compute=compute, compute_all=compute_all, match=match,
                   match_report=match_report, ids=[d["id"] for d in DEFINITIONS])


def _jsonable(x):
    return json.loads(json.dumps(x))


def compact_match(results):
    out = []
    for r in results:
        d = r if isinstance(r, dict) else r.to_dict()
        reasons = []
        for x in d["reasons"]:
            lines = [l["met"] for l in x.get("lines") or []]
            reasons.append([x["id"], x["met"], lines])
        out.append([d["requirement_key"], d["exercise"], d["stream"], d["eligible"], d["aggregate_id"], d["gross"],
                    d["net"], reasons])
    return out


def run_chunk(args):
    seed, start, stop, every, full_cut, out_path = args
    if not _ENGINE:
        _init()
    E = _ENGINE
    h = hashlib.sha256()
    counts = {"students": 0, "match": 0, "full_match": 0}
    f = gzip.open(out_path, "wt", encoding="utf-8", compresslevel=3) if out_path else None
    try:
        for i in range(start, stop):
            cat, subjects, bonus, rng = student(seed, i)
            subjects_in = _jsonable(subjects)
            bonus_in = _jsonable(bonus)
            rec = {"i": i, "category": cat, "subjects": subjects_in, "bonus": bonus_in}
            rec["check_inputs"] = _jsonable(E["check_inputs"](subjects_in))
            results = [r.to_dict() for r in E["compute_all"](subjects_in, bonus_in)]
            problems = results[0]["input_problems"] if results else []
            for r in results:
                if r["input_problems"] != problems:
                    raise AssertionError("student %d: input_problems differ between results" % i)
                del r["input_problems"]
            rec["problems"] = _jsonable(problems)
            rec["results"] = _jsonable(results)
            cid = rng.choice(E["ids"])
            rec["compute"] = {"id": cid, "result": _jsonable(E["compute"](cid, subjects_in, bonus_in).to_dict())}
            if in_match_subset(i, every):
                counts["match"] += 1
                if i < full_cut:
                    rep = E["match_report"](subjects_in, bonus_in)
                    rep = dict(rep, results=[r.to_dict() for r in rep["results"]])
                    rec["match_report"] = _jsonable(rep)
                    rec["match_compact"] = compact_match(rep["results"])
                    counts["full_match"] += 1
                else:
                    rec["match_compact"] = _jsonable(compact_match(E["match"](subjects_in, bonus_in)))
                    ex = rng.choice([None, ["JAE-2027"], ["PSE-2028", "DPP-2027"], []])
                    if ex is not None:
                        rec["match_exercises"] = ex
                        rec["match_compact_ex"] = _jsonable(compact_match(E["match"](subjects_in, bonus_in, ex)))
            line = json.dumps(rec, sort_keys=True, separators=(",", ":"))
            h.update(line.encode("utf-8"))
            if f:
                f.write(line + "\n")
            counts["students"] += 1
    finally:
        if f:
            f.close()
    return start, h.hexdigest(), counts


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--students", type=int, default=27000)
    ap.add_argument("--match", type=int, default=3000, help="students in the matcher subset (spread over categories)")
    ap.add_argument("--full-match", type=int, default=120, help="of those, how many get the full match_report compared")
    ap.add_argument("--seed", type=int, default=20261018)
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument("--chunk", type=int, default=500)
    ap.add_argument("--digest-only", action="store_true", help="compute the Python output digest; write no shards")
    a = ap.parse_args(argv)

    every = max(1, a.students // max(1, a.match))
    full_cut = a.full_match * every
    os.makedirs(OUT_DIR, exist_ok=True)
    if not a.digest_only:
        for fn in os.listdir(OUT_DIR):
            if fn.startswith("shard_") or fn == "manifest.json":
                os.remove(os.path.join(OUT_DIR, fn))
    jobs = []
    for k, start in enumerate(range(0, a.students, a.chunk)):
        stop = min(a.students, start + a.chunk)
        out = None if a.digest_only else os.path.join(OUT_DIR, "shard_%03d.jsonl.gz" % k)
        jobs.append((a.seed, start, stop, every, full_cut, out))
    t = time.time()
    with Pool(a.workers, initializer=_init) as pool:
        res = pool.map(run_chunk, jobs, chunksize=1)
    res.sort()
    digest = hashlib.sha256("".join(h for _, h, _ in res).encode()).hexdigest()
    counts = {k: sum(c[k] for _, _, c in res) for k in ("students", "match", "full_match")}
    from engine import ENGINE_VERSION
    from matcher import MATCHER_VERSION
    manifest = {"seed": a.seed, "students": counts["students"], "match_students": counts["match"],
                "full_match_students": counts["full_match"], "every": every, "categories": CATEGORIES,
                "engine_version": ENGINE_VERSION, "matcher_version": MATCHER_VERSION, "python_digest": digest,
                "shards": [os.path.basename(j[5]) for j in jobs] if not a.digest_only else [],
                "seconds": round(time.time() - t, 1)}
    if not a.digest_only:
        with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
            json.dump(manifest, f, indent=1)
    print(json.dumps(manifest if a.digest_only else {k: v for k, v in manifest.items() if k != "shards"}, indent=1))


if __name__ == "__main__":
    main()
