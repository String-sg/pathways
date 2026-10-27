"""MER line evaluation on invented students (independent lines, alternatives, PDF variants, aggregate slots)."""

import unittest

from helpers import entries, na, nt, o, record

from matcher import evaluate as EV


def lines_of(key):
    return record(key)["mer"]


def line_result(res_lines, lid):
    return next(x for x in res_lines if x["id"] == lid)


class TestIndependent(unittest.TestCase):
    def test_each_line_needs_its_own_subject(self):
        # N96 ECDE: a) EL 1-6, b) 1st group ELR2B2-A 1-6, c) 2nd group ELR2B2-A 1-6, sat for Maths.
        mer = lines_of("POLY:JAE:N96")
        ok, lines = EV.eval_independent(mer["lines"], entries([o("English Language", "B3"), o("Geography", "B4"),
                                                                o("Mathematics", "B3")]))
        self.assertTrue(ok)
        self.assertEqual(line_result(lines, "b")["satisfied_by"][0]["subject_id"], "geography")
        self.assertEqual(line_result(lines, "c")["satisfied_by"][0]["subject_id"], "mathematics")
        # Mathematics F9 still counts as "sat for", but cannot be the 2nd-group subject; Geography cannot serve twice.
        ok, lines = EV.eval_independent(mer["lines"], entries([o("English Language", "B3"), o("Geography", "B4"),
                                                                o("Mathematics", "F9")]))
        self.assertFalse(ok)
        self.assertTrue(line_result(lines, "sat")["met"])
        self.assertFalse(line_result(lines, "distinct")["met"])

    def test_grade_boundary(self):
        mer = lines_of("POLY:JAE:C45")  # a) English Language 1-7
        base = [o("Mathematics", "C6"), o("Physics", "C6")]
        ok, _ = EV.eval_independent(mer["lines"], entries(base + [o("English Language", "D7")]))
        self.assertTrue(ok)
        ok, lines = EV.eval_independent(mer["lines"], entries(base + [o("English Language", "E8")]))
        self.assertFalse(ok)
        self.assertIn("best result: English Language E8", line_result(lines, "a")["detail"])
        ok, _ = EV.eval_independent(mer["lines"], entries([o("English Language", "D7"), o("Mathematics", "D7"),
                                                           o("Physics", "C6")]))
        self.assertFalse(ok)  # b) Additional Mathematics / Mathematics 1-6

    def test_n_level_grades_do_not_meet_o_level_lines(self):
        mer = lines_of("POLY:JAE:C45")
        ok, _ = EV.eval_independent(mer["lines"], entries([na("English Language", "1"), o("Mathematics", "C6"),
                                                           o("Physics", "C6")]))
        self.assertFalse(ok)

    def test_higher_chinese_or_chinese(self):
        mer = lines_of("POLY:JAE:N70")  # b) Higher Chinese 1-4 or Chinese 1-3; sat for Maths
        base = [o("English Language", "C6"), o("History", "C6"), o("Mathematics", "F9")]
        self.assertTrue(EV.eval_independent(mer["lines"], entries(base + [o("Higher Chinese", "B4")]))[0])
        self.assertFalse(EV.eval_independent(mer["lines"], entries(base + [o("Higher Chinese", "C5")]))[0])
        self.assertTrue(EV.eval_independent(mer["lines"], entries(base + [o("Chinese", "B3")]))[0])
        self.assertFalse(EV.eval_independent(mer["lines"], entries(base + [o("Chinese", "B4")]))[0])

    def test_sat_for(self):
        mer = lines_of("POLY:JAE:N70")
        base = [o("English Language", "C6"), o("History", "C6"), o("Chinese", "A1")]
        self.assertFalse(EV.eval_independent(mer["lines"], entries(base))[0])
        self.assertTrue(EV.eval_independent(mer["lines"], entries(base + [o("Additional Mathematics", "F9")]))[0])
        ok, lines = EV.eval_independent(mer["lines"], entries(base + [o("Mathematics", "ABS")]))
        self.assertFalse(ok)
        self.assertFalse(line_result(lines, "sat")["met"])

    def test_any_other_count(self):
        mer = lines_of("ITE:JAE:V54:East")  # ELB4-A: a) EL 1-7, b) any two other subjects 1-7, sat for Maths
        ok, lines = EV.eval_independent(mer["lines"], entries([o("English Language", "D7"), o("Mathematics", "F9"),
                                                                o("Art", "D7"), o("Malay", "B4")]))
        self.assertTrue(ok)
        self.assertEqual({s["subject_id"] for s in line_result(lines, "b")["satisfied_by"]}, {"art", "malay"})
        ok, lines = EV.eval_independent(mer["lines"], entries([o("English Language", "D7"), o("Mathematics", "F9"),
                                                                o("Art", "D7"), o("Malay", "E8")]))
        self.assertFalse(ok)
        self.assertIn("1 qualifying subject(s) besides", line_result(lines, "b")["detail"])

    def test_search_finds_the_assignment_greedy_would_miss(self):
        # ELR1B3-B: b) A Maths / Maths / POA 1-8, c) any 1 other subject 1-7. Taking Mathematics B3 for b) leaves
        # nothing for c); the search puts POA E8 on b) and Mathematics on c).
        mer = lines_of("ITE:JAE:V27:East")
        ok, lines = EV.eval_independent(mer["lines"], entries([o("English Language", "D7"), o("Mathematics", "B3"),
                                                                o("Principles of Accounts", "E8")]))
        self.assertTrue(ok)
        self.assertEqual(line_result(lines, "b")["satisfied_by"][0]["subject_id"], "principles_of_accounts")
        self.assertEqual(line_result(lines, "c")["satisfied_by"][0]["subject_id"], "mathematics")

    def test_unknown_line_gives_unknown(self):
        mer = {"mode": "independent", "alternatives": [], "pdf_variant": None,
               "lines": [{"id": "a", "text": "Mystery (1-6)", "kind": "unknown", "unknown_reason": "test"}]}
        self.assertIsNone(EV.eval_mer(mer, entries([o("English Language", "A1")]))["met"])
        mer["lines"].append({"id": "b", "text": "English Language (1-6)", "kind": "subject", "count": 1,
                             "options": [{"subjects": ["english_language"], "max_grade": {"G3": "C6"}}]})
        self.assertIsNone(EV.eval_mer(mer, entries([o("English Language", "A1")]))["met"])
        self.assertFalse(EV.eval_mer(mer, entries([o("English Language", "F9")]))["met"])


