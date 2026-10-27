"""match: exercises x institution types, gates, MER, links and flags - invented students only."""

import unittest

from helpers import mer, na, nt, o, reason, result_for, sec

from engine import compute

from matcher import EXERCISE_IDS, load_requirements, match, match_report


def _records():
    return {r["key"]: r for r in load_requirements()["records"]}

EXPRESS = [o("English Language", "B3"), o("Mathematics", "B4"), o("Science (Physics, Chemistry)", "C5"),
           o("Humanities (Social Studies, Geography)", "C6"), o("Chinese", "A2"), o("Principles of Accounts", "B3"),
           o("Art", "A2")]


class TestJae(unittest.TestCase):
    def test_jc_mi(self):
        jc = result_for(EXPRESS, "JAE-2027", "JC:JAE:39A", {"cca": "Good"})
        self.assertEqual(jc.aggregate_id, "L1R5(2026)")
        self.assertEqual(jc.aggregate_display_name, "L1R5 (2026 O-Level)")
        self.assertEqual(reason(jc, "aggregate")["label"], "L1R5 (2026 O-Level)")
        self.assertEqual(jc.net_range_basis, "L1R5 (2026 O-Level)")
        self.assertEqual(jc.gross, 22)
        self.assertFalse(jc.eligible)
        self.assertFalse(reason(jc, "jc_gross")["met"])
        mi = result_for(EXPRESS, "JAE-2027", "MI:JAE:43C", {"cca": "Good"})
        self.assertEqual(mi.gross, 16)  # EL 3 + Maths 4 + Sci 5 + Chinese 2 + Art 2
        self.assertTrue(mi.eligible)
        self.assertEqual(mi.net_range_2026, [10, 20])

    def test_jc_conditional_admission(self):
        rows = [o("English Language", "D7"), o("Higher Chinese", "A1"), o("History", "A1"), o("Mathematics", "A1"),
                o("Physics", "A1"), o("Chemistry", "A1"), o("Biology", "A2")]
        jc = result_for(rows, "JAE-2027", "JC:JAE:28S")
        self.assertEqual(jc.gross, 7)  # Higher Chinese as L1
        self.assertTrue(jc.eligible)
        gate = reason(jc, "jc_subjects|jc_conditional")
        self.assertTrue(gate["conditional"])

    def test_aggregate_not_computable_blocks(self):
        rows = [o("English Language", "A1"), o("Mathematics", "A1"), o("Physics", "A1"), o("Chemistry", "A1"),
                o("Biology", "A1"), o("Chinese", "A1")]  # no Humanities subject for R1
        jc = result_for(rows, "JAE-2027", "JC:JAE:28S")
        self.assertIsNone(jc.gross)
        self.assertFalse(jc.eligible)
        engine_reason = compute("L1R5(2026)", rows).not_computable_reason
        self.assertIn("can't be worked out: " + engine_reason, reason(jc, "jc_gross")["detail"])
        agg = reason(jc, "aggregate")
        self.assertTrue(agg["cant_be_worked_out"])
        self.assertIn(engine_reason, agg["detail"])
        # JIE 'N' has no aggregate gate: the course is unknown, because posting needs the aggregate.
        jien = result_for([nt("English Language", "A"), nt("Mathematics", "A"), nt("Tamil", "B")], "JIE-N-2027",
                          "ITE:JIEN:HF3AC:Central")  # 3 subjects, needs 4
        self.assertIsNone(jien.gross)
        self.assertIsNone(jien.eligible)
        self.assertIn("(needed for posting)", reason(jien, "aggregate")["detail"])

    def test_poly_mer_and_nursing_threshold(self):
        rows = [o("English Language", "C6"), o("Mathematics", "C6"), o("Biology", "C6"), o("Art", "B4"),
                o("Chinese", "C5")]
        nursing = result_for(rows, "JAE-2027", "POLY:JAE:C97")
        self.assertEqual((nursing.gross, nursing.net), (27, 27))
        self.assertTrue(reason(nursing, "nursing_net")["met"])
        self.assertTrue(nursing.eligible)
        self.assertTrue(nursing.notes)  # medical / vaccination note: shown, never blocking
        chem = result_for(rows, "JAE-2027", "POLY:JAE:C45")
        self.assertTrue(mer(chem)["met"])
        self.assertFalse(reason(chem, "poly_net")["met"])
        self.assertFalse(chem.eligible)

    def test_poly_mer_line_evidence(self):
        r = result_for(EXPRESS, "JAE-2027", "POLY:JAE:N95", {"cca": "Good"})
        self.assertFalse(r.eligible)
        m = mer(r)
        self.assertFalse(m["met"])
        bad = [ln for ln in m["lines"] if ln["met"] is False]
        self.assertEqual([ln["id"] for ln in bad], ["b"])
        good = [ln for ln in m["lines"] if ln["id"] == "c"][0]
        self.assertEqual(good["satisfied_by"][0]["subject_id"], "art")

    def test_earlier_subject_in_a_group_named_mer_line(self):
        rows = [o("English Language", "B3"), o("Mathematics", "B4"), o("Combined Science", "B3"), o("Art", "A2"),
                o("History", "C5")]
        named = result_for(rows, "JAE-2027", "POLY:JAE:N81")  # c) Any one of the 2nd group ... ELR2B2-C (1-6)
        c = [ln for ln in mer(named)["lines"] if ln["id"] == "c"][0]
        self.assertEqual(c["satisfied_by"][0]["subject_id"], "combined_science")
        self.assertTrue(named.eligible)
        self.assertIsNotNone(named.gross)  # the engine's R2 slot takes it as well
        listed = result_for(rows, "JAE-2027", "POLY:JAE:C45")  # c) Any one of the following subjects: ... (1-6)
        self.assertFalse(mer(listed)["met"])
        self.assertFalse(listed.eligible)

    def test_ite_needs_five_o_level_subjects(self):
        rows = [o("English Language", "C6"), o("Mathematics", "C6"), o("Biology", "C6"), o("Art", "B4")]
        r = result_for(rows, "JAE-2027", "ITE:JAE:V54:East")
        self.assertFalse(reason(r, "ite_sat5")["met"])
        self.assertFalse(r.eligible)
        r = result_for(rows + [o("Malay", "D7")], "JAE-2027", "ITE:JAE:V54:East")
        self.assertTrue(r.eligible)

    def test_links_flags_and_ranges(self):
        res = match(EXPRESS, {"cca": "Good"}, ["JAE-2027"])
        self.assertEqual(len(res), 34 + 3 + 195 + 74)
        for r in res:
            self.assertTrue(r.moe_url.startswith("https://www.moe.gov.sg/"))
            self.assertTrue(r.institution_url.startswith("http"))
            self.assertIn(r.eligible, (True, False, None))
            self.assertTrue(r.reasons)
        c23 = [r for r in res if r.requirement_key == "POLY:JAE:C23"][0]
        self.assertIsNone(c23.net_range_2026)
        self.assertIn("no_net_aggregate_range", c23.data_flags)
        self.assertIn("mer_line_from_pdf", c23.data_flags)


