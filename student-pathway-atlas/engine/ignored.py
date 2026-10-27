"""Which typed grades an aggregate does not use, and why.

Every Result lists them in `ignored`: [{subject, level, grade, state, reason, code, year, row, input_name}], in input
order. state "rule" = the source says the grade is not used; "silent" = the source does not say, so the grade is not
counted. The reasons and each definition's policy are data (definitions.IGNORED_REASONS / IGNORED_POLICY_BY_ID).

An entry is listed when no slot of the aggregate can ever use it:
  1. its exam year is after the aggregate's (later_year), or outside the best 2-year window (not_best_years), or its
     level's results from that year were dropped by a single-year rule (NFP: N-Level results of one year only);
  2. it is Absent; or its subject is excluded (Religious Knowledge for JC / MI, English for the arts aggregates);
  3. no slot scale gives its (level, grade) points: a non-scoring grade (Merit / Pass ...), a level no slot uses, or a
     grade the slot scales lack - the "rule" reason wins when two apply;
  4. the same subject has another entry that every slot prefers (as good or better on points and on grade floors, and
     ranked first by the search) - the better grade is used instead.
A "silent" entry from steps 2-3 is returned separately: a subject requirement that rests on it is "can't be worked
out" (eligibility.py), and a slot only it could fill is named in the not-computable reason.
"""

from . import grades as G
from . import subjects as SUB
from .definitions import IGNORED_REASONS, LEVEL_LABELS
from .engine import accepts_ids, mer_ok

FALLBACK = "unlisted"


def _accepted(slot, sid):
    ids = accepts_ids(slot["accepts"])
    return ids is None or sid in ids


def _soft_key(slot, scale, e, p):
    return (p, 0 if mer_ok(slot.get("mer"), scale, e, p) else 1, e.idx)


def _preferred_other(e, others, slots):
    """The same-subject entry the search always takes instead of `e`, or None if some slot could use `e`."""
    winner = None
    usable = False
    for s in slots:
        if not _accepted(s, e.subject_id):
            continue
        scale = G.SCALES[s["scale"]]
        p = G.points(scale, e.level, e.grade)
        if p is None:
            continue
        usable = True
        u = 1 if G.is_mer_unusable(scale, e.level, e.grade) else 0
        mine = _soft_key(s, scale, e, p)
        best = None
        for o in others:
            po = G.points(scale, o.level, o.grade)
            if po is None:
                continue
            uo = 1 if G.is_mer_unusable(scale, o.level, o.grade) else 0
            key = _soft_key(s, scale, o, po)
            if po <= p and uo <= u and key < mine and (best is None or key < best[0]):
                best = (key, o)
        if best is None:
            return None
        if winner is None:
            winner = best[1]
    return winner if usable else None


def _used_text(o, e, labels):
    if o.level != e.level:
        return "%s %s" % (labels[o.level], o.grade)
    if o.year is not None and o.year != e.year:
        return "%s (%d)" % (o.grade, o.year)
    return o.grade


def _item(e, code, fill):
    r = IGNORED_REASONS[code]
    return {"subject": e.name, "level": e.level, "grade": e.grade, "year": e.year, "row": e.idx + 1,
            "input_name": e.raw_name, "state": r["state"], "code": code, "reason": r["text"].format(**fill)}


def _level_grade_reason(e, policy, slots):
    """The level / grade reason for an entry whatever its subject (None when some slot scale gives it points)."""
    if any(G.points(G.SCALES[s["scale"]], e.level, e.grade) is not None for s in slots):
        return None
    if e.grade in G.NON_SCORING_GRADES:
        return policy.get("non_scoring") if e.kind == "MTL_B" else "no_points"
    levels = set()
    for s in slots:
        levels.update(G.SCALES[s["scale"]]["levels"])
    if e.level not in levels:
        return (policy.get("levels") or {}).get(e.level)
    return (policy.get("grades") or {}).get("%s:%s" % (e.level, e.grade))


