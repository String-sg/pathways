"""Engine 0.1.6: SEAB's subject lists (data/taxonomy/subjects_by_level.csv) - names the engine now reads,
two N(T) / G1 subjects added, and the levels SEAB examines each subject at per exam year (warn, never drop)."""

import csv
import os
import unittest

from helpers import ROOT, row, run, sec

from engine import check_inputs
from engine import subjects as SUB

CSV = os.path.join(ROOT, "data", "taxonomy", "subjects_by_level.csv")


def problems(rows):
    return [(p["field"], p["problem"], p["action"]) for p in check_inputs(rows)["input_problems"]]


class TestNames(unittest.TestCase):
    def test_new_aliases(self):
        r = SUB.resolve_subject
        self.assertEqual((r("Basic Chinese"), r("Basic Malay"), r("Basic Tamil")), ("chinese", "malay", "tamil"))
        self.assertEqual(r("Design and Technology Syllabus T"), "design_technology")
        self.assertEqual(r("Design & Technology (Syllabus T)"), "design_technology")

    def test_names_already_read(self):
        r = SUB.resolve_subject
        for name, sid in (("English Language Syllabus A", "english_language"),
                          ("English Language Syllabus T", "english_language"),
                          ("Mathematics Syllabus A", "mathematics"), ("Mathematics Syllabus T", "mathematics"),
                          ("Science Syllabus T", "science_t"), ("Arabic as a 3rd Language", "arabic"),
                          ("Bahasa Indonesia as a 3rd Language", "bahasa_indonesia"), ("Business", "business_studies")):
            self.assertEqual(r(name), sid, name)

    def test_every_seab_row_maps_to_a_subject(self):
        self.assertEqual(SUB.SEAB_ROWS_SKIPPED, [("SEC2027", "Mother Tongue Language Syllabus B (by request)")])
        with open(CSV, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 166)
        for r in rows:
            sid = r["engine_id"] or SUB.resolve_subject(r["subject_seab_name"])
            if r["subject_seab_name"].startswith("Mother Tongue Language Syllabus B"):
                continue
            self.assertIn(r["system"], SUB.SUBJECTS_BY_ID[sid]["levels_by_system"], r["subject_seab_name"])


class TestNewSubjects(unittest.TestCase):
    def test_in_the_catalogue_and_any_slots_only(self):
        for sid in ("elements_business_skills", "retail_operations"):
            s = SUB.SUBJECTS_BY_ID[sid]
            self.assertEqual(s["kind"], "OTHER")
            self.assertEqual(s["levels_by_system"], {"NT2026": ["G1"], "SEC2027": ["G1"]})
            for g, spec in SUB.GROUPS.items():
                self.assertNotIn(sid, spec["members"], g)

    def test_fill_a_best_subject_slot_without_a_problem(self):
        rows = [row("English Language", "B", "N(T)"), row("Mathematics", "C", "N(T)"),
                row("Elements of Business Skills", "A", "N(T)"), row("Retail Operations", "A", "N(T)")]
        r = run("B4(2026)", rows)
        self.assertEqual(r.input_problems, [])
        self.assertEqual(r.gross, 1 + 1 + 2 + 3)
        self.assertIn("elements_business_skills", [s["subject_id"] for s in r.slots])
        no_maths = [x for x in rows if x["subject"] != "Mathematics"] + [row("Art", "B", "N(T)")]
        r = run("MAS1B3(2026)", no_maths)  # not an ITE substitute for Science
        self.assertEqual(r.status, "not_computable")

    def test_basic_chinese_is_the_nt_mother_tongue(self):
        rows = [row("English Language", "B", "N(T)"), row("Mathematics", "C", "N(T)"), row("Basic Chinese", "A", "N(T)"),
                row("Art", "B", "N(T)")]
        r = run("B4(2026)", rows)
        self.assertEqual(r.input_problems, [])
        self.assertIn(("chinese", "G1"), [(s["subject_id"], s["level"]) for s in r.slots])


class TestExaminedLevels(unittest.TestCase):
    def test_wrong_level_is_reported_and_kept(self):
        cases = [
            (sec("Science (Syllabus T)", "3", "G2"), "Science (Syllabus T) is examined at G1 only."),
            (row("Physics", "3", "N(A)"), "Physics is examined at O-Level only."),
            (sec("Bengali", "A", "G1"), "Bengali is examined at G2 and G3 only."),
            (row("Higher Malay", "2", "N(A)"), "Higher Malay is examined at O-Level only."),
            (row("Music", "2", "N(A)"), "Music is examined at O-Level and N(T) only."),
            (row("Computer Applications", "B3", "O"), "Computer Applications is examined at N(T) only."),
            (sec("Elements of Business Skills", "B3", "G3"), "Elements of Business Skills is examined at G1 only."),
            ({"subject": "Combined Science", "level": "N(A)", "grade": "2", "year": 2024},
             "Combined Science was examined at O-Level only."),
            ({"subject": "Physics", "level": "G2", "grade": "2"}, "Physics is examined at G3 only."),
        ]
        for r, text in cases:
            self.assertEqual(problems([r]), [("level", text, "kept as given")], r)
            self.assertEqual(len(check_inputs([r])["entries"]), 1)

    def test_levels_seab_examines_raise_nothing(self):
        ok = [row("Chinese", "2", "N(A)"), row("Chinese", "B", "N(T)"), sec("Chinese", "A", "G1"),
              sec("Physics", "B3", "G3"), row("Art", "A", "N(T)"), sec("Mobile Robotics", "A", "G1"),
              sec("Chinese B", "Merit", "G3"),  # no 'B' Syllabus in SEC lists: no check
              row("Mechanical Design & Automation", "A", "N(T)")]  # not in SEAB's lists: no check
        self.assertEqual(problems(ok), [])

    def test_missing_level_filled_from_seab(self):
        res = check_inputs([{"subject": "Physics", "grade": "B3", "year": 2026},
                            {"subject": "Retail Operations", "grade": "A", "year": 2026},
                            {"subject": "Mathematics", "grade": "A1", "year": 2026}])
        self.assertEqual([(e["subject_id"], e["level"]) for e in res["entries"]],
                         [("physics", "G3"), ("retail_operations", "G1")])
        self.assertEqual(problems([{"subject": "Mathematics", "grade": "A1", "year": 2026}]),
                         [("level", "no level given", "row ignored")])
        self.assertIn("row 1 (Physics): no level given - Physics is examined at O-Level only, so G3 is assumed",
                      res["warnings"])

    def test_sec_year_reads_the_sec_list(self):
        self.assertEqual(problems([sec("Physics", "3", "G2")]), [("level", "Physics is examined at G3 only.",
                                                                  "kept as given")])
        self.assertEqual(problems([sec("Geography", "3", "G2")]), [])


if __name__ == "__main__":
    unittest.main()
