#!/usr/bin/env python3
"""Build the student page: one self-contained HTML file, no network requests.

    python3 app/tools/build_app.py            # -> app/dist/Student Pathway Atlas v<APP_VERSION>.html
    python3 app/tools/build_app.py --dev      # -> app/src/ui/_fixtures/dev.html (Python engine via dev_server.py)

Inlines, in this order: the typeface (app/src/ui/fonts/SpaceGrotesk-latin.woff2, the Bright theme, as a data: URI so
the page still makes no network request), the design tokens (app/src/ui/tokens_from_atlas.css + app_tokens.css), app.css, the engine
data (app/build/data.json, from app/tools/build_data.py), the page data assembled here (map dots, coastline,
secondary schools and their affiliated JCs, poly school labels, the calendar: school terms, exercise date fills and
the current-cycle exercise rows, the RIASEC table, the arts institutions), the engine + matcher (app/src/pse_core.js)
and the page code (app/src/ui/app.js).

Build checks (the build stops on a failure):
  - no colour literal in app.css / app.js (the token contract: colours live in the two token files only);
  - APP_VERSION in app.js matches the file name, the <title> and the version pill;
  - no external resource in the shell (scripts, styles, fonts, images);
  - last year's range is read in one place only (app.js `lastYearRange`), which refuses PFP and PSE rows;
  - PFP requirement records carry no `net_range_2026` (their snapshot range is JAE's: critic finding 5);
"""

import argparse
import base64
import csv
import json
import os
import re
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ROOT = os.path.dirname(APP)
UI = os.path.join(APP, "src", "ui")
FIX = os.path.join(UI, "_fixtures")
CORE = os.path.join(APP, "src", "pse_core.js")
FONT = os.path.join(UI, "fonts", "SpaceGrotesk-latin.woff2")  # SIL Open Font Licence 1.1: see fonts/README.md
DATA_JSON = os.path.join(APP, "build", "data.json")
SCHOOLS_DIR = os.path.join(ROOT, "data", "schools")  # copied from the SG School Atlas

SNAPSHOT = "2026-10-17"
INSTITUTIONS_CSV = os.path.join(ROOT, "data", "locations", "institutions_%s.csv" % SNAPSHOT)
COAST_JSON = os.path.join(ROOT, "data", "geo", "sg_outline.json")
EXERCISES_CSV = os.path.join(ROOT, "data", "exercises", "exercises_%s.csv" % SNAPSHOT)
TAXONOMY_CSV = os.path.join(ROOT, "data", "taxonomy", "course_taxonomy_%s.csv" % SNAPSHOT)
TERMS_CSV = os.path.join(ROOT, "data", "calendar", "school_terms.csv")
FILLS_CSV = os.path.join(ROOT, "data", "calendar", "exercise_date_fills.csv")
RIASEC_CSV = os.path.join(ROOT, "data", "taxonomy", "riasec_fields.csv")
ARTS_CSV = os.path.join(ROOT, "data", "locations", "arts_institutions_2027.csv")
SUBJECT_LEVELS_CSV = os.path.join(ROOT, "data", "taxonomy", "subjects_by_level.csv")

HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
# D16 / N14: words the built page must never contain (case-insensitive)
FORBIDDEN = re.compile(r"[/\\](?:Users|home)[/\\]\w")  # a local path must never reach the page



