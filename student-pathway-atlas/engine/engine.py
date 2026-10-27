"""Slot assignment: exact search (lowest total over every valid assignment) and greedy-in-slot-order.

Rules applied to every definition (sources in definitions.COMBINE_RULE and each definition):
- each subject fills at most one slot;
- the same subject sat twice (two sittings, or two levels) counts once, with the better entry for that slot's scale;
- MTL / HMTL rule per definition (`mtl_rule`);
- excluded groups (Religious Knowledge for JC / MI) never fill a slot;
- a grade that a slot's scale does not list cannot be used.

The exact search ranks complete assignments by
  (total, number of soft-MER misses, points slot by slot, input order)
so among equal totals it prefers picks that meet subject requirements, then the better grade in the
earlier slot (e.g. "the subject with the better grade will be used for B1"), then the student's input order.
Greedy fills slots in order, each with the lowest-points unused subject (ties: input order).
"""

import re
from itertools import combinations

from . import grades as G
from . import subjects as SUB


class Entry(object):
    """One subject result as given by the caller, normalised."""

    __slots__ = ("idx", "raw_name", "subject_id", "name", "known", "kind", "family", "level", "grade", "year",
                 "raw_level", "raw_grade")

    def __init__(self, idx, raw_name, subject_id, name, known, kind, family, level, grade, year, raw_level, raw_grade):
        self.idx = idx
        self.raw_name = raw_name
        self.subject_id = subject_id
        self.name = name
        self.known = known
        self.kind = kind
        self.family = family
        self.level = level
        self.grade = grade
        self.year = year
        self.raw_level = raw_level
        self.raw_grade = raw_grade

    def describe(self):
        return {"subject_id": self.subject_id, "subject": self.name, "input_name": self.raw_name,
                "level": self.level, "grade": self.grade, "year": self.year}


# A level written into an unknown subject name ("G1 Science"): exported to definitions.json for the JavaScript port.
LEVEL_PREFIX = {"regex": r"^\s*(G[123])\s+(.+)$", "ignore_case": True}
_LEVEL_PREFIX = re.compile(LEVEL_PREFIX["regex"], re.IGNORECASE if LEVEL_PREFIX["ignore_case"] else 0)


def _problem(i, name, field, value, problem, action):
    return {"row": i + 1, "subject": name, "field": field, "value": value, "problem": problem, "action": action}


def _blank(v):
    return v is None or (isinstance(v, str) and not v.strip())


