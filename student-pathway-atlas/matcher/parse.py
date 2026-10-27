"""Snapshot -> requirement records (one per course offering per 2026 admission route).

Inputs (local files only):
  data/snapshots/2026-10-17/poly_courses_raw.json   courses[].course_entry_requirement{1,2,3}_{name,grade},
                                                    ..._multiple_{description,grade,list}, ..._note, PFP fields
  data/snapshots/2026-10-17/ite_courses_raw.json    courses[].course_group[].moe_course_group_ite_id.<same fields>
  data/taxonomy/course_taxonomy_2026-10-17.csv      one row per offering: URLs, net range, field, flags
  the consolidated MER PDF text (matcher.pdf_mer)   fallback + cross-check for Poly / ITE JAE

A record's `mer.lines` is the course's minimum entry requirement as data:
  kind subject    one subject from `options[].subjects` at `max_grade` (per level) or better
  kind any_other  `count` other subjects at `max_grade` or better
  kind sat_for    must have sat one of `subjects` (any grade except Absent); uses no subject slot
  kind completed  has results at one of `levels`
  kind slot       (mode "slots": JIE 'H' / PFP) the line binds aggregate slots `slots` with `max_points`, `accepts`
  kind unknown    unreadable in every source -> the course's eligibility is unknown, `unknown_reason` says why
"""

import csv
import html
import json
import os
import re
from collections import Counter, OrderedDict

from engine import grades as GR
from engine import subjects as SUB
from engine.definitions import DEFINITIONS_BY_ID

from . import names as N
from . import pdf_mer
from .exercises import COURSE_REQUIREMENTS, PROGRESSION_NOTE

SNAPSHOT_DATE = "2026-10-17"
SNAP_DIR = "data/snapshots/%s/" % SNAPSHOT_DATE
TAXONOMY = "data/taxonomy/course_taxonomy_%s.csv" % SNAPSHOT_DATE
RB = "source-pages/"

SRC_JIEN_PDF = {"file": RB + "ite__jie_aggregates.md", "heading": "1.2 Which courses have which prerequisite group"}
SRC_POLY_JAE = {"file": RB + "post_secondary_admissions_jae_polytechnics.md", "heading": "Admission matters, criterion 2"}
SRC_ITE_JAE = {"file": RB + "post_secondary_admissions_jae_institute_of_technical_education.md",
               "heading": "Admission matters, criterion 2"}
SRC_PFP = {"file": RB + "post_secondary_admissions_pfp_eligibility_criteria.md", "heading": "Eligibility criteria"}
SRC_DPP = {"file": RB + "post_secondary_admissions_dpp_eligibility_criteria.md", "heading": "Eligibility criteria"}
READING_EARLIER = {
    "note": "earlier O-Level subjects of the same MOE category count, as in the aggregate's slot",
    "source": {"file": "README.md",
               "heading": "Assumptions: Rules MOE leaves unclear (Earlier O-Level subjects: \"Yes\")"},
}
READING_JIEN_MATHS = {
    "note": "'Mathematics' includes Additional Mathematics",
    "source": {"file": "README.md",
               "heading": "Assumptions: Rules MOE leaves unclear (JIE 'N' Mathematics / Science: \"yes\")"},
}

PFP_CLUSTER_GROUP = {
    "Sciences": "PFP_REL_SCI",
    "Design, Engineering and Technology": "PFP_REL_SCI",
    "Humanities, Arts, Media and Business": "PFP_REL_HUM",
}


def root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _p(rel):
    return os.path.join(root(), rel)


def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    return " ".join(html.unescape(s).split())


def _rname(x):
    return x["requirement_name"] if x else None


def _list_names(lst):
    return [x["moe_course_requirement_id"]["requirement_name"] for x in lst or []]


# --------------------------------------------------------------------------------------------- line parsing
def _unknown(letter, field, text, reason, **extra):
    d = {"id": letter, "field": field, "text": text, "kind": "unknown", "unknown_reason": reason}
    d.update(extra)
    return d


