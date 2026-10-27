"""match(subjects, bonus_inputs=None, exercises=None) -> list[CourseResult].

  - the engine aggregate the course uses (gross / net for this student),
  - eligible: True / False / None (None = cannot be decided from the published data, the reasons say why),
  - reasons: the gates (engine checks, e.g. ELR2B2 net <= 26) and the course MER, each MER line met or not with the
    subject that met it,
  - both links (MOE CourseFinder / SchoolFinder page and the institution's own page), the 2026 net range as
    published, data flags and the check-yourself notes (colour vision, medical tests ...), which never block.
"""

import json
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional

from engine import ENGINE_VERSION, compute_all
from engine.definitions import DEFINITIONS_BY_ID
from engine.engine import prepare_entries
from engine.ignored import ignored_entries

from . import evaluate as EV
from .exercises import EXERCISE_IDS, EXERCISES, aggregate_for

MATCHER_VERSION = "0.1.3"
REQUIREMENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "requirements.json")


@dataclass
class CourseResult:
    exercise: str
    exercise_label: str
    institution_type: str
    institution: str
    course_code: str
    course_name: str
    field_of_study: str
    aggregate_id: Optional[str]
    aggregate_display_name: Optional[str]
    gross: Optional[int]
    net: Optional[int]
    net_range_2026: Optional[List[int]]
    eligible: Optional[bool]
    reasons: List[Dict[str, Any]]
    moe_url: str
    institution_url: str
    data_flags: List[str]
    # extras
    stream: str = ""
    route: str = ""
    ite_course_code: str = ""
    jc_stream: str = ""
    pfp_cluster: str = ""
    aggregate_type: str = ""
    aggregate_status: str = ""
    net_range_basis: Optional[str] = None
    requirements_note: str = ""
    notes: List[str] = field(default_factory=list)
    requirement_key: str = ""

    def to_dict(self):
        return asdict(self)


_REQ_CACHE = {}


def load_requirements(path=None, rebuild=False):
    """requirements.json (written by `python3 -m matcher build`); rebuilt from the snapshot if missing."""
    path = path or REQUIREMENTS_FILE
    if not rebuild and path in _REQ_CACHE:
        return _REQ_CACHE[path]
    if rebuild or not os.path.exists(path):
        from .parse import build
        data = build()
    else:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    _REQ_CACHE[path] = data
    return data


def _window(entries, result, defn):
    years = result.years_used if result is not None else []
    mx = defn.get("max_year")
    if years:
        return [e for e in entries if e.year is None or e.year in years]
    return [e for e in entries if e.year is None or mx is None or e.year <= mx]


def _combine(items):
    mets = [i["met"] for i in items if i.get("blocking")]
    if any(m is False for m in mets):
        return False
    if any(m is None for m in mets):
        return None
    return True


def _gate_items(stream, record, result, defn):
    elig = {e["id"]: e for e in result.eligibility}
    ctype = {c["id"]: c["type"] for c in defn.get("checks", [])}
    computed = result.gross is not None
    items = []
    for gate in stream["gates"]:
        ids = list(gate)
        rep = stream.get("nursing_replaces")
        if record.get("is_nursing_diploma") and stream.get("nursing_gate") and rep in ids:
            ids = [stream["nursing_gate"] if i == rep else i for i in ids]
        found = [elig[i] for i in ids if i in elig]
        if not found:
            items.append({"id": "+".join(ids), "kind": "gate", "label": " or ".join(ids), "met": None,
                          "detail": "check not available in the engine result", "blocking": True})
            continue
        if len(found) == 1:
            e = found[0]
            met, detail = e["met"], e["detail"]
            if met is None and not computed and ctype.get(e["id"]) in ("gross_max", "net_max", "constrained"):
                met, detail = False, "%s can't be worked out: %s" % (result.display_name, _why_not(result))
            items.append({"id": e["id"], "kind": "gate", "label": e["label"], "met": met, "detail": detail,
                          "source": e.get("source"), "blocking": True})
        else:
            mets = [e["met"] for e in found]
            met = True if any(m is True for m in mets) else (False if all(m is False for m in mets) else None)
            hit = next((e for e in found if e["met"] is True), None)
            if hit is found[0]:
                detail = hit["detail"]
            elif hit:
                detail = "%s: %s" % (hit["label"], hit["detail"])
            else:
                detail = "; ".join("%s: %s" % (e["label"], e["detail"]) for e in found)
            items.append({"id": "|".join(e["id"] for e in found), "kind": "gate",
                          "label": " - or - ".join(e["label"] for e in found), "met": met, "detail": detail,
                          "source": found[0].get("source"), "blocking": True,
                          "conditional": bool(hit and "conditional" in hit["id"])})
    return items