class TestNLevelExercises(unittest.TestCase):
    NA = [na("English Language", "2"), na("Mathematics", "3"), na("Science (Physics, Chemistry)", "2"),
          na("Humanities (Social Studies, Geography)", "3"), na("Principles of Accounts", "1"), na("Tamil", "2")]

    def test_dpp(self):
        r = result_for(self.NA, "DPP-2027", "ITE:JIEH:FPACC:Central", {"cca": "Excellent"})
        self.assertEqual(r.aggregate_id, "ELMAB3:DPP(2026)")
        self.assertEqual((r.gross, r.net), (10, 8))  # EL 2 + MA 3 + POA 1, Sci 2, Tamil 2; bonus 2
        self.assertTrue(r.eligible)
        self.assertFalse(result_for(EXPRESS, "DPP-2027", "ITE:JIEH:FPACC:Central").eligible)  # no N(A) results

    def test_pfp(self):
        r = result_for(self.NA, "PFP-2027", "POLY:PFP:C45")
        self.assertEqual(r.aggregate_id, "ELMAB3:PFP(2026)")
        self.assertEqual(r.gross, 10)
        self.assertTrue(r.eligible)
        self.assertIsNone(r.net_range_2026)  # the row's range is the JAE ELR2B2 range, not PFP's
        # Chinese Studies: the extra Chinese grade is a Year-1 progression requirement - a note, never blocking.
        n70 = result_for(self.NA, "PFP-2027", "POLY:PFP:N70")
        self.assertTrue(n70.eligible)
        self.assertIn("Needed to progress to Year 1 of this diploma: one of Grade B4 for O-Level Higher Chinese, "
                      "Grade B3 for O-Level Chinese or Grade 1 for N(A)-Level Chinese.", n70.notes)
        self.assertEqual([it["id"] for it in n70.reasons], ["aggregate", "pfp_na", "pfp_gross", "mer"])

    def test_pfp_tamil_studies_applying_requirement(self):
        base = [r for r in self.NA if r["subject"] != "Tamil"] + [na("Literature in English", "2")]
        cases = [([na("Tamil", "1")], True), ([na("Tamil", "2")], False), ([o("Tamil", "B3", 2025)], True),
                 ([o("Tamil", "B4", 2025)], False), ([o("Higher Tamil", "B4")], True), ([o("Higher Tamil", "C5")], False),
                 ([], False), ([na("Chinese", "1")], False), ([na("Tamil", "ABS")], False)]
        for extra, ok in cases:
            r = result_for(base + extra, "PFP-2027", "POLY:PFP:N95")
            gate = reason(r, "applying_requirement")
            self.assertEqual(gate["met"], ok, extra)
            self.assertEqual(r.eligible, ok, extra)  # the rest of the student's PFP rows are met
            self.assertTrue(gate["blocking"])
            self.assertEqual(gate["kind"], "gate")
            if not ok:
                self.assertIn("not met: needs O-Level/G3 B4 or better in Higher Tamil Language; O-Level/G3 B3 or better "
                              "in Tamil Language; N(A)/G2 1 or better in Tamil Language", gate["detail"])
        self.assertEqual([it["id"] for it in r.reasons], ["aggregate", "pfp_na", "pfp_gross", "applying_requirement", "mer"])
        # not a progression note as well (the gate shows the scores), and no gate on PSE 2028 (MER unpublished)
        self.assertFalse(any("Year 1" in n for n in r.notes))
        pse = result_for(TestPse.SEC, "PSE-2028", "POLY:PFP:N95")
        self.assertNotIn("applying_requirement", [it["id"] for it in pse.reasons])
        # no other course carries an application requirement
        self.assertEqual(sorted(k for k, rec in _records().items() if rec.get("application_requirements")),
                         ["POLY:PFP:N95"])

    def test_jie_n(self):
        rows = [nt("English Language", "C"), nt("Mathematics", "E"), nt("Mobile Robotics", "B"), nt("Tamil", "A")]
        acc = result_for(rows, "JIE-N-2027", "ITE:JIEN:HF3AC:Central")  # ELB3
        self.assertEqual(acc.aggregate_id, "ELB3(2026)")
        self.assertTrue(acc.eligible)
        elec = result_for(rows, "JIE-N-2027", "ITE:JIEN:HF3EE:East")  # MAB3: Mathematics pass needed
        self.assertFalse(elec.eligible)
        olev = result_for(EXPRESS, "JIE-N-2027", "ITE:JIEN:HF3EE:East")
        self.assertTrue(olev.eligible)
        self.assertIn("alternative_used", mer(olev))