def _label(name, grade):
    return ("%s (%s)" % (name, grade)) if grade else (name or "")


def parse_line(letter, field, name, grade, lst, scheme, institution_type, findings):
    """One printed MER line -> a line dict. scheme: 'O' (JAE O-Level), 'N' (JIE 'N'), 'NA' (JIE 'H' / PFP)."""
    text = _label(name, grade)
    raw = N.clean(name)
    if not raw:
        return _unknown(letter, field, text, "no subject name in the data (grade %r given)" % grade)
    ranges = N.parse_grade_ranges(grade) if grade and grade.strip() != "-" else None

    if N.COMPLETED.match(raw):
        return {"id": letter, "field": field, "text": text, "kind": "completed", "levels": ["G1", "G2"],
                "label": "Completed GCE N-Level"}

    def grade_bits(rngs):
        """-> (dict to merge into the line / option, problem)"""
        if rngs is None:
            return None, "unreadable grade notation %r" % grade
        if scheme == "NA":
            mp = N.max_points(rngs)
            return ({"max_points": mp}, None) if mp else (None, "unreadable grade notation %r" % grade)
        pred, prob = N.grade_predicate(rngs, scheme)
        if prob:
            if scheme == "O" and any(k == "let" for k, _, _ in rngs):
                prob = "N-Level notation %r on an O-Level (JAE) course" % grade
            return None, prob
        return {"max_grade": pred}, None

    m = N.ANY_OTHER.match(raw)
    if m:
        bits, prob = grade_bits(ranges)
        if prob:
            return _unknown(letter, field, text, prob)
        d = {"id": letter, "field": field, "text": text, "kind": "any_other", "count": N.NUM[m.group(1).lower()]}
        d.update(bits)
        return d

    gm = N.GROUP_PHRASE.search(raw)
    if gm or N.FOLLOWING.match(raw):
        bits, prob = grade_bits(ranges)
        if prob:
            return _unknown(letter, field, text, prob)
        line = {"id": letter, "field": field, "text": text, "kind": "subject", "count": 1, "notes": []}
        group = N.group_for_phrase(gm.group(1), gm.group(2), institution_type) if gm else None
        if gm and group is None:
            return _unknown(letter, field, text, "no %s group list for %s" % (gm.group(2), institution_type))
        ids = []
        if lst:
            ids, unresolved, notes = N.resolve_list(lst)
            for u in unresolved:
                findings["unresolved_names"][u] += 1
            line["notes"].extend(notes)
            line["list_printed"] = list(lst)
            if unresolved:
                line["unresolved"] = unresolved
            if group:
                gset = set(SUB.group_members(group))
                if set(ids) != gset:
                    line["differs_from_group"] = {"group": group,
                                                  "missing_from_course_list": sorted(gset - set(ids)),
                                                  "extra_in_course_list": sorted(set(ids) - gset)}
        if group:
            # A line that names the aggregate type's group accepts exactly what the engine's slot accepts: the printed
            # group plus earlier O-Level subjects of the same MOE category.
            members = list(SUB.slot_members(group))
            opt = {"subjects": members, "groups": [group]}
            line["group"] = group
            added = [m for m in members if m not in set(SUB.group_members(group))]
            if added:
                line["earlier_subjects_added"] = added
                line["notes"].append(READING_EARLIER["note"])
                line["rulings"] = [READING_EARLIER["source"]]
            if not lst:
                line["notes"].append("no subject list in the data: the %s group from MOE's aggregate-type PDF is used "
                                     "(engine group %s)" % (gm.group(2), group))
                line["list_from_group"] = group
        elif ids:
            opt = {"subjects": ids, "groups": []}  # the course's own list, read literally
        elif lst:
            return _unknown(letter, field, text, "no subject in the list could be resolved", unresolved=line.get("unresolved"))
        else:
            return _unknown(letter, field, text, "'%s' with no subject list in the data" % raw)
        opt.update(bits)
        line["options"] = [opt]
        return line

    # Named subjects ("English Language", "Additional Mathematics or Mathematics", "Higher Chinese or Chinese").
    res = N.resolve_name(raw)
    for u in res["unresolved"]:
        findings["unresolved_names"][u] += 1
    if not res["subjects"] and not res["groups"]:
        return _unknown(letter, field, text, "subject name not in the engine catalogue: %s" % raw,
                        unresolved=res["unresolved"])
    if ranges is None:
        return _unknown(letter, field, text, "unreadable grade notation %r" % grade)
    line = {"id": letter, "field": field, "text": text, "kind": "subject", "count": 1, "notes": list(res["notes"])}
    if res["unresolved"]:
        line["unresolved"] = res["unresolved"]
    if scheme == "N" and "mathematics" in res["subjects"] and "ITE_MATHEMATICS" not in res["groups"]:
        res["groups"].append("ITE_MATHEMATICS")
        line["notes"].append(READING_JIEN_MATHS["note"])
        line["rulings"] = [READING_JIEN_MATHS["source"]]
    multi_scheme_ranges = scheme == "N" or len(ranges) == 1
    if multi_scheme_ranges:
        bits, prob = grade_bits(ranges)
        if prob:
            return _unknown(letter, field, text, prob)
        opt = {"subjects": N.expand_ids(res["subjects"], res["groups"]), "groups": list(res["groups"])}
        opt.update(bits)
        line["options"] = [opt]
        return line
    # Two or more ranges on an O-Level / N(A) course: pair them with the printed alternatives, in order.
    parts = [p for p in res["parts"] if p["subjects"] or p["groups"]]
    if len(parts) != len(ranges):
        return _unknown(letter, field, text, "%d grade ranges for %d subjects" % (len(ranges), len(parts)))
    opts = []
    for p, r in zip(parts, ranges):
        bits, prob = grade_bits([r])
        if prob:
            return _unknown(letter, field, text, prob)
        opt = {"subjects": N.expand_ids(p["subjects"], p["groups"]), "groups": list(p["groups"]), "printed": p["text"]}
        opt.update(bits)
        opts.append(opt)
    line["options"] = opts
    line["notes"].append("grades pair with the subjects in printed order (README, grade notation)")
    return line