def _year_hint(v):
    """The row's exam year as prepare_entries reads it, without reporting anything (used to pick SEAB's list)."""
    if _blank(v):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def prepare_entries(subject_rows):
    """Caller rows -> (entries, warnings, input_problems). A row: {subject, level, grade | mark, year?}.

    input_problems (loud: every Result carries them) - a row that was dropped, or kept but may be misread:
      unreadable / missing level, unreadable grade, missing subject name   -> row ignored
      subject not in the catalogue, or a name that is ambiguous at that level -> kept as an 'Others' subject
      level that contradicts the subject's only level, unreadable year      -> kept as given
    warnings (quiet): a level defaulted for a one-level subject or taken from a 'G1 ...' name prefix, a grade
    derived from a mark.
    """
    entries, warnings, problems = [], [], []
    for i, row in enumerate(subject_rows or []):
        name = row.get("subject") or row.get("name")
        if _blank(name):
            problems.append(_problem(i, name, "subject", name, "no subject name", "row ignored"))
            continue
        name = str(name)
        raw_level = row.get("level")
        level = G.normalise_level(raw_level)

        # A level written into the name ("G1 Science", "G3 Computing"): used only when the full name is unknown.
        core, prefix_level = name, None
        m = _LEVEL_PREFIX.match(name)
        if m and SUB.resolve_subject(name) is None:
            core, prefix_level = m.group(2), m.group(1).upper()

        if level is None:
            if not _blank(raw_level):
                problems.append(_problem(i, name, "level", raw_level, "unreadable level %r" % raw_level, "row ignored"))
                continue
            if prefix_level:
                level = prefix_level
                warnings.append("row %d (%s): no level given - %s taken from the subject name" % (i + 1, name, level))
            else:
                sid0 = SUB.resolve_subject(core)
                y0 = _year_hint(row.get("year"))
                only = SUB.default_level(sid0, y0) if sid0 else None
                if only is None:
                    problems.append(_problem(i, name, "level", raw_level, "no level given", "row ignored"))
                    continue
                level = only
                warnings.append("row %d (%s): no level given - %s, so %s is assumed"
                                % (i + 1, name, SUB.examined_text(sid0, SUB.examined_levels(sid0, y0))[:-1], only))
        elif prefix_level and prefix_level != level:
            problems.append(_problem(i, name, "level", raw_level, "level %s contradicts the %s in the subject name"
                                     % (level, prefix_level), "level column used"))

        raw_grade = row.get("grade")
        if _blank(raw_grade) and row.get("mark") is not None:
            raw_grade = G.mark_to_grade(level, row.get("mark"))
            warnings.append("row %d (%s): grade %s derived from mark %s using the usual school mark bands (not MOE text)"
                            % (i + 1, name, raw_grade, row.get("mark")))
        sid_k, _ = SUB.resolve_subject_at(core, level)
        kind = SUB.SUBJECTS_BY_ID[sid_k]["kind"] if sid_k else None
        grade = G.normalise_grade(level, raw_grade, kind)
        if grade is None:
            if kind in G.GRADES_BY_KIND:
                msg = "grade %r: a 'B' Syllabus is graded Merit / Pass / Ungraded" % raw_grade
            else:
                msg = "unreadable grade %r for level %s" % (raw_grade, level)
            problems.append(_problem(i, name, "grade", raw_grade, msg, "row ignored"))
            continue

        year = row.get("year")
        try:
            year = int(year) if not _blank(year) else None
        except (TypeError, ValueError):
            problems.append(_problem(i, name, "year", year, "unreadable year %r" % year,
                                     "used for every exam year"))
            year = None

        sid, hint = SUB.resolve_subject_at(core, level)
        if sid is None:
            key = "unknown:" + " ".join(name.lower().split())
            entries.append(Entry(i, name, key, name, False, "OTHER", None, level, grade, year, raw_level, raw_grade))
            problems.append(_problem(i, name, "subject", name,
                                     ("ambiguous at %s: %s" % (level, hint)) if hint else "subject not in the catalogue",
                                     "treated as an 'Others' subject (fills 'any subject' slots only)"))
            continue
        s = SUB.SUBJECTS_BY_ID[sid]
        found = SUB.examined_levels(sid, year)  # SEAB's lists for the row's year (engine 0.1.6)
        if found and level not in found[0]:
            problems.append(_problem(i, name, "level", raw_level, SUB.examined_text(sid, found), "kept as given"))
        entries.append(Entry(i, name, sid, s["name"], True, s["kind"], s["family"], level, grade, year,
                             raw_level, raw_grade))
    return entries, warnings, problems


# --------------------------------------------------------------------------------------------- slot helpers
def accepts_ids(accepts):
    """Resolve an `accepts` spec to a set of subject ids, or None meaning 'any subject'."""
    if accepts.get("any"):
        return None
    ids = set(accepts.get("subjects", []))
    for g in accepts.get("groups", []):
        ids.update(SUB.slot_members(g))
    return ids


def effective_slots(defn, alternative=None, slot_accepts=None):
    slots = []
    over = (alternative or {}).get("slot_overrides", {})
    for s in defn["slots"]:
        s2 = dict(s)
        if s["name"] in over:
            s2.update(over[s["name"]])
        if slot_accepts and s["name"] in slot_accepts:
            s2["accepts"] = slot_accepts[s["name"]]
        slots.append(s2)
    return slots


def mer_ok(mer, scale, entry, pts):
    if not mer:
        return True
    if entry.grade == "ABS":
        return False
    if mer.get("exclude_mer_unusable") and G.is_mer_unusable(scale, entry.level, entry.grade):
        return False
    mx = mer.get("max_points")
    if mx is not None and pts > mx:
        return False
    return True


