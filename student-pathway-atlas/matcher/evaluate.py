"""Evaluate a course's MER lines against one student's results (engine entries).

Two modes, chosen per admission route by the rule text (README "How a course is matched"):
  independent  Poly JAE, ITE JAE, ITE JIE 'N'. Each line needs its own subject: two lines are never met by the
               same subject. "sat for" and "completed" lines use no subject.
  slots        JIE 'H' (DPP) and PFP. The rule ties the grades to the subjects that make up ELMAB3 ("3 other
               best subjects"; "any two other subjects that make up the ELMAB3 aggregate"), so the lines become
               hard grade floors on the aggregate's slots and the engine's constrained search decides
               (engine.eligibility.constrained - the same code as the engine's DPP / PFP checks).
"""

from engine import eligibility as EL
from engine import grades as G
from engine.definitions import DEFINITIONS_BY_ID

LEVEL_RANK = {"G3": 0, "G2": 1, "G1": 2}


def _rank(e):
    order = G.GRADE_ORDER.get(e.level, [])
    return (order.index(e.grade) if e.grade in order else 99, LEVEL_RANK.get(e.level, 9), e.idx)


def _ev(e):
    return {"subject": e.name, "subject_id": e.subject_id, "level": e.level, "grade": e.grade, "year": e.year}


def _ev_text(e):
    return "%s %s%s" % (e.name, e.grade, (" (%s)" % e.year) if e.year else "")


def meets(e, max_grade):
    if e.grade == "ABS":
        return False
    worst = (max_grade or {}).get(e.level)
    return worst is not None and G.grade_at_or_better(e.level, e.grade, worst)


def _grade_text(max_grade):
    names = {"G3": "O-Level/G3", "G2": "N(A)/G2", "G1": "N(T)/G1"}
    return " or ".join("%s %s or better" % (names[k], v) for k, v in sorted(max_grade.items(), key=lambda kv: LEVEL_RANK[kv[0]]))


def candidates(line, entries):
    """{subject_id: entry} - the best entry of each subject that meets the line."""
    out = {}
    if line["kind"] == "subject":
        for opt in line["options"]:
            ids = set(opt["subjects"])
            for e in entries:
                if e.subject_id in ids and meets(e, opt.get("max_grade")):
                    if e.subject_id not in out or _rank(e) < _rank(out[e.subject_id]):
                        out[e.subject_id] = e
    elif line["kind"] == "any_other":
        for e in entries:
            if meets(e, line.get("max_grade")):
                if e.subject_id not in out or _rank(e) < _rank(out[e.subject_id]):
                    out[e.subject_id] = e
    return out


def _closest(line, entries):
    """Best entry the student has for the line's subjects, met or not (for the 'not met' detail)."""
    ids = None
    if line["kind"] == "subject":
        ids = set(s for o in line["options"] for s in o["subjects"])
    best = None
    for e in entries:
        if ids is not None and e.subject_id not in ids:
            continue
        if best is None or _rank(e) < _rank(best):
            best = e
    return best


def _requirement_text(line):
    if line["kind"] == "subject":
        return "; ".join(_grade_text(o["max_grade"]) + ((" in " + o["printed"]) if o.get("printed") else "")
                         for o in line["options"])
    if line["kind"] == "any_other":
        return "%d subject(s) at %s" % (line["count"], _grade_text(line["max_grade"]))
    return ""


def _assign(consuming, cand, which):
    """Distinct-subject assignment for the lines in `which`. -> {line index: [entries]} or None."""
    # Named-subject lines first, then "any other subject" lines (printed order within each kind).
    order = sorted(which, key=lambda i: (0 if consuming[i]["kind"] == "subject" else 1, i))
    slots = []
    for i in order:
        ranked = sorted(cand[i].items(), key=lambda kv: _rank(kv[1]))
        for _ in range(consuming[i].get("count", 1)):
            slots.append((i, ranked))
    picks = [None] * len(slots)
    used = set()

    def rec(k):
        if k == len(slots):
            return True
        for sid, e in slots[k][1]:
            if sid in used:
                continue
            used.add(sid)
            picks[k] = (slots[k][0], e)
            if rec(k + 1):
                return True
            used.discard(sid)
        picks[k] = None
        return False

    if not rec(0):
        return None
    by_line = {}
    for i, e in picks:
        by_line.setdefault(i, []).append(e)
    return by_line


