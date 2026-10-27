"""Public entry point: compute_all(subjects, bonus_inputs=None, ids=None) -> list[Result].

subjects: list of dicts, one per result:
    {"subject": "Higher Chinese", "level": "O" | "G3" | "N(A)" | "G2" | "N(T)" | "G1",
     "grade": "A1" | "3" | "B" ...   (or "mark": 72 -> the usual school mark bands),
     "year": 2026}                   (exam year; optional - a row without a year is used by every aggregate)
bonus_inputs: {"cca": "Excellent", "affiliated_jc": True, "lep": True}   (all optional)
"""

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from . import bonus as B
from . import eligibility as EL
from . import grades as G
from . import ignored as IG
from .definitions import DEFINITIONS, DEFINITIONS_BY_ID, FIFTH_YEAR_2027, LEVEL_LABELS
from .engine import accepts_ids, prepare_entries, solve, year_sets


@dataclass
class Result:
    id: str
    display_name: str
    letters: Optional[str]
    exam_year: Optional[int]
    exercise: Optional[str]
    institution: Optional[str]
    route: Optional[str]
    status: str  # computed | not_computable | not_applicable | stub | summary
    gross: Optional[int] = None
    net: Optional[int] = None
    bonus: Optional[Dict[str, Any]] = None
    net_variants: Dict[str, int] = field(default_factory=dict)
    slots: List[Dict[str, Any]] = field(default_factory=list)
    ignored: List[Dict[str, Any]] = field(default_factory=list)  # typed grades this aggregate does not use (ignored.py)
    alternatives: List[Dict[str, Any]] = field(default_factory=list)
    chosen_alternative: Optional[str] = None
    eligibility: List[Dict[str, Any]] = field(default_factory=list)
    not_computable_reason: Optional[str] = None
    greedy_total: Optional[int] = None
    greedy_slots: List[Dict[str, Any]] = field(default_factory=list)
    greedy_differs: bool = False
    years_used: List[int] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    input_problems: List[Dict[str, Any]] = field(default_factory=list)
    sources: List[Dict[str, str]] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    open_questions: List[int] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


def _base(defn, status):
    return Result(id=defn["id"], display_name=defn.get("display_name", defn["id"]), letters=defn.get("letters"),
                  exam_year=defn.get("exam_year"),
                  exercise=defn.get("exercise"), institution=defn.get("institution"), route=defn.get("route"),
                  status=status, sources=list(defn.get("sources", [])), notes=list(defn.get("notes", [])),
                  open_questions=list(defn.get("open_questions", [])))


def _usable_anywhere(defn, entries):
    for s in defn["slots"]:
        scale = G.SCALES[s["scale"]]
        if any(G.points(scale, e.level, e.grade) is not None for e in entries):
            return True
    return False


def _solve_all_alternatives(defn, entries):
    alts = defn.get("alternatives") or [None]
    sols = [solve(defn, entries, alternative=a) for a in alts]
    computed = [s for s in sols if s["gross"] is not None]
    chosen = min(computed, key=lambda s: s["gross"]) if computed else None  # ties: first alternative (EL)
    greedy = [s["greedy_total"] for s in sols if s["greedy_total"] is not None]
    greedy_best = None
    if greedy:
        gmin = min(greedy)
        greedy_best = next(s for s in sols if s["greedy_total"] == gmin)
    return sols, chosen, greedy_best


def compute_definition(defn, entries, bonus_inputs=None, base_warnings=(), input_problems=()):
    r = _compute_definition(defn, entries, bonus_inputs, base_warnings)
    r.input_problems = [dict(p) for p in input_problems]
    return r


