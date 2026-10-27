#!/usr/bin/env python3
"""engine/definitions.json + matcher/requirements.json + the course taxonomy -> app/build/data.json.

    python3 -m engine.export_definitions      # if the engine changed
    python3 -m matcher build                  # if the matcher or the snapshot changed
    python3 app/tools/build_data.py           # -> app/build/data.json (+ the sizes, and a self-check)

data.json = {"definitions": <definitions.json as exported>,
             "requirements": {exercises, mers, notes, records},     <- matcher/requirements.json, trimmed
             "courses": {columns, rows},                            <- one row per course offering (taxonomy row)
             "lep_hosts": [{jc, programme, source, quote, note}]}   <- data/taxonomy/lep_host_jcs.csv (CLEP / MLEP /
                                                                       TLEP host JCs; jc = the courses' JC name)

Trimming keeps exactly what app/src/pse_core.js reads:
  - a requirement record keeps key, route, its course row (`course`), its MER (`mer`, an index into `mers`: 607
    records share 40 distinct MERs), its notes (indexes into `notes`), the matcher's own data flags (`flags`; the
    course row holds the taxonomy flags), is_nursing_diploma and application_requirements (only when present);
  - an MER keeps mode, lines, alternatives, pdf_variant, rule_source, aggregate_id; a line keeps the fields its kind is
    evaluated on (evaluate.py) and drops CourseFinder bookkeeping (field, list_printed, rulings, notes, ...);
  - the course-level fields come from the course row; this script asserts the join gives back every record field.
Before writing, the trimmed data is expanded again and run through the Python matcher for a set of random students:
the results must equal those from the full requirements.json. Standard library only.
"""

import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ROOT = os.path.dirname(APP)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

DEFINITIONS = os.path.join(ROOT, "engine", "definitions.json")
LEP_HOSTS = os.path.join(ROOT, "data", "taxonomy", "lep_host_jcs.csv")
LEP_PROGRAMMES = ("CLEP", "MLEP", "TLEP")
REQUIREMENTS = os.path.join(ROOT, "matcher", "requirements.json")
OUT = os.path.join(APP, "build", "data.json")

# Fields a record takes from its course row (pse_core.js COURSE_FIELDS) and the other taxonomy fields the app may show.
COURSE_FIELDS = ["institution_type", "institution", "course_code", "ite_course_code", "course_name", "field_of_study",
                 "stream", "pfp_cluster", "aggregate_type", "net_range_2026", "moe_url", "institution_url"]
COLUMNS = ["id", "institution_type", "institution", "course_code", "ite_course_code", "course_name", "field_of_study",
           "faculty_or_school", "stream", "pfp_cluster", "pfp_subcluster", "duration", "admission_route",
           "aggregate_type", "net_range_2026", "moe_url", "institution_url", "data_flags", "exercises"]

# MER fields pse_core.js / matcher/evaluate.py read, per line kind.
LINE_KEYS = {
    "subject": ["id", "text", "kind", "count", "options"],
    "any_other": ["id", "text", "kind", "count", "max_grade"],
    "sat_for": ["id", "text", "kind", "subjects"],
    "completed": ["id", "text", "kind", "levels"],
    "slot": ["id", "text", "kind", "slots", "accepts", "max_points"],
    "unknown": ["id", "text", "kind", "unknown_reason"],
}
OPTION_KEYS = ["subjects", "max_grade", "printed"]
MER_KEYS = ["mode", "lines", "alternatives", "pdf_variant", "rule_source", "aggregate_id"]


def dumps(x):
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"))


def size(x):
    return len(dumps(x).encode("utf-8"))


def course_id(row):
    t = row["institution_type"]
    if t == "Polytechnic":
        return "POLY:" + row["course_code"]
    if t == "ITE":
        return "ITE:%s:%s:%s" % (row["admission_route"], row["course_code"], row["institution"].replace("ITE College ", ""))
    return "%s:%s" % (t, row["course_code"])


def net_range(row):
    a, b = row.get("net_agg_min", ""), row.get("net_agg_max", "")
    return None if a == "" or b == "" else [int(a), int(b)]


