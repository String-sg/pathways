"""JC / MI aggregates: L1R5(2026), L1R4(2026) (MI), L1R4(2027) (SEC, JC + MI)."""

import unittest

from helpers import check, picks, row, run, sec

# EL B3, CL A2, Maths A1, A Maths B4, Physics C5, Chemistry C6, Geography B3, POA A1  (no HMTL)
PLAIN = [row("English Language", "B3"), row("Chinese", "A2"), row("Mathematics", "A1"),
         row("Additional Mathematics", "B4"), row("Physics", "C5"), row("Chemistry", "C6"),
         row("Geography", "B3"), row("Principles of Accounts", "A1")]


class TestL1R5_2026(unittest.TestCase):
    def test_no_hmtl(self):
        # L1 EL 3 + R1 Geog 3 + R2 Maths 1 + R3 AMaths 4 + R4/R5 POA 1, CL 2 = 14
        r = run("L1R5(2026)", PLAIN)
        self.assertEqual(r.gross, 14)
        p = picks(r)
        self.assertEqual(p["L1"][0], "english_language")
        self.assertEqual(p["R1"][0], "geography")
        self.assertEqual(p["R2"][0], "mathematics")
        self.assertEqual(p["R3"][0], "additional_mathematics")
        self.assertEqual({p["R4"][0], p["R5"][0]}, {"principles_of_accounts", "chinese"})
        self.assertEqual(r.greedy_total, 14)
        self.assertTrue(check(r, "jc_gross")["met"])
        self.assertTrue(check(r, "jc_subjects")["met"])

    def test_hmtl_as_l1_is_better(self):
        # EL E8. EL-L1: 8+Hist 3+Maths 3+Phy 4 + HCL 1 + Art 2 = 21.
        # HMTL-L1: HCL 1 + 3 + 3 + 4 + Art 2 + Econ 3 = 16 (EL drops out; CL blocked by HCL).
        rows = [row("English Language", "E8"), row("Higher Chinese", "A1"), row("Chinese", "A1"),
                row("Mathematics", "B3"), row("Physics", "B4"), row("History", "B3"), row("Art", "A2"),
                row("Economics", "B3")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.gross, 16)
        self.assertEqual(r.chosen_alternative, "HMTL")
        alts = {a["id"]: a["gross"] for a in r.alternatives}
        self.assertEqual(alts, {"EL": 21, "HMTL": 16})
        self.assertNotIn("chinese", [s["subject_id"] for s in r.slots])

    def test_other_first_language_fills_open_slot(self):
        # HMTL-L1 uses EL in R4/R5 when it is among the best: HCL A1 L1, EL A1 in R4.
        rows = [row("English Language", "A1"), row("Higher Malay", "A1"), row("Mathematics", "A2"),
                row("Biology", "A2"), row("Literature in English", "A2"), row("Art", "C6")]
        r = run("L1R5(2026)", rows)
        # EL-L1: 1 + Lit 2 + Maths 2 + Bio 2 + HML 1 + Art 6 = 14; HMTL-L1: 1 + 2 + 2 + 2 + EL 1 + Art 6 = 14
        self.assertEqual(r.gross, 14)
        hm = [a for a in r.alternatives if a["id"] == "HMTL"][0]
        self.assertIn("english_language", [s["subject_id"] for s in hm["slots"] if s["slot"] in ("R4", "R5")])

    def test_hmtl_with_mtl_in_lieu_any_language(self):
        # 2026 JC text: no HMTL with any MTL (MTL includes MTL-in-lieu).
        rows = [row("English Language", "A1"), row("Higher Chinese", "A1"), row("French", "A1"),
                row("History", "A1"), row("Mathematics", "A1"), row("Chemistry", "A1"), row("Art", "C6")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.gross, 11)  # 1+1+1+1 + (HCL or French) 1 + Art 6
        used = {s["subject_id"] for s in r.slots}
        self.assertFalse({"higher_chinese", "french"} <= used)
        # the 2027 rule is same-language only: HCL and French can both count
        rows27 = [dict(x, year=2027, level="G3") for x in rows]
        r27 = run("L1R4(2027)", rows27)
        self.assertEqual(r27.gross, 5)

    def test_religious_knowledge_never_counts(self):
        rows = [row("English Language", "A1"), row("Islamic Religious Knowledge", "A1"), row("Mathematics", "A1"),
                row("History", "A1"), row("Chemistry", "A1"), row("Art", "B4"), row("Music", "C6")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.gross, 14)  # 1+1+1+1 + Art 4 + Music 6
        self.assertNotIn("islamic_rk", [s["subject_id"] for s in r.slots])

    def test_mtl_b_counts_for_requirement_not_aggregate(self):
        rows = [row("English Language", "A1"), row("Chinese 'B'", "Merit"), row("Mathematics", "A1"),
                row("History", "A1"), row("Chemistry", "A1"), row("Geography", "A2")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.status, "not_computable")  # only 5 scoring subjects
        self.assertTrue(check(r, "jc_subjects")["met"] is not False)
        r2 = run("L1R5(2026)", rows + [row("Art", "B3")])
        self.assertEqual(r2.gross, 9)
        self.assertTrue(check(r2, "jc_subjects")["met"])

    def test_no_humanities_not_computable(self):
        rows = [row("English Language", "A1"), row("Mathematics", "A1"), row("Physics", "A1"),
                row("Chemistry", "A1"), row("Biology", "A1"), row("Art", "A1")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.status, "not_computable")
        self.assertIn("R1", r.not_computable_reason)
        self.assertIsNone(r.gross)

    def test_n_level_results_cannot_be_used(self):
        rows = [row("English Language", "1", "N(A)"), row("Mathematics", "1", "N(A)")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.status, "not_applicable")

    def test_two_sittings_better_grade(self):
        rows = PLAIN + [row("Mathematics", "C6", year=2025)]
        self.assertEqual(run("L1R5(2026)", rows).gross, 14)
        worse = [x for x in PLAIN if x["subject"] != "Mathematics"] + [row("Mathematics", "C6", year=2025),
                                                                       row("Mathematics", "A1", year=2026)]
        self.assertEqual(run("L1R5(2026)", worse).gross, 14)

    def test_more_than_two_exam_years(self):
        rows = PLAIN[:-1] + [row("Principles of Accounts", "A1", year=2024)]
        r = run("L1R5(2026)", rows)
        # only 2026 + 2024 (or 2025 + ...) pairs; 2026 + 2024 keeps POA: same 14
        self.assertEqual(r.gross, 14)
        rows3 = PLAIN + [row("Economics", "A1", year=2024), row("History", "A1", year=2025)]
        r3 = run("L1R5(2026)", rows3)
        self.assertTrue(any("more than 2 exam years" in w for w in r3.warnings))
        self.assertEqual(len(r3.years_used), 2)


