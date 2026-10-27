"""PSE 2028 (2027 SEC) aggregates other than L1R4: ELR2B2-x(2027), ELMAB3:PFP / :ITE(2027),
ITE 3-year R2B2 / R1B3-A/B/C / B4(2027), 5th-year ELMAB3 / ELB3 / MAB3 :5Y(2027) and the 5th-year summary."""

import unittest

from engine import compute_all
from helpers import check, picks, row, run, sec


class TestPolyELR2B2_2027(unittest.TestCase):
    def test_b2_uses_g2_equivalent(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "B3"), sec("Physics", "B4"), sec("Chemistry", "C5"),
                sec("Geography", "1", "G2"), sec("Geography", "C6")]
        r = run("ELR2B2-C(2027)", rows)
        # B1 must be G3: Chem 5 ; B2 = Geography, better G2-equivalent of (G2 1 -> 1, G3 C6 -> 2) = 1
        self.assertEqual(r.gross, 3 + 3 + 4 + 5 + 1)
        b2 = [s for s in r.slots if s["slot"] == "B2"][0]
        self.assertEqual((b2["subject_id"], b2["level"], b2["points"]), ("geography", "G2", 1))

    def test_two_g3_subjects_better_one_is_b1(self):
        rows = [sec("English Language", "A2"), sec("Mathematics", "A1"), sec("Biology", "A2"), sec("Art", "B3"),
                sec("History", "B4")]
        r = run("ELR2B2-C(2027)", rows)
        p = picks(r)
        self.assertEqual(p["B1"][0], "art")  # B3 in B1 (3), History B4 -> 2 in B2: 5
        self.assertEqual(p["B2"], ("history", "B4", 2))
        self.assertEqual(r.gross, 2 + 1 + 2 + 3 + 2)

    def test_grade9_and_g2_5_6_unusable(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "A2"), sec("Chemistry", "F9"), sec("Physics", "C6"),
                sec("Art", "5", "G2"), sec("Design & Technology", "4", "G2"), sec("Geography", "B4")]
        r = run("ELR2B2-C(2027)", rows)
        self.assertEqual(r.gross, 3 + 2 + 6 + 4 + 4)  # R2 Phy 6; B1 Geog 4; B2 D&T G2 4
        self.assertNotIn("chemistry", [s["subject_id"] for s in r.slots])
        self.assertNotIn("art", [s["subject_id"] for s in r.slots])

    def test_g2_cannot_be_relevant_subject(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "2", "G2"), sec("Physics", "C6"),
                sec("Geography", "B4"), sec("Art", "1", "G2")]
        r = run("ELR2B2-C(2027)", rows)
        self.assertEqual(r.status, "not_computable")
        self.assertIn("R1", r.not_computable_reason)

    def test_thresholds(self):
        rows = [sec("English Language", "C6"), sec("Mathematics", "C5"), sec("Biology", "C6"), sec("Art", "C5"),
                sec("History", "D7")]
        r = run("ELR2B2-C(2027)", rows, {"cca": "Good"})
        self.assertEqual(r.gross, 6 + 5 + 6 + 5 + 3)  # 25
        self.assertEqual(r.net, 24)
        self.assertFalse(check(r, "poly_net")["met"])
        self.assertTrue(check(r, "nursing_net")["met"])


ITE_STUDENT = [sec("English Language", "2", "G2"), sec("Mathematics", "3", "G2"),
               sec("Science (Chemistry, Biology)", "1", "G2"), sec("Art", "F9"), sec("History", "6", "G2"),
               sec("Geography", "5", "G2")]


class TestELMAB3_2027(unittest.TestCase):
    def test_pfp_and_ite_differ(self):
        pfp = run("ELMAB3:PFP(2027)", ITE_STUDENT)
        self.assertEqual(pfp.status, "not_computable")  # F9, G2 5 and G2 6 unusable -> only 1 B subject
        ite = run("ELMAB3:ITE(2027)", ITE_STUDENT)
        # B: Sci 1, Art F9 -> 5, Geog 5 (History 6 next) ; ties prefer the pick that can meet subject MER
        self.assertEqual(ite.gross, 2 + 3 + 1 + 5 + 5)
        self.assertTrue(check(ite, "ite2_gross")["met"])

    def test_g1_not_usable(self):
        rows = [sec("English Language", "A", "G1"), sec("Mathematics", "A", "G1"), sec("Art", "A", "G1"),
                sec("Geography", "A", "G1"), sec("History", "A", "G1")]
        self.assertEqual(run("ELMAB3:ITE(2027)", rows).status, "not_applicable")
        self.assertEqual(run("ELMAB3:PFP(2027)", rows).status, "not_applicable")

    def test_pfp_threshold_and_cluster(self):
        rows = [sec("English Language", "B4"), sec("Mathematics", "2", "G2"), sec("Science (Chemistry, Biology)", "3", "G2"),
                sec("Art", "1", "G2"), sec("Geography", "C6")]
        r = run("ELMAB3:PFP(2027)", rows, {"cca": "Excellent"})
        self.assertEqual(r.gross, 2 + 2 + 1 + 2 + 3)  # EL B4 -> 2, Geog C6 -> 2
        self.assertEqual(r.net, 8)
        self.assertTrue(check(r, "pfp_gross")["met"])
        sci = check(r, "pfp_cluster_sci")
        self.assertTrue(sci["met"])
        self.assertIn("provisional", sci)


