"""N-Level aggregates: ELMAB3:DPP(2026) (JIE 'H'), ELMAB3:PFP(2026), JIE 'N' MAS1B3 / ELB3 / B4 / MAB3 / ELMAB2."""

import unittest

from helpers import check, picks, row, run


def na(subject, grade, year=2026):
    return row(subject, grade, "N(A)", year)


def nt(subject, grade, year=2026):
    return row(subject, grade, "N(T)", year)


class TestDPP2026(unittest.TestCase):
    def test_gross_and_families(self):
        rows = [na("English Language", "3"), na("Mathematics", "4"), na("Science (Chemistry, Biology)", "2"),
                na("Principles of Accounts", "3"), na("History", "5")]
        r = run("ELMAB3:DPP(2026)", rows, {"cca": "Good"})
        self.assertEqual(r.gross, 3 + 4 + 2 + 3 + 5)
        self.assertEqual(r.net, 16)
        self.assertTrue(check(r, "dpp_gross")["met"])
        self.assertTrue(check(r, "dpp_family_asci")["met"])
        self.assertTrue(check(r, "dpp_family_bs")["met"])
        rows[0] = na("English Language", "4")
        r2 = run("ELMAB3:DPP(2026)", rows)
        self.assertTrue(check(r2, "dpp_family_asci")["met"])
        self.assertFalse(check(r2, "dpp_family_bs")["met"])  # business & services needs EL 1-3

    def test_na_grade_6_unusable_and_olevel_conversion(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Science (Physics, Chemistry)", "1"),
                na("Principles of Accounts", "U"), row("Art", "B4"), row("Principles of Accounts", "C6"),
                na("Geography", "6")]
        r = run("ELMAB3:DPP(2026)", rows)
        # B: Sci 1, Art B4 -> 2, POA: better of N(A) U (unusable) and O C6 (2) -> 2 ; Geog 6 unusable
        self.assertEqual(r.gross, 2 + 2 + 1 + 2 + 2)
        poa = [s for s in r.slots if s["subject_id"] == "principles_of_accounts"][0]
        self.assertEqual((poa["level"], poa["grade"]), ("G3", "C6"))

    def test_f9_counts_but_cannot_meet_requirements(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Science (Physics, Chemistry)", "1"),
                na("Principles of Accounts", "1"), row("Art", "F9")]
        r = run("ELMAB3:DPP(2026)", rows)
        self.assertEqual(r.gross, 2 + 2 + 1 + 1 + 5)
        self.assertFalse(check(r, "dpp_family_asci")["met"])  # Art F9 can't meet "1 to 5"
        r2 = run("ELMAB3:DPP(2026)", rows + [na("History", "5")])
        self.assertEqual(r2.gross, 11)  # History 5 ties with Art F9 (5)
        self.assertEqual(picks(r2)["B3"][0], "history")  # tie broken towards the pick that meets MER
        self.assertTrue(check(r2, "dpp_family_asci")["met"])

    def test_nt_cannot_use_dpp(self):
        rows = [nt("English Language", "A"), nt("Mathematics", "A"), nt("Science (Syllabus T)", "A"),
                nt("Art", "A"), nt("Mobile Robotics", "A")]
        self.assertEqual(run("ELMAB3:DPP(2026)", rows).status, "not_applicable")

    def test_requires_na(self):
        rows = [row("English Language", "A1"), row("Mathematics", "A1"), row("Art", "A1"), row("History", "A1"),
                row("Physics", "A1")]
        r = run("ELMAB3:DPP(2026)", rows)
        self.assertEqual(r.gross, 5)
        self.assertFalse(check(r, "dpp_na")["met"])


