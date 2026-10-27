"""See README.md."""

import json
import os
import unittest

from engine import compute_all
from engine import subjects as SUB
from engine.definitions import (ALTERNATIVE_RULE, DEFINITIONS, DEFINITIONS_BY_ID, EMPTY_SLOT_RULE,
                                FIFTH_YEAR_2027, format_display_name)
from engine.export_definitions import OUT
from helpers import ROOT, picks, row, run, sec, source_listed


def na(subject, grade, year=2026):
    return row(subject, grade, "N(A)", year)


class TestEarlierSubjectsByCategory(unittest.TestCase):
    """See README.md."""

    def test_effective_membership(self):
        m = SUB.slot_members
        for g in ("POLY_C_G2", "POLY_D_G2"):
            self.assertIn("combined_science", m(g))
            self.assertIn("sci_phy_chem_bio", m(g))
        for g in ("POLY_A_G2", "POLY_B_G2"):
            self.assertNotIn("combined_science", m(g))  # no Science in these lists
        for g in ("POLY_B_G1", "POLY_C_G1", "POLY_D_G1", "POLY_A_G2"):
            self.assertIn("mathematics_bcd", m(g))
        self.assertIn("music_mep", m("POLY_A_G1"))
        self.assertNotIn("commerce", m("POLY_A_G1"))  # earlier 'Others' not named in the list
        self.assertIn("computer_studies", m("POLY_C_G2"))  # earlier 'Others' named in the list
        for g in ("ITE_C_G1", "ITE_C_G2", "ITE_R1B3B_R1", "PFP_REL_SCI", "PFP_REL_HUM"):
            self.assertEqual(m(g), SUB.printed_members(g), g)
        self.assertNotIn("combined_science", SUB.group_members("POLY_C_G2"))  # printed list unchanged

    def test_combined_science_fills_d_but_not_b(self):
        rows = [row("English Language", "B3"), row("Mathematics", "A2"), row("Combined Science", "A1", year=2020),
                row("Geography", "C6"), row("Art", "B4")]
        d = run("ELR2B2-D(2026)", rows)
        self.assertEqual(picks(d)["R2"][0], "combined_science")
        self.assertEqual(d.gross, 3 + 2 + 1 + 4 + 6)
        b = run("ELR2B2-B(2026)", rows)
        p = picks(b)
        self.assertEqual(p["R2"][0], "art")  # B's 2nd group has no Science: Art B4 takes R2
        self.assertEqual(p["B1"][0], "combined_science")  # Combined Science only as a best-other subject
        self.assertEqual(b.gross, 3 + 2 + 4 + 1 + 6)

    def test_mathematics_syllabus_d_fills_first_group(self):
        rows = [row("English Language", "B3"), row("Mathematics (Syllabus D)", "B4", year=2021), row("History", "A2"),
                row("Art", "B3"), row("Economics", "C5")]
        r = run("ELR2B2-B(2026)", rows)
        self.assertEqual(picks(r)["R1"][0], "mathematics_bcd")
        self.assertEqual(r.gross, 3 + 4 + 2 + 3 + 5)
        # ITE lists stay as printed: Mathematics (Syllabus D) is not on ITE's R1 lists
        self.assertEqual(run("ELR1B3-B(2026)", rows).status, "not_computable")
        self.assertEqual(run("ELR2B2-C:ITE(2026)", rows).status, "not_computable")

    def test_earlier_others_only_where_named(self):
        rows = [row("English Language", "B3"), row("Mathematics", "A2"), row("Computer Studies", "B4", year=2018),
                row("Commerce", "A1", year=2018), row("Art", "C5")]
        r = run("ELR2B2-C:POLY(2026)", rows)
        self.assertEqual(picks(r)["R2"][0], "computer_studies")
        a = run("ELR2B2-A(2026)", [row("English Language", "B3"), row("Commerce", "A1", year=2018),
                                   row("Mathematics", "A2"), row("Art", "C5"), row("Geography", "B4")])
        self.assertNotEqual(picks(a)["R1"][0], "commerce")

    def test_2027_poly_reuses_the_rule(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "A2"), row("Combined Science", "B4", year=2026),
                sec("Art", "C5"), sec("History", "2", "G2")]
        r = run("ELR2B2-C(2027)", rows)
        self.assertEqual(picks(r)["R2"][0], "combined_science")
        self.assertEqual(r.gross, 3 + 2 + 4 + 5 + 2)