def die(msg):
    sys.stderr.write("build_app: " + msg + "\n")
    sys.exit(1)


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def font_face():
    """the one typeface, built in (latin only: other characters, such as ✓ and ✗, come from the system font)."""
    if not os.path.exists(FONT):
        die("app/src/ui/fonts/SpaceGrotesk-latin.woff2 is missing")
    with open(FONT, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return ('@font-face{font-family:"Space Grotesk";font-style:normal;font-weight:300 700;font-display:swap;'
            'src:url(data:font/woff2;base64,%s) format("woff2")}' % b64)


def json_safe(text):
    """Inline JSON inside <script>: '</' would end the element; '<\\/' is the same string to JSON.parse."""
    return text.replace("</", "<\\/")


def js_safe(text):
    """Inline JS inside <script>: only '</script' ends the element (a blanket '</' swap would break regex literals)."""
    return re.sub(r"</(script)", r"<\\/\1", text, flags=re.I)


def strip_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(^|[^:\\])//[^\n]*", r"\1", src)


# ------------------------------------------------------------------------------------------------- page data
def institutions():
    out = []
    with open(INSTITUTIONS_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["type"] not in ("JC", "MI", "Poly", "ITE"):
                continue  # NUS High, SOTA, Sports School: no JAE courses
            out.append({"id": r["id"], "name": r["name"], "type": r["type"], "lat": float(r["lat"]),
                        "lng": float(r["lng"]), "website": r["website"], "moe_page": r["moe_page"]})
    return out


def coast():
    d = json.loads(read(COAST_JSON))
    return {"rings": d["rings"], "credit": d["credit_line"]}


def read_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def calendar():
    """D14: the key dates. School terms and holidays (MOE), the date fills (confirmed / inferred / month_only) and the
    current-cycle exercise rows. Previous-cycle rows are never inlined, so the page cannot draw one as this year's."""
    terms = [{k: r[k] for k in ("year", "kind", "name", "date_start", "date_end")} for r in read_csv(TERMS_CSV)
             if r["kind"] in ("term", "holiday") and r["date_start"] and r["date_end"]]
    fills = [{k: r[k] for k in ("exercise_id", "phase_prefix", "date_start", "date_end", "basis", "note", "source")}
             for r in read_csv(FILLS_CSV)]
    for f in fills:
        if f["basis"] not in ("confirmed", "inferred", "month_only"):
            die("exercise_date_fills.csv: unknown basis %r" % f["basis"])
    keep = ("exercise_id", "phase", "date_text", "date_start", "date_end", "source_url")
    rows = [{k: r[k] for k in keep} for r in read_csv(EXERCISES_CSV) if r["cycle_status"] == "current"]
    return {"terms": terms, "fills": fills, "rows": rows}


def riasec():
    """The letters -> field table (our suggestion, from Holland's type descriptions; labelled so on the page)."""
    return [{"field": r["field_name"], "letters": r["primary_letters"]} for r in read_csv(RIASEC_CSV)]


def subject_levels():
    """D19: the subject x level pairs that exist (SEAB, data/taxonomy/subjects_by_level.csv), school candidates only.
    [] when the file is missing."""
    if not os.path.exists(SUBJECT_LEVELS_CSV):
        return []
    sys_level = {"O2026": "O", "NA2026": "N(A)", "NT2026": "N(T)"}
    merged = {}
    for r in read_csv(SUBJECT_LEVELS_CSV):
        if not r.get("availability", "").startswith("school"):
            continue
        name = (r.get("engine_name") or "").strip() or (r.get("subject_seab_name") or "").strip()
        system = r.get("system", "")
        if not name or not system:
            continue
        if system.startswith("SEC"):
            year, levels = 2027, [x.strip() for x in r.get("levels", "").replace(",", ";").split(";") if x.strip()]
        elif system in sys_level:
            year, levels = 2026, [sys_level[system]]
        else:
            die("subjects_by_level.csv: unknown system %r" % system)
        key = (name, year)
        merged.setdefault(key, {"levels": [], "seab": ""})
        for lv in levels:
            if lv not in merged[key]["levels"]:
                merged[key]["levels"].append(lv)
        seab = (r.get("subject_seab_name") or "").strip()
        # SEAB's own, shorter name where the engine's name only adds to it ("Science" for "Science (Syllabus T)")
        if seab and len(seab) < len(name) and name.lower().startswith(seab.lower()):
            merged[key]["seab"] = seab
    return [dict({"subject": k[0], "year": k[1], "levels": v["levels"]}, **({"seab": v["seab"]} if v["seab"] else {}))
            for k, v in sorted(merged.items())]


def arts():
    keep = ("institution", "programme_type", "minimum_requirements", "application_window", "how_to_apply_url",
            "source_url", "notes")
    return [{k: r[k] for k in keep} for r in read_csv(ARTS_CSV)]


def poly_schools():
    """See README.md."""
    out = {}
    with open(TAXONOMY_CSV, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["institution_type"] == "Polytechnic" and r["faculty_or_school"]:
                out["%s|%s" % (r["institution"], r["course_code"])] = r["faculty_or_school"]
    return out


def secondary_schools():
    """[[secondary school, [affiliated JC, ...]], ...] from the SG Schools Atlas data, or [] if it can't be joined."""
    try:
        aff = json.loads(read(os.path.join(SCHOOLS_DIR, "affiliations.json")))
        sf = json.loads(read(os.path.join(SCHOOLS_DIR, "school_finder.json")))
    except (OSError, ValueError) as e:
        print("  (no secondary-school picker: %s)" % e)
        return []
    names = {}
    for s in sf:
        if s.get("school_code") and s.get("level") == "SECONDARY":
            names.setdefault(s["school_code"], s["school_name"])
    out = []
    for code, name in names.items():
        jcs = [a["name"] for a in aff.get(code, []) if a.get("level") == "JUNIOR COLLEGE"]
        out.append([name, sorted(set(jcs))])
    out.sort(key=lambda x: x[0].lower())
    return out


# ------------------------------------------------------------------------------------------------- engine data
def engine_data(dev):
    if os.path.exists(DATA_JSON) and not dev:
        d = json.loads(read(DATA_JSON))
        src = "app/build/data.json"
    else:
        if not dev:
            die("app/build/data.json is missing (run app/tools/build_data.py first)")
        d = {"definitions": json.loads(read(os.path.join(ROOT, "engine", "definitions.json"))),
             "requirements": json.loads(read(os.path.join(ROOT, "matcher", "requirements.json")))}
        src = "engine/definitions.json + matcher/requirements.json (dev)"
    # Critic finding 5: a PFP record's snapshot range is the JAE diploma range. The page never reads it, and the
    # app's copy of the data does not carry it either.
    req = d.get("requirements") or {}
    recs = req.get("records") if isinstance(req, dict) else None
    dropped = 0
    for r in recs or []:
        if r.get("route") == "PFP" and r.get("net_range_2026"):
            r["net_range_2026"] = None
            dropped += 1
    for r in recs or []:
        if r.get("route") == "PFP" and r.get("net_range_2026"):
            die("a PFP record still carries net_range_2026")
    if req.get("mers"):
        print("  engine data: %s (compact: PFP records point at the shared course row; the matcher blanks its "
              "range and app.js lastYearRange() refuses PFP)" % src)
    else:
        print("  engine data: %s (PFP ranges dropped: %d)" % (src, dropped))
    return d


CORE_CHECK_JS = r"""
const PSE = require(process.argv[1]);
const data = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
PSE.load(data);
const students = [
  [[['English Language','O','B3'],['Mathematics','O','B4'],['Science (Physics, Chemistry)','O','C5'],['Humanities (Social Studies, Geography)','O','C6'],['Chinese','O','A2'],['Principles of Accounts','O','B3'],['Art','O','A2']], 2026, {cca:'Good'}],
  [[['English Language','N(A)','2'],['Mathematics','N(A)','3'],['Science (Physics, Chemistry)','N(A)','2'],['Humanities (Social Studies, Geography)','N(A)','3'],['Principles of Accounts','N(A)','1'],['Tamil','N(A)','2']], 2026, {cca:'Excellent'}],
  [[['English Language','G3','B3'],['Mathematics','G3','B4'],['Science (Physics, Chemistry)','G3','C5'],['History','G3','C6'],['Geography','G2','1'],['Tamil','G2','2']], 2027, {cca:'Good'}]
];
let n = 0, bad = [];
for (const [rows, year, bonus] of students) {
  const subjects = rows.map(r => ({subject: r[0], level: r[1], grade: r[2], year}));
  for (const r of PSE.match(subjects, bonus)) {
    n++;
    const rng = r.net_range_2026;
    if ((r.route === 'PFP' || r.exercise === 'PSE-2028') && rng) bad.push(r.requirement_key + ' ' + r.exercise);
  }
}
console.log(JSON.stringify({n, bad: bad.slice(0, 5), nbad: bad.length}));
"""


def check_core_ranges(core_path, data_path):
    """Run the real engine on three made-up students: no PFP or PSE 2028 course may carry a range (critic 5)."""
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        print("  (node not found: PFP / PSE range check skipped)")
        return
    out = subprocess.run([node, "-e", CORE_CHECK_JS, core_path, data_path], capture_output=True, text=True)
    if out.returncode != 0:
        die("engine check failed to run: " + out.stderr.strip()[:400])
    res = json.loads(out.stdout.strip().splitlines()[-1])
    if res["nbad"]:
        die("%d PFP / PSE course results carry a range, e.g. %s" % (res["nbad"], res["bad"]))
    print("  engine check: %d course results on 3 made-up students; no PFP or PSE 2028 range" % res["n"])


# ------------------------------------------------------------------------------------------------- checks
def check_sources(app_js, app_css, shell):
    for name, src in (("app.css", app_css), ("app.js", app_js)):
        hits = HEX.findall(strip_comments(src))
        if hits:
            die("%s has colour literals outside the token files: %s" % (name, sorted(set(hits))[:8]))
    if re.search(r"<(script|link|img|iframe)[^>]+(src|href)=[\"']https?:", shell, re.I) or "@import" in shell:
        die("the shell loads an external resource")
    if re.search(r"url\(\s*['\"]?https?:", app_css):
        die("app.css loads an external resource")
    code = strip_comments(app_js)
    n = len(re.findall(r"net_range_2026", code))
    if n != 1:
        die("net_range_2026 must be read in exactly one place in app.js (lastYearRange); found %d" % n)
    if re.search(r"\bfetch\(|XMLHttpRequest|new\s+WebSocket", code):
        die("app.js makes a network request")


def version_of(app_js):
    m = re.search(r'const APP_VERSION\s*=\s*"(\d+)\.(\d+)\.(\d+)"', app_js)
    if not m:
        die("APP_VERSION not found in app.js")
    return m.group(1), m.group(2), m.group(3)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev", action="store_true", help="write _fixtures/dev.html backed by dev_server.py")
    args = ap.parse_args(argv)

    shell = read(os.path.join(UI, "index.html"))
    app_js = read(os.path.join(UI, "app.js"))
    app_css = read(os.path.join(UI, "app.css"))
    tokens = read(os.path.join(UI, "tokens_from_atlas.css")) + "\n" + read(os.path.join(UI, "app_tokens.css"))
    check_sources(app_js, app_css, shell)

    major, minor, patch = version_of(app_js)
    short = "v%s.%s" % (major, minor) + ("" if patch == "0" else ".%s" % patch)
    title = "<title>Rosetta: Student Pathway Atlas · %s</title>" % short
    if title not in shell:
        die("the shell's <title> does not match APP_VERSION (%s)" % title)
    if '>%s</span>' % short not in shell:
        die("the version pill does not match APP_VERSION (%s)" % short)

    if args.dev:
        core = read(os.path.join(FIX, "pse_dev_shim.js"))
        core_src = "_fixtures/pse_dev_shim.js (dev)"
    elif os.path.exists(CORE):
        core = read(CORE)
        core_src = "app/src/pse_core.js"
    else:
        die("app/src/pse_core.js is missing")
    print("  engine code: " + core_src)

    pse_data = engine_data(args.dev)
    if not args.dev:
        check_core_ranges(CORE, DATA_JSON)
    page_data = {"built": date.today().isoformat(), "snapshot": SNAPSHOT, "institutions": institutions(),
                 "coast": coast(), "schools": secondary_schools(), "calendar": calendar(), "riasec": riasec(),
                 "arts": arts(), "subject_levels": subject_levels()}
    if not isinstance(pse_data.get("courses"), dict):
        page_data["poly_schools"] = poly_schools()  # the compact data.json carries faculty_or_school itself
    cal = page_data["calendar"]
    print("  page data: %d institutions, %d secondary schools (%d with an affiliated JC), calendar %d terms + %d fills "
          "+ %d current exercise rows, %d RIASEC rows, %d arts rows" % (
              len(page_data["institutions"]), len(page_data["schools"]), sum(1 for s in page_data["schools"] if s[1]),
              len(cal["terms"]), len(cal["fills"]), len(cal["rows"]), len(page_data["riasec"]), len(page_data["arts"])))
    print("  subjects by level: %s" % ("%d subject x year rows from data/taxonomy/subjects_by_level.csv" % len(page_data["subject_levels"])
                                      if page_data["subject_levels"] else "file missing: app.js uses the stated table"))
    if "lep_hosts" in pse_data:
        print("  engine data: lep_hosts present (%d rows)" % len(pse_data.get("lep_hosts") or []))

    style = "<style>\n%s\n%s\n%s\n</style>" % (font_face(), tokens, app_css)
    scripts = "\n".join([
        '<script type="application/json" id="pse-data">%s</script>'
        % json_safe(json.dumps(pse_data, separators=(",", ":"), ensure_ascii=False)),
        '<script type="application/json" id="page-data">%s</script>'
        % json_safe(json.dumps(page_data, separators=(",", ":"), ensure_ascii=False)),
        "<script>\n%s\n</script>" % js_safe(core),
        "<script>\n%s\n</script>" % js_safe(app_js),
    ])
    if "<!--@STYLE-->" not in shell or "<!--@SCRIPTS-->" not in shell:
        die("the shell is missing <!--@STYLE--> or <!--@SCRIPTS-->")
    html = shell.replace("<!--@STYLE-->", style).replace("<!--@SCRIPTS-->", scripts)
    hit = FORBIDDEN.search(html)
    if hit:
        die("the built page names %r (D16 / N14): %s" % (hit.group(0), html[max(0, hit.start() - 80):hit.end() + 40]))

    if args.dev:
        out = os.path.join(FIX, "dev.html")
    else:
        out = os.path.join(APP, "dist", "Student Pathway Atlas %s.html" % short)
        os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    size = os.path.getsize(out)
    print("  wrote %s (%.2f MB)" % (os.path.relpath(out, ROOT), size / 1e6))
    if not args.dev and size > 2.5e6:
        print("  WARNING: over the 2.5 MB target")


if __name__ == "__main__":
    main()