def _compute_definition(defn, entries, bonus_inputs, base_warnings):
    if defn.get("status") == "stub":
        r = _base(defn, "stub")
        r.not_computable_reason = defn.get("stub_reason")
        return r

    best = None  # (gross or inf, years, entries, sols, chosen, greedy_best)
    combos = year_sets(entries, defn.get("max_year"), defn.get("single_year_levels"))
    for years, ents in combos:
        sols, chosen, greedy_best = _solve_all_alternatives(defn, ents)
        g = chosen["gross"] if chosen else float("inf")
        if best is None or g < best[0]:
            best = (g, years, ents, sols, chosen, greedy_best)
    _, years, ents, sols, chosen, greedy_best = best

    r = _base(defn, "computed")
    r.warnings = list(base_warnings)
    r.years_used = list(years)
    r.ignored, silent = IG.ignored_entries(defn, entries, ents, years)
    if len({c[0] for c in combos}) > 1:
        r.warnings.append("results from more than 2 exam years: the best 2-year combination (%s) is used"
                          % "+".join(str(y) for y in years))
    r.alternatives = [{"id": s["alternative"], "label": s["label"], "gross": s["gross"], "slots": s["slots"],
                       "greedy_total": s["greedy_total"], "not_computable_reason": s["reason"]}
                      for s in sols] if defn.get("alternatives") else []

    if not _usable_anywhere(defn, ents):
        r.status = "not_applicable"
        r.not_computable_reason = ("no results usable by this aggregate (exam year %s or earlier; scale: %s)"
                                   % (defn.get("max_year"), G.SCALES[defn["slots"][0]["scale"]]["label"]))
    elif chosen is None:
        r.status = "not_computable"
        r.not_computable_reason = "; ".join(
            ("%s: %s" % (s["label"], s["reason"])) if s["label"] else s["reason"] for s in sols)
        rests = _slot_rests_on(defn, silent)
        if rests:
            r.not_computable_reason += "; the rules do not say whether %s counts" % IG.silent_text(
                rests, LEVEL_LABELS.get(defn.get("exam_key")) or LEVEL_LABELS["SEC"])
    else:
        r.gross = chosen["gross"]
        r.slots = chosen["slots"]
        r.chosen_alternative = chosen["alternative"]
        if chosen.get("misses"):
            r.warnings.append("%d slot pick(s) do not meet that slot's subject grade requirement "
                              "(the subject still counts in the aggregate)" % chosen["misses"])

    if greedy_best is not None:
        r.greedy_total = greedy_best["greedy_total"]
        r.greedy_slots = greedy_best["greedy_slots"]
    r.greedy_differs = (r.gross is not None and r.greedy_total != r.gross) or (r.gross is None and r.greedy_total is not None)
    if r.greedy_differs:
        r.warnings.append("greedy slot-by-slot filling gives %s, exact search gives %s" % (r.greedy_total, r.gross))

    net_reason = None
    if defn.get("bonus") is None:
        net_reason = defn.get("bonus_missing_reason", "no bonus schedule")
    elif r.gross is not None:
        b = B.compute_bonus(defn["bonus"], ents, bonus_inputs)
        r.bonus = b
        r.net = r.gross - b["base"]
        r.net_variants = {k: r.gross - v for k, v in b["variants"].items()}
        if not (bonus_inputs or {}).get("cca"):
            r.warnings.append("CCA grade not given: net assumes no CCA bonus")
    if net_reason and r.gross is not None:
        r.notes.append("net: " + net_reason)

    r.eligibility = EL.evaluate(defn, ents, r.gross, r.net, sols, net_reason, silent)
    return r


def _slot_rests_on(defn, silent):
    """Silent (not counted) entries that some slot of the aggregate could take - an empty slot may rest on them."""
    out = []
    for e, why in silent:
        for s in defn["slots"]:
            ids = accepts_ids(s["accepts"])
            if ids is None or e.subject_id in ids:
                out.append((e, why))
                break
    return out


def _g3_passes(entries, max_year, worst):
    """Distinct subjects at G3 with a grade of `worst` or better."""
    ids = {e.subject_id for e in entries
           if e.level == "G3" and (e.year is None or e.year <= max_year) and G.grade_at_or_better("G3", e.grade, worst)}
    return len(ids)


def _all_met(result, check_ids):
    el = {e["id"]: e["met"] for e in result.eligibility}
    return all(el.get(c) for c in check_ids)