def _why_not(result):
    """The engine's own reason an aggregate can't be worked out."""
    return result.not_computable_reason or {"not_applicable": "no results this aggregate can use"}.get(
        result.status, result.status)


def _aggregate_item(agg_id, result, blocking_if_missing):
    base = {"id": "aggregate", "kind": "aggregate", "label": result.display_name, "aggregate_id": agg_id,
            "met": None}
    if result.gross is not None:
        detail = "gross %d" % result.gross
        if result.net is not None and result.net != result.gross:
            detail += ", net %d (bonus %d)" % (result.net, result.gross - result.net)
        elif result.net is not None:
            detail += ", net %d" % result.net
        for k, v in sorted((result.net_variants or {}).items()):
            detail += "; net %d with %s" % (v, k.replace("_", " "))
        return dict(base, detail=detail, blocking=False)
    return dict(base, detail="can't be worked out: %s" % _why_not(result)
                + (" (needed for posting)" if blocking_if_missing else ""),
                blocking=blocking_if_missing, cant_be_worked_out=True)


def _mer_item(record, stream, entries, result):
    mer = record["mer"]
    label = "Course minimum entry requirements (MER)"
    silent = []
    if mer["mode"] == "slots":  # DPP / PFP floors: the engine's silent rule, as in its own family / cluster checks
        silent = ignored_entries(DEFINITIONS_BY_ID[mer["aggregate_id"]], entries, entries, result.years_used)[1]
    ev = EV.eval_mer(mer, entries, total_max=stream.get("mer_total_max"), base_gross=result.gross, label=label,
                     silent=silent)
    item = {"id": "mer", "kind": "mer", "label": label, "met": ev["met"], "lines": ev["lines"], "blocking": True,
            "mode": mer["mode"], "source": mer.get("rule_source")}
    if ev.get("alternative_used"):
        item["alternative_used"] = ev["alternative_used"]
        item["detail"] = "met through: " + ev["alternative_used"]["label"]
    elif ev["met"] is True:
        item["detail"] = "every line met"
    elif ev["met"] is False:
        bad = [l for l in ev["lines"] if l["met"] is False]
        item["detail"] = "not met: " + "; ".join("%s) %s" % (l["id"], l["text"]) if len(l["id"]) == 1 else l["text"]
                                               for l in bad)
    else:
        item["detail"] = "cannot be decided from the published data"
    if ev.get("pdf_variant"):
        item["pdf_variant"] = ev["pdf_variant"]
        if "met_coursefinder" in ev:
            item["detail"] = ("CourseFinder and MOE's consolidated MER PDF print different MER for this course, and "
                              "the answer depends on which is right (CourseFinder: %s, PDF: %s)"
                              % (_yn(ev["met_coursefinder"]), _yn(ev["pdf_variant"]["met"])))
    if mer["mode"] == "slots" and ev.get("total") is not None:
        item["total"] = ev["total"]
    return item


def _yn(v):
    return {True: "met", False: "not met", None: "unknown"}[v]


def _application_items(record, entries):
    """Requirements to apply for this course beyond the MER (PFP N95's Tamil scores): blocking."""
    items = []
    for req in record.get("application_requirements", []):
        met, lines = EV.eval_independent(req["lines"], entries)
        items.append({"id": req["id"], "kind": "gate", "label": req["label"], "met": met,
                      "detail": "; ".join(l["detail"] for l in lines), "lines": lines, "source": req["source"],
                      "decision": req.get("decision"), "blocking": True})
    return items


def _unpublished_items(ex):
    """PSE 2028: eligibility and thresholds only; each course marked as not yet published."""
    return [{"id": "mer", "kind": "mer", "label": ex["requirements_note"], "met": None,
             "detail": ex["requirements_note_detail"], "source": ex["requirements_note_source"],
             "decision": ex["requirements_note_decision"], "blocking": True}]


