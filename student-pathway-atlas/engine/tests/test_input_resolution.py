"""Input resolution: combined-subject separators, MOE's combined level labels, loud
input_problems, level defaulting for one-level subjects, and the level-aware bare name 'Science'.
All students and spellings are invented."""

import unittest

from engine import check_inputs, compute_all
from engine import grades as G
from engine import subjects as SUB
from helpers import picks, row, run, sec


class TestCombinedSubjectSeparators(unittest.TestCase):
    def test_separators_inside_parentheses_are_equal(self):
        r = SUB.resolve_subject
        for name in ["SCIENCE (PHYSICS & CHEMISTRY)", "Science (Physics and Chemistry)", "Science (Physics/Chemistry)",
                     "science(physics,chemistry)", "sCiEnCe ( pHySiCs  &  ChEmIsTrY )", "Science (Phy & Chem)"]:
            self.assertEqual(r(name), "sci_phy_chem", name)
        self.assertEqual(r("SCIENCE (CHEMISTRY & BIOLOGY)"), "sci_chem_bio")
        self.assertEqual(r("Science (Physics & Biology)"), "sci_phy_bio")
        self.assertEqual(r("SCIENCE (PHYSICS & CHEMISTRY & BIOLOGY)"), "sci_phy_chem_bio")

    def test_combined_humanities(self):
        r = SUB.resolve_subject
        self.assertEqual(r("HUMANITIES (SOCIAL STUDIES & GEOGRAPHY)"), "hum_ss_geog")
        self.assertEqual(r("Humanities (Social Studies and History)"), "hum_ss_hist")
        self.assertEqual(r("HUMANITIES (SOCIAL STUDIES & LITERATURE IN ENGLISH)"), "hum_ss_lit_eng")
        self.assertEqual(r("humanities (social studies / literature in malay)"), "hum_ss_lit_mal")
        self.assertEqual(r("Humanities (Social Studies & Literature in Tamil)"), "hum_ss_lit_tam")

    def test_ampersand_outside_parentheses_unchanged(self):
        self.assertEqual(SUB.resolve_subject("DESIGN & TECHNOLOGY"), "design_technology")
        self.assertEqual(SUB.resolve_subject("FOOD & NUTRITION"), "food_nutrition")
        self.assertEqual(SUB.resolve_subject("Exercise & Sports Science"), "exercise_sports_science")
        self.assertEqual(SUB.resolve_subject("MATHEMATICS (SYLLABUS B, C OR D)"), "mathematics_bcd")

    def test_capitals_and_ampersands_count_in_category_slots(self):
        # Results-slip style: capitals, '&' inside the brackets. The combined science must fill R2 (Maths/Science)
        # and the combined humanities R1, with no input problems.
        rows = [row("ENGLISH LANGUAGE", "B3"), row("HUMANITIES (SOCIAL STUDIES & GEOGRAPHY)", "B4"),
                row("SCIENCE (CHEMISTRY & BIOLOGY)", "A2"), row("MATHEMATICS", "C5"), row("ART", "B3"),
                row("FOOD & NUTRITION", "C6"), row("MALAY", "A2")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.input_problems, [])
        p = picks(r)
        self.assertEqual(p["R1"][0], "hum_ss_geog")
        self.assertEqual(p["R2"][0], "sci_chem_bio")
        self.assertEqual(r.gross, 3 + 4 + 2 + 5 + 2 + 3)  # R3 Maths C5, R4/R5 Malay A2 + Art B3
        c = run("ELR2B2-C:POLY(2026)", rows)
        self.assertEqual(picks(c)["R2"][0], "sci_chem_bio")
        self.assertEqual(c.gross, 3 + 5 + 2 + 2 + 3)