def eval_independent(lines, entries):
    """-> (met True/False/None, [line results])."""
    consuming = [l for l in lines if l["kind"] in ("subject", "any_other")]
    cand = {i: candidates(ln, entries) for i, ln in enumerate(consuming)}
    short = {i for i, ln in enumerate(consuming) if len(cand[i]) < ln.get("count", 1)}
    able = [i for i in range(len(consuming)) if i not in short]
    by_line = _assign(consuming, cand, able)  # the decision: a full search over every able line
    joint = by_line is not None
    left_over, named_used = {}, set()
    if not joint:
        # Diagnosis only: "any N other subjects" means other than the subjects the named lines use.
        named = [i for i in able if consuming[i]["kind"] == "subject"]
        named_pick = _assign(consuming, cand, named) or {}
        named_used = {e.subject_id for es in named_pick.values() for e in es}
        for i in able:
            ln = consuming[i]
            if ln["kind"] == "any_other":
                left_over[i] = len(set(cand[i]) - named_used)
                if left_over[i] < ln.get("count", 1):
                    short.add(i)
        able = [i for i in able if i not in short]
        by_line = _assign(consuming, cand, able)
        joint = by_line is not None
    by_line = by_line or {}
    slots = [i for i in able for _ in range(consuming[i].get("count", 1))]

    out = []
    any_unknown = False
    for ln in lines:
        r = {"id": ln["id"], "text": ln["text"], "kind": ln["kind"], "met": None, "satisfied_by": [], "detail": ""}
        if ln["kind"] == "unknown":
            r["detail"] = "cannot check: " + ln["unknown_reason"]
            any_unknown = True
        elif ln["kind"] in ("subject", "any_other"):
            i = next(k for k, c in enumerate(consuming) if c is ln)
            need = ln.get("count", 1)
            if i not in short and joint:
                es = by_line.get(i, [])
                r["met"] = True
                r["satisfied_by"] = [_ev(e) for e in es]
                r["detail"] = "met by " + ", ".join(_ev_text(e) for e in es)
            elif i not in short:
                r["met"] = True
                r["satisfied_by"] = [_ev(e) for e in sorted(cand[i].values(), key=_rank)[:need]]
                r["detail"] = ("met on its own by " + ", ".join(_ev_text(e) for e in sorted(cand[i].values(), key=_rank)[:need])
                               + " (but see: each line needs a different subject)")
            else:
                r["met"] = False
                best = _closest(ln, entries) if ln["kind"] == "subject" else None
                have = (" - best result: " + _ev_text(best)) if best else (" - no result for these subjects" if ln["kind"] == "subject" else "")
                if ln["kind"] == "any_other":
                    have = " - %d qualifying subject(s) besides those used for the other lines" % left_over.get(
                        i, len(set(cand[i]) - named_used))
                r["detail"] = "not met: needs %s%s" % (_requirement_text(ln), have)
        elif ln["kind"] == "sat_for":
            hits = sorted([e for e in entries if e.subject_id in set(ln["subjects"]) and e.grade != "ABS"], key=_rank)
            r["met"] = bool(hits)
            r["satisfied_by"] = [_ev(hits[0])] if hits else []
            r["detail"] = ("sat " + _ev_text(hits[0])) if hits else "not met: no result for these subjects"
        elif ln["kind"] == "completed":
            hits = sorted([e for e in entries if e.level in ln["levels"] and e.grade != "ABS"], key=_rank)
            r["met"] = bool(hits)
            r["detail"] = ("has %s results" % "/".join(ln["levels"])) if hits else "no %s results" % "/".join(ln["levels"])
        out.append(r)

    line_mets = [r["met"] for r in out]
    if not joint and slots:
        out.append({"id": "distinct", "text": "Each line needs a different subject", "kind": "distinct", "met": False,
                    "satisfied_by": [],
                    "detail": "not met: the lines can each be met, but not with %d different subjects" % len(slots)})
        line_mets.append(False)
    if any(m is False for m in line_mets):
        return False, out
    if any_unknown or any(m is None for m in line_mets):
        return None, out
    return True, out