class TestJCConditional2026(unittest.TestCase):
    def base(self, el="A1"):
        return [row("English Language", el), row("Chinese", "A2"), row("Mathematics", "A1"),
                row("History", "A2"), row("Physics", "A1"), row("Chemistry", "A2"), row("Art", "A1")]

    def test_conditional_by_gross_15(self):
        r = run("L1R5(2026)", self.base(el="D7"))  # EL fails A1-C6
        self.assertEqual(r.gross, 7 + 2 + 1 + 1 + 2 + 1)  # EL 7, Hist 2, Maths 1, Phy 1, R4/R5 Art 1 + CL 2 = 14
        self.assertFalse(check(r, "jc_subjects")["met"])
        self.assertTrue(check(r, "jc_conditional")["met"])

    def test_conditional_band_needs_a1_a2(self):
        rows = [row("English Language", "E8"), row("Chinese", "A2"), row("Mathematics", "A1"),
                row("History", "A2"), row("Physics", "A1"), row("Chemistry", "A2"), row("Art", "B3")]
        r = run("L1R5(2026)", rows)
        # 8 + Hist 2 + Maths 1 + Phy 1 + Chem 2 + CL 2 = 16; R1-R5 all A1/A2 -> conditional
        self.assertEqual(r.gross, 16)
        self.assertTrue(check(r, "jc_conditional")["met"])
        rows[1] = row("Chinese", "B4")
        r2 = run("L1R5(2026)", rows)  # R5 now Art B3 or CL B4 -> not all A1/A2
        self.assertEqual(r2.gross, 17)
        self.assertFalse(check(r2, "jc_conditional")["met"])

    def test_absent_blocks_conditional(self):
        rows = [row("English Language", "A1"), row("Chinese", "ABS"), row("Mathematics", "A1"),
                row("History", "A2"), row("Physics", "A1"), row("Chemistry", "A2"), row("Art", "A1"),
                row("Economics", "A1")]
        r = run("L1R5(2026)", rows)
        self.assertFalse(check(r, "jc_subjects")["met"])
        self.assertFalse(check(r, "jc_conditional")["met"])
        self.assertIn("Absent", check(r, "jc_conditional")["detail"])