def course_row(row):
    """A taxonomy row -> the course table's fields (same derivations as matcher/parse.py _base)."""
    return {
        "id": course_id(row), "institution_type": row["institution_type"], "institution": row["institution"],
        "course_code": row["course_code"], "ite_course_code": row.get("ite_course_code", ""),
        "course_name": row["course_name"], "field_of_study": row.get("field_of_study", ""),
        "faculty_or_school": row.get("faculty_or_school", ""), "stream": row.get("stream", ""),
        "pfp_cluster": row.get("pfp_cluster", ""), "pfp_subcluster": row.get("pfp_subcluster", ""),
        "duration": row.get("duration", ""), "admission_route": row.get("admission_route", ""),
        "aggregate_type": row.get("aggregate_type", ""), "net_range_2026": net_range(row),
        "moe_url": row.get("moe_page_url", ""), "institution_url": row.get("course_page_url", ""),
        "data_flags": [f for f in (row.get("data_flags") or "").split(";") if f], "exercises": [],
    }


def find_row(rec, by_poly, by_ite, by_other):
    """The taxonomy row a requirement record was built from (matcher/parse.py _tax_index keys)."""
    t = rec["institution_type"]
    if t == "Polytechnic":
        return by_poly[rec["course_code"]]
    if t == "ITE":
        return by_ite[(rec["course_code"], rec["ite_course_code"], rec["route"], rec["institution"])]
    return by_other[(t, rec["course_code"])]


def trim_line(line):
    out = {k: line[k] for k in LINE_KEYS[line["kind"]] if k in line}
    if "options" in out:
        out["options"] = [{k: o[k] for k in OPTION_KEYS if k in o} for o in out["options"]]
    return out


def trim_mer(mer):
    out = {}
    for k in MER_KEYS:
        if k not in mer:
            continue
        v = mer[k]
        if k == "lines":
            v = [trim_line(l) for l in v]
        elif k == "alternatives":
            v = [{"label": a["label"], "lines": [trim_line(l) for l in a["lines"]], "source": a["source"]} for a in v]
        elif k == "pdf_variant" and v is not None:
            v = [trim_line(l) for l in v]
        out[k] = v
    return out


