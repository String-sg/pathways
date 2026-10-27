"""Parsing the snapshot: name resolution, grade notation, record coverage, the PDF cross-check, freshness."""

import csv
import json
import os
import unittest
from collections import Counter

from helpers import ROOT, record  # noqa: F401

from matcher import names as N
from matcher import parse as P
from matcher import pdf_mer
from matcher.__main__ import dumps_requirements
from matcher.match import MATCHER_VERSION, REQUIREMENTS_FILE


class TestNames(unittest.TestCase):
    def ids(self, name):
        r = N.resolve_name(name)
        self.assertEqual(r["unresolved"], [], name)
        return set(N.expand_ids(r["subjects"], r["groups"]))

    def test_plain_and_alias(self):
        self.assertEqual(self.ids("English Language"), {"english_language"})
        self.assertEqual(self.ids("English Language Syllabus A"), {"english_language"})
        self.assertEqual(self.ids("Science (Physics, Biology, Chemistry)"), {"sci_phy_chem_bio"})

    def test_or_comma_slash(self):
        self.assertEqual(self.ids("Additional Mathematics, Mathematics or Principles of Accounts"),
                         {"additional_mathematics", "mathematics", "principles_of_accounts"})
        self.assertEqual(self.ids("Computing/Computer Studies"), {"computing", "computer_studies"})
        self.assertEqual(self.ids("Science (Physics, Chemistry)/Physical Science"), {"sci_phy_chem", "physical_science"})
        self.assertEqual(self.ids("Food and Nutrition/Nutrition and Food Science"), {"food_nutrition", "nutrition_food_science"})
        self.assertEqual(self.ids("Mathematics Syllabus A / Additional Mathematics"), {"mathematics", "additional_mathematics"})
        self.assertEqual(self.ids("Art/Higher Art"), {"art", "higher_art"})

    def test_explicit_rules(self):
        self.assertEqual(self.ids("Media Studies (English/Chinese)"), {"media_studies_english", "media_studies_chinese"})
        self.assertEqual(self.ids("Mathematics (Elementary/Additional)"), {"mathematics", "additional_mathematics"})
        s = self.ids("Mathematics or Science*")
        self.assertIn("mathematics", s)
        self.assertIn("science_t", s)
        self.assertIn("mobile_robotics", s)
        self.assertNotIn("additional_mathematics", s)

    def test_parts_keep_order(self):
        r = N.resolve_name("Higher Chinese or Chinese")
        self.assertEqual([p["text"] for p in r["parts"]], ["Higher Chinese", "Chinese"])

    def test_unresolved_is_reported(self):
        r = N.resolve_name("Underwater Basket Weaving or Physics")
        self.assertEqual(r["unresolved"], ["Underwater Basket Weaving"])
        self.assertEqual(r["subjects"], ["physics"])

    def test_group_phrase(self):
        m = N.GROUP_PHRASE.search("Any one of the 2nd group of Relevant Subjects for the ELR2B2-C Aggregate Type")
        self.assertEqual(N.group_for_phrase(m.group(1), m.group(2), "Polytechnic"), "POLY_C_G2")
        self.assertEqual(N.group_for_phrase(m.group(1), m.group(2), "ITE"), "ITE_C_G2")
        self.assertEqual(N.group_for_phrase("1st", "ELR2B2-A", "Polytechnic"), "POLY_A_G1")

    def test_grade_notation(self):
        self.assertEqual(N.grade_predicate(N.parse_grade_ranges("1-7"), "O"), ({"G3": "D7"}, None))
        self.assertEqual(N.grade_predicate(N.parse_grade_ranges("1-6"), "O"), ({"G3": "C6"}, None))
        self.assertEqual(N.grade_predicate(N.parse_grade_ranges("A-D or 1-5"), "N"), ({"G1": "D", "G2": "5"}, None))
        pred, prob = N.grade_predicate(N.parse_grade_ranges("A-D or 1-5"), "O")
        self.assertIsNone(pred)
        self.assertIn("not O-Level", prob)
        self.assertEqual(N.max_points(N.parse_grade_ranges("1-3")), 3)
        self.assertIsNone(N.parse_grade_ranges("1-4 / 1-3"))
        self.assertEqual(len(N.parse_grade_ranges("1-4 or 1-3")), 2)


NEEDS_PDF = unittest.skipUnless(os.path.exists(os.path.join(ROOT, pdf_mer.PDF_FILE)),
                                "needs MOE's aggregate-type PDF, which is not in this folder")