class TestMI2026(unittest.TestCase):
    def test_mi_rule(self):
        # L1 EL 3 + R1/R2 best two H/M/S: Maths 1, Geog 3 + R3/R4 any: POA 1, CL 2 = 10
        r = run("L1R4(2026)", PLAIN)
        self.assertEqual(r.gross, 10)
        self.assertTrue(check(r, "mi_gross")["met"])


class TestL1R4_2027(unittest.TestCase):
    def test_sec_rule(self):
        rows = [dict(x, level="G3", year=2027) for x in PLAIN]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.gross, 12)  # EL 3 + Geog 3 + Maths 1 + AMaths 4 + POA 1
        self.assertTrue(check(r, "jc_gross")["met"])
        self.assertTrue(check(r, "mi_gross")["met"])

    def test_g2_subject_cannot_fill_g3_slot(self):
        rows = [sec("English Language", "A1"), sec("Geography", "1", "G2"), sec("Mathematics", "A1"),
                sec("Physics", "A2"), sec("Chemistry", "A2"), sec("Tamil", "A1")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.status, "not_computable")
        self.assertIn("Humanities", r.not_computable_reason)

    def test_sec3_olevel_mtl_combined(self):
        rows = [sec("English Language", "B3"), row("Tamil", "A2", year=2026), sec("Mathematics", "B4"),
                sec("Science (Physics, Chemistry)", "C5"), sec("History", "C6")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.gross, 3 + 6 + 4 + 5 + 2)
        self.assertEqual(sorted(r.years_used), [2026, 2027])

    def test_mtl_and_hmtl_same_language(self):
        rows = [sec("English Language", "A1"), sec("Higher Chinese", "C6"), sec("Chinese", "A1"),
                sec("History", "A1"), sec("Mathematics", "A1"), sec("Chemistry", "A1")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.gross, 5)  # EL-L1 with CL in R4
        hm = [a for a in r.alternatives if a["id"] == "HMTL"][0]
        self.assertEqual(hm["gross"], 6 + 1 + 1 + 1 + 1)  # HCL-L1, R4 = EL (CL blocked)
        self.assertNotIn("chinese", [s["subject_id"] for s in hm["slots"]])

    def test_jc_mi_thresholds_and_conditional(self):
        rows = [sec("English Language", "C6"), sec("History", "C5"), sec("Mathematics", "D7"),
                sec("Physics", "C6"), sec("Art", "C5"), sec("Malay", "3", "G2")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.gross, 6 + 5 + 6 + 7 + 5)  # R2 Phy 6, R3 Maths 7 -> 29
        self.assertFalse(check(r, "jc_gross")["met"])
        self.assertFalse(check(r, "mi_gross")["met"])
        self.assertTrue(check(r, "jcmi_subjects")["met"])  # G2 MTL grade 3 meets "G2: 1 to 5"
        good = [sec("English Language", "D7"), sec("History", "A1"), sec("Mathematics", "A2"),
                sec("Physics", "A1"), sec("Art", "A2"), sec("Malay", "2", "G2")]
        r2 = run("L1R4(2027)", good)  # 7 + 1 + 1 + 2 + 2 = 13; EL fails C6
        self.assertEqual(r2.gross, 13)
        self.assertFalse(check(r2, "jcmi_subjects")["met"])
        self.assertTrue(check(r2, "jc_conditional")["met"])  # 13-16 band, R1-R4 all A1/A2
        self.assertTrue(check(r2, "mi_conditional")["met"])  # <= 15


if __name__ == "__main__":
    unittest.main()
