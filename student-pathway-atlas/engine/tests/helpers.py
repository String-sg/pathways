"""Shared test helpers. Every student in these tests is invented; expected values are worked out by hand
from the rule text (never from MOE's worked examples)."""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from engine import compute  # noqa: E402


def source_listed(name):
    """A cited file is in the repo, or is an MOE / ITE / NAFA page listed under Sources in README.md."""
    if os.path.exists(os.path.join(ROOT, name)):
        return True
    with open(os.path.join(ROOT, "README.md"), encoding="utf-8") as f:
        return name.split("/")[-1].replace(".md", "") in f.read()


def row(subject, grade, level="O", year=2026):
    return {"subject": subject, "level": level, "grade": grade, "year": year}


def sec(subject, grade, level="G3", year=2027):
    return {"subject": subject, "level": level, "grade": grade, "year": year}


def run(agg_id, rows, bonus=None):
    return compute(agg_id, rows, bonus)


def picks(result):
    """{slot: (subject_id, grade, points)}"""
    return {s["slot"]: (s["subject_id"], s["grade"], s["points"]) for s in result.slots}


def check(result, check_id):
    for e in result.eligibility:
        if e["id"] == check_id:
            return e
    raise KeyError(check_id)
