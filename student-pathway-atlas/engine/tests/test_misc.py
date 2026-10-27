"""Input handling, stubs, compute_all shape."""

import json
import unittest

from engine import compute_all
from engine.definitions import DEFINITIONS
from helpers import row, run


class TestInputs(unittest.TestCase):
    def test_unknown_subject_only_fills_any_slot(self):
        rows = [row("English Language", "A1", "N(T)"), row("Underwater Basket Weaving", "A", "N(T)"),
                row("Mathematics", "B", "N(T)"), row("Art", "C", "N(T)")]
        self.assertEqual(run("B4(2026)", rows).status, "not_computable")  # EL "A1" at N(T) unreadable: 3 subjects left
        rows[0] = row("English Language", "A", "N(T)")
        r = run("B4(2026)", rows)
        self.assertEqual(r.gross, 1 + 1 + 2 + 3)
        self.assertTrue(any(p["problem"] == "subject not in the catalogue" for p in r.input_problems))
        self.assertIn("unknown:underwater basket weaving", [s["subject_id"] for s in r.slots])

    def test_marks_converted_with_warning(self):
        rows = [{"subject": "English Language", "level": "O", "mark": 72, "year": 2026},
                row("Mathematics", "A1"), row("Art", "A1"), row("History", "A1"), row("Biology", "A1")]
        r = run("ELB4-A(2026)", rows)
        self.assertEqual(r.slots[0]["grade"], "A2")
        self.assertTrue(any("usual school mark bands" in w for w in r.warnings))

    def test_bad_rows_ignored(self):
        rows = [row("English Language", "A1"), {"subject": "Mathematics", "level": "IB", "grade": "7"},
                {"subject": "Art", "level": "O", "grade": "Z9"}]
        r = run("ELB4-A(2026)", rows)
        self.assertEqual([p["field"] for p in r.input_problems if p["action"] == "row ignored"], ["level", "grade"])

    def test_string_years(self):
        rows = [dict(row("English Language", "A1"), year="2026"), row("Mathematics", "A1"), row("Art", "A1"),
                row("History", "A1"), row("Biology", "A1")]
        self.assertEqual(run("ELB4-A(2026)", rows).gross, 5)


class TestStubsAndShape(unittest.TestCase):
    def test_stubs(self):
        r = run("EMB1", [row("English Language", "A1")])
        self.assertEqual(r.status, "stub")
        self.assertIn("rule source missing", r.not_computable_reason)
        self.assertEqual([d["id"] for d in DEFINITIONS if d["status"] == "stub"], ["EMB1"])

    def test_compute_all_is_json_serialisable(self):
        rows = [row("English Language", "A1"), row("Mathematics", "A2"), row("History", "B3"), row("Physics", "B4"),
                row("Chemistry", "C5"), row("Chinese", "A1")]
        out = compute_all(rows, {"cca": "Good"})
        ids = [r.id for r in out]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ids[-1], "5TH-YEAR(2027)")
        json.dumps([r.to_dict() for r in out])

    def test_empty_input(self):
        out = compute_all([])
        self.assertTrue(all(r.status in ("not_applicable", "stub", "summary") for r in out))


if __name__ == "__main__":
    unittest.main()