class TestPFP2026(unittest.TestCase):
    def test_gross_and_clusters(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Science (Chemistry, Biology)", "3"),
                na("Art", "2"), na("History", "4"), na("Geography", "1")]
        r = run("ELMAB3:PFP(2026)", rows)
        self.assertEqual(r.gross, 2 + 2 + 1 + 2 + 3)  # B: Geog 1, Art 2, Sci 3
        self.assertIsNone(r.net)  # no 2026 PFP bonus schedule
        self.assertTrue(check(r, "pfp_gross")["met"])
        self.assertTrue(check(r, "pfp_cluster_sci")["met"])
        self.assertTrue(check(r, "pfp_cluster_hum")["met"])

    def test_relevant_subject_outside_best_three(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Chinese", "1"), na("Economics", "1"),
                na("Music", "1"), na("Science (Physics, Biology)", "3")]
        r = run("ELMAB3:PFP(2026)", rows)
        self.assertEqual(r.gross, 7)
        sci = check(r, "pfp_cluster_sci")
        self.assertTrue(sci["met"])
        self.assertEqual(sci["total"], 2 + 2 + 3 + 1 + 1)
        self.assertFalse(check(r, "pfp_cluster_hum")["met"])  # no humanities-cluster relevant subject

    def test_grade_floors(self):
        rows = [na("English Language", "4"), na("Mathematics", "2"), na("Science (Chemistry, Biology)", "1"),
                na("Art", "1"), na("Geography", "1")]
        r = run("ELMAB3:PFP(2026)", rows)
        self.assertEqual(r.gross, 9)
        self.assertTrue(check(r, "pfp_gross")["met"])
        self.assertFalse(check(r, "pfp_cluster_sci")["met"])  # EL must be grade 3 or better

    def test_olevel_9_does_not_count(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Art", "1"), na("Geography", "1"),
                row("Physics", "F9")]
        self.assertEqual(run("ELMAB3:PFP(2026)", rows).status, "not_computable")


class TestJIEN2026(unittest.TestCase):
    NT = [nt("English Language", "C"), nt("Mathematics", "B"), nt("Science (Syllabus T)", "D"),
          nt("Mobile Robotics", "A"), nt("Computer Applications", "B"), nt("Tamil", "E")]

    def test_five_aggregates(self):
        self.assertEqual(run("B4(2026)", self.NT).gross, 1 + 2 + 2 + 3)
        self.assertEqual(run("ELB3(2026)", self.NT).gross, 3 + 1 + 2 + 2)
        self.assertEqual(run("MAB3(2026)", self.NT).gross, 2 + 1 + 2 + 3)
        self.assertEqual(run("ELMAB2(2026)", self.NT).gross, 3 + 2 + 1 + 2)
        r = run("MAS1B3(2026)", self.NT)
        self.assertEqual(r.gross, 1 + 2 + 2 + 3)
        self.assertEqual(picks(r)["R1"][0], "mobile_robotics")  # ITE substitute for Science

    def test_mixed_levels_each_on_its_own_table(self):
        rows = [na("English Language", "4"), na("Mathematics", "5"), row("Physics", "E8"), nt("Art", "A"),
                na("Geography", "6")]
        r = run("B4(2026)", rows)
        # N(A) 4 -> 2, N(A) 5 -> 3, O E8 -> 2, N(T) A -> 1, N(A) 6 -> 4 ; best 4 = 1 + 2 + 2 + 3
        self.assertEqual(r.gross, 8)

    def test_mer_passes(self):
        r = run("ELMAB2(2026)", self.NT)
        self.assertTrue(check(r, "jien_mer")["met"])  # EL C, Maths B + 1 other pass
        weak = [nt("English Language", "E"), nt("Mathematics", "B"), nt("Art", "A"), nt("Computer Applications", "B")]
        self.assertFalse(check(run("ELMAB2(2026)", weak), "jien_mer")["met"])
        self.assertTrue(check(run("MAB3(2026)", weak), "jien_mer")["met"])
        olevel = [row("English Language", "F9"), row("Mathematics", "F9"), row("Art", "E8"), row("History", "D7")]
        self.assertTrue(check(run("MAS1B3(2026)", olevel), "jien_mer")["met"])  # 2 O-Level grades 1-8

    def test_bonus_net(self):
        r = run("B4(2026)", self.NT, {"cca": "Excellent"})
        self.assertEqual(r.net, 8 - 2)


if __name__ == "__main__":
    unittest.main()