class TestGrade9Poly2026(unittest.TestCase):
    """See README.md."""

    def test_scales(self):
        for did in ("ELR2B2-A(2026)", "ELR2B2-B(2026)", "ELR2B2-C:POLY(2026)", "ELR2B2-D(2026)", "L1R5(2026)",
                    "L1R4(2026)", "ELB4-A(2026)", "ELR1B3-B(2026)", "ELR2B2-C:ITE(2026)"):
            self.assertEqual({s["scale"] for s in DEFINITIONS_BY_ID[did]["slots"]}, {"O_POINTS"}, did)
        self.assertTrue(any("follows MOE" in n for n in DEFINITIONS_BY_ID["ELR2B2-B(2026)"]["notes"]))

    def test_maths_9_fills_first_group(self):
        # Mathematics F9 is the only 1st-group subject: a computed gross, not "not computable".
        rows = [row("English Language", "C6"), row("Mathematics", "F9"), row("History", "C5"), row("Art", "B4"),
                row("Geography", "D7")]
        for did in ("ELR2B2-A(2026)", "ELR2B2-B(2026)"):
            r = run(did, rows)
            self.assertEqual(r.status, "computed", did)
        b = run("ELR2B2-B(2026)", rows)
        self.assertEqual(picks(b)["R1"], ("mathematics", "F9", 9))
        self.assertEqual(b.gross, 6 + 9 + 5 + 4 + 7)  # R2 History C5 (5), B Art B4 (4), Geog D7 (7)
        self.assertFalse(b.eligibility[0]["met"])  # 31 > 26

    def test_2027_poly_still_excludes_9(self):
        rows = [sec("English Language", "C6"), sec("Mathematics", "F9"), sec("History", "C5"), sec("Art", "B4"),
                sec("Geography", "D7")]
        r = run("ELR2B2-B(2027)", rows)
        self.assertEqual(r.status, "not_computable")
        self.assertIn("R1", r.not_computable_reason)


class TestITEMathematicsAndScience(unittest.TestCase):
    """See README.md."""

    def test_jie_n_amaths_in_mathematics_slots(self):
        rows = [na("English Language", "3"), na("Additional Mathematics", "2"), na("Geography", "4"),
                na("Principles of Accounts", "1"), na("Art", "5")]
        mab3 = run("MAB3(2026)", rows)
        self.assertEqual(picks(mab3)["MA"][0], "additional_mathematics")
        self.assertEqual(mab3.gross, 1 + 1 + 1 + 2)  # N(A) 2 -> 1, EL 3 -> 1, POA 1 -> 1, Geog 4 -> 2
        self.assertTrue([e for e in mab3.eligibility if e["id"] == "jien_mer"][0]["met"])
        elmab2 = run("ELMAB2(2026)", rows)
        self.assertEqual(picks(elmab2)["MA"][0], "additional_mathematics")
        self.assertTrue([e for e in elmab2.eligibility if e["id"] == "jien_mer"][0]["met"])
        self.assertEqual(picks(run("MAS1B3(2026)", rows))["R1"][0], "additional_mathematics")

    def test_ite_3_year_by_analogy(self):
        rows = [sec("English Language", "C", "G1"), sec("Additional Mathematics", "B3"), sec("Art", "B", "G1"),
                sec("Geography", "C", "G1"), sec("History", "D", "G1")]
        for did, slot in (("R2B2(2027)", "R2"), ("R1B3-A(2027)", "R1"), ("R1B3-B(2027)", "R1")):
            r = run(did, rows)
            self.assertEqual(picks(r)[slot][0], "additional_mathematics", did)
            self.assertTrue(any("by analogy" in n for n in r.notes), did)

    def test_science_set_for_jie_n(self):
        accepted = [na("Science (Physics, Chemistry)", "2"), na("Science (Chemistry, Biology)", "2"),
                    na("Science (Physics, Biology)", "2"), {"subject": "Science", "level": "N(T)", "grade": "A",
                                                            "year": 2026},
                    row("Physics", "C6"), row("Chemistry", "C6"), row("Biology", "C6"),
                    {"subject": "Mobile Robotics", "level": "N(T)", "grade": "A", "year": 2026},
                    {"subject": "IoT Applications", "level": "N(T)", "grade": "A", "year": 2026}]
        others = [{"subject": s, "level": "N(T)", "grade": "B", "year": 2026}
                  for s in ("English Language", "Art", "Design & Technology")]
        for sci in accepted:
            r = run("MAS1B3(2026)", [sci] + others)
            self.assertEqual(r.status, "computed", sci["subject"])
            self.assertEqual(len(r.slots), 4)  # (Mathematics or Science) + best 3 = 4 subjects
            self.assertNotIn(r.slots[0]["subject_id"], ("english_language", "art", "design_technology"))
        r = run("MAS1B3(2026)", [{"subject": "Geography", "level": "N(T)", "grade": "A", "year": 2026}] + others)
        self.assertEqual(r.status, "not_computable")
        self.assertEqual([s["name"] for s in DEFINITIONS_BY_ID["MAS1B3(2026)"]["slots"]], ["R1", "B1", "B2", "B3"])