class Cand(object):
    __slots__ = ("sid", "entry", "points", "mer_ok", "rank")

    def __init__(self, sid, entry, points, mer_ok_, rank=0):
        self.sid = sid
        self.entry = entry
        self.points = points
        self.mer_ok = mer_ok_
        self.rank = rank


def build_candidates(slots, entries, exclude_ids, hard_mer=None):
    """For each slot, the usable subjects with their best entry on that slot's scale.

    hard_mer: {slot_name: mer} - entries failing it are dropped (constrained eligibility search).
    """
    by_subject = {}
    for e in entries:
        by_subject.setdefault(e.subject_id, []).append(e)
    out = []
    for s in slots:
        scale = G.SCALES[s["scale"]]
        allowed = accepts_ids(s["accepts"])
        soft = s.get("mer")
        hard = (hard_mer or {}).get(s["name"])
        cands = []
        for sid, ents in by_subject.items():
            if sid in exclude_ids:
                continue
            if allowed is not None and sid not in allowed:
                continue
            best = None
            for e in ents:
                p = G.points(scale, e.level, e.grade)
                if p is None:
                    continue
                if hard is not None and not mer_ok(hard, scale, e, p):
                    continue
                ok = mer_ok(soft, scale, e, p)
                key = (p, 0 if ok else 1, e.idx)
                if best is None or key < best[0]:
                    best = (key, Cand(sid, e, p, ok))
            if best is not None:
                cands.append(best[1])
        cands.sort(key=lambda c: (c.points, 0 if c.mer_ok else 1, c.entry.idx))
        for r, c in enumerate(cands):
            c.rank = r
        out.append(cands)
    return out


def conflicts(a, b, rule):
    """MTL / HMTL rule between two candidate entries."""
    if rule is None:
        return False
    kinds = {a.entry.kind, b.entry.kind}
    if rule == "same_language":
        return kinds == {"MTL", "HMTL"} and a.entry.family == b.entry.family
    if rule == "any_language":
        return "HMTL" in kinds and (("MTL" in kinds) or ("MTL_IN_LIEU" in kinds))
    raise ValueError("unknown mtl_rule %r" % rule)


def _slot_signature(s, hard_mer=None):
    hard = (hard_mer or {}).get(s["name"]) or {}
    return (repr(sorted(s["accepts"].items())), s["scale"], repr(sorted((s.get("mer") or {}).items())),
            repr(sorted(hard.items())))


# --------------------------------------------------------------------------------------------- searches
def exact_search(slots, cands, rule, hard_mer=None):
    """Lowest-total complete assignment, or None. Returns (key, [Cand per slot]).

    Consecutive identical slots (same accepts, scale and requirements) are filled in candidate-rank order only,
    which removes permutations without losing the optimum.
    """
    n = len(slots)
    if any(len(c) == 0 for c in cands):
        return None
    same_prev = [i > 0 and _slot_signature(slots[i], hard_mer) == _slot_signature(slots[i - 1], hard_mer)
                 for i in range(n)]
    lb = [0] * (n + 1)
    for i in range(n - 1, -1, -1):
        lb[i] = lb[i + 1] + cands[i][0].points
    best = [None]

    def dfs(i, used, picked, total, misses):
        if best[0] is not None and total + lb[i] > best[0][0][0]:
            return
        if i == n:
            key = (total, misses, tuple(c.points for c in picked), tuple(c.entry.idx for c in picked))
            if best[0] is None or key < best[0][0]:
                best[0] = (key, list(picked))
            return
        start = picked[-1].rank + 1 if same_prev[i] else 0
        for c in cands[i][start:]:
            if c.sid in used:
                continue
            if any(conflicts(c, p, rule) for p in picked):
                continue
            used.add(c.sid)
            picked.append(c)
            dfs(i + 1, used, picked, total + c.points, misses + (0 if c.mer_ok else 1))
            picked.pop()
            used.discard(c.sid)

    dfs(0, set(), [], 0, 0)
    return best[0]