class TestCombinedLevelLabels(unittest.TestCase):
    def test_level_forms(self):
        n = G.normalise_level
        cases = {"G3/O-Level": "G3", "G2/N(A)-Level": "G2", "G1/N(T)-Level": "G1", "O-Level": "G3",
                 "N(A)-Level": "G2", "N(T)-Level": "G1", "GCE O-Level": "G3", "g3 / o-level": "G3",
                 "GCE N(A) Level": "G2", "o levels": "G3", "N(T) LEVEL": "G1", "SEC G2": "G2"}
        for raw, want in cases.items():
            self.assertEqual(n(raw), want, raw)
        for bad in ["G3/N(A)", "N-Level", "IB", "", "  ", "A-Level"]:
            self.assertIsNone(n(bad), bad)

    def test_same_subject_two_levels_in_combined_form(self):
        # ELMAB3:ITE(2027): Geography at G2/N(A)-Level grade 4 (2026) and G3/O-Level C5 (2027):
        # better G2-equivalent = C5 -> 2.
        rows = [{"subject": "English Language", "level": "G3/O-Level", "grade": "B4", "year": 2027},
                {"subject": "Mathematics", "level": "G2/N(A)-Level", "grade": "2", "year": 2027},
                {"subject": "Geography", "level": "G2/N(A)-Level", "grade": "4", "year": 2026},
                {"subject": "Geography", "level": "G3/O-Level", "grade": "C5", "year": 2027},
                {"subject": "Art", "level": "G2/N(A)-Level", "grade": "1", "year": 2027},
                {"subject": "Principles of Accounts", "level": "N(A)-Level", "grade": "3", "year": 2027}]
        for agg in ("ELMAB3:ITE(2027)", "ELMAB3:PFP(2027)"):
            r = run(agg, rows)
            self.assertEqual(r.input_problems, [], agg)
            self.assertEqual(r.gross, 2 + 2 + 1 + 2 + 3, agg)
            geog = [s for s in r.slots if s["subject_id"] == "geography"][0]
            self.assertEqual((geog["level"], geog["grade"], geog["points"]), ("G3", "C5", 2))


class TestInputProblemsAreLoud(unittest.TestCase):
    ROWS = [row("English Language", "A2"), {"subject": "Mathematics", "level": "G3/N(A)", "grade": "B3", "year": 2026},
            row("History", "B3"), row("Physics", "B4"), row("Chemistry", "C5"), row("Chinese", "A1"),
            row("Art", "Q7"), row("Robotics Club", "A1")]

    def test_every_result_carries_the_same_problems(self):
        out = compute_all(self.ROWS)
        first = out[0].input_problems
        self.assertEqual([(p["row"], p["field"], p["action"]) for p in first],
                         [(2, "level", "row ignored"), (7, "grade", "row ignored"),
                          (8, "subject", "treated as an 'Others' subject (fills 'any subject' slots only)")])
        for r in out:  # stubs and the 5th-year summary included
            self.assertEqual(r.input_problems, first, r.id)
            self.assertFalse(any("ignored" in w or "catalogue" in w for w in r.warnings), r.id)

    def test_missing_level_for_multi_level_subject(self):
        rows = [row("English Language", "A1"), {"subject": "Mathematics", "grade": "A1", "year": 2026}]
        probs = check_inputs(rows)["input_problems"]
        self.assertEqual([(p["field"], p["problem"], p["action"]) for p in probs],
                         [("level", "no level given", "row ignored")])

    def test_check_inputs_without_computing(self):
        res = check_inputs(self.ROWS)
        self.assertEqual(len(res["input_problems"]), 3)
        self.assertEqual(len(res["entries"]), 6)  # 8 rows - 2 dropped (the unknown subject is kept)

    def test_unreadable_year_is_a_problem(self):
        rows = [dict(row("English Language", "A1"), year="twenty")]
        probs = check_inputs(rows)["input_problems"]
        self.assertEqual(probs[0]["field"], "year")
        self.assertEqual(probs[0]["action"], "used for every exam year")


