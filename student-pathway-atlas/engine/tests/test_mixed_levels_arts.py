"""Engine 0.1.5: mixed exam levels and the `ignored` list (E1), arts institutions (E2), LEP host JCs (E3), JC / MI
conditional admission needs a result in the subject (E5). Invented students; expected values worked out by hand from
the rule text (research/riasec_arts_mixed_levels_18oct.md section 3, the colleges' pages, MOE's FSBB FAQ)."""

import csv
import json
import os
import unittest

from helpers import ROOT, check, picks, row, run, sec, source_listed

from engine import compute_all
from engine import grades as G
from engine.definitions import DEFINITIONS, IGNORED_REASONS
from engine.engine import prepare_entries


def na(subject, grade, year=2026):
    return row(subject, grade, "N(A)", year)


def nt(subject, grade, year=2026):
    return row(subject, grade, "N(T)", year)


def ign(result, subject_id_or_name):
    """The ignored item for a subject (by catalogue name)."""
    hits = [i for i in result.ignored if i["subject"] == subject_id_or_name]
    return hits[0] if hits else None


def codes(result):
    return sorted((i["subject"], i["code"]) for i in result.ignored)


O_CORE = [row("English Language", "A2"), row("Mathematics", "B3"), row("Physics", "B3"), row("History", "A2"),
          row("Geography", "B4"), row("Art", "A1")]


# ============================================================================================ E1, row by row
class TestJAEOLevelOnly(unittest.TestCase):
    """JAE L1R5, L1R4, ELR2B2, ITE JAE types: O-Level grades only; N(A) / N(T) silent; two O-Level years, better."""

    def test_na_mtl_listed_silent_everywhere_in_jae(self):
        rows = O_CORE + [na("Chinese", "1")]
        for aid in ("L1R5(2026)", "L1R4(2026)", "ELR2B2-A(2026)", "ELR2B2-B(2026)", "ELR2B2-C:POLY(2026)",
                    "ELR2B2-D(2026)", "ELB4-A(2026)", "ELR1B3-B(2026)", "ELR2B2-C:ITE(2026)"):
            r = run(aid, rows)
            self.assertEqual(r.status, "computed", aid)
            item = ign(r, "Chinese")
            self.assertEqual((item["state"], item["code"], item["level"], item["grade"]), ("silent", "jae_o_only", "G2", "1"), aid)
            self.assertNotIn("chinese", [s["subject_id"] for s in r.slots], aid)

    def test_gross_unchanged_by_the_na_grade(self):
        self.assertEqual(run("L1R5(2026)", O_CORE + [na("Chinese", "1")]).gross, run("L1R5(2026)", O_CORE).gross)

    def test_nt_grade_silent(self):
        r = run("ELB4-A(2026)", O_CORE + [nt("Computer Applications", "A")])
        self.assertEqual(ign(r, "Computer Applications")["code"], "jae_o_only")

    def test_two_olevel_years_better_grade_rule(self):
        rows = O_CORE + [row("Chemistry", "C6", year=2025), row("Chemistry", "B3", year=2026)]
        r = run("L1R5(2026)", rows)
        item = ign(r, "Chemistry")
        self.assertEqual((item["grade"], item["year"], item["state"], item["code"]), ("C6", 2025, "rule", "moe_better_years"))
        self.assertTrue(item["reason"].startswith("B3 (2026) is used instead."))

    def test_mtl_b_merit_rule_and_meets_requirement(self):
        rows = O_CORE + [row("Chinese B", "Merit")]
        r = run("L1R5(2026)", rows)
        self.assertEqual((ign(r, "Chinese 'B'")["state"], ign(r, "Chinese 'B'")["code"]), ("rule", "jae_mtl_b"))
        self.assertTrue(check(r, "jc_subjects")["met"])

    def test_rk_excluded_for_jc_only(self):
        rows = O_CORE + [row("Islamic Religious Knowledge", "A1"), row("Chinese", "B3")]
        self.assertEqual(ign(run("L1R5(2026)", rows), "Islamic Religious Knowledge")["code"], "jcmi_rk")
        self.assertIsNone(ign(run("ELR2B2-A(2026)", rows), "Islamic Religious Knowledge"))