def _course_result(ex, stream, record, by_id, entries_all):
    agg_id = aggregate_for(stream, record)
    result = by_id.get(agg_id)
    defn = DEFINITIONS_BY_ID[agg_id]
    entries = _window(entries_all, result, defn)
    reasons = []
    reasons.append(_aggregate_item(agg_id, result, blocking_if_missing=(stream.get("aggregate_gates") is False)))
    reasons.extend(_gate_items(stream, record, result, defn))
    if stream["mer"] == "course":
        reasons.extend(_application_items(record, entries))
        reasons.append(_mer_item(record, stream, entries, result))
    elif stream["mer"] == "unpublished":
        reasons.extend(_unpublished_items(ex))
    flags = list(record["data_flags"])
    net_range, basis = record.get("net_range_2026"), None
    if stream.get("net_range") == "none" or ex.get("net_range") == "none":
        net_range = None  # PFP: the row's range is JAE's; PSE 2028: no cut-off comparison
    elif net_range:
        basis = result.display_name  # the 2026 range is on this exercise's own (2026) aggregate
    if ex.get("course_list") == "2026":
        flags.append("course_list_2026")
    if stream.get("aggregate_map_source"):
        flags.append("aggregate_type_mapped_from_2026")
    return CourseResult(
        exercise=ex["id"], exercise_label=ex["label"], institution_type=record["institution_type"],
        institution=record["institution"], course_code=record["course_code"], course_name=record["course_name"],
        field_of_study=record.get("field_of_study", ""), aggregate_id=agg_id,
        aggregate_display_name=result.display_name, gross=result.gross, net=result.net,
        net_range_2026=net_range, eligible=_combine(reasons), reasons=reasons, moe_url=record["moe_url"],
        institution_url=record["institution_url"], data_flags=flags, stream=stream["name"], route=record["route"],
        ite_course_code=record.get("ite_course_code", ""), jc_stream=record.get("stream", ""),
        pfp_cluster=record.get("pfp_cluster", ""), aggregate_type=record["aggregate_type"],
        aggregate_status=result.status, net_range_basis=basis, requirements_note=ex.get("requirements_note", "") if stream["mer"] == "unpublished" else "",
        notes=list(record.get("notes", [])),
        requirement_key=record["key"])


def match(subjects, bonus_inputs=None, exercises=None, requirements=None):
    """One student's results -> list[CourseResult] for the chosen exercises (default: all five)."""
    reqs = requirements or load_requirements()
    wanted = EXERCISE_IDS if exercises is None else list(exercises)
    unknown = [e for e in wanted if e not in EXERCISE_IDS]
    if unknown:
        raise ValueError("unknown exercise id(s) %s; known: %s" % (unknown, EXERCISE_IDS))
    results = compute_all(subjects, bonus_inputs)
    by_id = {r.id: r for r in results}
    entries, _, _ = prepare_entries(subjects)
    out = []
    for ex in EXERCISES:
        if ex["id"] not in wanted:
            continue
        for stream in ex["streams"]:
            for rec in reqs["records"]:
                if rec["institution_type"] in stream["institution_types"] and rec["route"] == stream["route"]:
                    out.append(_course_result(ex, stream, rec, by_id, entries))
    return out


def match_report(subjects, bonus_inputs=None, exercises=None):
    """match plus what an app shows first: input problems, warnings, and counts per exercise and stream."""
    from engine import check_inputs
    inp = check_inputs(subjects)
    res = match(subjects, bonus_inputs, exercises)
    summary = {}
    for r in res:
        k = (r.exercise, r.stream)
        s = summary.setdefault(k, {"exercise": r.exercise, "stream": r.stream, "courses": 0, "eligible": 0,
                                   "unknown": 0, "not_eligible": 0})
        s["courses"] += 1
        s[{True: "eligible", None: "unknown", False: "not_eligible"}[r.eligible]] += 1
    return {"engine_version": ENGINE_VERSION, "matcher_version": MATCHER_VERSION,
            "input_problems": inp["input_problems"], "warnings": inp["warnings"],
            "summary": list(summary.values()), "results": res}
