"""Bonus points: net = gross - bonus, with each exercise's schedule and cap (definitions.BONUS_*).

bonus_inputs (all optional):
  cca            CCA grade: "Excellent" / "Good" / "Fair" ..., or an older A1..C6 CCA grade
  affiliated_jc  True if the student's secondary school is affiliated to the JC applied for (JC choices only)
  lep            True if applying for / selected for CLEP, MLEP or TLEP at a JC (not TLEP at UPTLC)

Item types
  cca         table lookup on the CCA grade
  grades_all  every requirement (a subject group) has a subject at `level` with grade <= max_grade
  grades_any  any subject in `accepts` at `level` with grade <= max_grade
  flag        bonus_inputs[flag] is truthy
Items with scope "choice" only apply to some course choices (affiliated JC, language electives); they never
change the base net but appear in `variants`.
"""

from . import grades as G
from .engine import accepts_ids


def _best_grade_ok(entries, accepts, level, max_grade):
    ids = accepts_ids(accepts)
    for e in entries:
        if ids is not None and e.subject_id not in ids:
            continue
        if e.level == level and G.grade_at_or_better(level, e.grade, max_grade):
            return True
    return False


def _item_points(item, entries, inputs):
    t = item["type"]
    if t == "cca":
        raw = inputs.get("cca")
        if raw is None:
            return 0, "CCA grade not given"
        pts = item["table"].get(str(raw).strip().upper(), 0)
        return pts, "CCA %s" % raw
    if t == "grades_all":
        ok = all(_best_grade_ok(entries, req, item["level"], item["max_grade"]) for req in item["requirements"])
        return (item["points"], "met") if ok else (0, "not met")
    if t == "grades_any":
        ok = _best_grade_ok(entries, item["accepts"], item["level"], item["max_grade"])
        return (item["points"], "met") if ok else (0, "not met")
    if t == "flag":
        return (item["points"], "flag set") if inputs.get(item["flag"]) else (0, "flag not set")
    raise ValueError("unknown bonus item type %r" % t)


def compute_bonus(schedule, entries, inputs):
    """Returns {base, items, cap, variants{label: bonus}} or None if no schedule."""
    if schedule is None:
        return None
    inputs = inputs or {}
    items, base_capped, choice_capped, choice_uncapped = [], 0, [], []
    for item in schedule["items"]:
        pts, why = _item_points(item, entries, inputs)
        scope = item.get("scope", "all")
        items.append({"id": item["id"], "label": item["label"], "points": pts, "detail": why, "scope": scope,
                      "capped": True, "applies_to": item.get("applies_to")})
        if pts:
            if scope == "choice":
                choice_capped.append((item, pts))
            else:
                base_capped += pts
    base_uncapped = 0
    for item in schedule.get("uncapped", []):
        pts, why = _item_points(item, entries, inputs)
        scope = item.get("scope", "all")
        items.append({"id": item["id"], "label": item["label"], "points": pts, "detail": why, "scope": scope,
                      "capped": False, "applies_to": item.get("applies_to")})
        if pts:
            if scope == "choice":
                choice_uncapped.append((item, pts))
            else:
                base_uncapped += pts
    cap = schedule["cap"]
    base = min(base_capped, cap) + base_uncapped
    variants = {}
    # every non-empty combination of choice-scoped items (at most two exist: affiliated JC, LEP)
    choice = [(it, p, True) for it, p in choice_capped] + [(it, p, False) for it, p in choice_uncapped]
    n = len(choice)
    for mask in range(1, 1 << n):
        picked = [choice[k] for k in range(n) if mask & (1 << k)]
        capped = base_capped + sum(p for _, p, c in picked if c)
        uncapped = base_uncapped + sum(p for _, p, c in picked if not c)
        label = " + ".join(it["label"].split(" (")[0] for it, _, _ in picked)
        scopes = {it.get("applies_to") for it, _, _ in picked if it.get("applies_to")}
        if scopes:
            label += " [%s choices only]" % "/".join(sorted(scopes))
        variants[label] = min(capped, cap) + uncapped
    return {"base": base, "items": items, "cap": cap, "variants": variants, "source": schedule.get("source")}
