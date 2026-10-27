"""CLI.  python3 -m engine demo          all aggregates for a few made-up students
        python3 -m engine demo --slots  ... with slot-by-slot picks
        python3 -m engine json FILE     FILE = {"subjects": [...], "bonus": {...}} -> results as JSON
"""

import json
import sys

from .api import compute_all

DEMO_STUDENTS = [
    ("Express student, 2026 O-Levels (HCL, CL in Sec 3)", {"cca": "Excellent"}, [
        {"subject": "English Language", "level": "O", "grade": "A2", "year": 2026},
        {"subject": "Higher Chinese", "level": "O", "grade": "A1", "year": 2026},
        {"subject": "Chinese", "level": "O", "grade": "A2", "year": 2025},
        {"subject": "Mathematics", "level": "O", "grade": "B3", "year": 2026},
        {"subject": "Additional Mathematics", "level": "O", "grade": "C5", "year": 2026},
        {"subject": "Physics", "level": "O", "grade": "C6", "year": 2026},
        {"subject": "Chemistry", "level": "O", "grade": "B4", "year": 2026},
        {"subject": "Humanities (Social Studies, Geography)", "level": "O", "grade": "B3", "year": 2026},
        {"subject": "Principles of Accounts", "level": "O", "grade": "A2", "year": 2026},
    ]),
    ("N(A) student, 2026 N-Levels + one O-Level subject", {"cca": "Good"}, [
        {"subject": "English Language", "level": "N(A)", "grade": "2", "year": 2026},
        {"subject": "Mathematics", "level": "N(A)", "grade": "3", "year": 2026},
        {"subject": "Science (Chemistry, Biology)", "level": "N(A)", "grade": "2", "year": 2026},
        {"subject": "Humanities (Social Studies, History)", "level": "N(A)", "grade": "4", "year": 2026},
        {"subject": "Principles of Accounts", "level": "N(A)", "grade": "1", "year": 2026},
        {"subject": "Malay", "level": "N(A)", "grade": "3", "year": 2026},
        {"subject": "Malay", "level": "O", "grade": "B4", "year": 2026},
    ]),
    ("N(T) student, 2026 N-Levels", None, [
        {"subject": "English Language", "level": "N(T)", "grade": "C", "year": 2026},
        {"subject": "Mathematics", "level": "N(T)", "grade": "B", "year": 2026},
        {"subject": "Science (Syllabus T)", "level": "N(T)", "grade": "D", "year": 2026},
        {"subject": "Mobile Robotics", "level": "N(T)", "grade": "A", "year": 2026},
        {"subject": "Computer Applications", "level": "N(T)", "grade": "B", "year": 2026},
        {"subject": "Tamil", "level": "N(T)", "grade": "E", "year": 2026},
    ]),
    ("SEC 2027 student, mixed G2/G3, O-Level MTL in Sec 3 (2026)", {"cca": "Good", "affiliated_jc": True}, [
        {"subject": "English Language", "level": "G3", "grade": "B3", "year": 2027},
        {"subject": "Tamil", "level": "O", "grade": "A2", "year": 2026},
        {"subject": "Mathematics", "level": "G3", "grade": "B4", "year": 2027},
        {"subject": "Science (Physics, Chemistry)", "level": "G3", "grade": "C5", "year": 2027},
        {"subject": "History", "level": "G3", "grade": "C6", "year": 2027},
        {"subject": "Geography", "level": "G2", "grade": "1", "year": 2027},
        {"subject": "Art", "level": "G2", "grade": "2", "year": 2027},
    ]),
]


def _fmt(v):
    return "-" if v is None else str(v)


def _elig(r):
    marks = []
    for e in r.eligibility:
        if e["met"] is None:
            continue
        marks.append(("Y " if e["met"] else "N ") + e["label"].split(":")[0])
    return "; ".join(marks)


def demo(show_slots=False):
    for title, bonus, subjects in DEMO_STUDENTS:
        print("=" * 100)
        print(title)
        for s in subjects:
            print("   %-42s %-5s %-3s %s" % (s["subject"], s["level"], s["grade"], s.get("year", "")))
        print("   bonus inputs: %s" % (bonus or "none"))
        results = compute_all(subjects, bonus)
        for prob in results[0].input_problems:
            print("   INPUT PROBLEM row %d (%s): %s - %s" % (prob["row"], prob["subject"], prob["problem"], prob["action"]))
        print("-" * 100)
        print("%-22s %-14s %5s %5s %6s  %s" % ("aggregate", "status", "gross", "net", "greedy", "eligibility / reason"))
        for r in results:
            if r.status == "stub":
                continue
            tail = r.not_computable_reason or _elig(r)
            print("%-22s %-14s %5s %5s %6s  %s" % (r.id, r.status, _fmt(r.gross), _fmt(r.net), _fmt(r.greedy_total),
                                                   tail[:120]))
            if show_slots and r.slots:
                print("%22s %s" % ("", ", ".join("%s=%s %s(%d)" % (x["slot"], x["subject"], x["grade"], x["points"])
                                                 for x in r.slots)))
        print()


def main(argv):
    if len(argv) >= 1 and argv[0] == "demo":
        demo(show_slots="--slots" in argv)
        return 0
    if len(argv) >= 2 and argv[0] == "json":
        with open(argv[1]) as f:
            data = json.load(f)
        out = [r.to_dict() for r in compute_all(data.get("subjects", []), data.get("bonus"))]
        print(json.dumps(out, indent=1))
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