def sat_for_line(note, field="note"):
    m = N.SAT_FOR.search(note or "")
    if not m:
        return None
    res = N.resolve_name(m.group(1))
    ids = N.expand_ids(res["subjects"], res["groups"])
    if not ids:
        return _unknown("sat", field, note, "subject in the 'sat for' note not in the catalogue")
    return {"id": "sat", "field": field, "text": note.strip(), "kind": "sat_for", "subjects": ids,
            "notes": list(res["notes"])}


def signature(line):
    k = line["kind"]
    if k == "subject":
        return ("subject", frozenset((frozenset(o["subjects"]),
                                      tuple(sorted((o.get("max_grade") or {}).items())), o.get("max_points"))
                                     for o in line["options"]))
    if k == "any_other":
        return ("any_other", line["count"], tuple(sorted((line.get("max_grade") or {}).items())),
                line.get("max_points"))
    if k == "sat_for":
        return ("sat_for", frozenset(line["subjects"]))
    if k == "completed":
        return ("completed", tuple(line["levels"]))
    return ("unknown",)


# --------------------------------------------------------------------------------------------- PDF merge
def pdf_lines(prec, institution_type, findings):
    out, letters = [], iter("abcdefgh")
    for pl in prec["lines"]:
        grade = " or ".join(pl["grades"])
        out.append(parse_line(next(letters), "pdf:%s)" % pl["letter"], pl["name"], grade, pl["bullets"], "O",
                              institution_type, findings))
    sats = [sat_for_line(n, "pdf:note") for n in prec["notes"] if N.SAT_FOR.search(n)]
    out.extend(s for s in sats if s)
    return out


