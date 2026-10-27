"""MER text -> engine subject ids, engine groups and grade predicates.

Every MER subject name is resolved through the engine's catalogue (`engine.subjects`). A name the catalogue does not
know, after the documented splitting rules below, is reported as an unresolved finding - never dropped silently.

Splitting rules (README "MER notation", each with its source):
  - A top-level " or ", "," or "/" (outside parentheses) separates alternative subjects:
    "Additional Mathematics, Mathematics or Principles of Accounts", "Computing/Computer Studies",
    "Science (Physics, Chemistry)/Physical Science". Inside parentheses the engine's own rule applies
    ("Science (Physics, Chemistry)" is one subject).
  - EXPLICIT_NAMES: names that need a stated reading (a slash inside parentheses that lists two subjects; ITE's
    "Science*" whose footnote names substitute subjects).
Grade notation (README "Grade notation"):
  - "1-7" on an O-Level course = O-Level grade 7 or better (A1 ... D7).
  - "1-4 or 1-3" beside "Higher Chinese or Chinese" = Higher Chinese 1-4, Chinese 1-3 (pairs in order).
  - "A-D or 1-5" = N(T) grade A-D or N(A) grade 1-5 (ITE JIE 'N').
  - "1-3" on a JIE 'H' / PFP course = N(A) grade 3 or better, O-Level grades converted by that exercise's table.
"""

import re

from engine import grades as G
from engine import subjects as SUB

RB = "source-pages/"

# Names that need a documented reading. Value: dict(subjects=[ids], groups=[engine group names], note, source).
EXPLICIT_NAMES = {
    "media studies(english,chinese)": {
        "subjects": ["media_studies_english", "media_studies_chinese"],
        "note": "'Media Studies (English/Chinese)' lists the two Media Studies subjects (MOE's aggregate-type PDF "
                "prints them as two lines)",
        "source": {"file": RB + "pdf_transcribed__aggregate_types_2026_jae.md", "heading": "ELR2B2-D 2nd Group"},
    },
    "mathematics(elementary,additional)": {
        "subjects": ["mathematics", "additional_mathematics"],
        "note": "'Mathematics (Elementary/Additional)' = Mathematics or Additional Mathematics (the consolidated MER "
                "PDF prints 'Additional Mathematics / Mathematics' for the same note)",
        "source": {"file": RB + "pdf__post_secondary_2027_jae_240be16f_8870_4b37_821e_4ae50200285a_pdf.md",
                   "heading": "ITE notes: 'To be eligible for admission, you must also have sat for Additional "
                              "Mathematics / Mathematics'"},
    },
    "science": {
        "groups": ["SCIENCE_ANY_LEVEL", "ITE_SCIENCE_SUBSTITUTES"],
        "note": "ITE's 'Mathematics or Science*': Science = the engine's SCIENCE_ANY_LEVEL group (no ITE list exists) "
                "plus the five subjects the footnote * allows in lieu of Science",
        "source": {"file": RB + "ite__jie_aggregates.md", "heading": "1.2 Group M/S and footnote *"},
    },
}

# "Any one of the 1st / 2nd group of Relevant Subjects for the ELR2B2-X Aggregate Type" -> engine group.
GROUP_PHRASE = re.compile(r"any\s+one\s+of\s+the\s+(1st|2nd|first|second)\s+group\s+of\s+relevant\s+subjects\s+for\s+"
                          r"the\s+(ELR2B2-[A-D])\s+aggregate(?:\s+type)?", re.I)
ANY_OTHER = re.compile(r"^(?:any\s+)?(one|two|three|1|2|3)\s+other\s+subjects?(?:\s*\(?excluding\s+cca\)?)?$", re.I)
FOLLOWING = re.compile(r"^(?:any\s+one\s+of\s+the\s+following(?:\s+relevant)?\s+subjects?|one\s+of\s+the\s+following"
                       r"(?:\s+relevant)?\s+subjects?|any\s+1\s+relevant\s+subjects?)$", re.I)
SAT_FOR = re.compile(r"must\s+(?:have\s+)?also\s+(?:have\s+)?sat\s+for\s+(.+?)\.?\s*$", re.I)
COMPLETED = re.compile(r"^completed\s+gce\s+'?n'?[\s-]*level$", re.I)
NUM = {"one": 1, "two": 2, "three": 3, "1": 1, "2": 2, "3": 3}


def clean(text):
    s = (text or "").replace("’", "'").replace("‘", "'")
    s = " ".join(s.split()).strip()
    prev = None
    while prev != s:
        prev = s
        s = s.rstrip(":").rstrip("*").rstrip(".").strip()
    return s


def group_for_phrase(nth, letters, institution_type):
    """'2nd', 'ELR2B2-C', 'ITE' -> engine group name (ITE has its own ELR2B2-C list)."""
    n = "1" if nth.lower() in ("1st", "first") else "2"
    suffix = letters.upper()[-1]
    if institution_type == "ITE":
        return "ITE_C_G" + n if suffix == "C" else None
    return "POLY_%s_G%s" % (suffix, n)


