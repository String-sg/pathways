"""MOE's consolidated list of 2027 JAE courses with MER (PDF text, extracted with pdfplumber) -> MER per course code.

Used for two things only (the CourseFinder JSON stays the primary source):
  1. a fallback where the JSON line is empty or unreadable (e.g. C23 / T72 have no subject list; T66 has no slot-2
     name; four ITE JAE courses print N-Level notation for English);
  2. a cross-check of every Poly / ITE JAE course: where both sources are readable and disagree, the matcher
     evaluates both readings and only gives a definite answer when they agree.

Table layout: one Markdown table per PDF table; the MER cell is merged across the courses that share it, so a row
with an empty MER cell inherits the previous row's MER inside the same table (never across tables).
"""

import os
import re

PDF_FILE = "source-pages/pdf__post_secondary_2027_jae_240be16f_8870_4b37_821e_4ae50200285a_pdf.md"

_CODE = re.compile(r"^((?:[CNRST]\d{2})|(?:V\d{2}))\*?$")
_LETTER = re.compile(r"^([a-e])\)\s*(.*)$")
_GRADE_TOKEN = re.compile(r"\b(?:\d-\d|[A-E]-[A-E])(?:\s+or\s+(?:\d-\d|[A-E]-[A-E]))*\b")
_NOTE_START = re.compile(r"^(Note:|To be eligible|\*)", re.I)


def _root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _tables(text):
    tables, cur = [], None
    for ln in text.split("\n"):
        m = re.match(r"^### Page (\d+) table (\d+)", ln)
        if m:
            cur = {"page": int(m.group(1)), "rows": []}
            tables.append(cur)
            continue
        if ln.startswith("## Page"):
            cur = None
            continue
        if cur is not None and ln.startswith("|"):
            cur["rows"].append([c.strip() for c in ln.strip().strip("|").split("|")])
    return tables


def parse_cell(cell):
    """MER cell text -> {lines: [{letter, text, name, grades: [...]}], bullets per line, notes: [...]}."""
    frags = [f.strip() for f in cell.split("<br>")]
    lines, notes, mode = [], [], None
    for f in frags:
        if not f or f.lower() in ("subject grade", "subject", "grade"):
            continue
        if f.lower().startswith("subject grade"):
            f = f[len("subject grade"):].strip()
            if not f:
                continue
        m = _LETTER.match(f)
        if m:
            lines.append({"letter": m.group(1), "raw": [m.group(2)], "bullets": []})
            mode = "line"
            continue
        if _NOTE_START.match(f):
            notes.append(f)
            mode = "note"
            continue
        if f.startswith("•"):
            if lines:
                lines[-1]["bullets"].append(f.lstrip("•").strip())
                mode = "bullet"
            continue
        if mode == "bullet" and lines:
            lines[-1]["bullets"][-1] += " " + f
        elif mode == "line" and lines:
            lines[-1]["raw"].append(f)
        elif mode == "note":
            notes[-1] += " " + f
    out = []
    for ln in lines:
        text = " ".join(ln["raw"])
        grades = _GRADE_TOKEN.findall(text)
        name = _GRADE_TOKEN.sub(" ", text)
        name = " ".join(name.split()).strip().rstrip(":").strip()
        out.append({"letter": ln["letter"], "text": text, "name": name, "grades": grades,
                    "bullets": [" ".join(b.split()) for b in ln["bullets"]]})
    return {"lines": out, "notes": [" ".join(n.split()) for n in notes]}


def load(path=None):
    """{course_code: {page, how: own|inherit, lines, notes, net_range}} for every Poly / ITE JAE row in the PDF."""
    path = path or os.path.join(_root(), PDF_FILE)
    with open(path, encoding="utf-8") as f:
        text = f.read()
    found = {}
    for t in _tables(text):
        last = None
        for cells in t["rows"]:
            idx = next((i for i, c in enumerate(cells) if _CODE.match(c)), None)
            if idx is None:
                continue
            code = _CODE.match(cells[idx]).group(1)
            mer_cells = [c for c in cells if re.search(r"(^|<br>\s*)a\)", c)]
            rng = next((c for c in cells[idx + 1:idx + 4] if re.match(r"^(\d+\s*to\s*\d+\*?|-)$", c)), None)
            if mer_cells:
                last = parse_cell(mer_cells[0])
                how = "own"
            elif last is not None:
                how = "inherit"
            else:
                continue
            found.setdefault(code, dict(page=t["page"], how=how, lines=last["lines"], notes=last["notes"],
                                        net_range=rng))
    return found