def eval_slots(lines, agg_id, entries, total_max, base_gross, label, silent=()):
    """JIE 'H' / PFP: lines as grade floors on the aggregate's slots; the engine's constrained search decides.

    silent: the aggregate's silent entries (engine.ignored) - a failure one of them could change is unknown, exactly as
    in the engine's own dpp_family / pfp_cluster checks (matcher 0.1.3)."""
    defn = DEFINITIONS_BY_ID[agg_id]
    unknown = [l for l in lines if l["kind"] != "slot"]
    if unknown:
        return None, [{"id": l["id"], "text": l["text"], "kind": l["kind"], "met": None, "satisfied_by": [],
                       "detail": "cannot check: " + l.get("unknown_reason", "unreadable")} for l in lines], None
    check = {"id": "course_mer", "type": "constrained", "label": label, "slot_mer": {}, "slot_accepts": {},
             "total_max": total_max, "source": None}
    for ln in lines:
        for s in ln["slots"]:
            check["slot_mer"][s] = {"max_points": ln["max_points"], "exclude_mer_unusable": True}
            if ln["accepts"] is not None:
                check["slot_accepts"][s] = {"subjects": list(ln["accepts"])}
    res = EL.constrained(check, defn, entries, base_gross, silent)
    by_slot = {row["slot"]: row for row in res.get("slots") or []}
    scales = {s["name"]: G.SCALES[s["scale"]] for s in defn["slots"]}

    def within(ln):
        scale = scales[ln["slots"][0]]
        best = {}
        for e in entries:
            if ln["accepts"] is not None and e.subject_id not in set(ln["accepts"]):
                continue
            p = G.points(scale, e.level, e.grade)
            if p is None or p > ln["max_points"] or G.is_mer_unusable(scale, e.level, e.grade):
                continue
            if e.subject_id not in best or p < best[e.subject_id]:
                best[e.subject_id] = p
        return best

    # Diagnosis only (the decision is the engine's search): named slots (EL, MA, relevant subject) take their best
    # subject first; "any other subject" slots count what is left.
    taken = set()
    if not res["met"]:
        for ln in sorted(lines, key=lambda x: x["accepts"] is None):
            cands = within(ln)
            if ln["accepts"] is not None:
                free = sorted((p, s) for s, p in cands.items() if s not in taken)
                taken.update(s for _, s in free[:len(ln["slots"])])
    out = []
    for ln in lines:
        r = {"id": ln["id"], "text": ln["text"], "kind": "slot", "slots": ln["slots"], "met": None,
             "satisfied_by": [], "detail": ""}
        if res["met"] is not None and by_slot:
            rows = [by_slot[s] for s in ln["slots"] if s in by_slot]
            r["satisfied_by"] = [{"subject": x["subject"], "subject_id": x["subject_id"], "level": x["level"],
                                  "grade": x["grade"], "year": x["year"], "points": x["points"], "slot": x["slot"]}
                                 for x in rows]
            r["met"] = True
            r["detail"] = "met by " + ", ".join("%s %s (%d pt)" % (x["subject"], x["grade"], x["points"]) for x in rows)
        if not res["met"]:
            ok = set(within(ln))
            if ln["accepts"] is None:
                ok -= taken
            need = len(ln["slots"])
            if len(ok) < need:
                r["met"] = False if res["met"] is False else None
                r["satisfied_by"] = []
                r["detail"] = "%s: needs %d %ssubject(s) worth %d point(s) or better; %d found" % (
                    "not met" if res["met"] is False else "can't be worked out", need,
                    "other " if ln["accepts"] is None else "", ln["max_points"], len(ok))
            elif not by_slot:
                r["met"] = True
                r["detail"] = "met on its own (%d subject(s) within the floor)" % len(ok)
        out.append(r)
    if not res["met"]:
        out.append({"id": "together", "text": "All lines met by the subjects that make up %s%s" % (
            defn["letters"], (" with a total of %d or better" % total_max) if total_max else ""),
            "kind": "together", "met": res["met"], "satisfied_by": [], "detail": res["detail"]})
    return res["met"], out, res


def eval_mer(mer, entries, total_max=None, base_gross=None, label="Course MER", silent=()):
    """A record's MER -> dict(met, lines, alternative_used, variant). `silent` is used by the slots mode only."""
    if mer["mode"] == "slots":
        met, lines, raw = eval_slots(mer["lines"], mer["aggregate_id"], entries, total_max, base_gross, label, silent)
        return {"met": met, "lines": lines, "alternative_used": None, "pdf_variant": None,
                "total": (raw or {}).get("total")}
    met, lines = eval_independent(mer["lines"], entries)
    out = {"met": met, "lines": lines, "alternative_used": None, "pdf_variant": None}
    if met is not True and mer.get("alternatives"):
        for alt in mer["alternatives"]:
            am, alines = eval_independent(alt["lines"], entries)
            if am:
                out.update(met=True, alternative_used={"label": alt["label"], "lines": alines, "source": alt["source"]})
                break
            if am is None and out["met"] is False:
                out["met"] = None
    if mer.get("pdf_variant"):
        vm, vlines = eval_independent(mer["pdf_variant"], entries)
        out["pdf_variant"] = {"met": vm, "lines": vlines}
        if vm != out["met"] and out["alternative_used"] is None:
            out["met_coursefinder"] = out["met"]
            out["met"] = None
    return out