class TestSourcesAndConfirmedBehaviour(unittest.TestCase):
    def _exists(self, src):
        self.assertTrue(source_listed(src["file"]), src["file"])

    def test_lep_cites_press_release(self):
        for did in ("L1R5(2026)", "L1R4(2027)"):
            bonus = DEFINITIONS_BY_ID[did]["bonus"]
            files = [x["file"] for x in bonus["also_sources"]]
            self.assertTrue(any("pdf__news_press_2025_96136c92.md" in f for f in files), did)
            lep = bonus["uncapped"][0]
            self.assertEqual(lep["id"], "lep")
            self.assertTrue(any("pdf__news_press_2025_96136c92.md" in x["file"] for x in lep["sources"]))
            for x in bonus["also_sources"] + lep["sources"]:
                self._exists(x)

    def test_confirmed_rules_cite_readings(self):
        for rule in (ALTERNATIVE_RULE, EMPTY_SLOT_RULE):
            self.assertTrue(any(x["file"] == "README.md" for x in rule["sources"]))
            for x in rule["sources"]:
                self._exists(x)
        with open(OUT, encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("alternative_rule", data)
        self.assertIn("empty_slot_rule", data)
        self.assertIn("display_name_rule", data)
        self.assertIn("effective_members", data["groups"]["POLY_C_G2"])

    def test_empty_slot_still_not_computable(self):
        r = run("L1R5(2026)", [row("English Language", "A1"), row("Mathematics", "A1"), row("Physics", "A1"),
                               row("Chemistry", "A1"), row("Biology", "A1"), row("Art", "A1")])
        self.assertEqual(r.status, "not_computable")
        self.assertIsNone(r.gross)


class TestDisplayNames(unittest.TestCase):
    def test_examples_from_koo(self):
        want = {
            "L1R5(2026)": "L1R5 (2026 O-Level)", "L1R4(2026)": "L1R4 (2026 O-Level)", "L1R4(2027)": "L1R4 (2027 SEC)",
            "ELR2B2-C:POLY(2026)": "ELR2B2-C (2026 O-Level) · Poly", "ELR2B2-C:ITE(2026)": "ELR2B2-C (2026 O-Level) · ITE",
            "ELMAB3:DPP(2026)": "ELMAB3 (2026 N-Level) · DPP", "ELMAB3:PFP(2026)": "ELMAB3 (2026 N-Level) · PFP",
            "ELMAB3:PFP(2027)": "ELMAB3 (2027 SEC) · PFP", "ELMAB3:ITE(2027)": "ELMAB3 (2027 SEC) · ITE 2-year",
            "ELB3(2026)": "ELB3 (2026 N-Level)", "ELB3:5Y(2027)": "ELB3 (2027 SEC) · 5th year",
            "B5(2026)": "B5 (2026 O-Level)", "MAS1B3(2026)": "MAS1B3 (2026 N-Level)", "R2B2(2027)": "R2B2 (2027 SEC)",
            "ELR2B2-A(2026)": "ELR2B2-A (2026 O-Level)", "ELR2B2-C(2027)": "ELR2B2-C (2027 SEC)", "EMB1": "EMB1",
        }
        for did, name in want.items():
            self.assertEqual(DEFINITIONS_BY_ID[did]["display_name"], name, did)

    def test_unique_and_on_every_result(self):
        names = [d["display_name"] for d in DEFINITIONS]
        self.assertEqual(len(names), len(set(names)))
        out = compute_all([row("English Language", "A1")])
        for r in out:
            want = DEFINITIONS_BY_ID[r.id]["display_name"] if r.id in DEFINITIONS_BY_ID else FIFTH_YEAR_2027["display_name"]
            self.assertEqual(r.display_name, want)
        self.assertEqual(out[-1].display_name, "5th year eligibility (2027 SEC)")

    def test_format_function(self):
        self.assertEqual(format_display_name("X1", 2027, "SEC"), "X1 (2027 SEC)")
        self.assertEqual(format_display_name("X1", 2026, "N", "pfp", show_pathway=True), "X1 (2026 N-Level) · PFP")
        self.assertEqual(format_display_name("X1", 2026, "N", "pfp"), "X1 (2026 N-Level)")
        self.assertEqual(format_display_name("X1", 2027, "SEC", "5y"), "X1 (2027 SEC) · 5th year")
        self.assertEqual(format_display_name("X1", None, None), "X1")


if __name__ == "__main__":
    unittest.main()