class TestJCMIRequirementRestsOnSilentGrade(unittest.TestCase):
    """JC / MI 2026 MTL requirement: an N(A) MTL is silent -> "can't be worked out", never "not met"."""

    def test_na_mtl_only(self):
        rows = O_CORE + [na("Chinese", "2")]
        for aid, req, cond in (("L1R5(2026)", "jc_subjects", "jc_conditional"),
                               ("L1R4(2026)", "mi_subjects", "mi_conditional")):
            r = run(aid, rows)
            self.assertIsNone(check(r, req)["met"], aid)
            self.assertEqual(check(r, req)["rests_on"], [{"subject": "Chinese", "level": "G2", "grade": "2"}])
            self.assertIsNone(check(r, cond)["met"], aid)

    def test_olevel_mtl_still_decides(self):
        r = run("L1R5(2026)", O_CORE + [na("Chinese", "2"), row("Chinese", "C5")])
        self.assertTrue(check(r, "jc_subjects")["met"])
        r = run("L1R5(2026)", O_CORE + [na("Chinese", "2"), row("Chinese", "E8")])
        self.assertIsNone(check(r, "jc_subjects")["met"])  # O-Level Chinese E8 fails, N(A) Chinese could count

    def test_na_maths_only(self):
        rows = [row("English Language", "A2"), na("Mathematics", "1"), row("Physics", "B3"), row("History", "A2"),
                row("Geography", "B4"), row("Chinese", "A1"), row("Chemistry", "B3")]
        r = run("L1R5(2026)", rows)
        self.assertIsNone(check(r, "jc_subjects")["met"])

    def test_a_definite_failure_wins(self):
        rows = [row("English Language", "E8"), row("Mathematics", "B3"), row("Physics", "B3"), row("History", "A2"),
                row("Geography", "B4"), row("Art", "A1"), na("Chinese", "2")]
        r = run("L1R5(2026)", rows)
        self.assertFalse(check(r, "jc_subjects")["met"])  # English fails whatever the N(A) Chinese counts for


class TestDPPMixed(unittest.TestCase):
    """DPP / JIE 'H': O-Level converted A1-B3=1 ... F9=5 (F9 aggregate only); N(A) 6/U not used; N(T) silent."""

    BASE = [na("English Language", "2"), na("Mathematics", "3"), na("Science (Physics, Chemistry)", "2"),
            na("Art", "3"), na("History", "4")]

    def test_conversion(self):
        rows = [na("English Language", "2"), row("Mathematics", "A2"), row("Physics", "B4"), row("History", "D7"),
                row("Art", "E8"), na("Geography", "5")]
        r = run("ELMAB3:DPP(2026)", rows)
        self.assertEqual(r.gross, 2 + 1 + 2 + 3 + 4)  # Geog 5 loses to Art E8 (4)
        rows[-1] = row("Geography", "F9")
        self.assertEqual(run("ELMAB3:DPP(2026)", rows).gross, 2 + 1 + 2 + 3 + 4)  # F9 = 5, not picked

    def test_na_6_rule(self):
        r = run("ELMAB3:DPP(2026)", self.BASE + [na("Geography", "U")])
        item = ign(r, "Geography")
        self.assertEqual((item["state"], item["code"], item["grade"]), ("rule", "dpp_na_6", "6"))

    def test_nt_silent_and_family_check_cant_be_worked_out(self):
        rows = [na("English Language", "2"), na("Mathematics", "3"), na("Art", "3"), na("History", "6"),
                row("Physics", "F9"), nt("Mobile Robotics", "A")]
        r = run("ELMAB3:DPP(2026)", rows)
        self.assertEqual(ign(r, "Mobile Robotics")["code"], "dpp_nt")
        self.assertIsNone(r.gross)  # only 4 usable subjects (History 6 not used)
        self.assertIn("the rules do not say whether Mobile Robotics (N(T) A) counts", r.not_computable_reason)
        self.assertIsNone(check(r, "dpp_family_asci")["met"])
        rows[3] = na("Geography", "4")
        r = run("ELMAB3:DPP(2026)", rows)
        self.assertEqual(r.gross, 2 + 3 + 3 + 4 + 5)
        self.assertIsNone(check(r, "dpp_family_asci")["met"])  # F9 can't meet "1 to 5"; the N(T) grade might
        self.assertEqual(check(r, "dpp_family_asci")["rests_on"][0]["subject"], "Mobile Robotics")
        rows.pop()
        self.assertFalse(check(run("ELMAB3:DPP(2026)", rows), "dpp_family_asci")["met"])

    def test_better_grade_across_levels_rule(self):
        rows = self.BASE + [row("Mathematics", "B3")]
        r = run("ELMAB3:DPP(2026)", rows)
        item = ign(r, "Mathematics")
        self.assertEqual((item["level"], item["grade"], item["code"]), ("G2", "3", "moe_better_na_o"))
        self.assertTrue(item["reason"].startswith("O-Level B3 is used instead."))
        self.assertEqual(picks(r)["MA"], ("mathematics", "B3", 1))


