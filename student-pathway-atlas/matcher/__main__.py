"""CLI.  python3 -m matcher build                 parse the snapshot -> matcher/requirements.json (+ data findings)
        python3 -m matcher demo [EXERCISE ...]   made-up students: counts per exercise, then the top lines
        python3 -m matcher demo --full           ... every course, with reasons
        python3 -m matcher findings              data findings: PDF vs CourseFinder, fallbacks, unresolved names
        python3 -m matcher json FILE             FILE = {"subjects": [...], "bonus": {...}, "exercises": [...]}
"""

import json
import sys

from engine import ENGINE_VERSION

from .exercises import EXERCISE_IDS, EXERCISES
from .match import MATCHER_VERSION, REQUIREMENTS_FILE, match_report

DEMO_STUDENTS = [
    ("Express student, 2026 O-Levels (made up)", {"cca": "Good"}, ["JAE-2027"], [
        {"subject": "English Language", "level": "O", "grade": "B3", "year": 2026},
        {"subject": "Mathematics", "level": "O", "grade": "B4", "year": 2026},
        {"subject": "Science (Physics, Chemistry)", "level": "O", "grade": "C5", "year": 2026},
        {"subject": "Humanities (Social Studies, Geography)", "level": "O", "grade": "C6", "year": 2026},
        {"subject": "Chinese", "level": "O", "grade": "A2", "year": 2026},
        {"subject": "Principles of Accounts", "level": "O", "grade": "B3", "year": 2026},
        {"subject": "Art", "level": "O", "grade": "A2", "year": 2026},
    ]),
    ("O-Level student with weaker results (made up)", None, ["JAE-2027", "JIE-N-2027"], [
        {"subject": "English Language", "level": "O", "grade": "D7", "year": 2026},
        {"subject": "Mathematics", "level": "O", "grade": "E8", "year": 2026},
        {"subject": "Science (Chemistry, Biology)", "level": "O", "grade": "D7", "year": 2026},
        {"subject": "Humanities (Social Studies, History)", "level": "O", "grade": "C6", "year": 2026},
        {"subject": "Malay", "level": "O", "grade": "B4", "year": 2026},
        {"subject": "Food & Nutrition", "level": "O", "grade": "C5", "year": 2026},
    ]),
    ("N(A) student, 2026 N-Levels (made up)", {"cca": "Excellent"}, ["DPP-2027", "PFP-2027", "JIE-N-2027"], [
        {"subject": "English Language", "level": "N(A)", "grade": "2", "year": 2026},
        {"subject": "Mathematics", "level": "N(A)", "grade": "3", "year": 2026},
        {"subject": "Science (Physics, Chemistry)", "level": "N(A)", "grade": "2", "year": 2026},
        {"subject": "Humanities (Social Studies, Geography)", "level": "N(A)", "grade": "3", "year": 2026},
        {"subject": "Principles of Accounts", "level": "N(A)", "grade": "1", "year": 2026},
        {"subject": "Tamil", "level": "N(A)", "grade": "2", "year": 2026},
    ]),
    ("N(T) student, 2026 N-Levels (made up)", None, ["JIE-N-2027"], [
        {"subject": "English Language", "level": "N(T)", "grade": "C", "year": 2026},
        {"subject": "Mathematics", "level": "N(T)", "grade": "E", "year": 2026},
        {"subject": "Mobile Robotics", "level": "N(T)", "grade": "B", "year": 2026},
        {"subject": "Computer Applications", "level": "N(T)", "grade": "A", "year": 2026},
    ]),
    ("SEC 2027 student, mixed G2 / G3 (made up)", {"cca": "Good"}, ["PSE-2028"], [
        {"subject": "English Language", "level": "G3", "grade": "B3", "year": 2027},
        {"subject": "Mathematics", "level": "G3", "grade": "B4", "year": 2027},
        {"subject": "Science (Physics, Chemistry)", "level": "G3", "grade": "C5", "year": 2027},
        {"subject": "History", "level": "G3", "grade": "C6", "year": 2027},
        {"subject": "Geography", "level": "G2", "grade": "1", "year": 2027},
        {"subject": "Tamil", "level": "G2", "grade": "2", "year": 2027},
    ]),
]

YN = {True: "yes", False: "no", None: "?"}


def _course_line(r):
    score = ("can't be worked out" if r.gross is None else
             ("net %d" % r.net) if r.net is not None else ("gross %d" % r.gross))
    tail = ("2026: %s-%s" % tuple(r.net_range_2026)) if r.net_range_2026 else (r.requirements_note or "2026: -")
    return "  %-3s %-5s %-30.30s %-40.40s %-30s %-20s %s" % (YN[r.eligible], r.course_code, r.institution,
                                                            r.course_name, r.aggregate_display_name, score, tail)


def _why(r):
    bits = []
    for it in r.reasons:
        if not it.get("blocking"):
            continue
        if it["met"] is True and it["kind"] != "mer":
            continue
        if it["kind"] == "mer":
            if it["met"] is True:
                used = []
                for ln in it.get("lines", []):
                    for s in ln.get("satisfied_by", [])[:2]:
                        used.append("%s) %s %s" % (ln["id"], s["subject"], s["grade"]))
                if it.get("alternative_used"):
                    used = [it["alternative_used"]["label"]]
                bits.append("MER met: " + "; ".join(used))
            else:
                bits.append("MER %s: %s" % (YN[it["met"]], it.get("detail", "")))
        else:
            bits.append("%s: %s" % (it["label"], it["detail"]))
    if not bits:
        bits = ["%s: %s" % (it["label"].split(" - or - ")[0], it["detail"]) for it in r.reasons if it.get("blocking")]
    return "        " + " | ".join(bits)[:220]