class TestPse(unittest.TestCase):
    SEC = [sec("English Language", "B3"), sec("Mathematics", "B4"), sec("Science (Physics, Chemistry)", "C5"),
           sec("History", "C6"), sec("Geography", "1", "G2"), sec("Tamil", "2", "G2")]

    def test_poly_unknown_until_2028_mer(self):
        r = result_for(self.SEC, "PSE-2028", "POLY:JAE:C45", {"cca": "Good"})
        self.assertEqual(r.aggregate_id, "ELR2B2-C(2027)")
        self.assertEqual(r.aggregate_display_name, "ELR2B2-C (2027 SEC)")
        self.assertEqual(r.net, 18)  # EL 3 + Maths 4 + Sci 5 + History 6 + Geography (G2) 1 - 1
        self.assertIsNone(r.eligible)
        self.assertIsNone(mer(r)["met"])
        self.assertEqual(mer(r)["label"], "2028 entry requirements not yet published")
        self.assertEqual(r.requirements_note, "2028 entry requirements not yet published")
        self.assertIsNone(r.net_range_2026)
        self.assertIsNone(r.net_range_basis)
        self.assertEqual({it["kind"] for it in r.reasons}, {"aggregate", "gate", "mer"})
        self.assertIn("course_list_2026", r.data_flags)
        weak = [sec("English Language", "D7"), sec("Mathematics", "E8"), sec("Science (Physics, Chemistry)", "E8"),
                sec("History", "D7"), sec("Geography", "4", "G2")]
        self.assertFalse(result_for(weak, "PSE-2028", "POLY:JAE:C45").eligible)

    def test_jc_fully_decided(self):
        rows = [sec("English Language", "A1"), sec("History", "A1"), sec("Mathematics", "A1"), sec("Physics", "A2"),
                sec("Chemistry", "A1"), sec("Chinese", "A1")]
        r = result_for(rows, "PSE-2028", "JC:JAE:28S")
        self.assertEqual((r.aggregate_id, r.gross), ("L1R4(2027)", 5))
        self.assertTrue(r.eligible)
        self.assertIsNone(r.net_range_2026)
        # MOE has published the 2028 JC / MI criteria: no "not yet published" note next to a definite answer.
        self.assertEqual(r.requirements_note, "")
        self.assertEqual(result_for(rows, "PSE-2028", "MI:JAE:43S").requirements_note, "")
        self.assertEqual(result_for(rows, "PSE-2028", "ITE:JAE:V27:East").requirements_note,
                         "2028 entry requirements not yet published")
        self.assertFalse(result_for(self.SEC, "PSE-2028", "JC:JAE:28S").eligible)  # only 4 G3 subjects

    def test_ite_3_year_mapping_and_pfp(self):
        r = result_for(self.SEC, "PSE-2028", "ITE:JIEN:HF3AC:Central")
        self.assertEqual(r.aggregate_id, "R1B3-C(2027)")
        self.assertIn("aggregate_type_mapped_from_2026", r.data_flags)
        self.assertIsNone(r.eligible)
        p = result_for(self.SEC, "PSE-2028", "POLY:PFP:C45")
        self.assertEqual(p.aggregate_id, "ELMAB3:PFP(2027)")
        self.assertEqual({it["id"] for it in p.reasons}, {"aggregate", "pfp_gross", "mer"})
        self.assertIsNone(p.eligible)


class TestApi(unittest.TestCase):
    def test_exercise_filter(self):
        res = match(EXPRESS, None, ["PFP-2027"])
        self.assertEqual({r.exercise for r in res}, {"PFP-2027"})
        with self.assertRaises(ValueError):
            match(EXPRESS, None, ["JAE-2099"])

    def test_report(self):
        rep = match_report(EXPRESS + [{"subject": "Underwater Basket Weaving", "level": "O", "grade": "A1",
                                       "year": 2026}], {"cca": "Good"})
        self.assertEqual(len(rep["input_problems"]), 1)
        self.assertEqual(sum(s["courses"] for s in rep["summary"]), len(rep["results"]))
        self.assertEqual({s["exercise"] for s in rep["summary"]}, set(EXERCISE_IDS))
        d = rep["results"][0].to_dict()
        for k in ("exercise", "institution_type", "institution", "course_code", "course_name", "field_of_study",
                  "aggregate_id", "gross", "net", "net_range_2026", "eligible", "reasons", "moe_url",
                  "institution_url", "data_flags"):
            self.assertIn(k, d)


if __name__ == "__main__":
    unittest.main()