def merge_with_pdf(code, json_lines, prec, institution_type, findings):
    """-> (lines, pdf_variant or None, flags, comparison dict)."""
    if prec is None:
        return json_lines, None, ["mer_not_in_pdf"], {"status": "not_in_pdf"}
    plines = pdf_lines(prec, institution_type, findings)
    j_main = [l for l in json_lines if l["kind"] != "sat_for"]
    p_main = [l for l in plines if l["kind"] != "sat_for"]
    j_sat = {signature(l) for l in json_lines if l["kind"] == "sat_for"}
    p_sat = {signature(l) for l in plines if l["kind"] == "sat_for"}
    flags, diffs = [], []
    merged = []
    if len(j_main) == len(p_main):
        for jl, pl in zip(j_main, p_main):
            if jl["kind"] == "unknown" and pl["kind"] != "unknown":
                pl2 = dict(pl, id=jl["id"], replaced_json=jl["text"], replaced_reason=jl["unknown_reason"])
                merged.append(pl2)
                flags.append("mer_line_from_pdf")
                diffs.append({"line": jl["id"], "json": jl["text"], "pdf": pl["text"], "use": "pdf (json unreadable)"})
            elif jl["kind"] != "unknown" and pl["kind"] != "unknown" and signature(jl) != signature(pl):
                merged.append(jl)
                diffs.append({"line": jl["id"], "json": jl["text"], "pdf": pl["text"], "use": "both readings"})
            else:
                merged.append(jl)
    else:
        merged = list(j_main)
        diffs.append({"line": "*", "json": "; ".join(l["text"] for l in j_main),
                      "pdf": "; ".join(l["text"] for l in p_main), "use": "both readings"})
    if j_sat != p_sat:
        diffs.append({"line": "sat", "json": "; ".join(l["text"] for l in json_lines if l["kind"] == "sat_for") or "-",
                      "pdf": "; ".join(l["text"] for l in plines if l["kind"] == "sat_for") or "-",
                      "use": "both readings"})
    merged_full = merged + [l for l in json_lines if l["kind"] == "sat_for"]
    variant = None
    if any(d["use"] == "both readings" for d in diffs):
        if any(l["kind"] == "unknown" for l in p_main):
            variant = None
            flags.append("mer_pdf_unreadable")
        else:
            variant = [dict(l, id=l["id"]) for l in plines]
            flags.append("mer_json_pdf_differ")
    comp = {"status": "agree" if not diffs else "differ", "pdf_page": prec["page"], "pdf_cell": prec["how"],
            "differences": diffs}
    return merged_full, variant, flags, comp


# --------------------------------------------------------------------------------------------- slot binding
def bind_slots(lines, agg_id):
    """JIE 'H' / PFP: map parsed lines onto the aggregate's slots (EL, MA, B1..). Returns (lines, problem)."""
    defn = DEFINITIONS_BY_ID[agg_id]
    slot_names = [s["name"] for s in defn["slots"]]
    b_slots = [s for s in slot_names if s.startswith("B")]
    out, bi = [], 0
    for ln in lines:
        if ln["kind"] == "unknown":
            out.append(ln)
            continue
        if ln["kind"] == "subject":
            opt = ln["options"][0]
            ids = set(opt["subjects"])
            if ids == {"english_language"} and "EL" in slot_names:
                slots = ["EL"]
            elif ids and ids <= {"mathematics", "additional_mathematics"} and "MA" in slot_names:
                slots = ["MA"]
            else:
                slots = b_slots[bi:bi + 1]
                bi += 1
            accepts = sorted(ids)
            mp = opt.get("max_points")
        elif ln["kind"] == "any_other":
            slots = b_slots[bi:bi + ln["count"]]
            bi += ln["count"]
            accepts = None
            mp = ln.get("max_points")
        else:
            return lines, "line kind %s cannot bind an aggregate slot" % ln["kind"]
        if not slots or len(slots) != (ln.get("count") or 1) or mp is None:
            return lines, "more MER lines than %s slots" % agg_id
        d = dict(ln, kind="slot", slots=slots, accepts=accepts, max_points=mp, printed_kind=ln["kind"])
        out.append(d)
    used = [s for l in out if l["kind"] == "slot" for s in l["slots"]]
    if sorted(used) != sorted(slot_names):
        return lines, "MER lines cover slots %s, %s has %s" % (used, agg_id, slot_names)
    return out, None


