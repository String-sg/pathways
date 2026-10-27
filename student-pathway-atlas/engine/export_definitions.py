"""Dump every rule the engine uses to engine/definitions.json (for the JavaScript port).

    python3 -m engine.export_definitions          (or: python3 engine/export_definitions.py)

The JSON holds data only: grade scales, level / grade aliases, the subject catalogue and groups, every
aggregate definition (slots, alternatives, bonus schedule, eligibility checks, sources), and the exam-year
combination rule. The search itself (engine.py) is ~150 lines to port; see README "Porting to JavaScript".
Output is deterministic (no timestamp) so a diff shows real rule changes.
"""

import json
import os
import sys

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    __package__ = "engine"

from engine import ENGINE_VERSION  # noqa: E402
from engine import grades as G  # noqa: E402
from engine import engine as E  # noqa: E402
from engine import subjects as SUB  # noqa: E402
from engine.definitions import (ALTERNATIVE_RULE, COMBINE_RULE, DEFINITIONS, DISPLAY_NAME_RULE,  # noqa: E402
                                EMPTY_SLOT_RULE, IGNORED_REASONS, LEVEL_LABELS, SUMMARIES)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "definitions.json")


def id_table():
    rows = []
    for d in DEFINITIONS:
        scales = sorted({s["scale"] for s in d["slots"]})
        rows.append({"id": d["id"], "display_name": d.get("display_name"), "letters": d.get("letters"),
                     "route_tag": d.get("route_tag"),
                     "exam_year": d.get("exam_year"), "exercise": d.get("exercise"),
                     "institution": d.get("institution"), "route": d.get("route"), "scales": scales,
                     "status": d.get("status")})
    return rows


def groups():
    """Groups as printed, plus `effective_members` where earlier O-Level subjects join by MOE category."""
    out = {}
    for name, spec in SUB.GROUPS.items():
        g = dict(spec)
        if spec.get("earlier_by_category"):
            g["effective_members"] = SUB.slot_members(name)
        out[name] = g
    return out


def build():
    return {
        "engine_version": ENGINE_VERSION,
        "generated_by": "engine/export_definitions.py",
        "levels": {"aliases": G.LEVEL_ALIASES, "normalise": G.LEVEL_NORMALISE, "grade_order": G.GRADE_ORDER,
                   "grade_aliases": G.GRADE_ALIASES, "grades_by_kind": G.GRADES_BY_KIND,
                   "absent_aliases": sorted(G.ABSENT_ALIASES), "absent_scores_as": G.ABSENT_SCORES_AS,
                   "non_scoring_grades": G.NON_SCORING_GRADES, "grade_strip_words": G.GRADE_STRIP_WORDS},
        "mark_bands": G.SCHOOL_COCKPIT_MARK_BANDS,
        "scales": G.SCALES,
        "subjects": SUB.SUBJECTS,
        "subject_name_matching": {
            "rule": ("case, quotes and spacing ignored; '&' outside parentheses reads 'and'; inside parentheses ',', "
                     "'/', '&' and 'and' are the same separator; a leading 'G1 '/'G2 '/'G3 ' in an unknown name is "
                     "read as the level"),
            "separator_in_parens_regex": SUB._SEP_IN_PARENS.pattern,
            "normalise": SUB.NAME_NORMALISE,
            "level_prefix": E.LEVEL_PREFIX,
            "level_specific_names": SUB.LEVEL_SPECIFIC_NAMES,
            "only_level_sources": SUB.ONLY_LEVEL_SOURCES,
        },
        "examined_levels": SUB.EXAMINED_LEVELS,
        "groups": groups(),
        "earlier_by_category": SUB.EARLIER_BY_CATEGORY,
        "combine_rule": COMBINE_RULE,
        "alternative_rule": ALTERNATIVE_RULE,
        "empty_slot_rule": EMPTY_SLOT_RULE,
        "display_name_rule": DISPLAY_NAME_RULE,
        "ignored_reasons": IGNORED_REASONS,
        "level_labels": LEVEL_LABELS,
        "id_table": id_table(),
        "definitions": DEFINITIONS,
        "summaries": SUMMARIES,
    }


def dumps():
    return json.dumps(build(), indent=1, ensure_ascii=False, sort_keys=False) + "\n"


def main():
    text = dumps()
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote %s (%d definitions, %d subjects, %d groups, %d scales, %d bytes)"
          % (OUT, len(DEFINITIONS), len(SUB.SUBJECTS), len(SUB.GROUPS), len(G.SCALES), len(text.encode("utf-8"))))


if __name__ == "__main__":
    main()