class TestPFPMixed(unittest.TestCase):
    def test_olevel_9_rule_and_na_6_silent(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Art", "1"), na("Geography", "2"),
                na("History", "3"), row("Physics", "F9"), na("Literature in English", "6")]
        r = run("ELMAB3:PFP(2026)", rows)
        self.assertEqual(r.gross, 10)
        self.assertEqual((ign(r, "Physics")["state"], ign(r, "Physics")["code"]), ("rule", "pfp_o9"))
        self.assertEqual((ign(r, "Literature in English")["state"], ign(r, "Literature in English")["code"]),
                         ("silent", "pfp_na_6"))

    def test_na_6_never_makes_a_floor_unknown(self):
        rows = [na("English Language", "4"), na("Mathematics", "2"), na("Art", "1"), na("Geography", "2"),
                na("History", "3"), na("Science (Physics, Chemistry)", "6")]
        r = run("ELMAB3:PFP(2026)", rows)
        self.assertFalse(check(r, "pfp_cluster_sci")["met"])  # a grade 6 can never meet "grade 3 or better"

    def test_nt_silent(self):
        rows = [na("English Language", "2"), na("Mathematics", "2"), na("Art", "1"), na("Geography", "2"),
                na("History", "3"), nt("Smart Electrical Technology", "A")]
        self.assertEqual(ign(run("ELMAB3:PFP(2026)", rows), "Smart Electrical Technology")["code"], "pfp_nt")


class TestJIEN(unittest.TestCase):
    """JIE 'N': N(T), N(A) and O-Level each on its own table; same subject at two levels: better point, marked."""

    def test_three_levels_used(self):
        rows = [nt("English Language", "B"), na("Mathematics", "4"), row("Physics", "E8"), nt("Art", "A")]
        r = run("B4(2026)", rows)
        self.assertEqual(r.gross, 2 + 2 + 2 + 1)
        self.assertEqual(r.ignored, [])

    def test_same_subject_two_levels_silent(self):
        rows = [nt("English Language", "C"), na("English Language", "3"), nt("Mathematics", "B"), nt("Art", "A"),
                nt("Computer Applications", "B")]
        r = run("ELB3(2026)", rows)
        self.assertEqual(picks(r)["EL"], ("english_language", "3", 1))
        item = ign(r, "English Language")
        self.assertEqual((item["level"], item["state"], item["code"]), ("G1", "silent", "jien_levels"))
        self.assertTrue(item["reason"].startswith("N(A) 3 is used instead."))
        self.assertTrue(check(r, "jien_mer")["met"])  # the marked duplicate never blocks a requirement


class TestJIEO(unittest.TestCase):
    def test_na_silent(self):
        r = run("B5(2026)", O_CORE + [na("Chinese", "1")])
        self.assertEqual((ign(r, "Chinese")["state"], ign(r, "Chinese")["code"]), ("silent", "jieo_o_only"))


