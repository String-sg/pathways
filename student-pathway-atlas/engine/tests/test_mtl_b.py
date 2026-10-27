"""MTL 'B' Syllabus grades (Merit / Pass): valid, never scoring, meet the 2026 JC / MI MTL requirement.
Invented students and spellings."""

import unittest

from engine import check_inputs
from helpers import check, row, run, sec

CORE = [row("English Language", "B3"), row("Mathematics", "A2"), row("History", "B4"), row("Physics", "C5"),
        row("Chemistry", "B3"), row("Art", "A2")]


class TestMTLBGrades(unittest.TestCase):
    def test_spellings_and_grades_are_not_input_problems(self):
        rows = [{"subject": name, "level": "O", "grade": g, "year": 2026}
                for name, g in (("CHINESE B", "M"), ("Chinese 'B'", "p"), ("Malay B Syllabus", "Merit"),
                                ("tamil 'b' syllabus", "PASS"), ("Chinese Language B", "u"))]
        res = check_inputs(rows)
        self.assertEqual(res["input_problems"], [])
        self.assertEqual([e["grade"] for e in res["entries"]], ["MERIT", "PASS", "MERIT", "PASS", "UNGRADED"])
        self.assertEqual({e["subject_id"] for e in res["entries"]}, {"chinese_b", "malay_b", "tamil_b"})

    def test_letter_grade_for_b_syllabus_is_a_problem(self):
        res = check_inputs([{"subject": "Chinese B", "level": "O", "grade": "A1", "year": 2026}])
        p = res["input_problems"][0]
        self.assertEqual((p["field"], p["action"]), ("grade", "row ignored"))
        self.assertIn("Merit / Pass", p["problem"])

    def test_merit_meets_jc_mi_requirement_but_never_scores(self):
        rows = CORE + [{"subject": "CHINESE B", "level": "O", "grade": "M", "year": 2026}]
        for did, req in (("L1R5(2026)", "jc_subjects"), ("L1R4(2026)", "mi_subjects")):
            r = run(did, rows)
            self.assertEqual(r.input_problems, [], did)
            self.assertTrue(check(r, req)["met"], did)
            self.assertNotIn("chinese_b", [s["subject_id"] for s in r.slots], did)

    def test_l1r5_total(self):
        rows = CORE + [{"subject": "Chinese 'B'", "level": "O", "grade": "Pass", "year": 2026}]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.gross, 3 + 4 + 2 + 3 + 2 + 5)  # EL, Hist, Maths, Chem, Art, Physics; 'B' never counts
        self.assertTrue(check(r, "jc_gross")["met"])
        self.assertTrue(check(r, "jc_subjects")["met"])

    def test_ungraded_b_fails_the_requirement(self):
        rows = CORE + [{"subject": "Malay B", "level": "O", "grade": "U", "year": 2026}]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.input_problems, [])
        self.assertFalse(check(r, "jc_subjects")["met"])

    def test_b_never_fills_a_poly_or_ite_slot(self):
        rows = CORE[:4] + [{"subject": "Tamil B", "level": "O", "grade": "M", "year": 2026}]
        self.assertEqual(run("ELB4-A(2026)", rows).status, "not_computable")  # only 4 scoring subjects

    def test_2027_page_has_no_b_option(self):
        # The PSE JC/MI grade table lists G1 / G2 / G3 MTL and HMTL only - no 'B' Syllabus row.
        rows = [sec("English Language", "B3"), sec("Mathematics", "A2"), sec("History", "B4"), sec("Physics", "C5"),
                sec("Art", "A2"), row("Chinese B", "Merit", year=2026)]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.input_problems, [])
        self.assertFalse(check(r, "jcmi_subjects")["met"])


if __name__ == "__main__":
    unittest.main()