# --------------------------------------------------------------------------------------------- records
def _tax_index(rows):
    poly, ite, jc = {}, {}, []
    for r in rows:
        if r["institution_type"] == "Polytechnic":
            poly[r["course_code"]] = r
        elif r["institution_type"] == "ITE":
            ite[(r["course_code"], r["ite_course_code"], r["admission_route"], r["institution"])] = r
        else:
            jc.append(r)
    return poly, ite, jc


def _range(trow):
    a, b = trow.get("net_agg_min", ""), trow.get("net_agg_max", "")
    if a == "" or b == "":
        return None
    return [int(a), int(b)]


def _base(trow, route, key):
    flags = [f for f in (trow.get("data_flags") or "").split(";") if f]
    notes = []
    if trow.get("forward_note"):
        notes.append(trow["forward_note"])
    return OrderedDict([
        ("key", key), ("route", route), ("institution_type", trow["institution_type"]),
        ("institution", trow["institution"]), ("course_code", trow["course_code"]),
        ("ite_course_code", trow.get("ite_course_code", "")), ("course_name", trow["course_name"]),
        ("field_of_study", trow.get("field_of_study", "")), ("stream", trow.get("stream", "")),
        ("pfp_cluster", trow.get("pfp_cluster", "")), ("pfp_subcluster", trow.get("pfp_subcluster", "")),
        ("duration", trow.get("duration", "")), ("aggregate_type", trow.get("aggregate_type", "")),
        ("net_range_2026", _range(trow)), ("moe_url", trow.get("moe_page_url", "")),
        ("institution_url", trow.get("course_page_url", "")),
        ("is_nursing_diploma", trow["institution_type"] == "Polytechnic" and trow["course_name"].strip() == "Nursing"),
        ("mer", None), ("notes", notes), ("data_flags", flags),
    ])


def _jae_lines(src, institution_type, findings, scheme="O"):
    """CourseFinder fields (poly course or ITE course group) -> (lines, other notes)."""
    lines, letters, other = [], iter("abcdefgh"), []
    for i in (1, 2, 3):
        nm, gr = src.get("course_entry_requirement%d_name" % i), src.get("course_entry_requirement%d_grade" % i)
        if nm is None and not (gr or "").strip():
            continue
        lines.append(parse_line(next(letters), "course_entry_requirement%d" % i, _rname(nm), gr, None, scheme,
                                institution_type, findings))
    desc = src.get("course_entry_requirement_multiple_description") or ""
    lst = _list_names(src.get("course_entry_requirement_multiple_list"))
    if desc.strip() or lst:
        lines.append(parse_line(next(letters), "course_entry_requirement_multiple", desc,
                                src.get("course_entry_requirement_multiple_grade"), lst, scheme, institution_type,
                                findings))
    note = strip_html(src.get("course_entry_requirement_note"))
    if note:
        s = sat_for_line(note, "course_entry_requirement_note")
        if s:
            lines.append(s)
        elif "in lieu of Science" in note:
            for ln in lines:
                if ln["kind"] == "subject" and any("ITE_SCIENCE_SUBSTITUTES" in o.get("groups", []) for o in ln["options"]):
                    ln.setdefault("notes", []).append("data note: " + note)
        else:
            other.append(note)
    return lines, other