class TestOneLevelSubjectsDefaultTheLevel(unittest.TestCase):
    def test_hmtl_without_level_defaults_to_g3(self):
        rows = [sec("English Language", "B3"), {"subject": "Higher Tamil", "grade": "A1", "year": 2027},
                sec("History", "B4"), sec("Mathematics", "A2"), sec("Physics", "B3")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.input_problems, [])
        self.assertTrue(any("no level given - Higher Tamil is examined at G3 only, so G3 is assumed" in w
                            for w in r.warnings))
        self.assertEqual(r.gross, 3 + 4 + 2 + 3 + 1)  # EL-L1 with HTL A1 in R4 (HMTL-L1 ties at 13)
        self.assertIn(("higher_tamil", "G3"), [(s["subject_id"], s["level"]) for s in r.slots])

    def test_earlier_olevel_subject_defaults_to_g3(self):
        res = check_inputs([{"subject": "Combined Science", "grade": "B3", "year": 2024}])
        self.assertEqual(res["input_problems"], [])
        self.assertEqual(res["entries"][0]["level"], "G3")

    def test_hmtl_at_wrong_level_is_flagged(self):
        res = check_inputs([{"subject": "Higher Malay", "level": "N(A)", "grade": "2", "year": 2026}])
        p = res["input_problems"][0]
        self.assertEqual((p["field"], p["action"]), ("level", "kept as given"))
        self.assertEqual(p["problem"], "Higher Malay is examined at O-Level only.")

    def test_level_from_name_prefix(self):
        res = check_inputs([{"subject": "G1 Computing", "grade": "B", "year": 2027}])
        self.assertEqual(res["entries"][0]["subject_id"], "computing")
        self.assertEqual(res["entries"][0]["level"], "G1")
        self.assertTrue(any("taken from the subject name" in w for w in res["warnings"]))
        clash = check_inputs([{"subject": "G3 Computing", "level": "G1", "grade": "B", "year": 2027}])
        self.assertEqual(clash["input_problems"][0]["action"], "level column used")
        self.assertEqual(clash["entries"][0]["level"], "G1")


class TestBareScienceIsLevelAware(unittest.TestCase):
    NT = [{"subject": "Science", "level": "N(T)", "grade": "A", "year": 2026},
          {"subject": "English Language", "level": "N(T)", "grade": "C", "year": 2026},
          {"subject": "Art", "level": "N(T)", "grade": "B", "year": 2026},
          {"subject": "Mathematics", "level": "N(T)", "grade": "D", "year": 2026},
          {"subject": "Design & Technology", "level": "N(T)", "grade": "B", "year": 2026}]

    def test_bare_science_at_nt_fills_maths_or_science(self):
        r = run("MAS1B3(2026)", self.NT)
        self.assertEqual(r.input_problems, [])
        self.assertEqual(picks(r)["R1"], ("science_t", "A", 1))
        self.assertEqual(r.gross, 1 + 2 + 2 + 3)
        g1 = [dict(x, level="G1", year=2027) for x in self.NT]
        r2 = run("R1B3-B(2027)", g1)
        self.assertEqual(picks(r2)["R1"][0], "science_t")
        self.assertEqual(r2.gross, 1 + 2 + 2 + 3)

    def test_bare_science_elsewhere_is_ambiguous_and_loud(self):
        for level in ("N(A)", "G3/O-Level"):
            rows = [{"subject": "SCIENCE", "level": level, "grade": "2" if level == "N(A)" else "B3", "year": 2026}]
            res = check_inputs(rows)
            p = res["input_problems"][0]
            self.assertEqual(p["field"], "subject", level)
            self.assertIn("ambiguous", p["problem"])
            self.assertTrue(res["entries"][0]["subject_id"].startswith("unknown:"))
        none = check_inputs([{"subject": "Science", "grade": "A", "year": 2026}])["input_problems"][0]
        self.assertEqual((none["field"], none["action"]), ("level", "row ignored"))


if __name__ == "__main__":
    unittest.main()