def ignored_entries(defn, entries, window, years_used):
    """-> (items, silent): items for Result.ignored; silent = [(entry, reason dict)] for the "can't be worked out" rule.

    entries: every prepared entry; window: the entries of the year set the aggregate used; years_used: its years.
    """
    if defn.get("status") == "stub":
        return [], []
    policy = defn.get("ignored_policy") or {}
    labels = LEVEL_LABELS.get(defn.get("exam_key")) or LEVEL_LABELS["SEC"]
    slots = defn["slots"]
    max_year = defn.get("max_year")
    in_window = {e.idx for e in window}
    years = list(years_used or [])
    single = set(defn.get("single_year_levels") or [])
    excluded = {}
    for g in defn.get("exclude_groups", []):
        for sid in SUB.group_members(g):
            excluded.setdefault(sid, g)
    by_subject = {}
    for e in window:
        by_subject.setdefault(e.subject_id, []).append(e)
    fill = {"max_year": max_year, "years": " and ".join(str(y) for y in years), "used": ""}

    items, silent = [], []
    for e in entries:
        code, check_silent = None, False
        if e.year is not None and max_year is not None and e.year > max_year:
            code = "later_year"
        elif e.idx not in in_window:
            if e.level in single and e.year in years:
                code = policy.get("single_year") or FALLBACK
            else:
                code = "not_best_years"
        elif e.grade == "ABS" and not any(_accepted(s, e.subject_id) and
                                          G.points(G.SCALES[s["scale"]], e.level, e.grade) is not None for s in slots):
            code = "absent"
        elif e.subject_id in excluded:
            code = (policy.get("excluded") or {}).get(excluded[e.subject_id]) or FALLBACK
            check_silent = True
            # An excluded subject can still meet a requirement (English for the arts aggregates): when its level or
            # grade is one the source is silent on, a requirement resting on it is "can't be worked out".
            shadow = _level_grade_reason(e, policy, slots)
            if shadow and IGNORED_REASONS[shadow]["state"] == "silent":
                silent.append((e, IGNORED_REASONS[shadow]))
        else:
            usable = any(_accepted(s, e.subject_id) and G.points(G.SCALES[s["scale"]], e.level, e.grade) is not None
                         for s in slots)
            if not usable:
                taking = [s for s in slots if _accepted(s, e.subject_id)]
                levels_here = set()
                for s in taking:
                    levels_here.update(G.SCALES[s["scale"]]["levels"])
                found = []
                if e.grade in G.NON_SCORING_GRADES:
                    found.append(policy.get("non_scoring") if e.kind == "MTL_B" else "no_points")
                if not taking:
                    found.append("no_slot")
                elif e.level not in levels_here:
                    found.append((policy.get("levels") or {}).get(e.level))
                elif e.grade not in G.NON_SCORING_GRADES:
                    found.append((policy.get("grades") or {}).get("%s:%s" % (e.level, e.grade)))
                found = [c for c in found if c] or [FALLBACK]
                code = next((c for c in found if IGNORED_REASONS[c]["state"] == "rule"), found[0])
                check_silent = True
            else:
                others = [o for o in by_subject.get(e.subject_id, []) if o is not e]
                o = _preferred_other(e, others, slots) if others else None
                if o is not None:
                    if o.level != e.level:
                        code = policy.get("cross_level") or policy.get("same_level") or FALLBACK
                    elif o.year is not None and e.year is not None and o.year != e.year:
                        code = policy.get("same_level") or FALLBACK
                    else:
                        code = "duplicate"
                    items.append(_item(e, code, dict(fill, used=_used_text(o, e, labels))))
                    continue
        if code is None:
            continue
        items.append(_item(e, code, fill))
        if check_silent and IGNORED_REASONS[code]["state"] == "silent":
            silent.append((e, IGNORED_REASONS[code]))
    return items, silent


def silent_text(silent_pairs, labels):
    """'Chinese (N(A) 2), History (N(A) 4)' for messages."""
    return ", ".join("%s (%s %s)" % (e.name, labels.get(e.level, e.level), e.grade) for e, _ in silent_pairs)