def _scores(req):
    """COURSE_REQUIREMENTS `one_of` -> [(level, subject_id, grade, printed text)] via the engine's own readers."""
    out = []
    for level, name, grade in req["one_of"]:
        sid, lv = SUB.resolve_subject(name), GR.normalise_level(level)
        g = GR.normalise_grade(lv, grade)
        if sid is None or lv is None or g is None:
            raise ValueError("COURSE_REQUIREMENTS: cannot read %r" % ([level, name, grade],))
        out.append((lv, sid, g, "Grade %s for %s %s" % (grade, level, name), name))
    return out


def _one_of_text(scores):
    texts = [s[3] for s in scores]
    return ", ".join(texts[:-1]) + " or " + texts[-1] if len(texts) > 1 else texts[0]


def application_requirement(req):
    """kind "application" -> a requirement record: one MER-style subject line, any one printed score meets it."""
    scores = _scores(req)
    options = [{"subjects": [sid], "groups": [], "max_grade": {lv: g}, "printed": name} for lv, sid, g, _, name in scores]
    line = {"id": "a", "text": _one_of_text(scores), "kind": "subject", "count": 1, "options": options}
    return OrderedDict([("id", req["id"]), ("label", req["label"]), ("lines", [line]), ("source", req["source"]),
                        ("decision", req["decision"])])


def progression_note(req):
    return PROGRESSION_NOTE + "one of " + _one_of_text(_scores(req)) + "."


def course_requirements(route, code):
    return [r for r in COURSE_REQUIREMENTS if r["route"] == route and code in r["course_codes"]]


def _mer_status(lines, extra_flags):
    if any(l["kind"] == "unknown" for l in lines):
        return "unknown"
    if "mer_line_from_pdf" in extra_flags:
        return "parsed_with_pdf_fallback"
    return "parsed"


