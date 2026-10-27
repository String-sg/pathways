"""Eligibility checks attached to each definition (`checks`). Each returns
{id, label, met: True | False | None, detail, source[, total, slots, provisional]}.

"""

from . import grades as G
from .engine import accepts_ids, solve

ABSENT = "ABS"


def _r(check, met, detail, **extra):
    d = {"id": check["id"], "label": check["label"], "met": met, "detail": detail, "source": check.get("source")}
    d.update(extra)
    return d


def _option_met(option, entries):
    ids = accepts_ids(option["accepts"])
    hits, absent = [], False
    for e in entries:
        if ids is not None and e.subject_id not in ids:
            continue
        if e.grade == "ABS":
            absent = True
            continue
        if "grades" in option and e.grade in option["grades"]:
            hits.append(e)
            continue
        worst = option.get("max_grade", {}).get(e.level)
        if worst and G.grade_at_or_better(e.level, e.grade, worst):
            hits.append(e)
    return hits, absent


def _item_ids(item, with_silent=False):
    """Subject ids a requirement line names (None = any subject)."""
    ids = set()
    specs = [o["accepts"] for o in item["options"]]
    if with_silent and item.get("silent_accepts"):
        specs.append(item["silent_accepts"])
    for spec in specs:
        got = accepts_ids(spec)
        if got is None:
            return None
        ids.update(got)
    return ids


def _item_levels(item):
    """Levels a requirement line grades (None = any level)."""
    levels = set()
    for o in item["options"]:
        if "grades" in o or not o.get("max_grade"):
            return None
        levels.update(o["max_grade"])
    return levels


def _silent_desc(entries):
    return ", ".join("%s %s %s" % (e.name, e.level, e.grade) for e in entries)


def subject_requirements(check, entries, silent=()):
    failed, unknown, absent_any, no_result, wrong_level, notes, near, rests = [], [], False, [], [], [], [], []
    for item in check["items"]:
        ok, absent_here = False, False
        for opt in item["options"]:
            hits, absent = _option_met(opt, entries)
            absent_here = absent_here or absent
            if hits:
                ok = True
                notes.append("%s: %s %s" % (item["label"].split(":")[0], hits[0].name, hits[0].grade))
                break
        if ok:
            continue
        ids = _item_ids(item, with_silent=True)
        resting = [e for e, _ in silent if ids is None or e.subject_id in ids]
        if resting:
            unknown.append(item["label"])
            rests.extend(resting)
            continue
        failed.append(item["label"])
        absent_any = absent_any or absent_here
        ids = _item_ids(item)
        sat = [e for e in entries if e.grade != ABSENT and (ids is None or e.subject_id in ids)]
        levels = _item_levels(item)
        if not sat:
            no_result.append(item["label"])
        elif levels is not None and not any(e.level in levels for e in sat):
            wrong_level.append(item["label"])
        if item.get("near") and any(_option_met(o, entries)[0] for o in item["near"]["options"]):
            near.append(item["near"]["note"])
    extra = {"absent": absent_any, "no_result": no_result, "wrong_level": wrong_level}
    if near:
        extra["near"] = near
    if failed:
        detail = "not met: " + "; ".join(failed)
        if near:
            detail += " (" + " ".join(near) + ")"
        return _r(check, False, detail, **extra)
    if unknown:
        extra["rests_on"] = [{"subject": e.name, "level": e.level, "grade": e.grade} for e in rests]
        return _r(check, None, "can't be worked out: %s rests on %s, which is not counted (the rules do not say "
                               "whether it counts)" % ("; ".join(unknown), _silent_desc(rests)), **extra)
    return _r(check, True, "met (" + "; ".join(notes) + ")", **extra)


def conditional(check, by_id, alt_solutions):
    req = by_id.get(check["when_failed"])
    if req is None:
        return _r(check, None, "subject requirements not evaluated")
    if req["met"] is None:
        return _r(check, None, "can't be worked out: the grade requirements for specific subjects can't be worked out")
    if req["met"]:
        return _r(check, None, "not needed: grade requirements for specific subjects are met")
    if req.get("absent"):
        return _r(check, False, "an 'Absent' grade in a specific subject: not eligible for conditional admission")
    if req.get("no_result"):
        return _r(check, False, "no result for a specific subject (%s): not eligible for conditional admission, which "
                                "is for a subject you sat and must sit again" % "; ".join(req["no_result"]))
    if req.get("wrong_level"):
        return _r(check, False, "a result only at another level for a specific subject (%s): not eligible for "
                                "conditional admission, which is for the subject at the level asked"
                                % "; ".join(req["wrong_level"]))
    lo, hi = check["band"]
    reasons = []
    for sol in alt_solutions:
        g = sol["gross"]
        if g is None:
            continue
        tag = sol["label"] or "computation"
        if g <= check["gross_max"]:
            return _r(check, True, "%s: gross %d <= %d" % (tag, g, check["gross_max"]))
        if lo <= g <= hi:
            rel = [row for row in sol["slots"] if row["slot"] in check["relevant_slots"]]
            ok_grades = check["relevant_grades"]
            if rel and all(row["grade"] in ok_grades.get(row["level"], []) for row in rel):
                return _r(check, True, "%s: gross %d with A1/A2 in all relevant subjects" % (tag, g))
            reasons.append("%s: gross %d but not A1/A2 in every relevant subject" % (tag, g))
        else:
            reasons.append("%s: gross %d outside %d-%d" % (tag, g, lo, hi))
    return _r(check, False, "; ".join(reasons) or "no aggregate computed")


