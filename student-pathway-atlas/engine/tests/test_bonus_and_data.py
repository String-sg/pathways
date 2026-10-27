"""Bonus schedules and caps; definition data integrity (every rule cites an existing source file, every
reference resolves, definitions.json is in sync with the code)."""

import json
import os
import unittest

from helpers import ROOT, row, run, sec, source_listed
from engine import grades as G
from engine import subjects as SUB
from engine.definitions import DEFINITIONS
from engine.export_definitions import OUT, build

STRONG_2026 = [row("English Language", "A1"), row("Higher Chinese", "B3"), row("Chinese (Special Programme)", "A2"),
               row("Mathematics", "A1"), row("History", "A1"), row("Physics", "A1"), row("Chemistry", "A2"),
               row("Art", "A2")]


class TestBonus(unittest.TestCase):
    def test_jc_2026_cap_4_and_lep_on_top(self):
        r = run("L1R5(2026)", STRONG_2026, {"cca": "Excellent", "affiliated_jc": True, "lep": True})
        items = {i["id"]: i["points"] for i in r.bonus["items"]}
        self.assertEqual(items, {"cca": 2, "el_hmtl": 2, "sp_bi": 2, "affiliated_jc": 2, "lep": 2})
        self.assertEqual(r.bonus["base"], 4)  # 6 from CCA + EL/HMTL + CSP, capped at 4
        self.assertEqual(r.net, r.gross - 4)
        v = r.net_variants
        self.assertEqual(v["Affiliated JC"], r.gross - 4)  # still capped
        self.assertEqual(v["CLEP / MLEP / TLEP"], r.gross - 6)  # +2 outside the cap
        self.assertEqual(v["Affiliated JC + CLEP / MLEP / TLEP"], r.gross - 6)

    def test_jc_2026_small_bonus(self):
        r = run("L1R5(2026)", STRONG_2026[:1] + STRONG_2026[3:] + [row("Geography", "A1")], {"cca": "Good"})
        self.assertEqual(r.bonus["base"], 1)
        r2 = run("L1R5(2026)", STRONG_2026[:1] + STRONG_2026[3:] + [row("Geography", "A1")],
                 {"cca": "Good", "affiliated_jc": True})
        self.assertEqual(r2.net_variants["Affiliated JC"], r2.gross - 3)

    def test_el_hmtl_needs_both(self):
        rows = [row("English Language", "D7")] + STRONG_2026[1:]
        r = run("L1R5(2026)", rows)
        self.assertEqual({i["id"]: i["points"] for i in r.bonus["items"]}["el_hmtl"], 0)

    def test_mi_2026_no_affiliation_or_lep(self):
        r = run("L1R4(2026)", STRONG_2026, {"cca": "Excellent", "affiliated_jc": True, "lep": True})
        self.assertEqual(r.bonus["base"], 4)
        self.assertEqual(r.net_variants, {})

    def test_2027_cap_3_jc_only_variants(self):
        rows = [dict(x, level="G3", year=2027) for x in STRONG_2026]
        r = run("L1R4(2027)", rows, {"cca": "Excellent", "affiliated_jc": True, "lep": True})
        self.assertEqual(r.bonus["base"], 3)
        self.assertEqual(r.net, r.gross - 3)
        self.assertEqual(r.net_variants["CLEP / MLEP / TLEP [JC choices only]"], r.gross - 5)
        self.assertEqual(r.net_variants["Affiliated JC [JC choices only]"], r.gross - 3)

    def test_cca_tables(self):
        rows = [sec("English Language", "B3"), sec("Mathematics", "A2"), sec("Biology", "B4"), sec("Art", "C5"),
                sec("History", "C6")]
        gross = run("ELR2B2-C(2027)", rows).gross
        self.assertEqual(run("ELR2B2-C(2027)", rows, {"cca": "A1"}).net, gross - 2)
        self.assertEqual(run("ELR2B2-C(2027)", rows, {"cca": "c6"}).net, gross - 1)
        self.assertEqual(run("ELR2B2-C(2027)", rows, {"cca": "Fair"}).net, gross)
        r = run("ELR2B2-C(2027)", rows)
        self.assertEqual(r.net, gross)
        self.assertTrue(any("CCA grade not given" in w for w in r.warnings))