def lep_hosts(courses):
    """data/taxonomy/lep_host_jcs.csv -> [{jc, programme, source, quote, note}]; every jc must be a JC in the course
    table (spelled the same), so the app can match a JC card to its LEP points."""
    jcs = {c["institution"] for c in courses if c["institution_type"] == "JC"}
    out = []
    with open(LEP_HOSTS, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["jc"] not in jcs:
                raise SystemExit("lep_host_jcs.csv: %r is not a JC name in the course table" % r["jc"])
            if r["programme"] not in LEP_PROGRAMMES:
                raise SystemExit("lep_host_jcs.csv: unknown programme %r" % r["programme"])
            out.append({"jc": r["jc"], "programme": r["programme"], "source": r["source_url"], "quote": r["quote"],
                        "note": r["note"]})
    return out


def build():
    with open(DEFINITIONS, encoding="utf-8") as f:
        defs = json.load(f)
    with open(REQUIREMENTS, encoding="utf-8") as f:
        reqs = json.load(f)
    taxonomy = os.path.join(ROOT, "data", "taxonomy", "course_taxonomy_%s.csv" % reqs["snapshot_date"])
    with open(taxonomy, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    from matcher.exercises import aggregate_for

    courses, by_poly, by_ite, by_other, index = [], {}, {}, {}, {}
    for r in rows:
        c = course_row(r)
        if c["id"] in index:
            raise SystemExit("duplicate course id %s in the taxonomy" % c["id"])
        index[c["id"]] = len(courses)
        courses.append(c)
        if r["institution_type"] == "Polytechnic":
            by_poly[r["course_code"]] = c
        elif r["institution_type"] == "ITE":
            by_ite[(r["course_code"], r["ite_course_code"], r["admission_route"], r["institution"])] = c
        else:
            by_other[(r["institution_type"], r["course_code"])] = c

    mers, mer_index, notes, note_index, records = [], {}, [], {}, []
    for rec in reqs["records"]:
        c = find_row(rec, by_poly, by_ite, by_other)
        for f in COURSE_FIELDS + ["pfp_subcluster", "duration"]:
            if rec.get(f) != c[f]:
                raise SystemExit("%s: %s is %r in requirements.json but %r from the taxonomy" % (rec["key"], f, rec.get(f), c[f]))
        n = len(c["data_flags"])
        if rec["data_flags"][:n] != c["data_flags"]:
            raise SystemExit("%s: data_flags do not start with the taxonomy flags" % rec["key"])
        nurse = c["institution_type"] == "Polytechnic" and c["course_name"].strip() == "Nursing"
        if bool(rec.get("is_nursing_diploma")) != nurse:
            raise SystemExit("%s: is_nursing_diploma differs from the rule" % rec["key"])
        m = trim_mer(rec["mer"])
        mk = json.dumps(m, sort_keys=True)
        if mk not in mer_index:
            mer_index[mk] = len(mers)
            mers.append(m)
        out = {"key": rec["key"], "route": rec["route"], "course": index[c["id"]], "mer": mer_index[mk]}
        ns = []
        for t in rec.get("notes", []):
            if t not in note_index:
                note_index[t] = len(notes)
                notes.append(t)
            ns.append(note_index[t])
        if ns:
            out["notes"] = ns
        if rec["data_flags"][n:]:
            out["flags"] = rec["data_flags"][n:]
        if nurse:
            out["is_nursing_diploma"] = True
        if rec.get("application_requirements"):
            out["application_requirements"] = [dict(a, lines=[trim_line(l) for l in a["lines"]])
                                               for a in rec["application_requirements"]]
        records.append(out)

    # Which exercises list each course offering, under which stream and engine aggregate (the matcher's stream table).
    for ex in reqs["exercises"]:
        for stream in ex["streams"]:
            for rec, slim in zip(reqs["records"], records):
                if rec["institution_type"] in stream["institution_types"] and rec["route"] == stream["route"]:
                    courses[slim["course"]]["exercises"].append([ex["id"], stream["name"], aggregate_for(stream, rec)])

    trimmed = {"matcher_version": reqs["matcher_version"], "engine_version": reqs["engine_version"],
               "snapshot_date": reqs["snapshot_date"], "exercises": reqs["exercises"], "mers": mers, "notes": notes,
               "records": records}
    table = {"columns": COLUMNS, "rows": [[c[k] for k in COLUMNS] for c in courses]}
    data = {"format": "sg-pse-atlas-data/1", "built_by": "app/tools/build_data.py",
            "engine_version": defs["engine_version"], "matcher_version": reqs["matcher_version"],
            "snapshot_date": reqs["snapshot_date"], "definitions": defs, "requirements": trimmed, "courses": table,
            "lep_hosts": lep_hosts(courses)}
    full_compact = {k: v for k, v in reqs.items()}
    sizes = {
        "definitions.json on disk": os.path.getsize(DEFINITIONS), "definitions (compact)": size(defs),
        "requirements.json on disk": os.path.getsize(REQUIREMENTS), "requirements (compact, untrimmed)": size(full_compact),
        "requirements (trimmed)": size(trimmed), "courses table": size(table), "lep_hosts": len(data["lep_hosts"]),
        "data.json": size(data),
        "mers": len(mers), "records": len(records), "notes": len(notes), "courses": len(courses),
    }
    return data, reqs, sizes


def expand(data):
    """The inverse of the trimming (what pse_core.js expandRecords does), for the self-check."""
    cols = data["courses"]["columns"]
    courses = [dict(zip(cols, r)) for r in data["courses"]["rows"]]
    req = data["requirements"]
    records = []
    for r in req["records"]:
        c = courses[r["course"]]
        rec = {"key": r["key"], "route": r["route"]}
        rec.update({k: c[k] for k in COURSE_FIELDS})
        rec["is_nursing_diploma"] = bool(r.get("is_nursing_diploma"))
        rec["mer"] = req["mers"][r["mer"]]
        rec["notes"] = [req["notes"][i] for i in r.get("notes", [])]
        rec["data_flags"] = c["data_flags"] + r.get("flags", [])
        if r.get("application_requirements"):
            rec["application_requirements"] = r["application_requirements"]
        records.append(rec)
    return {"records": records, "exercises": req["exercises"]}


def self_check(data, reqs, n=40):
    from matcher import match
    import parity
    slim = expand(data)
    for i in range(n):
        _, subjects, bonus, _ = parity.student(7, i * 13)
        a = [r.to_dict() for r in match(subjects, bonus, requirements=reqs)]
        b = [r.to_dict() for r in match(subjects, bonus, requirements=slim)]
        if a != b:
            raise SystemExit("self-check failed: the trimmed data changes the matcher's results (student %d)" % (i * 13))
    return n


def main():
    data, reqs, sizes = build()
    checked = self_check(data, reqs)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(dumps(data))
    for k, v in sizes.items():
        print("%-36s %s" % (k, "{:,}".format(v)))
    print("self-check: trimmed data gives the same matcher results on %d random students" % checked)
    print("wrote %s" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