class TestJieN(unittest.TestCase):
    def test_n_level_passes(self):
        mer = lines_of("ITE:JIEN:HF3AC:Central")  # ELB3: EL A-D/1-5 + any 2 others
        r = EV.eval_mer(mer, entries([nt("English Language", "D"), nt("Mathematics", "C"), nt("Mobile Robotics", "B")]))
        self.assertTrue(r["met"])
        self.assertIsNone(r["alternative_used"])
        r = EV.eval_mer(mer, entries([nt("English Language", "E"), nt("Mathematics", "C"), nt("Mobile Robotics", "B")]))
        self.assertFalse(r["met"])  # N(T) E cannot meet a subject requirement

    def test_o_level_alternative(self):
        mer = lines_of("ITE:JIEN:HF3AC:Central")
        r = EV.eval_mer(mer, entries([o("English Language", "D7"), o("Mathematics", "E8")]))
        self.assertTrue(r["met"])
        self.assertEqual(r["alternative_used"]["label"], "Or 2 GCE O-Level grades (1-8) in any two subjects")
        r = EV.eval_mer(mer, entries([o("English Language", "F9"), o("Mathematics", "F9"), o("Physics", "E8")]))
        self.assertFalse(r["met"])

    def test_maths_or_science_with_substitute(self):
        mer = lines_of("ITE:JIEN:HF3AI:Central")  # MAS1B3
        # Mobile Robotics stands in for Science; 3 N-Level passes in all (Mathematics E is not a pass).
        r = EV.eval_mer(mer, entries([nt("Mathematics", "E"), nt("Mobile Robotics", "B"), nt("English Language", "C"),
                                      nt("Tamil", "A")]))
        self.assertTrue(r["met"])
        self.assertEqual(r["lines"][0]["satisfied_by"][0]["subject_id"], "mobile_robotics")
        r = EV.eval_mer(mer, entries([nt("Mathematics", "E"), nt("Mobile Robotics", "B"), nt("English Language", "C")]))
        self.assertFalse(r["met"])
        r = EV.eval_mer(mer, entries([nt("Mathematics", "E"), nt("English Language", "C"), nt("Tamil", "A"),
                                      nt("Computer Applications", "A")]))
        self.assertFalse(r["met"])

    def test_additional_mathematics_counts_as_mathematics(self):
        rows = [na("Additional Mathematics", "4"), na("English Language", "5"), na("Art", "3")]
        self.assertTrue(EV.eval_mer(lines_of("ITE:JIEN:HF3EE:East"), entries(rows))["met"])
        self.assertTrue(EV.eval_mer(lines_of("ITE:JIEN:HF3AI:Central"), entries(rows))["met"])
        rows[0] = na("Additional Mathematics", "6")
        self.assertFalse(EV.eval_mer(lines_of("ITE:JIEN:HF3EE:East"), entries(rows))["met"])

    def test_completed(self):
        mer = lines_of("ITE:JIEN:HF3AT:West")  # B4: Completed GCE 'N' Level (or O-Level)
        self.assertTrue(EV.eval_mer(mer, entries([nt("English Language", "E")]))["met"])
        r = EV.eval_mer(mer, entries([o("English Language", "F9")]))
        self.assertTrue(r["met"])
        self.assertIsNotNone(r["alternative_used"])