def fifth_year_summary(results_by_id, entries, spec=FIFTH_YEAR_2027):
    """5th year in secondary school (PSE 2028). Thresholds come from definitions.FIFTH_YEAR_2027."""
    src = spec["source"]
    r = Result(id=spec["id"], display_name=spec.get("display_name", spec["id"]), letters=None,
               exam_year=spec["exam_year"], exercise=spec["exercise"],
               institution=spec["institution"], route=spec["route"], status="summary",
               sources=[src], open_questions=list(spec["open_questions"]))
    n_pass = _g3_passes(entries, spec["exam_year"], spec["g3_pass_max_grade"])

    a = spec["criterion_a"]
    jcmi_res = results_by_id.get(a["jcmi_aggregate"])
    jcmi = False
    if jcmi_res is not None and jcmi_res.gross is not None:
        jcmi = (any(_all_met(jcmi_res, ids) for ids in a["jc_ok"]) or
                any(_all_met(jcmi_res, ids) for ids in a["mi_ok"]))
    nets = [results_by_id[i].net for i in a["poly_aggregates"]
            if i in results_by_id and results_by_id[i].net is not None]
    poly_out = not nets or min(nets) >= a["poly_fail_net_from"]
    if n_pass < a["min_g3_passes"]:
        a_met, a_detail = False, "%d G3 pass(es)" % n_pass
    elif jcmi:
        a_met, a_detail = False, "qualifies for JC or MI (%s)" % a["jcmi_aggregate"]
    elif not poly_out:
        a_met, a_detail = None, "ELR2B2 net %d: depends on course MER (not checked)" % min(nets)
    else:
        a_met, a_detail = True, "%d G3 passes; no JC / MI; no ELR2B2 net below %d" % (n_pass, a["poly_fail_net_from"])

    b = spec["criterion_b"]
    hits = [x["aggregate"] for x in b["any_of"]
            if results_by_id.get(x["aggregate"]) is not None and results_by_id[x["aggregate"]].gross is not None
            and results_by_id[x["aggregate"]].gross <= x["max"]]
    if n_pass > b["max_g3_passes"]:
        b_met, b_detail = False, "%d G3 passes (needs %d or fewer)" % (n_pass, b["max_g3_passes"])
    else:
        b_met = bool(hits)
        b_detail = ("met by " + ", ".join(hits)) if hits else "no aggregate under its threshold"

    g = spec["all_g3"]
    agg = results_by_id.get(g["aggregate"])
    all_g3 = None if agg is None or agg.gross is None else agg.gross <= g["max"]
    overall = True if (a_met or b_met) else (None if a_met is None else False)
    r.eligibility = [
        {"id": "criterion_a", "label": a["label"], "met": a_met, "detail": a_detail, "source": src},
        {"id": "criterion_b", "label": b["label"], "met": b_met, "detail": b_detail, "source": src},
        {"id": "all_g3", "label": g["label"], "met": all_g3,
         "detail": "%s = %s" % (g["aggregate"], agg.gross if agg else None), "source": src},
        {"id": "eligible", "label": "Eligible for a 5th year", "met": overall, "detail": "either criterion",
         "source": src},
    ]
    r.warnings.append(spec["g3_pass_note"])
    return r


def check_inputs(subjects):
    """Read the rows only: {entries, input_problems, warnings}. For an app's paste / entry step."""
    entries, warnings, problems = prepare_entries(subjects)
    return {"entries": [e.describe() for e in entries], "input_problems": problems, "warnings": warnings}


def compute_all(subjects, bonus_inputs=None, ids=None, include_summary=True):
    """Every aggregate (or those in `ids`) for one student. Returns list[Result].

    Every Result carries the same `input_problems` list: rows that were dropped or may be misread. Show it
    before any score - a dropped row changes every aggregate.
    """
    entries, warnings, problems = prepare_entries(subjects)
    defs = DEFINITIONS if ids is None else [DEFINITIONS_BY_ID[i] for i in ids]
    results = [compute_definition(d, entries, bonus_inputs, warnings, problems) for d in defs]
    if include_summary and ids is None:
        by_id = {r.id: r for r in results}
        summary = fifth_year_summary(by_id, entries)
        summary.input_problems = [dict(p) for p in problems]
        results.append(summary)
    return results


def compute(aggregate_id, subjects, bonus_inputs=None):
    """One aggregate by ID."""
    return compute_all(subjects, bonus_inputs, ids=[aggregate_id])[0]