class TestITE3Year2027(unittest.TestCase):
    def test_points_and_aggregates(self):
        rows = [sec("English Language", "C", "G1"), sec("Mathematics", "4", "G2"), sec("Art", "E8"),
                sec("Geography", "B", "G1"), sec("Science", "D", "G1")]
        # bare "Science" at G1 is the N(T) / G1 Science subject (science_t)
        self.assertEqual(run("B4(2027)", rows).gross, 2 + 2 + 2 + 3)  # Maths 2, Art 2, Geog 2, EL 3
        self.assertEqual(run("R2B2(2027)", rows).gross, 3 + 2 + 2 + 2)
        self.assertEqual(run("R1B3-A(2027)", rows).gross, 2 + 2 + 2 + 3)
        self.assertEqual(run("R1B3-C(2027)", rows).gross, 3 + 2 + 2 + 2)

    def test_r1b3_b_science(self):
        rows = [sec("Science (Syllabus T)", "A", "G1"), sec("Mathematics", "D", "G1"), sec("Art", "B", "G1"),
                sec("Geography", "B", "G1"), sec("English Language", "C", "G1")]
        r = run("R1B3-B(2027)", rows)
        self.assertEqual(picks(r)["R1"][0], "science_t")
        self.assertEqual(r.gross, 1 + 2 + 2 + 3)

    def test_mer_fails_when_no_second_pass(self):
        rows = [sec("Mathematics", "D", "G1"), sec("English Language", "E", "G1"), sec("Science (Syllabus T)", "E", "G1"),
                sec("Art", "C", "G1"), sec("Geography", "E", "G1")]
        r = run("R1B3-A(2027)", rows)
        self.assertEqual(r.gross, 4 + 3 + 5 + 5)
        self.assertFalse(check(r, "ite3_mer")["met"])
        self.assertTrue(check(run("B4(2027)", rows), "ite3_mer")["met"] is None)

    def test_tie_break_towards_requirement(self):
        rows = [sec("English Language", "C", "G1"), sec("Mathematics", "C", "G1"), sec("Art", "F9"),
                sec("Geography", "C", "G1"), sec("History", "E", "G1")]
        r = run("R2B2(2027)", rows)
        self.assertEqual(r.gross, 3 + 3 + 3 + 3)
        self.assertEqual(picks(r)["B1"][0], "geography")  # G1 C meets the B1 requirement; Art 9 does not
        self.assertTrue(check(r, "ite3_mer")["met"])

    def test_mer_met_only_by_other_assignment(self):
        # Two G3 9s (3 pts each, cannot meet MER) beat a G1 D (4 pts, meets it): gross uses the 9s,
        # MER is met by swapping in the D.
        rows = [sec("English Language", "C", "G1"), sec("Mathematics", "C", "G1"), sec("Art", "F9"),
                sec("History", "F9"), sec("Geography", "D", "G1")]
        r = run("R2B2(2027)", rows)
        self.assertEqual(r.gross, 3 + 3 + 3 + 3)
        mer = check(r, "ite3_mer")
        self.assertTrue(mer["met"])
        self.assertEqual(mer["total"], 3 + 3 + 4 + 3)


class TestFifthYear2027(unittest.TestCase):
    G2_STUDENT = [sec("English Language", "3", "G2"), sec("Mathematics", "4", "G2"), sec("Science (Physics, Chemistry)", "2", "G2"),
                  sec("Geography", "4", "G2"), sec("Art", "B3"), sec("History", "6", "G2")]

    def test_aggregates_at_g2(self):
        res = {r.id: r for r in compute_all(self.G2_STUDENT)}
        self.assertEqual(res["ELMAB3:5Y(2027)"].gross, 3 + 4 + 2 + 1 + 4)  # Art B3 -> 1; History 6 unusable
        self.assertEqual(res["ELB3:5Y(2027)"].gross, 3 + 1 + 2 + 4)
        self.assertEqual(res["MAB3:5Y(2027)"].gross, 4 + 1 + 2 + 3)
        summary = res["5TH-YEAR(2027)"]
        el = {e["id"]: e["met"] for e in summary.eligibility}
        self.assertTrue(el["criterion_b"])  # 1 G3 pass; ELMAB3 14 <= 21
        self.assertFalse(el["criterion_a"])
        self.assertTrue(el["eligible"])
        self.assertTrue(el["all_g3"])  # 14 <= 19

    def test_grade_6_unusable(self):
        rows = [sec("English Language", "6", "G2"), sec("Mathematics", "4", "G2"), sec("Art", "1", "G2"),
                sec("Geography", "2", "G2"), sec("History", "3", "G2")]
        r = run("ELMAB3:5Y(2027)", rows)
        self.assertEqual(r.status, "not_computable")
        self.assertEqual(run("MAB3:5Y(2027)", rows).gross, 4 + 1 + 2 + 3)

    def test_g3_strong_student_not_eligible(self):
        rows = [sec("English Language", "A1"), sec("Mathematics", "A1"), sec("History", "A1"), sec("Physics", "A1"),
                sec("Chemistry", "A2"), sec("Chinese", "A1")]
        res = {r.id: r for r in compute_all(rows)}
        el = {e["id"]: e["met"] for e in res["5TH-YEAR(2027)"].eligibility}
        self.assertFalse(el["criterion_a"])  # qualifies for JC
        self.assertFalse(el["criterion_b"])  # more than 2 G3 passes
        self.assertFalse(el["eligible"])


if __name__ == "__main__":
    unittest.main()