class TestDefinitionData(unittest.TestCase):
    def test_ids_unique_and_labelled(self):
        ids = [d["id"] for d in DEFINITIONS]
        self.assertEqual(len(ids), len(set(ids)))
        for d in DEFINITIONS:
            if d["status"] == "stub":
                self.assertTrue(d.get("stub_reason"), d["id"])
                continue
            self.assertIn("(%d)" % d["exam_year"], d["id"])

    def _src_ok(self, src, where):
        self.assertIsInstance(src, dict, where)
        self.assertTrue(src.get("heading"), where)
        self.assertTrue(source_listed(src["file"]), "%s: source %s is not in README.md" % (where, src["file"]))

    def test_every_rule_cites_an_existing_source(self):
        for d in DEFINITIONS:
            self.assertTrue(d.get("sources"), d["id"])
            for s in d["sources"]:
                self._src_ok(s, d["id"])
            for sl in d["slots"]:
                self._src_ok(sl["source"], "%s/%s" % (d["id"], sl["name"]))
            for c in d.get("checks", []):
                if c["type"] != "info" or c.get("source"):
                    self._src_ok(c["source"], "%s/%s" % (d["id"], c["id"]))
            if d.get("bonus"):
                self._src_ok(d["bonus"]["source"], d["id"] + "/bonus")
                for x in d["bonus"].get("also_sources", []):
                    self._src_ok(x, d["id"] + "/bonus")
                for item in d["bonus"]["items"] + d["bonus"].get("uncapped", []):
                    for x in item.get("sources", []):
                        self._src_ok(x, "%s/bonus/%s" % (d["id"], item["id"]))
        for name, sc in G.SCALES.items():
            self._src_ok(sc["source"], "scale " + name)
        for name, g in SUB.GROUPS.items():
            self._src_ok(g["source"], "group " + name)

    def test_references_resolve(self):
        check_types = {"gross_max", "net_max", "subject_requirements", "conditional_admission",
                       "constrained", "min_subjects", "passes", "requires_level", "info"}

        def accepts_ok(acc, where):
            if acc.get("any"):
                return
            for g in acc.get("groups", []):
                self.assertIn(g, SUB.GROUPS, where)
            for s in acc.get("subjects", []):
                self.assertIn(s, SUB.SUBJECTS_BY_ID, where)

        for d in DEFINITIONS:
            names = [s["name"] for s in d["slots"]]
            self.assertEqual(len(names), len(set(names)), d["id"])
            for s in d["slots"]:
                self.assertIn(s["scale"], G.SCALES, d["id"])
                accepts_ok(s["accepts"], d["id"])
            for a in d.get("alternatives", []):
                for sn, ov in a["slot_overrides"].items():
                    self.assertIn(sn, names)
                    accepts_ok(ov["accepts"], d["id"])
            for g in d.get("exclude_groups", []):
                self.assertIn(g, SUB.GROUPS)
            self.assertIn(d.get("mtl_rule"), (None, "same_language", "any_language"))
            for c in d.get("checks", []):
                self.assertIn(c["type"], check_types, d["id"])
                if c["type"] == "constrained":
                    for sn in list(c["slot_mer"]) + list(c.get("slot_accepts", {})):
                        self.assertIn(sn, names, (d["id"], c["id"]))

    def test_definitions_json_in_sync(self):
        self.assertTrue(os.path.exists(OUT), "run python3 -m engine.export_definitions")
        with open(OUT, encoding="utf-8") as f:
            on_disk = json.load(f)
        fresh = json.loads(json.dumps(build()))
        self.assertEqual(on_disk, fresh, "engine/definitions.json is stale: run python3 -m engine.export_definitions")


if __name__ == "__main__":
    unittest.main()
