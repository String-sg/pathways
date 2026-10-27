"""See README.md."""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from engine.engine import prepare_entries  # noqa: E402
from matcher import load_requirements, match  # noqa: E402


def o(subject, grade, year=2026):
    return {"subject": subject, "level": "O", "grade": grade, "year": year}


def na(subject, grade, year=2026):
    return {"subject": subject, "level": "N(A)", "grade": grade, "year": year}


def nt(subject, grade, year=2026):
    return {"subject": subject, "level": "N(T)", "grade": grade, "year": year}


def sec(subject, grade, level="G3", year=2027):
    return {"subject": subject, "level": level, "grade": grade, "year": year}


def entries(rows):
    return prepare_entries(rows)[0]


_REC = {}


def record(key):
    if not _REC:
        for r in load_requirements()["records"]:
            _REC[r["key"]] = r
    return _REC[key]


def result_for(rows, exercise, key, bonus=None):
    for r in match(rows, bonus, [exercise]):
        if r.requirement_key == key:
            return r
    raise KeyError(key)


def reason(res, rid):
    for it in res.reasons:
        if it["id"] == rid:
            return it
    raise KeyError(rid)


def mer(res):
    return reason(res, "mer")


def line(item, lid):
    for ln in item["lines"]:
        if ln["id"] == lid:
            return ln
    raise KeyError(lid)