class TestPSE2028(unittest.TestCase):
    """PSE 2028: grades a route cannot use are listed with MOE's reason."""

    ROWS = [sec("English Language", "B3"), sec("Mathematics", "B4"), sec("Physics", "C5"), sec("History", "9"),
            sec("Geography", "5", "G2"), sec("Art", "A", "G1"), sec("Chinese", "2", "G2")]

    def test_jcmi_g3_only(self):
        r = run("L1R4(2027)", self.ROWS)
        self.assertEqual(ign(r, "Geography")["code"], "jcmi27_g3_only")
        self.assertEqual(ign(r, "Art")["code"], "jcmi27_g3_only")
        self.assertEqual(ign(r, "Geography")["state"], "rule")

    def test_poly(self):
        r = run("ELR2B2-A(2027)", self.ROWS)
        self.assertEqual(ign(r, "History")["code"], "poly27_9_56")
        self.assertEqual(ign(r, "Geography")["code"], "poly27_9_56")
        self.assertEqual(ign(r, "Art")["code"], "poly27_g1")
        self.assertIsNone(ign(r, "Chinese"))  # G2 2 can be B2

    def test_pfp_ite2_ite3_5y(self):
        self.assertEqual(ign(run("ELMAB3:PFP(2027)", self.ROWS), "Art")["code"], "pfp27_g1")
        self.assertEqual(ign(run("ELMAB3:ITE(2027)", self.ROWS), "Art")["code"], "ite2_g1")
        self.assertEqual(ign(run("ELMAB3:5Y(2027)", self.ROWS), "Art")["code"], "fifth_g1")
        r = run("ELMAB3:5Y(2027)", self.ROWS + [sec("Literature in English", "6", "G2")])
        self.assertEqual(ign(r, "Literature in English")["code"], "fifth_g2_6")
        r = run("B4(2027)", self.ROWS + [sec("Computer Applications", "U", "G1")])
        self.assertEqual((ign(r, "Computer Applications")["state"], ign(r, "Computer Applications")["code"]),
                         ("silent", "ite3_g1_u"))

    def test_better_g2_grade_rule(self):
        rows = self.ROWS + [sec("Geography", "B4")]
        r = run("ELMAB3:ITE(2027)", rows)
        item = ign(r, "Geography")
        self.assertEqual((item["level"], item["code"]), ("G2", "pse_better_g2"))
        self.assertTrue(item["reason"].startswith("G3 B4 is used instead."))

    def test_2028_mtl_b_cant_be_worked_out(self):
        rows = [sec("English Language", "A1"), sec("Mathematics", "A1"), sec("Physics", "A1"), sec("History", "A1"),
                sec("Geography", "A2"), sec("Chinese B", "Merit")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(ign(r, "Chinese 'B'")["code"], "pse_mtl_b")
        self.assertIsNone(check(r, "jcmi_subjects")["met"])
        self.assertIsNone(check(r, "jc_conditional")["met"])


class TestEngineWideReasons(unittest.TestCase):
    def test_absent_later_year_duplicate(self):
        rows = O_CORE + [row("Chinese", "ABS"), sec("Literature in English", "A1"), row("Biology", "B3"),
                         row("Biology", "C5")]
        r = run("ELB4-A(2026)", rows)
        self.assertIsNone(ign(r, "Chinese"))  # an Absent counts as 9 here, so it is usable, not ignored
        self.assertEqual(ign(r, "Literature in English")["code"], "later_year")
        self.assertEqual(ign(r, "Literature in English")["reason"], "This aggregate uses results from 2026 or earlier.")
        bio = ign(r, "Biology")
        self.assertEqual((bio["grade"], bio["code"]), ("C5", "duplicate"))

    def test_not_best_years(self):
        rows = [row("English Language", "A1", year=2024), row("Mathematics", "A1", year=2025),
                row("History", "A1", year=2025), row("Art", "A1", year=2025), row("Biology", "A1", year=2025),
                row("Physics", "F9", year=2026)]
        r = run("ELB4-A(2026)", rows)
        self.assertEqual(r.years_used, [2024, 2025])
        item = ign(r, "Physics")
        self.assertEqual(item["code"], "not_best_years")
        self.assertEqual(item["reason"], "Results from two exam years can be combined. The best two, 2024 and 2025, are used.")

    def test_item_shape(self):
        r = run("L1R5(2026)", O_CORE + [na("Chinese", "1")])
        self.assertEqual(set(r.ignored[0]), {"subject", "level", "grade", "year", "row", "input_name", "state", "code",
                                             "reason"})
        self.assertEqual(r.ignored[0]["row"], 7)


class TestNothingDroppedSilently(unittest.TestCase):
    """Every prepared entry is either listed in `ignored`, or some slot of the aggregate can use it."""

    def test_random_students(self):
        import sys
        sys.path.insert(0, os.path.join(ROOT, "app", "tools"))
        import parity
        for i in range(0, 1500):
            _, subjects, bonus, _ = parity.student(11, i)
            entries, _, _ = prepare_entries(subjects)
            for r in compute_all(subjects, bonus):
                if r.status in ("stub", "summary"):
                    continue
                defn = next(d for d in DEFINITIONS if d["id"] == r.id)
                listed = {x["row"] for x in r.ignored}
                for s in r.slots:  # every slot pick is an entry that is not listed
                    self.assertTrue(any(e.idx + 1 not in listed for e in entries if e.subject_id == s["subject_id"]
                                        and e.level == s["level"] and e.grade == s["grade"] and e.year == s["year"]),
                                    (i, r.id, s))
                for e in entries:
                    if e.idx + 1 in listed:
                        continue
                    ok = any(G.points(G.SCALES[sl["scale"]], e.level, e.grade) is not None for sl in defn["slots"])
                    self.assertTrue(ok, (i, r.id, e.describe()))
                for x in r.ignored:
                    self.assertIn(x["state"], ("rule", "silent"))
                    self.assertNotEqual(x["code"], "unlisted", (i, r.id, x))


class TestPolicyCompleteness(unittest.TestCase):
    def test_every_unusable_grade_has_a_reason(self):
        for d in DEFINITIONS:
            if d["status"] == "stub":
                self.assertIsNone(d["ignored_policy"])
                continue
            pol = d["ignored_policy"]
            for key in [pol.get("non_scoring"), pol.get("same_level"), pol.get("cross_level"), pol.get("single_year")] \
                    + list((pol.get("levels") or {}).values()) + list((pol.get("grades") or {}).values()) \
                    + list((pol.get("excluded") or {}).values()):
                if key is not None:
                    self.assertIn(key, IGNORED_REASONS, d["id"])
            self.assertTrue(pol.get("non_scoring") and pol.get("same_level"), d["id"])
            for g in d.get("exclude_groups", []):
                self.assertIn(g, pol.get("excluded") or {}, d["id"])
            levels = set()
            for s in d["slots"]:
                levels.update(G.SCALES[s["scale"]]["levels"])
            for lv, grades in G.GRADE_ORDER.items():
                if lv not in levels:
                    self.assertIn(lv, pol.get("levels") or {}, (d["id"], lv))
                    continue
                for gr in grades:
                    if not any(G.points(G.SCALES[s["scale"]], lv, gr) is not None for s in d["slots"]):
                        self.assertIn("%s:%s" % (lv, gr), pol.get("grades") or {}, (d["id"], lv, gr))

    def test_reasons_are_sentences(self):
        for k, r in IGNORED_REASONS.items():
            self.assertIn(r["state"], ("rule", "silent"), k)
            self.assertTrue(r["text"].endswith("."), k)
            self.assertTrue(r["text"][0].isupper() or r["text"].startswith("{used}"), k)
            for s in r["sources"]:
                self.assertTrue(source_listed(s["file"]), (k, s["file"]))


# ============================================================================================ E5
class TestConditionalNeedsAResult(unittest.TestCase):
    """MOE: conditional admission is for a specific subject the student sat ("you must sit for the specific subject
    again"); an 'Absent' grade, or no result at all, closes it."""

    NO_MTL = [row("English Language", "A2"), row("Mathematics", "A1"), row("Physics", "A1"), row("History", "A2"),
              row("Geography", "A1"), row("Chemistry", "A2"), row("Art", "A1")]

    def test_no_mtl_result_closes_jc_and_mi(self):
        r = run("L1R5(2026)", self.NO_MTL)
        self.assertEqual(r.gross, 8)
        self.assertFalse(check(r, "jc_subjects")["met"])
        self.assertEqual(len(check(r, "jc_subjects")["no_result"]), 1)
        self.assertFalse(check(r, "jc_conditional")["met"])
        r = run("L1R4(2026)", self.NO_MTL)
        self.assertFalse(check(r, "mi_conditional")["met"])

    def test_sat_and_missed_the_grade_is_conditional(self):
        r = run("L1R5(2026)", self.NO_MTL + [row("Chinese", "E8")])
        self.assertEqual(check(r, "jc_subjects")["no_result"], [])
        self.assertTrue(check(r, "jc_conditional")["met"])

    G3_NO_MATHS = [sec("English Language", "A1"), sec("Chinese", "A1"), sec("Physics", "A1"), sec("History", "A1"),
                   sec("Geography", "A1")]

    def test_a_lower_level_result_does_not_open_it(self):
        # grades map down a level, never up: a G2 Mathematics is not a result for "G3 Mathematics A1 to D7"
        r = run("L1R4(2027)", self.G3_NO_MATHS + [sec("Mathematics", "1", level="G2")])
        self.assertEqual(r.gross, 5)
        self.assertEqual(len(check(r, "jcmi_subjects")["wrong_level"]), 1)
        self.assertFalse(check(r, "jc_conditional")["met"])
        self.assertFalse(check(r, "mi_conditional")["met"])
        r = run("L1R4(2027)", self.G3_NO_MATHS + [sec("Mathematics", "E8")])
        self.assertEqual(check(r, "jcmi_subjects")["wrong_level"], [])
        self.assertTrue(check(r, "jc_conditional")["met"])

    def test_absent_counts_as_the_lowest_grade(self):
        # an Absent subject is counted at the lowest grade (G3 9), but never meets a specific-subject requirement
        rows = [sec("English Language", "Absent"), sec("Mathematics", "A1"), sec("Chinese", "A1"), sec("Physics", "A1"),
                sec("History", "A1"), sec("Geography", "A1")]
        r = run("L1R4(2027)", rows)
        self.assertEqual(r.gross, 13)  # English 9 + 4 x A1
        self.assertFalse(check(r, "jcmi_subjects")["met"])
        self.assertTrue(check(r, "jcmi_subjects")["absent"])
        self.assertFalse(check(r, "jc_conditional")["met"])
        self.assertNotIn("absent", [i["code"] for i in r.ignored])
        r = run("ELMAB3:PFP(2027)", [sec("English Language", "Absent"), sec("Mathematics", "1", level="G2"),
                                     sec("Science", "1", level="G2"), sec("History", "1", level="G2"),
                                     sec("Geography", "1", level="G2")])
        self.assertIsNone(r.gross)  # PFP can't use the lowest grade, so not an Absent either
        self.assertIn("absent", [i["code"] for i in r.ignored])

    def test_absent_closes_it(self):
        r = run("L1R5(2026)", self.NO_MTL + [row("Chinese", "Absent")])
        self.assertTrue(check(r, "jc_subjects")["absent"])
        self.assertFalse(check(r, "jc_conditional")["met"])

    def test_no_maths_result(self):
        rows = [x for x in self.NO_MTL if x["subject"] != "Mathematics"] + [row("Chinese", "A1"), row("Biology", "A1")]
        r = run("L1R5(2026)", rows)
        self.assertFalse(check(r, "jc_conditional")["met"])

    def test_mtl_b_ungraded_counts_as_sat(self):
        r = run("L1R5(2026)", self.NO_MTL + [row("Chinese B", "Ungraded")])
        self.assertFalse(check(r, "jc_subjects")["met"])
        self.assertTrue(check(r, "jc_conditional")["met"])

    def test_2027_same_rule(self):
        rows = [sec("English Language", "A1"), sec("Mathematics", "A1"), sec("Physics", "A1"), sec("History", "A1"),
                sec("Geography", "A2")]
        r = run("L1R4(2027)", rows)
        self.assertFalse(check(r, "jc_conditional")["met"])
        self.assertFalse(check(r, "mi_conditional")["met"])
        r = run("L1R4(2027)", rows + [sec("Chinese", "E8")])
        self.assertTrue(check(r, "jc_conditional")["met"])

    def test_fifth_year_summary_sees_it(self):
        rows = [sec("English Language", "A1"), sec("Mathematics", "A1"), sec("Physics", "A1"), sec("History", "A1"),
                sec("Geography", "A2")]
        out = {r.id: r for r in compute_all(rows)}
        self.assertNotEqual(out["5TH-YEAR(2027)"].eligibility[0]["detail"], "qualifies for JC or MI (L1R4(2027))")


# ============================================================================================ E2
class TestAI42026(unittest.TestCase):
    def test_best_four_without_english(self):
        rows = O_CORE + [row("Chinese", "C6"), row("Biology", "F9")]
        r = run("AI4(2026)", rows, {"cca": "Excellent"})
        self.assertEqual(r.gross, 1 + 2 + 3 + 3)  # Art A1, History A2, Maths B3, Physics B3
        self.assertNotIn("english_language", [s["subject_id"] for s in r.slots])
        self.assertEqual(ign(r, "English Language")["code"], "ai_english_apart")
        self.assertEqual(r.net, r.gross - 2)  # NAFA's CCA bonus
        self.assertTrue(check(r, "ai_english")["met"])
        self.assertTrue(check(r, "lasalle_min")["met"])
        self.assertTrue(check(r, "nafa_min")["met"])

    def test_f9_counts_nine(self):
        rows = [row("English Language", "C6"), row("Mathematics", "F9"), row("Art", "B4"), row("History", "C5"),
                row("Geography", "E8")]
        r = run("AI4(2026)", rows)
        self.assertEqual(r.gross, 9 + 4 + 5 + 8)
        self.assertFalse(check(r, "lasalle_min")["met"])

    def test_nafa_counts_cca_points(self):
        """Engine 0.1.7 (E7a): NAFA's minimum is on the net (up to 2 CCA points)."""
        rows = [row("English Language", "C6"), row("Mathematics", "D7"), row("Art", "C6"), row("History", "C6"),
                row("Geography", "D7")]
        r = run("AI4(2026)", rows, {"cca": "Excellent"})
        self.assertEqual((r.gross, r.net), (26, 24))
        self.assertFalse(check(r, "lasalle_min")["met"])  # LASALLE: gross, no bonus
        self.assertTrue(check(r, "nafa_min")["met"])
        self.assertEqual(run("AI4(2026)", rows, {"cca": "Good"}).net, 25)
        self.assertTrue(check(run("AI4(2026)", rows, {"cca": "Good"}), "nafa_min")["met"])  # at the limit
        r = run("AI4(2026)", rows)
        self.assertFalse(check(r, "nafa_min")["met"])  # no CCA points: net = gross 26
        rows[1] = row("Mathematics", "F9")
        r = run("AI4(2026)", rows, {"cca": "Excellent"})
        self.assertEqual((r.gross, r.net), (28, 26))
        self.assertFalse(check(r, "nafa_min")["met"])

    def test_english(self):
        rows = [row("English Language", "D7"), row("Mathematics", "A1"), row("Art", "A1"), row("History", "A1"),
                row("Geography", "A1")]
        self.assertFalse(check(run("AI4(2026)", rows), "ai_english")["met"])
        rows[0] = na("English Language", "1")
        r = run("AI4(2026)", rows)
        self.assertIsNone(check(r, "ai_english")["met"])  # N(A) English: silent, can't be worked out
        self.assertEqual(ign(r, "English Language")["code"], "ai_english_apart")

    def test_no_cutoff_invented(self):
        d = next(x for x in DEFINITIONS if x["id"] == "AI4(2026)")
        self.assertEqual({c["id"] for c in d["checks"]}, {"ai_english", "lasalle_min", "nafa_min", "ai_aptitude"})


class TestAI42027(unittest.TestCase):
    def test_three_g3_and_one_g2(self):
        rows = [sec("English Language", "C6"), sec("Mathematics", "A2"), sec("Physics", "B3"), sec("History", "B4"),
                sec("Geography", "3", "G2"), sec("Art", "A", "G1")]
        r = run("AI4(2027)", rows)
        self.assertEqual(r.gross, 2 + 3 + 4 + 3)
        self.assertEqual(picks(r)["S4"][0], "geography")
        self.assertEqual(ign(r, "Art")["code"], "ai27_g1")
        self.assertEqual(ign(r, "English Language")["code"], "ai27_english_apart")
        self.assertTrue(check(r, "ai_english")["met"])
        self.assertTrue(check(r, "lasalle_min")["met"])
        self.assertTrue(check(r, "nafa_min")["met"])
        self.assertEqual(r.net, r.gross)  # no CCA grade given

    def test_all_g3_lowest_grade_mapped(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "A1"), sec("Physics", "A2"), sec("History", "B3"),
                sec("Geography", "C6")]
        r = run("AI4(2027)", rows)
        self.assertEqual(r.gross, 1 + 2 + 3 + 2)  # C6 mapped to G2 grade 2
        self.assertEqual(picks(r)["S4"], ("geography", "C6", 2))

    def test_threshold(self):
        rows = [sec("English Language", "C6"), sec("Mathematics", "C6"), sec("Physics", "C6"), sec("History", "D7"),
                sec("Geography", "6", "G2")]
        r = run("AI4(2027)", rows)
        self.assertEqual(r.gross, 6 + 6 + 7 + 6)  # G2 6 counts 6
        self.assertFalse(check(r, "lasalle_min")["met"])
        self.assertFalse(check(r, "nafa_min")["met"])
        rows[3] = sec("History", "C5")  # gross 23
        r = run("AI4(2027)", rows, {"cca": "Excellent"})
        self.assertEqual((r.gross, r.net), (23, 21))
        self.assertFalse(check(r, "lasalle_min")["met"])
        self.assertTrue(check(r, "nafa_min")["met"])  # NAFA's SEC 21 also counts CCA points (E7a)
        rows[0] = sec("English Language", "5", "G2")
        self.assertFalse(check(run("AI4(2027)", rows), "ai_english")["met"])


