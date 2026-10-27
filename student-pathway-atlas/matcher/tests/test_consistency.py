"""Random invented students: where a course's MER is the same rule the engine already checks, the two must agree.

  JIE 'H' (DPP)  course MER (EL 1-3 / 1-4, MA 1-4, 3 others 1-5)  == engine dpp_family_bs / dpp_family_asci
  PFP            course MER with the cluster's relevant list      == engine pfp_cluster_sci / pfp_cluster_hum
  JIE 'N'        course MER + O-Level alternative                 == engine jien_mer (MAS1B3, ELB3, MAB3, ELMAB2)
                 (both read "Mathematics" as Mathematics or Additional Mathematics -)
"""

import random
import unittest

from helpers import record

from engine import compute_all
from engine import subjects as SUB
from engine.engine import prepare_entries
from matcher import evaluate as EV

POOL = ["English Language", "Mathematics", "Additional Mathematics", "Science (Physics, Chemistry)",
        "Science (Chemistry, Biology)", "History", "Geography", "Principles of Accounts", "Art", "Tamil", "Chinese",
        "Food & Nutrition", "Design & Technology", "Humanities (Social Studies, History)", "Literature in English"]
NT_ONLY = ["Science (Syllabus T)", "Mobile Robotics", "Smart Electrical Technology"]
GRADES = {"N(A)": ["1", "2", "3", "4", "5", "6"], "N(T)": ["A", "B", "C", "D", "E", "U"],
          "O": ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "F9"]}


def student(rng, levels):
    rows = []
    n = rng.randint(3, 7)
    subjects = rng.sample(POOL + (NT_ONLY if "N(T)" in levels else []), n)
    if rng.random() < 0.8 and "English Language" not in subjects:
        subjects[0] = "English Language"
    for s in subjects:
        lv = "N(T)" if s in NT_ONLY else rng.choice(levels)
        rows.append({"subject": s, "level": lv, "grade": rng.choice(GRADES[lv]), "year": 2026})
    return rows


def engine_check(results, agg_id, check_id):
    r = next(x for x in results if x.id == agg_id)
    return next(e for e in r.eligibility if e["id"] == check_id)["met"], r


class TestAgreesWithEngine(unittest.TestCase):
    N = 400

    def test_dpp_families(self):
        rng = random.Random(20261018)
        bs, asci = record("ITE:JIEH:FPACC:Central")["mer"], record("ITE:JIEH:FPCHT:East")["mer"]
        for _ in range(self.N):
            rows = student(rng, ["N(A)", "N(A)", "O"])
            res = compute_all(rows)
            ents = prepare_entries(rows)[0]
            for mer, cid in ((bs, "dpp_family_bs"), (asci, "dpp_family_asci")):
                want, r = engine_check(res, "ELMAB3:DPP(2026)", cid)
                got = EV.eval_mer(mer, ents, total_max=19, base_gross=r.gross)["met"]
                self.assertEqual(got, want, (cid, rows))

    def test_dpp_families_with_nt_grades(self):
        """Engine 0.1.5 / matcher 0.1.3: an N(T) grade is silent for DPP, so a failed floor check it could change is
        unknown in both the engine check and the course MER."""
        rng = random.Random(515)
        bs, asci = record("ITE:JIEH:FPACC:Central")["mer"], record("ITE:JIEH:FPCHT:East")["mer"]
        from engine.ignored import ignored_entries
        from engine.definitions import DEFINITIONS_BY_ID
        unknown = 0
        for _ in range(self.N):
            rows = student(rng, ["N(A)", "N(A)", "O", "N(T)"])
            res = compute_all(rows)
            ents = prepare_entries(rows)[0]
            for mer, cid in ((bs, "dpp_family_bs"), (asci, "dpp_family_asci")):
                want, r = engine_check(res, "ELMAB3:DPP(2026)", cid)
                silent = ignored_entries(DEFINITIONS_BY_ID["ELMAB3:DPP(2026)"], ents, ents, r.years_used)[1]
                got = EV.eval_mer(mer, ents, total_max=19, base_gross=r.gross, silent=silent)["met"]
                self.assertEqual(got, want, (cid, rows))
                unknown += want is None
        self.assertGreater(unknown, 0)

    def test_pfp_clusters(self):
        rng = random.Random(7)
        sci, hum = record("POLY:PFP:C45")["mer"], record("POLY:PFP:C34")["mer"]
        self.assertEqual(set(sci["lines"][2]["accepts"]), set(SUB.group_members("PFP_REL_SCI")))
        self.assertEqual(set(hum["lines"][2]["accepts"]), set(SUB.group_members("PFP_REL_HUM")))
        for _ in range(self.N):
            rows = student(rng, ["N(A)", "N(A)", "O"])
            res = compute_all(rows)
            ents = prepare_entries(rows)[0]
            for mer, cid in ((sci, "pfp_cluster_sci"), (hum, "pfp_cluster_hum")):
                want, r = engine_check(res, "ELMAB3:PFP(2026)", cid)
                got = EV.eval_mer(mer, ents, total_max=12, base_gross=r.gross)["met"]
                self.assertEqual(got, want, (cid, rows))

    def test_jie_n(self):
        rng = random.Random(42)
        keys = {"MAS1B3(2026)": "ITE:JIEN:HF3AI:Central", "ELB3(2026)": "ITE:JIEN:HF3AC:Central",
                "MAB3(2026)": "ITE:JIEN:HF3EE:East", "ELMAB2(2026)": "ITE:JIEN:HF3NS:East"}
        mers = {k: record(v)["mer"] for k, v in keys.items()}
        checked = 0
        for _ in range(self.N):
            rows = student(rng, ["N(T)", "N(A)", "O"])
            res = compute_all(rows)
            ents = prepare_entries(rows)[0]
            for agg, mer in mers.items():
                want, _ = engine_check(res, agg, "jien_mer")
                got = EV.eval_mer(mer, ents)["met"]
                self.assertEqual(got, want, (agg, rows))
                checked += 1
        self.assertEqual(checked, 4 * self.N)


if __name__ == "__main__":
    unittest.main()