def build(pdf=None):
    """-> dict(records=[...], findings={...}). Reads local files only."""
    with open(_p(TAXONOMY), encoding="utf-8-sig", newline="") as f:
        tax_rows = list(csv.DictReader(f))
    with open(_p(SNAP_DIR + "poly_courses_raw.json"), encoding="utf-8") as f:
        poly_raw = json.load(f)["courses"]
    with open(_p(SNAP_DIR + "ite_courses_raw.json"), encoding="utf-8") as f:
        ite_raw = json.load(f)["courses"]
    pdf = pdf if pdf is not None else pdf_mer.load()
    tpoly, tite, tjc = _tax_index(tax_rows)
    findings = {"unresolved_names": Counter(), "pdf_comparison": [], "group_list_differences": [],
                "unknown_lines": [], "slot_binding_problems": []}
    records = []

    for c in poly_raw:
        trow = tpoly[c["course_code"]]
        routes = (trow["admission_routes_all"] or "").split("|")
        special = strip_html(c.get("course_special_requirement_note"))
        remarks = strip_html(c.get("course_remarks"))
        if "JAE" in routes:
            rec = _base(trow, "JAE", "POLY:JAE:" + c["course_code"])
            lines, other = _jae_lines(c, "Polytechnic", findings)
            lines, variant, flags, comp = merge_with_pdf(c["course_code"], lines, pdf.get(c["course_code"]),
                                                         "Polytechnic", findings)
            findings["pdf_comparison"].append(dict(key=rec["key"], **comp))
            rec["data_flags"].extend(flags)
            rec["mer"] = {"mode": "independent", "lines": lines, "alternatives": [], "pdf_variant": variant,
                          "status": _mer_status(lines, flags), "source": "coursefinder_json",
                          "pdf_check": comp["status"], "rule_source": SRC_POLY_JAE}
            rec["notes"].extend([special] if special else [])
            rec["notes"].extend(other)
            if remarks and remarks not in rec["notes"]:
                rec["notes"].append(remarks)
            records.append(rec)
        if "PFP" in routes:
            rec = _base(trow, "PFP", "POLY:PFP:" + c["course_code"])
            lines = []
            lines.append(parse_line("a", "course_pfp_entryRequirement1", _rname(c.get("course_pfp_entryRequirement1_name")),
                                    c.get("course_pfp_entry_requirement1_grade"), None, "NA", "Polytechnic", findings))
            lines.append(parse_line("b", "course_pfp_entry_requirement2", _rname(c.get("course_pfp_entry_requirement2_name")),
                                    c.get("course_pfp_entry_requirement2_grade"), None, "NA", "Polytechnic", findings))
            l1 = _list_names(c.get("course_pfp_entry_requirement_multiple_list_1"))
            desc1 = c.get("course_pfp_entry_requirement_multiple_description_1") or ""
            flags = []
            if not l1:
                grp = PFP_CLUSTER_GROUP.get(trow["pfp_cluster"])
                if grp:
                    l1 = [SUB.SUBJECTS_BY_ID[s]["name"] for s in SUB.group_members(grp)]
                    flags.append("pfp_list_from_cluster")
            ln = parse_line("c", "course_pfp_entry_requirement_multiple_1", desc1,
                            c.get("course_pfp_entry_requirement_multiple_grade_1"), l1, "NA", "Polytechnic", findings)
            if "pfp_list_from_cluster" in flags and ln["kind"] == "subject":
                ln.setdefault("notes", []).append("no relevant-subject list in the data: the %s cluster list on MOE's "
                                                  "PFP page is used" % trow["pfp_cluster"])
            lines.append(ln)
            lines.append(parse_line("d", "course_pfp_entry_requirement_multiple_2",
                                    c.get("course_pfp_entry_requirement_multiple_description_2"),
                                    c.get("course_pfp_entry_requirement_multiple_grade_2"),
                                    _list_names(c.get("course_pfp_entry_requirement_multiple_list_2")), "NA",
                                    "Polytechnic", findings))
            bound, prob = bind_slots(lines, "ELMAB3:PFP(2026)")
            if prob:
                findings["slot_binding_problems"].append({"key": rec["key"], "problem": prob})
                bound = [_unknown("*", "pfp", "; ".join(l["text"] for l in lines), prob)]
            rec["data_flags"].extend(flags)
            rec["mer"] = {"mode": "slots", "aggregate_id": "ELMAB3:PFP(2026)", "lines": bound, "alternatives": [],
                          "pdf_variant": None, "status": _mer_status(bound, flags), "source": "coursefinder_json",
                          "pdf_check": "n/a", "rule_source": SRC_PFP}
            if special:
                rec["notes"].append(special)
            extra = course_requirements("PFP", c["course_code"])
            apps = [application_requirement(r) for r in extra if r["kind"] == "application"]
            progs = [progression_note(r) for r in extra if r["kind"] == "progression"]
            if apps:
                rec["application_requirements"] = apps
            if progs:
                rec["notes"].extend(progs)
            elif trow.get("pfp_additional_requirement") and not apps:
                # (with an application requirement the gate already shows the same scores)
                rec["notes"].append(PROGRESSION_NOTE + trow["pfp_additional_requirement"])
            records.append(rec)

    for c in ite_raw:
        for g in c["course_group"]:
            G = g["moe_course_group_ite_id"]
            route = G["course_main_admission"]["admission_code"]
            agg = G["course_aggregate_type"]["aggregate_type_name"]
            special = strip_html(G.get("course_special_requirement_note"))
            for o in G["moe_course_individual_ite_id"]:
                college = o["course_institution"]["brief_school_name"]
                trow = tite[(o["course_code"], o["course_code_for_ite"], route, college)]
                key = "ITE:%s:%s:%s" % (route, o["course_code"], college.replace("ITE College ", ""))
                rec = _base(trow, route, key)
                if route == "JAE":
                    lines, other = _jae_lines(G, "ITE", findings)
                    lines, variant, flags, comp = merge_with_pdf(o["course_code"], lines, pdf.get(o["course_code"]),
                                                                 "ITE", findings)
                    findings["pdf_comparison"].append(dict(key=key, **comp))
                    rec["data_flags"].extend(flags)
                    rec["mer"] = {"mode": "independent", "lines": lines, "alternatives": [], "pdf_variant": variant,
                                  "status": _mer_status(lines, flags), "source": "coursefinder_json",
                                  "pdf_check": comp["status"], "rule_source": SRC_ITE_JAE}
                elif route == "JIEH":
                    lines, other = _jae_lines(G, "ITE", findings, scheme="NA")
                    bound, prob = bind_slots(lines, "ELMAB3:DPP(2026)")
                    if prob:
                        findings["slot_binding_problems"].append({"key": key, "problem": prob})
                        bound = [_unknown("*", "jieh", "; ".join(l["text"] for l in lines), prob)]
                    rec["mer"] = {"mode": "slots", "aggregate_id": "ELMAB3:DPP(2026)", "lines": bound,
                                  "alternatives": [], "pdf_variant": None, "status": _mer_status(bound, []),
                                  "source": "coursefinder_json", "pdf_check": "n/a", "rule_source": SRC_DPP}
                else:  # JIEN
                    lines, other = _jae_lines(G, "ITE", findings, scheme="N")
                    if any(l["kind"] == "completed" for l in lines):
                        alt = [{"id": "a", "field": "ITE JIE 'N' PDF", "text": "Completed GCE 'O' Level",
                                "kind": "completed", "levels": ["G3"], "label": "Completed GCE O-Level"}]
                        alt_label = "Or completed GCE O-Level"
                    else:
                        alt = [{"id": "a", "field": "ITE JIE 'N' PDF", "text": "2 GCE 'O' Grades (Grade 1-8) in any two subjects",
                                "kind": "any_other", "count": 2, "max_grade": {"G3": "E8"}}]
                        alt_label = "Or 2 GCE O-Level grades (1-8) in any two subjects"
                    rec["mer"] = {"mode": "independent", "lines": lines,
                                  "alternatives": [{"label": alt_label, "lines": alt, "source": SRC_JIEN_PDF}],
                                  "pdf_variant": None, "status": _mer_status(lines, []),
                                  "source": "coursefinder_json", "pdf_check": "n/a", "rule_source": SRC_JIEN_PDF}
                if special:
                    rec["notes"].append(special)
                rec["notes"].extend(other)
                records.append(rec)

    for trow in tjc:
        rec = _base(trow, "JAE", "%s:JAE:%s" % (trow["institution_type"], trow["course_code"]))
        rec["mer"] = {"mode": "none", "lines": [], "alternatives": [], "pdf_variant": None, "status": "none",
                      "source": "none", "pdf_check": "n/a",
                      "rule_source": {"file": RB + "post_secondary_admissions_jae_junior_colleges_and_millennia_institute.md",
                                      "heading": "Grade requirements for specific subjects (no course-level MER)"}}
        records.append(rec)

    for rec in records:
        for ln in rec["mer"]["lines"]:
            if ln["kind"] == "unknown":
                findings["unknown_lines"].append({"key": rec["key"], "line": ln["id"], "text": ln["text"],
                                                  "reason": ln["unknown_reason"]})
            if ln.get("differs_from_group"):
                findings["group_list_differences"].append(dict(key=rec["key"], line=ln["id"], **ln["differs_from_group"]))
        if any(ln.get("unresolved") for ln in rec["mer"]["lines"]):
            rec["data_flags"].append("mer_subject_unresolved")
    findings["unresolved_names"] = dict(findings["unresolved_names"])
    return {"records": records, "findings": findings}