class TestNFP2026(unittest.TestCase):
    def test_gross_conversion_and_reasons(self):
        rows = [na("English Language", "3"), na("Mathematics", "2"), row("Mathematics", "B3"),
                na("Science (Physics, Chemistry)", "1"), na("Art", "2"), na("History", "3"), na("Geography", "6"),
                row("Physics", "F9")]
        r = run("ELMAB3:NFP(2026)", rows)
        self.assertEqual(r.gross, 3 + 1 + 1 + 2 + 3)
        self.assertIsNone(r.net)
        self.assertEqual(ign(r, "Mathematics")["code"], "nafa_better")
        self.assertEqual((ign(r, "Geography")["state"], ign(r, "Geography")["code"]), ("silent", "nfp_na_6"))
        self.assertEqual((ign(r, "Physics")["state"], ign(r, "Physics")["code"]), ("rule", "nfp_o9"))
        self.assertTrue(check(r, "nfp_gross")["met"])
        self.assertTrue(check(r, "nfp_english")["met"])
        self.assertTrue(check(r, "nfp_na")["met"])

    def test_threshold_15(self):
        rows = [na("English Language", "3"), na("Mathematics", "3"), na("Art", "3"), na("History", "3"),
                na("Geography", "4")]
        r = run("ELMAB3:NFP(2026)", rows)
        self.assertEqual(r.gross, 16)
        self.assertFalse(check(r, "nfp_gross")["met"])

    def test_english_interview_note(self):
        rows = [na("English Language", "4"), na("Mathematics", "1"), na("Art", "1"), na("History", "1"),
                na("Geography", "1")]
        c = check(run("ELMAB3:NFP(2026)", rows), "nfp_english")
        self.assertFalse(c["met"])
        self.assertIn("interview", c["near"][0])
        rows[0] = row("English Language", "D7")
        self.assertTrue(check(run("ELMAB3:NFP(2026)", rows), "nfp_english")["met"])  # converts to 3

    def test_n_level_years_not_combined(self):
        y25 = [na(s, "1", 2025) for s in ("English Language", "Mathematics", "Art", "History", "Geography")]
        y26 = [na("English Language", "2"), na("Mathematics", "2"), na("Art", "2"), na("History", "2"),
               na("Biology", "1")]
        r = run("ELMAB3:NFP(2026)", y25 + y26)
        self.assertEqual(r.gross, 5)  # the 2025 N-Level set alone
        self.assertEqual({i["code"] for i in r.ignored}, {"nfp_one_n_year"})
        self.assertEqual(len(r.ignored), 5)
        self.assertEqual(r.warnings, [])

    def test_display_name(self):
        d = next(x for x in DEFINITIONS if x["id"] == "ELMAB3:NFP(2026)")
        self.assertEqual(d["display_name"], "ELMAB3 (2026 N-Level) · NFP")


