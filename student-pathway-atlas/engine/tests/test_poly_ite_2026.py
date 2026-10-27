"""Poly ELR2B2-A/B/C/D(2026), ITE JAE ELB4-A / ELR1B3-B / ELR2B2-C:ITE(2026), JIE 'O' B5(2026)."""

import unittest

from helpers import check, picks, row, run

STUDENT = [row("English Language", "B3"), row("Mathematics", "A2"), row("Physics", "C6"),
           row("Chemistry", "F9"), row("Geography", "B4"), row("History", "C5"),
           row("Principles of Accounts", "B3"), row("Higher Chinese", "A1"), row("Chinese", "A2", year=2025)]


class TestPoly2026(unittest.TestCase):
    def test_elr2b2_a(self):
        # R1 (1st group) Geog 4 | Hist 5 ; R2 (2nd group incl. HCL, Maths, POA) HCL 1 ; B1/B2 Maths 2 + POA 3
        r = run("ELR2B2-A(2026)", STUDENT)
        self.assertEqual(r.gross, 3 + 4 + 1 + 2 + 3)
        p = picks(r)
        self.assertEqual(p["R1"][0], "geography")
        self.assertEqual(p["R2"][0], "higher_chinese")
        self.assertNotIn("chinese", [s["subject_id"] for s in r.slots])  # same-language rule

    def test_elr2b2_b_r1_only_maths(self):
        r = run("ELR2B2-B(2026)", STUDENT)
        p = picks(r)
        self.assertEqual(p["R1"][0], "mathematics")  # 1st group = A Maths / Maths only
        self.assertEqual(p["R2"][0], "principles_of_accounts")  # POA 3 beats Geog 4
        self.assertEqual(r.gross, 3 + 2 + 3 + 1 + 4)  # B: HCL 1, Geog 4

    def test_elr2b2_grade9_counts_9(self):
        rows = [row("English Language", "B3"), row("Mathematics", "A2"), row("Chemistry", "F9"),
                row("Geography", "B4"), row("Art", "C5")]
        r = run("ELR2B2-C:POLY(2026)", rows)
        self.assertEqual(r.gross, 3 + 2 + 9 + 4 + 5)
        self.assertEqual(picks(r)["R2"], ("chemistry", "F9", 9))
        r2 = run("ELR2B2-C:POLY(2026)", rows + [row("Physics", "D7")])
        self.assertEqual(r2.gross, 3 + 2 + 7 + 4 + 5)  # Physics D7 now beats Chemistry F9 for R2

    def test_poly_net_threshold_and_nursing(self):
        rows = [row("English Language", "C6"), row("Mathematics", "D7"), row("Biology", "D7"),
                row("Art", "C5"), row("Geography", "C5")]
        r = run("ELR2B2-C:POLY(2026)", rows, {"cca": "Excellent"})
        self.assertEqual(r.gross, 6 + 7 + 7 + 5 + 5)  # 30
        self.assertEqual(r.net, 28)
        self.assertFalse(check(r, "poly_net")["met"])
        self.assertTrue(check(r, "nursing_net")["met"])

    def test_earlier_science_fills_poly_c_group(self):
        rows = [row("English Language", "B3"), row("Mathematics", "A2"), row("Combined Science", "A1", year=2019),
                row("Art", "C5"), row("Geography", "B4")]
        r = run("ELR2B2-C:POLY(2026)", rows)
        self.assertEqual(picks(r)["R2"][0], "combined_science")
        self.assertEqual(r.gross, 3 + 2 + 1 + 4 + 5)
        r = run("ELR2B2-C:ITE(2026)", rows)
        self.assertEqual(r.gross, 3 + 2 + 1 + 4 + 5)
        self.assertEqual(picks(r)["R2"][0], "combined_science")

    def test_rk_can_fill_b_slot_for_poly(self):
        rows = [row("English Language", "A1"), row("Islamic Religious Knowledge", "A1"), row("Mathematics", "A1"),
                row("History", "A1"), row("Chemistry", "A1"), row("Art", "B4")]
        r = run("ELR2B2-A(2026)", rows)
        self.assertEqual(r.gross, 5)
        self.assertIn("islamic_rk", [s["subject_id"] for s in r.slots])

    def test_mtl_b_not_usable(self):
        rows = [row("English Language", "A1"), row("Malay 'B'", "Pass"), row("Mathematics", "A1"),
                row("History", "A1"), row("Chemistry", "A1")]
        self.assertEqual(run("ELR2B2-A(2026)", rows).status, "not_computable")


class TestITEJAE2026(unittest.TestCase):
    def test_elb4_a(self):
        r = run("ELB4-A(2026)", STUDENT)
        self.assertEqual(r.gross, 3 + 1 + 2 + 3 + 4)  # EL + HCL, Maths, POA, Geog

    def test_elr1b3_b(self):
        r = run("ELR1B3-B(2026)", STUDENT)
        self.assertEqual(picks(r)["R1"][0], "mathematics")
        self.assertEqual(r.gross, 3 + 2 + 1 + 3 + 4)

    def test_elr2b2_c_ite(self):
        r = run("ELR2B2-C:ITE(2026)", STUDENT)
        p = picks(r)
        self.assertEqual(p["R1"][0], "mathematics")
        self.assertEqual(p["R2"][0], "physics")  # Physics 6 beats Chemistry 9
        self.assertEqual(r.gross, 3 + 2 + 6 + 1 + 3)

    def test_sat_five_subjects(self):
        r = run("ELB4-A(2026)", STUDENT[:4])
        self.assertFalse(check(r, "ite_sat5")["met"])
        self.assertTrue(check(run("ELB4-A(2026)", STUDENT), "ite_sat5")["met"])

    def test_cca_bonus(self):
        self.assertEqual(run("ELB4-A(2026)", STUDENT, {"cca": "A2"}).net, 13 - 2)
        self.assertEqual(run("ELB4-A(2026)", STUDENT, {"cca": "B3"}).net, 13 - 1)
        self.assertEqual(run("ELB4-A(2026)", STUDENT, {"cca": "Fair"}).net, 13)


class TestJIEO2026(unittest.TestCase):
    def test_best_five_with_f9(self):
        rows = [row("English Language", "F9"), row("Mathematics", "E8"), row("Art", "D7"), row("Geography", "F9"),
                row("History", "F9")]
        r = run("B5(2026)", rows)
        self.assertEqual(r.gross, 9 + 8 + 7 + 9 + 9)
        self.assertTrue(check(r, "o_grades")["met"])  # Maths E8 and Art D7 = 2 grades 1-8
        r2 = run("B5(2026)", [row("English Language", "F9"), row("Mathematics", "E8"), row("Art", "F9"),
                              row("Geography", "F9"), row("History", "F9")])
        self.assertFalse(check(r2, "o_grades")["met"])


if __name__ == "__main__":
    unittest.main()