class TestPdfVariants(unittest.TestCase):
    def test_disagreement_gives_unknown(self):
        mer = lines_of("ITE:JAE:V83:West")  # CourseFinder b) A Maths, Maths or POA; PDF b) A Maths / Maths + c) science
        stu = entries([o("English Language", "C5"), o("Principles of Accounts", "B3"), o("Chinese", "A2"),
                       o("Art", "B4"), o("Geography", "C6")])
        r = EV.eval_mer(mer, stu)
        self.assertIsNone(r["met"])
        self.assertTrue(r["met_coursefinder"])
        self.assertFalse(r["pdf_variant"]["met"])

    def test_agreement_gives_answer(self):
        mer = lines_of("ITE:JAE:V83:West")
        stu = entries([o("English Language", "C5"), o("Mathematics", "D7"), o("Physics", "E8"), o("Art", "B4"),
                       o("Geography", "C6")])
        r = EV.eval_mer(mer, stu)
        self.assertTrue(r["met"])
        self.assertTrue(r["pdf_variant"]["met"])

    def test_fallback_line_from_pdf(self):
        mer = lines_of("ITE:JAE:V14:Central")  # CourseFinder EL 'A-D or 1-5' (unreadable); PDF EL 1-8
        r = EV.eval_mer(mer, entries([o("English Language", "E8"), o("Mathematics", "D7"), o("Physics", "E8")]))
        self.assertTrue(r["met"])


class TestSlots(unittest.TestCase):
    def test_dpp_english_floor_by_course(self):
        stu = entries([na("English Language", "4"), na("Mathematics", "2"), na("Science (Physics, Chemistry)", "2"),
                       na("Geography", "3"), na("Principles of Accounts", "1")])
        acc = lines_of("ITE:JIEH:FPACC:Central")  # EL 1-3
        eng = lines_of("ITE:JIEH:FPCHT:East")  # EL 1-4
        self.assertFalse(EV.eval_mer(acc, stu, total_max=19)["met"])
        self.assertTrue(EV.eval_mer(eng, stu, total_max=19)["met"])

    def test_dpp_f9_counts_in_aggregate_not_mer(self):
        stu = entries([na("English Language", "2"), na("Mathematics", "2"), na("Science (Physics, Chemistry)", "2"),
                       na("Principles of Accounts", "3"), o("History", "F9")])
        r = EV.eval_mer(lines_of("ITE:JIEH:FPCHT:East"), stu, total_max=19)
        self.assertFalse(r["met"])
        bad = [x for x in r["lines"] if x["met"] is False]
        self.assertEqual(bad[0]["id"], "c")

    def test_pfp_relevant_subject_inside_elmab3(self):
        # gross ELMAB3 = 3+3+2+2+2 = 12; with the Sciences relevant subject (3) the five subjects total 13.
        stu = entries([na("English Language", "3"), na("Mathematics", "3"), na("History", "2"), na("Geography", "2"),
                       na("Art", "2"), na("Science (Physics, Chemistry)", "3")])
        sci = EV.eval_mer(lines_of("POLY:PFP:C45"), stu, total_max=12)
        hum = EV.eval_mer(lines_of("POLY:PFP:C34"), stu, total_max=12)
        self.assertFalse(sci["met"])
        self.assertEqual(sci["total"], 13)
        self.assertTrue(hum["met"])
        self.assertEqual(hum["total"], 12)

    def test_pfp_o_level_grade_9_unusable(self):
        stu = entries([na("English Language", "2"), na("Mathematics", "2"), na("Science (Physics, Chemistry)", "2"),
                       na("History", "3"), o("Geography", "F9")])
        self.assertFalse(EV.eval_mer(lines_of("POLY:PFP:C45"), stu, total_max=12)["met"])
        stu[-1:] = entries([o("Geography", "B4")])
        self.assertTrue(EV.eval_mer(lines_of("POLY:PFP:C45"), stu, total_max=12)["met"])  # B4 -> 2 points


if __name__ == "__main__":
    unittest.main()