class TestNFP2027(unittest.TestCase):
    """Engine 0.1.7 (E7b): NAFA's NFP for SEC - ELMAB3 at G2 (G3 mapped), 15 or better, English G2 3 or better."""

    def test_mapping_and_limit(self):
        rows = [sec("English Language", "3", "G2"), sec("Mathematics", "B4"), sec("Physics", "D7"),
                sec("History", "2", "G2"), sec("Art", "E8"), sec("Geography", "9")]
        r = run("ELMAB3:NFP(2027)", rows)
        self.assertEqual(r.status, "computed")
        self.assertEqual(r.gross, 3 + 2 + 2 + 3 + 4)  # B4 -> 2, D7 -> 3, E8 -> 4; Geography 9 -> 5 not best
        self.assertIsNone(r.net)
        self.assertTrue(check(r, "nfp_gross")["met"])
        rows[3] = sec("History", "5", "G2")
        r = run("ELMAB3:NFP(2027)", rows)
        self.assertEqual(r.gross, 3 + 2 + 3 + 4 + 5)  # 17: G3 9 maps to 5 (MOE's FAQ, NFP table)
        self.assertFalse(check(r, "nfp_gross")["met"])

    def test_g1_and_g2_6_not_counted(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "A2"), sec("Physics", "B3"), sec("History", "A1"),
                sec("Computer Applications", "A", "G1"), sec("Geography", "6", "G2")]
        r = run("ELMAB3:NFP(2027)", rows)
        self.assertEqual(r.status, "not_computable")  # only 4 usable subjects
        self.assertEqual((ign(r, "Computer Applications")["state"], ign(r, "Computer Applications")["code"]),
                         ("silent", "nfp27_g1"))
        self.assertEqual((ign(r, "Geography")["state"], ign(r, "Geography")["code"]), ("silent", "nfp27_g2_6"))
        self.assertIn("the rules do not say whether", r.not_computable_reason)

    def test_english_line(self):
        base = [sec("Mathematics", "1", "G2"), sec("Physics", "A1"), sec("History", "1", "G2"), sec("Art", "1", "G2")]
        for eng, met in ((sec("English Language", "3", "G2"), True), (sec("English Language", "D7"), True),
                         (sec("English Language", "4", "G2"), False), (sec("English Language", "E8"), False)):
            c = check(run("ELMAB3:NFP(2027)", [eng] + base), "nfp_english")
            self.assertEqual(c["met"], met, eng)
            self.assertNotIn("near", c)  # the N(A) interview note is not applied to SEC
        c = check(run("ELMAB3:NFP(2027)", [sec("English Language", "A", "G1")] + base), "nfp_english")
        self.assertIsNone(c["met"])  # a G1 English is silent: can't be worked out

    def test_shape(self):
        d = next(x for x in DEFINITIONS if x["id"] == "ELMAB3:NFP(2027)")
        self.assertEqual(d["status"], "implemented")
        self.assertEqual(d["display_name"], "ELMAB3 (2027 SEC) · NFP")
        self.assertEqual({c["id"] for c in d["checks"]}, {"nfp_gross", "nfp_english", "nfp_aptitude"})
        self.assertIsNone(d["bonus"])


