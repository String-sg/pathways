"""Search correctness on random invented students (fixed seed):
- the exact search equals a brute-force enumeration of every assignment (no pruning, no symmetry cuts);
- greedy is never better than exact; disagreements are collected and checked against known causes.

Run `python3 engine/tests/test_search.py survey` for a per-aggregate count of greedy-vs-exact disagreements.
"""

import random
import sys
import unittest

import helpers  # noqa: F401
from engine import engine as E
from engine import subjects as SUB
from engine.definitions import DEFINITIONS

POOL = ["english_language", "higher_chinese", "chinese", "higher_malay", "malay", "french", "chinese_b",
        "mathematics", "additional_mathematics", "physics", "chemistry", "biology", "sci_phy_chem", "sci_chem_bio",
        "geography", "history", "hum_ss_geog", "lit_english", "principles_of_accounts", "art", "design_technology",
        "economics", "computing", "nutrition_food_science", "combined_science", "islamic_rk", "science_t",
        "mobile_robotics", "music", "media_studies_english", "creative_3d_animation", "biotechnology"]
LEVEL_GRADES = {"G3": ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "F9"], "G2": ["1", "2", "3", "4", "5", "6"],
                "G1": ["A", "B", "C", "D", "E"]}


def random_student(rng, n_min=5, n_max=9, levels=("G3", "G2", "G1"), weights=(6, 3, 1)):
    subs = rng.sample(POOL, rng.randint(n_min, n_max))
    if "english_language" not in subs and rng.random() < 0.85:
        subs[0] = "english_language"
    if "mathematics" not in subs and rng.random() < 0.7:
        subs[-1] = "mathematics"
    rows = []
    for sid in subs:
        lvl = rng.choices(levels, weights=weights[:len(levels)])[0]
        if sid == "chinese_b":
            rows.append({"subject": SUB.SUBJECTS_BY_ID[sid]["name"], "level": "G3", "grade": "MERIT", "year": 2026})
            continue
        grade = rng.choice(LEVEL_GRADES[lvl])
        rows.append({"subject": SUB.SUBJECTS_BY_ID[sid]["name"], "level": lvl, "grade": grade,
                     "year": rng.choice([2026, 2026, 2027]) if lvl == "G3" else 2026})
        if rng.random() < 0.08:  # a second sitting / level of the same subject
            lvl2 = rng.choice(levels)
            rows.append({"subject": SUB.SUBJECTS_BY_ID[sid]["name"], "level": lvl2,
                         "grade": rng.choice(LEVEL_GRADES[lvl2]), "year": 2026})
    return rows


def survey(n=400, seed=7):
    rng = random.Random(seed)
    counts, examples, total = {}, {}, {}
    for _ in range(n):
        rows = random_student(rng)
        entries, _, _ = E.prepare_entries(rows)
        for d in DEFINITIONS:
            if d.get("status") == "stub":
                continue
            for years, ents in E.year_sets(entries, d.get("max_year")):
                for alt in d.get("alternatives") or [None]:
                    sol = E.solve(d, ents, alternative=alt)
                    if sol["gross"] is None:
                        continue
                    total[d["id"]] = total.get(d["id"], 0) + 1
                    if sol["greedy_total"] != sol["gross"]:
                        counts[d["id"]] = counts.get(d["id"], 0) + 1
                        examples.setdefault(d["id"], (rows, alt and alt["id"], sol["gross"], sol["greedy_total"],
                                                      sol["slots"], sol["greedy_slots"]))
    return counts, total, examples


class TestExactSearch(unittest.TestCase):
    def test_exact_matches_brute_force(self):
        rng = random.Random(20261018)
        checked = 0
        for _ in range(70):
            rows = random_student(rng, 5, 8)
            entries, _, _ = E.prepare_entries(rows)
            for d in DEFINITIONS:
                if d.get("status") == "stub":
                    continue
                for years, ents in E.year_sets(entries, d.get("max_year")):
                    for alt in d.get("alternatives") or [None]:
                        slots = E.effective_slots(d, alt)
                        cands = E.build_candidates(slots, ents, E.exclude_ids_for(d))
                        ex = E.exact_search(slots, cands, d.get("mtl_rule"))
                        bf = E.brute_force(slots, cands, d.get("mtl_rule"))
                        self.assertEqual(None if ex is None else ex[0][0], bf, (d["id"], rows))
                        checked += 1
                        gr = E.greedy_search(slots, cands, d.get("mtl_rule"))
                        if gr is not None:
                            self.assertIsNotNone(ex)
                            self.assertLessEqual(ex[0][0], sum(c.points for c in gr), d["id"])
        self.assertGreater(checked, 1000)

    def test_constrained_matches_brute_force(self):
        rng = random.Random(99)
        for _ in range(60):
            rows = random_student(rng, 5, 8)
            entries, _, _ = E.prepare_entries(rows)
            for d in DEFINITIONS:
                for chk in d.get("checks", []):
                    if chk["type"] != "constrained":
                        continue
                    for alt in d.get("alternatives") or [None]:
                        slots = E.effective_slots(d, alt, chk.get("slot_accepts"))
                        cands = E.build_candidates(slots, entries, E.exclude_ids_for(d), chk["slot_mer"])
                        ex = E.exact_search(slots, cands, d.get("mtl_rule"), chk["slot_mer"])
                        bf = E.brute_force(slots, cands, d.get("mtl_rule"))
                        self.assertEqual(None if ex is None else ex[0][0], bf, (d["id"], chk["id"]))