@NEEDS_PDF
class TestRecords(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = P.build()
        cls.recs = cls.data["records"]
        cls.by_key = {r["key"]: r for r in cls.recs}

    def test_counts(self):
        c = Counter((r["institution_type"], r["route"]) for r in self.recs)
        self.assertEqual(c, Counter({("Polytechnic", "JAE"): 195, ("Polytechnic", "PFP"): 194, ("ITE", "JAE"): 74,
                                     ("ITE", "JIEN"): 73, ("ITE", "JIEH"): 34, ("JC", "JAE"): 34, ("MI", "JAE"): 3}))
        self.assertEqual(len({r["key"] for r in self.recs}), len(self.recs))

    def test_every_taxonomy_row_is_covered(self):
        with open(os.path.join(ROOT, P.TAXONOMY), encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        covered = {(r["institution_type"], r["course_code"], r["ite_course_code"], r["institution"]) for r in self.recs}
        for t in rows:
            self.assertIn((t["institution_type"], t["course_code"], t["ite_course_code"], t["institution"]), covered)
        # Nautical Studies is DAE-led: no JAE record, a PFP record.
        self.assertNotIn("POLY:JAE:DNS", self.by_key)
        self.assertIn("POLY:PFP:DNS", self.by_key)

    def test_links_on_every_record(self):
        for r in self.recs:
            self.assertTrue(r["moe_url"].startswith("https://www.moe.gov.sg/"), r["key"])
            self.assertTrue(r["institution_url"].startswith("http"), r["key"])

    def test_nothing_unresolved_or_unknown(self):
        F = self.data["findings"]
        self.assertEqual(F["unresolved_names"], {})
        self.assertEqual(F["unknown_lines"], [])
        self.assertEqual(F["slot_binding_problems"], [])
        self.assertEqual(F["group_list_differences"], [])

    def test_pdf_cross_check_findings(self):
        pc = {c["key"]: c for c in self.data["findings"]["pdf_comparison"]}
        self.assertEqual(Counter(c["status"] for c in pc.values()), Counter({"agree": 258, "differ": 11}))
        fallback = sorted(k for k, r in self.by_key.items() if "mer_line_from_pdf" in r["data_flags"])
        self.assertEqual(fallback, ["ITE:JAE:V14:Central", "ITE:JAE:V15:Central", "ITE:JAE:V41:West",
                                    "ITE:JAE:V43:Central", "POLY:JAE:C23", "POLY:JAE:T66", "POLY:JAE:T72"])
        differ = sorted(k for k, r in self.by_key.items() if "mer_json_pdf_differ" in r["data_flags"])
        self.assertEqual(differ, ["ITE:JAE:V37:West", "ITE:JAE:V38:West", "ITE:JAE:V55:Central", "ITE:JAE:V83:West"])

    def test_higher_chinese_pairing(self):
        b = [ln for ln in self.by_key["POLY:JAE:N70"]["mer"]["lines"] if ln["id"] == "b"][0]
        self.assertEqual([(o["subjects"], o["max_grade"]) for o in b["options"]],
                         [(["higher_chinese"], {"G3": "B4"}), (["chinese"], {"G3": "B3"})])

    def test_group_named_without_list_uses_engine_group(self):
        lines = self.by_key["POLY:JAE:N96"]["mer"]["lines"]
        self.assertEqual([ln.get("list_from_group") for ln in lines if ln["kind"] == "subject"],
                         [None, "POLY_A_G1", "POLY_A_G2"])
        self.assertEqual(lines[-1]["kind"], "sat_for")

    def test_group_named_lines_accept_the_engine_slot(self):
        from engine import subjects as SUB
        for key, lid, group in (("POLY:JAE:N81", "c", "POLY_C_G2"), ("POLY:JAE:N96", "b", "POLY_A_G1"),
                                ("POLY:JAE:N96", "c", "POLY_A_G2")):
            ln = [x for x in self.by_key[key]["mer"]["lines"] if x["id"] == lid][0]
            self.assertEqual(ln["options"][0]["subjects"], list(SUB.slot_members(group)), (key, lid))
        self.assertIn("combined_science", [x for x in self.by_key["POLY:JAE:N81"]["mer"]["lines"]
                                           if x["id"] == "c"][0]["options"][0]["subjects"])
        literal = [x for x in self.by_key["POLY:JAE:C45"]["mer"]["lines"] if x["id"] == "c"][0]
        self.assertNotIn("group", literal)
        self.assertNotIn("combined_science", literal["options"][0]["subjects"])

    def test_fallbacks_take_pdf_lines(self):
        t66 = [ln for ln in self.by_key["POLY:JAE:T66"]["mer"]["lines"] if ln["id"] == "b"][0]
        self.assertEqual(set(t66["options"][0]["subjects"]), {"mathematics", "additional_mathematics"})
        self.assertEqual(t66["field"], "pdf:b)")
        v14 = self.by_key["ITE:JAE:V14:Central"]["mer"]["lines"][0]
        self.assertEqual(v14["options"][0]["max_grade"], {"G3": "E8"})
        c23 = [ln for ln in self.by_key["POLY:JAE:C23"]["mer"]["lines"] if ln["id"] == "c"][0]
        self.assertIn("food_nutrition", c23["options"][0]["subjects"])

    def test_jien_lines_and_alternative(self):
        r = self.by_key["ITE:JIEN:HF3NS:East"]
        self.assertEqual([ln["kind"] for ln in r["mer"]["lines"]], ["subject", "subject", "any_other"])
        self.assertEqual(r["mer"]["lines"][0]["options"][0]["max_grade"], {"G1": "D", "G2": "5"})
        self.assertEqual(r["mer"]["alternatives"][0]["lines"][0]["max_grade"], {"G3": "E8"})
        b4 = [x for x in self.recs if x["route"] == "JIEN" and x["aggregate_type"] == "B4"][0]
        self.assertEqual(b4["mer"]["lines"][0]["kind"], "completed")
        self.assertEqual(b4["mer"]["alternatives"][0]["lines"][0]["levels"], ["G3"])

    def test_jien_mathematics_includes_additional_mathematics(self):
        for key in ("ITE:JIEN:HF3EE:East", "ITE:JIEN:HF3AI:Central", "ITE:JIEN:HF3NS:East"):
            maths = [ln for ln in self.by_key[key]["mer"]["lines"]
                     if ln["kind"] == "subject" and "mathematics" in ln["options"][0]["subjects"]][0]
            self.assertIn("additional_mathematics", maths["options"][0]["subjects"], key)
        # JAE lines keep their printed subjects ("English Language" etc. untouched; no A Maths added anywhere else).
        c45 = [ln for ln in self.by_key["POLY:JAE:C45"]["mer"]["lines"] if ln["id"] == "a"][0]
        self.assertEqual(c45["options"][0]["subjects"], ["english_language"])

    def test_slot_binding(self):
        dpp = self.by_key["ITE:JIEH:FPACC:Central"]["mer"]
        self.assertEqual([(ln["slots"], ln["max_points"]) for ln in dpp["lines"]],
                         [(["EL"], 3), (["MA"], 4), (["B1", "B2", "B3"], 5)])
        pfp = self.by_key["POLY:PFP:C45"]["mer"]
        self.assertEqual([(ln["slots"], ln["max_points"]) for ln in pfp["lines"]],
                         [(["EL"], 3), (["MA"], 3), (["B1"], 3), (["B2", "B3"], 4)])
        self.assertIsNotNone(pfp["lines"][2]["accepts"])
        self.assertIsNone(pfp["lines"][3]["accepts"])

    def test_pfp_cluster_fallback(self):
        # C23 / R68 / T72 have no PFP list; only R68 is offered through PFP.
        keys = sorted(k for k, r in self.by_key.items() if "pfp_list_from_cluster" in r["data_flags"])
        self.assertEqual(keys, ["POLY:PFP:R68"])
        for k in keys:
            self.assertEqual(self.by_key[k]["mer"]["status"], "parsed")

    def test_nursing_flag(self):
        nurs = sorted(r["course_code"] for r in self.recs if r["is_nursing_diploma"] and r["route"] == "JAE")
        self.assertEqual(nurs, ["C97", "N69"])  # the two courses the MER PDF footnotes as "28 points or better"

    def test_requirements_json_is_fresh(self):
        with open(REQUIREMENTS_FILE, encoding="utf-8") as f:
            on_disk = json.load(f)
        self.assertEqual(on_disk["matcher_version"], MATCHER_VERSION)
        self.assertEqual(json.loads(json.dumps(self.data["records"])), on_disk["records"],
                         "matcher/requirements.json is stale: run python3 -m matcher build")


@NEEDS_PDF
class TestPdfParser(unittest.TestCase):
    def test_cell_with_two_grades_and_note(self):
        cell = ("Subject Grade <br> a) English Language 1-6 <br> b) Higher Chinese or 1-4 <br> Chinese 1-3 <br> "
                "c) Any one of the 1st group of Relevant 1-6 <br> Subjects for the ELR2B2-A <br> Aggregate Type <br> "
                "To be eligible for selection, students must also have <br> sat for Additional Mathematics / Mathematics.")
        p = pdf_mer.parse_cell(cell)
        self.assertEqual([(ln["letter"], ln["name"], ln["grades"]) for ln in p["lines"]], [
            ("a", "English Language", ["1-6"]), ("b", "Higher Chinese or Chinese", ["1-4", "1-3"]),
            ("c", "Any one of the 1st group of Relevant Subjects for the ELR2B2-A Aggregate Type", ["1-6"])])
        self.assertEqual(len(p["notes"]), 1)

    def test_merged_cells_inherit_within_a_table(self):
        d = pdf_mer.load()
        self.assertEqual(d["C23"]["how"], "inherit")
        self.assertEqual(d["C97"]["how"], "own")  # code printed as "C97*"
        self.assertGreaterEqual(len(d), 269)


if __name__ == "__main__":
    unittest.main()