def demo(exercise_filter=None, full=False):
    for title, bonus, exercises, subjects in DEMO_STUDENTS:
        exs = [e for e in exercises if not exercise_filter or e in exercise_filter]
        if not exs:
            continue
        rep = match_report(subjects, bonus, exs)
        print("=" * 120)
        print(title, "  | exercises:", ", ".join(exs), "| bonus:", bonus or "none")
        for s in subjects:
            print("   %-42s %-5s %-3s %s" % (s["subject"], s["level"], s["grade"], s.get("year", "")))
        for p in rep["input_problems"]:
            print("   INPUT PROBLEM row %d (%s): %s - %s" % (p["row"], p["subject"], p["problem"], p["action"]))
        print("-" * 120)
        print("   %-12s %-34s %7s %8s %7s %8s" % ("exercise", "stream", "courses", "eligible", "unknown", "not elig"))
        for s in rep["summary"]:
            print("   %-12s %-34s %7d %8d %7d %8d" % (s["exercise"], s["stream"], s["courses"], s["eligible"],
                                                   s["unknown"], s["not_eligible"]))
        res = rep["results"]
        groups = []
        for r in res:
            k = (r.exercise, r.stream)
            if not groups or groups[-1][0] != k:
                groups.append((k, []))
            groups[-1][1].append(r)
        for (ex, stream), rows in groups:
            print("\n   %s - %s" % (ex, stream))
            shown = rows if full else ([r for r in rows if r.eligible is True][:3] + [r for r in rows if r.eligible is None][:2]
                                       + [r for r in rows if r.eligible is False][:2])
            for r in shown:
                print(_course_line(r))
                print(_why(r))
        print()


def build():
    from .parse import build as do_build
    data = do_build()
    out = {"matcher_version": MATCHER_VERSION, "engine_version": ENGINE_VERSION,
           "generated_by": "python3 -m matcher build", "snapshot_date": "2026-10-17",
           "sources": {"coursefinder": "data/snapshots/2026-10-17/poly_courses_raw.json, ite_courses_raw.json",
                       "taxonomy": "data/taxonomy/course_taxonomy_2026-10-17.csv",
                       "pdf": "source-pages/pdf__post_secondary_2027_jae_240be16f_8870_4b37_821e_4ae50200285a_pdf.md"},
           "exercises": EXERCISES, "records": data["records"], "findings": data["findings"]}
    write_requirements(out, REQUIREMENTS_FILE)
    return out


def dumps_requirements(out):
    """Compact but diff-friendly: one record / exercise per line."""
    parts = ["{"]
    keys = list(out.keys())
    for i, k in enumerate(keys):
        tail = "," if i < len(keys) - 1 else ""
        v = out[k]
        if k in ("records", "exercises") and isinstance(v, list):
            parts.append(" %s: [" % json.dumps(k))
            for j, item in enumerate(v):
                parts.append("  " + json.dumps(item, ensure_ascii=False, separators=(",", ":"))
                             + ("," if j < len(v) - 1 else ""))
            parts.append(" ]" + tail)
        else:
            parts.append(" %s: %s%s" % (json.dumps(k), json.dumps(v, ensure_ascii=False, separators=(",", ":")), tail))
    parts.append("}")
    return "\n".join(parts) + "\n"


def write_requirements(out, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(dumps_requirements(out))


def findings(data=None):
    if data is None:
        from .parse import build as do_build
        data = do_build()
    F = data["findings"]
    recs = data["records"]
    from collections import Counter
    print("records:", len(recs), dict(Counter("%s/%s" % (r["institution_type"], r["route"]) for r in recs)))
    print("MER status:", dict(Counter("%s:%s" % (r["route"], r["mer"]["status"]) for r in recs)))
    print("unresolved subject names:", F["unresolved_names"] or "none")
    print("unknown MER lines:", len(F["unknown_lines"]))
    for u in F["unknown_lines"]:
        print("   ", u)
    pc = F["pdf_comparison"]
    print("PDF vs CourseFinder (Poly / ITE JAE):", dict(Counter(c["status"] for c in pc)))
    for c in pc:
        for d in c.get("differences", []):
            print("    %-24s line %-4s use %-24s | CourseFinder: %s | PDF: %s" % (c["key"], d["line"], d["use"],
                                                                                d["json"], d["pdf"]))
    print("group-list differences:", len(F["group_list_differences"]))
    print("slot binding problems:", F["slot_binding_problems"] or "none")


def main(argv):
    if argv and argv[0] == "build":
        out = build()
        print("wrote %s (%d records)" % (REQUIREMENTS_FILE, len(out["records"])))
        findings(out)
        return 0
    if argv and argv[0] == "findings":
        findings()
        return 0
    if argv and argv[0] == "demo":
        filt = [a for a in argv[1:] if a in EXERCISE_IDS]
        demo(filt or None, full="--full" in argv)
        return 0
    if len(argv) >= 2 and argv[0] == "json":
        with open(argv[1]) as f:
            data = json.load(f)
        rep = match_report(data.get("subjects", []), data.get("bonus"), data.get("exercises"))
        rep["results"] = [r.to_dict() for r in rep["results"]]
        print(json.dumps(rep, indent=1, ensure_ascii=False))
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