class TestGreedyVsExact(unittest.TestCase):
    def test_greedy_never_beats_exact(self):
        counts, total, examples = survey(n=250, seed=11)
        for did, (rows, alt, gross, greedy, slots, gslots) in examples.items():
            self.assertLess(gross, greedy, did)

    def test_greedy_loss_same_subject_two_levels_b2(self):
        # ELR2B2-B(2027): B1 must be G3, B2 takes the G2-equivalent grade, and Art was sat at G3 (C6) and G2 (1).
        # Greedy: B1 = Art G3 C6 (6) -> B2 = Music D7 -> 3 : 1 + 1 + 2 + 6 + 3 = 13
        # Exact : B1 = Music D7 (7), B2 = Art at G2 grade 1 (1) : 1 + 1 + 2 + 7 + 1 = 12
        rows = [helpers.sec("English Language", "A1"), helpers.sec("Mathematics", "A1"), helpers.sec("History", "A2"),
                helpers.sec("Art", "C6"), helpers.sec("Art", "1", "G2"), helpers.sec("Music", "D7")]
        r = helpers.run("ELR2B2-B(2027)", rows)
        self.assertEqual(r.gross, 12)
        self.assertEqual(r.greedy_total, 13)
        self.assertTrue(r.greedy_differs)
        b2 = helpers.picks(r)["B2"]
        self.assertEqual(b2, ("art", "1", 1))

    def test_greedy_loss_hmtl_blocks_two_mtls(self):
        # L1R4(2026) (MI), EL as L1. Greedy puts Higher Malay A1 in R3, which (2026 JC/MI wording: no HMTL with
        # any MTL) blocks Malay A2 and Chinese B4, so R4 = Nutrition & Food Science C6:
        #   greedy 3 + 4 + 8 + 1 + 6 = 22 ; exact uses Malay 2 + Chinese 4 instead: 3 + 4 + 8 + 2 + 4 = 21.
        rows = [helpers.row("English Language", "B3"), helpers.row("Higher Malay", "A1"), helpers.row("Malay", "A2"),
                helpers.row("Chinese", "B4"), helpers.row("Additional Mathematics", "B4"), helpers.row("History", "E8"),
                helpers.row("Nutrition & Food Science", "C6")]
        r = helpers.run("L1R4(2026)", rows)
        self.assertEqual(r.gross, 21)
        self.assertEqual(r.greedy_total, 22)
        self.assertNotIn("higher_malay", [s["subject_id"] for s in r.slots])

    def test_greedy_loss_which_hmtl_is_l1(self):
        # L1R4(2027), HMTL as L1, two HMTLs and a G3 Malay A1. Greedy takes the better HMTL (Higher Malay C5) as L1,
        # which blocks Malay A1 (same language): R4 = Higher Chinese C6. Exact takes Higher Chinese C6 as L1 and keeps
        # Malay A1 for R4: exact 6 + 6 + 8 + 8 + 1 = 29, greedy 5 + 6 + 8 + 8 + 6 = 33.
        rows = [helpers.sec("Higher Malay", "C5"), helpers.sec("Malay", "A1"), helpers.sec("Higher Chinese", "C6"),
                helpers.sec("Geography", "C6"), helpers.sec("Science (Chemistry, Biology)", "E8"),
                helpers.sec("Physics", "E8"), helpers.sec("English Language", "F9")]
        r = helpers.run("L1R4(2027)", rows)
        hm = [a for a in r.alternatives if a["id"] == "HMTL"][0]
        self.assertEqual(hm["gross"], 6 + 6 + 8 + 8 + 1)
        self.assertEqual(hm["greedy_total"], 5 + 6 + 8 + 8 + 6)

    def test_nested_groups_greedy_agrees(self):
        # ELR1B3-B(2026): POA is both an R1 subject and the best subject overall; any order gives the same total.
        rows = [helpers.row("English Language", "B3"), helpers.row("Principles of Accounts", "A1"),
                helpers.row("Mathematics", "A2"), helpers.row("Art", "B3"), helpers.row("History", "B4")]
        r = helpers.run("ELR1B3-B(2026)", rows)
        self.assertEqual(r.gross, 3 + 1 + 2 + 3 + 4)
        self.assertFalse(r.greedy_differs)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "survey":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
        counts, total, examples = survey(n=n, seed=7)
        print("greedy vs exact over %d random invented students" % n)
        for did in sorted(total):
            print("  %-22s computed %5d  greedy worse %4d" % (did, total[did], counts.get(did, 0)))
        for did, (rows, alt, gross, greedy, slots, gslots) in sorted(examples.items()):
            print("\n%s (alternative %s): exact %d, greedy %d" % (did, alt, gross, greedy))
            for x in rows:
                print("    %s %s %s %s" % (x["subject"], x["level"], x["grade"], x["year"]))
            print("  exact :", ", ".join("%s=%s %s%s(%d)" % (s["slot"], s["subject"], s["level"], s["grade"], s["points"])
                                         for s in slots))
            print("  greedy:", ", ".join("%s=%s %s%s(%d)" % (s["slot"], s["subject"], s["level"], s["grade"], s["points"])
                                         for s in gslots))
    else:
        unittest.main()