def _split_top(name):
    """Split on ' or ', ',' and '/' outside parentheses."""
    parts, depth, buf, i = [], 0, "", 0
    s = name
    while i < len(s):
        ch = s[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if depth == 0:
            if ch in ",/":
                parts.append(buf)
                buf = ""
                i += 1
                continue
            m = re.match(r"\s+or\s+", s[i:], re.I)
            if m:
                parts.append(buf)
                buf = ""
                i += m.end()
                continue
        buf += ch
        i += 1
    parts.append(buf)
    return [clean(p) for p in parts if clean(p)]


def resolve_name(name):
    """A MER subject phrase -> {subjects, groups, parts, unresolved, notes, sources}.

    subjects / groups together are the accepted set. `parts` keeps the printed alternatives in order (needed to pair
    "Higher Chinese or Chinese" with "1-4 or 1-3").
    """
    out = {"subjects": [], "groups": [], "parts": [], "unresolved": [], "notes": [], "sources": []}
    text = clean(name)
    if not text:
        out["unresolved"].append(name or "")
        return out
    whole = SUB.resolve_subject(text)
    if whole:
        out["subjects"].append(whole)
        out["parts"].append({"text": text, "subjects": [whole], "groups": []})
        return out
    key = SUB._norm(text)
    if key in EXPLICIT_NAMES:
        _apply_explicit(out, text, EXPLICIT_NAMES[key])
        return out
    for part in _split_top(text):
        sid = SUB.resolve_subject(part)
        pkey = SUB._norm(part)
        if sid:
            out["subjects"].append(sid)
            out["parts"].append({"text": part, "subjects": [sid], "groups": []})
        elif pkey in EXPLICIT_NAMES:
            _apply_explicit(out, part, EXPLICIT_NAMES[pkey])
        else:
            out["unresolved"].append(part)
            out["parts"].append({"text": part, "subjects": [], "groups": []})
    out["subjects"] = _dedupe(out["subjects"])
    out["groups"] = _dedupe(out["groups"])
    return out


def _apply_explicit(out, text, rule):
    out["subjects"].extend(rule.get("subjects", []))
    out["groups"].extend(rule.get("groups", []))
    out["parts"].append({"text": text, "subjects": list(rule.get("subjects", [])), "groups": list(rule.get("groups", []))})
    out["notes"].append(rule["note"])
    out["sources"].append(rule["source"])


def _dedupe(seq):
    seen, res = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            res.append(x)
    return res


def expand_ids(subjects, groups):
    ids = list(subjects)
    for g in groups:
        ids.extend(SUB.group_members(g))
    return _dedupe(ids)


def resolve_list(names):
    """A list of MER subject names (one per bullet) -> (ids, unresolved, notes)."""
    ids, unresolved, notes = [], [], []
    for n in names:
        r = resolve_name(n)
        ids.extend(expand_ids(r["subjects"], r["groups"]))
        unresolved.extend(r["unresolved"])
        notes.extend(r["notes"])
    return _dedupe(ids), unresolved, _dedupe(notes)


# ------------------------------------------------------------------------------------------- grade notation
_RANGE = re.compile(r"^\s*([1-9]|[A-E])\s*-\s*([1-9]|[A-E])\s*$")


def parse_grade_ranges(text):
    """'1-7' -> [('num', 1, 7)]; 'A-D or 1-5' -> [('let', 'A', 'D'), ('num', 1, 5)]; '1-4 or 1-3' -> two nums.

    Returns None if any piece is unreadable.
    """
    t = (text or "").strip()
    if not t:
        return None
    out = []
    for piece in re.split(r"\s+or\s+", t, flags=re.I):
        m = _RANGE.match(piece)
        if not m:
            return None
        a, b = m.group(1), m.group(2)
        if a.isdigit() and b.isdigit():
            out.append(("num", int(a), int(b)))
        elif a.isalpha() and b.isalpha():
            out.append(("let", a.upper(), b.upper()))
        else:
            return None
    return out


def o_level_worst(n):
    """O-Level grade number -> grade label: 1 -> A1 ... 9 -> F9 (engine G3 order)."""
    return G.GRADE_ORDER["G3"][n - 1]


def grade_predicate(ranges, scheme):
    """(ranges for ONE subject option, scheme) -> (max_grade {level: worst}, problem or None).

    scheme 'O'  : O-Level course (JAE). Only number ranges starting at 1; O-Level grade n or better.
    scheme 'N'  : ITE JIE 'N'. Letter range A-x = N(T) grade x or better; number range 1-x = N(A) grade x or better.
    """
    pred = {}
    for kind, lo, hi in ranges:
        if scheme == "O":
            if kind != "num" or lo != 1 or not 1 <= hi <= 9:
                return None, "grade range %s-%s is not O-Level notation" % (lo, hi)
            pred["G3"] = o_level_worst(hi)
        elif scheme == "N":
            if kind == "let":
                if lo != "A" or hi not in G.GRADE_ORDER["G1"]:
                    return None, "unreadable N(T) range %s-%s" % (lo, hi)
                pred["G1"] = hi
            else:
                if lo != 1 or not 1 <= hi <= 6:
                    return None, "unreadable N(A) range %s-%s" % (lo, hi)
                pred["G2"] = str(hi)
        else:
            return None, "unknown scheme %s" % scheme
    return pred, None


def max_points(ranges):
    """JIE 'H' / PFP: '1-4' -> 4 (N(A) grade = points on the exercise's scale). None if unreadable."""
    if not ranges or len(ranges) != 1:
        return None
    kind, lo, hi = ranges[0]
    if kind != "num" or lo != 1:
        return None
    return hi