def greedy_search(slots, cands, rule):
    """Fill slots in order with the lowest-points unused subject (ties: input order). Returns [Cand] or None."""
    used, picked = set(), []
    for i in range(len(slots)):
        choice = None
        for c in sorted(cands[i], key=lambda c: (c.points, c.entry.idx)):
            if c.sid in used or any(conflicts(c, p, rule) for p in picked):
                continue
            choice = c
            break
        if choice is None:
            return None
        used.add(choice.sid)
        picked.append(choice)
    return picked


def brute_force(slots, cands, rule):
    """Reference implementation for tests: every permutation, no pruning. Returns min total or None."""
    best = None

    def rec(i, used, picked, total):
        nonlocal best
        if i == len(slots):
            if best is None or total < best:
                best = total
            return
        for c in cands[i]:
            if c.sid in used or any(conflicts(c, p, rule) for p in picked):
                continue
            rec(i + 1, used | {c.sid}, picked + [c], total + c.points)

    rec(0, frozenset(), [], 0)
    return best


# --------------------------------------------------------------------------------------------- per definition
def exclude_ids_for(defn):
    ids = set()
    for g in defn.get("exclude_groups", []):
        ids.update(SUB.group_members(g))
    return ids


def slot_rows(slots, picks):
    rows = []
    for s, c in zip(slots, picks):
        rows.append({"slot": s["name"], "label": s["label"], "subject_id": c.sid, "subject": c.entry.name,
                     "input_name": c.entry.raw_name, "level": c.entry.level, "grade": c.entry.grade,
                     "year": c.entry.year, "points": c.points, "scale": s["scale"],
                     "meets_slot_requirement": c.mer_ok if s.get("mer") else None})
    return rows


def explain_failure(slots, cands):
    empty = [s["label"] for s, c in zip(slots, cands) if not c]
    if empty:
        return "no usable subject for " + "; ".join(empty)
    return ("not enough different usable subjects to fill every slot (each subject counts once; "
            "MTL / HMTL rule applied)")


def solve(defn, entries, alternative=None, slot_accepts=None, hard_mer=None):
    """Exact + greedy for one alternative. Returns a dict (never raises for infeasible inputs)."""
    slots = effective_slots(defn, alternative, slot_accepts)
    cands = build_candidates(slots, entries, exclude_ids_for(defn), hard_mer)
    rule = defn.get("mtl_rule")
    exact = exact_search(slots, cands, rule, hard_mer)
    greedy = greedy_search(slots, cands, rule) if hard_mer is None else None
    out = {"alternative": alternative["id"] if alternative else None,
           "label": alternative["label"] if alternative else None,
           "slots_def": slots}
    if exact is None:
        out.update({"gross": None, "slots": [], "picks": [], "reason": explain_failure(slots, cands), "misses": None})
    else:
        key, picks = exact
        out.update({"gross": key[0], "misses": key[1], "picks": picks, "slots": slot_rows(slots, picks), "reason": None})
    if greedy is not None:
        out["greedy_total"] = sum(c.points for c in greedy)
        out["greedy_slots"] = slot_rows(slots, greedy)
    else:
        out["greedy_total"] = None
        out["greedy_slots"] = []
    return out


def year_sets(entries, max_year, single_year_levels=None):
    """Usable entries for a definition, split into 2-exam-year combinations when the caller gave more years.

    single_year_levels: levels whose results from different years may not be combined (NAFA's NFP: "N-Level results
    from different years cannot be combined") - each combination is split by that level's year.
    """
    usable = [e for e in entries if e.year is None or max_year is None or e.year <= max_year]
    years = sorted({e.year for e in usable if e.year is not None})
    if len(years) <= 2:
        combos = [(tuple(years), usable)]
    else:
        combos = [(pair, [e for e in usable if e.year is None or e.year in pair]) for pair in combinations(years, 2)]
    if not single_year_levels:
        return combos
    out = []
    for yrs, ents in combos:
        split = sorted({e.year for e in ents if e.level in single_year_levels and e.year is not None})
        if len(split) <= 1:
            out.append((yrs, ents))
            continue
        for y in split:
            out.append((yrs, [e for e in ents if e.level not in single_year_levels or e.year is None or e.year == y]))
    return out