# ============================================================================================ E3
class TestLEPHosts(unittest.TestCase):
    EXPECTED = {
        "CLEP": {"Anderson Serangoon Junior College", "Dunman High School (Junior College)",
                 "Hwa Chong Institution (Junior College)", "Jurong Pioneer Junior College", "Nanyang Junior College",
                 "Temasek Junior College"},
        "MLEP": {"Jurong Pioneer Junior College", "National Junior College", "Raffles Institution (Junior College)",
                 "Tampines Meridian Junior College", "Yishun Innova Junior College"},
        "TLEP": {"Anderson Serangoon Junior College", "National Junior College"},
    }

    def test_csv_and_data_json(self):
        with open(os.path.join(ROOT, "data", "taxonomy", "lep_host_jcs.csv"), encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        got = {}
        for r in rows:
            got.setdefault(r["programme"], set()).add(r["jc"])
            self.assertTrue(r["source_url"].startswith("https://www.moe.gov.sg/schoolfinder/schooldetail/"))
            self.assertIn("Language Elective Programme (", r["quote"])
        self.assertEqual(got, self.EXPECTED)
        with open(os.path.join(ROOT, "app", "build", "data.json"), encoding="utf-8") as f:
            data = json.load(f)
        cols = data["courses"]["columns"]
        jcs = {dict(zip(cols, x))["institution"] for x in data["courses"]["rows"] if dict(zip(cols, x))["institution_type"] == "JC"}
        self.assertEqual([(h["jc"], h["programme"]) for h in data["lep_hosts"]], [(r["jc"], r["programme"]) for r in rows])
        for h in data["lep_hosts"]:
            self.assertIn(h["jc"], jcs)


if __name__ == "__main__":
    unittest.main()