def constrained(check, defn, entries, base_gross, silent=()):
    best = None
    alts = defn.get("alternatives") or [None]
    for alt in alts:
        sol = solve(defn, entries, alternative=alt, slot_accepts=check.get("slot_accepts"),
                    hard_mer=check["slot_mer"])
        if sol["gross"] is not None and (best is None or sol["gross"] < best["gross"]):
            best = sol
    extra = {}
    if check.get("provisional"):
        extra["provisional"] = check["provisional"]
    rests = []
    if best is None or (check.get("total_max") is not None and best["gross"] > check["total_max"]):
        rests = _floor_rests_on(check, defn, silent)
    if rests:
        extra["rests_on"] = [{"subject": e.name, "level": e.level, "grade": e.grade} for e in rests]
    if best is None:
        if rests:
            return _r(check, None, "can't be worked out: no assignment meets the grade floors without %s, which is not "
                                   "counted (the rules do not say whether it counts)" % _silent_desc(rests),
                      total=None, slots=[], **extra)
        return _r(check, False, "no assignment meets the grade floors", total=None, slots=[], **extra)
    mx = check.get("total_max")
    met = mx is None or best["gross"] <= mx
    detail = "assignment meeting the floors totals %d" % best["gross"]
    if mx is not None:
        detail += " (needs <= %d)" % mx
    if base_gross is not None and best["gross"] != base_gross:
        detail += "; differs from the aggregate's own gross %d" % base_gross
    if not met and rests:
        met = None
        detail = "can't be worked out: %s; it may change with %s, which is not counted" % (detail, _silent_desc(rests))
    return _r(check, met, detail, total=best["gross"], slots=best["slots"], **extra)


def _floor_rests_on(check, defn, silent):
    """Silent entries that could fill a slot of a floor check (a grade that can never meet a floor is left out)."""
    out = []
    over = check.get("slot_accepts") or {}
    for e, why in silent:
        if why.get("floor") is False:
            continue
        for s in defn["slots"]:
            ids = accepts_ids(over.get(s["name"], s["accepts"]))
            if ids is None or e.subject_id in ids:
                out.append(e)
                break
    return out


def min_subjects(check, entries):
    by_year, subjects = set(), set()
    for e in entries:
        if e.level in check["levels"] and e.grade != "ABS":
            subjects.add(e.subject_id)
            if e.year is not None:
                by_year.add(e.year)
    n = len(subjects)
    met = n >= check["count"]
    return _r(check, met, "%d distinct subject(s) at %s across %d exam year(s)" % (n, "/".join(check["levels"]),
                                                                                    max(len(by_year), 1)))


def passes(check, entries):
    details = []
    for alt in check["any_of"]:
        passing = {}
        for e in entries:
            worst = alt["pass_grades"].get(e.level)
            if worst and G.grade_at_or_better(e.level, e.grade, worst):
                passing.setdefault(e.subject_id, e)
        # each must_include needs its own distinct passing subject
        used, ok = set(), True
        for req in alt["must_include"]:
            ids = accepts_ids(req)
            hit = next((sid for sid in passing if sid not in used and (ids is None or sid in ids)), None)
            if hit is None:
                ok = False
                break
            used.add(hit)
        if ok and len(passing) >= alt["count"]:
            return _r(check, True, "met: " + alt["label"])
        details.append("%s: %d passing subject(s)%s" % (alt["label"], len(passing), "" if ok else ", prerequisite missing"))
    return _r(check, False, "not met (" + "; ".join(details) + ")")


def requires_level(check, entries):
    has = any(e.level == check["level"] for e in entries)
    return _r(check, has, "has %s results" % check["level"] if has else "no %s results" % check["level"])


def evaluate(defn, entries, gross, net, alt_solutions, net_reason=None, silent=()):
    out, by_id = [], {}
    for check in defn.get("checks", []):
        t = check["type"]
        if t == "gross_max":
            r = _r(check, None if gross is None else gross <= check["max"],
                   "gross not computed" if gross is None else "gross %d (max %d)" % (gross, check["max"]))
        elif t == "net_max":
            if net is None:
                r = _r(check, None, net_reason or "net not computed")
            else:
                r = _r(check, net <= check["max"], "net %d (max %d)" % (net, check["max"]))
        elif t == "subject_requirements":
            r = subject_requirements(check, entries, silent)
        elif t == "conditional_admission":
            r = conditional(check, by_id, alt_solutions)
        elif t == "constrained":
            r = constrained(check, defn, entries, gross, silent)
        elif t == "min_subjects":
            r = min_subjects(check, entries)
        elif t == "passes":
            r = passes(check, entries)
        elif t == "requires_level":
            r = requires_level(check, entries)
        elif t == "info":
            r = _r(check, None, "not evaluated")
        else:
            raise ValueError("unknown check type %r" % t)
        by_id[check["id"]] = r
        out.append(r)
    return out
