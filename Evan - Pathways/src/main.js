// Application Orchestrator
import { PURE_SCIENCES, SUB, ELECTIVE_OPTIONS } from './data/subjects.js';
import { PATHS } from './data/pathways.js';
import { COURSES_DATA, MACRO_BUBBLES } from './data/courses.js';
import { CAREER_LADDERS } from './data/careers.js';
import { GLOSSARY_MAP, TERM_PATTERNS, GLOSSARY_REGEX } from './data/glossary.js';
import { evaluate } from './engine/evaluate.js';
import { card } from './components/pathwayCard.js';
import { saveSettings, loadSettings, clearSettings } from './utils/db.js';

/* Extracted to modular file */

/* Extracted to modular file */

/* Extracted to modular file */

const GRADE_OPTIONS = {
  3: ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "9"],
  2: ["1", "2", "3", "4", "5", "6"],
  1: ["A", "B", "C", "D", "E"]
};

const MODE_KEY = "sec_detailed_grades_mode";
const CCA_KEY = "sec_cca_grade";

let detailedGradesMode = false;
try {
  detailedGradesMode = localStorage.getItem(MODE_KEY) === "true";
} catch(e){}

let ccaGrade = "none";
try {
  ccaGrade = localStorage.getItem(CCA_KEY) || "none";
} catch(e){}

function updateRowPassFromGrade(r){
  if(!r.grade || r.taken === false){
    r.pass = null;
    return;
  }
  const g = String(r.grade).toUpperCase();
  if(r.lv === 3){
    if(["A1", "A2", "B3", "B4", "C5", "C6"].includes(g)){
      r.pass = true;
      r.fg = null;
    } else if(g === "D7"){
      r.pass = false;
      r.fg = 7;
    } else if(g === "E8"){
      r.pass = false;
      r.fg = 8;
    } else if(g === "9"){
      r.pass = false;
      r.fg = 9;
    }
  } else if(r.lv === 2){
    const n = parseInt(g, 10);
    r.pass = n >= 1 && n <= 5;
    r.fg = null;
  } else if(r.lv === 1){
    r.pass = ["A", "B", "C", "D"].includes(g);
    r.fg = null;
  }
}

const blank = () => [
  { k: "EL", lv: null, pass: null, grade: null },
  { k: "MATH", lv: null, pass: null, grade: null },
  { k: "MTL", lv: null, pass: null, grade: null },
  { k: "SCI", lv: null, pass: null, sci: true, grade: null },
  { k: "HUM", lv: null, pass: null, grade: null },
  { k: "AMATH", lv: null, pass: null, el: 1, taken: false, grade: null },
  { k: "LIT", lv: null, pass: null, el: 2, taken: false, grade: null },
  { k: "ART", lv: null, pass: null, el: 3, taken: false, grade: null }
];

const SAVE_KEY = "sec_pathway_grades";
function loadSaved(){
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)), b = blank();
    if(Array.isArray(s) && s.length === b.length){
      s.forEach((r, idx) => {
        if(r.k && !SUB[r.k]) r.k = b[idx].k;
        if(b[idx].sci) r.sci = true;
      });
      return s;
    }
  }catch(e){}
  return null;
}

let rows = loadSaved() || blank();

function updateSave(saved = true){
  const b = document.getElementById("save");
  if(b){
    b.classList.toggle("saved", saved);
    b.textContent = saved ? "Saved ✓" : "Save";
  }
}

async function autoSave(){
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(rows));
    localStorage.setItem(MODE_KEY, String(detailedGradesMode));
    localStorage.setItem(CCA_KEY, ccaGrade);
  } catch(e){}
  try {
    await saveSettings(SAVE_KEY, rows);
    await saveSettings(MODE_KEY, detailedGradesMode);
    await saveSettings(CCA_KEY, ccaGrade);
  } catch(e){}
  updateSave(true);
}

const isSet = r => r.taken === false || (r.lv != null && r.pass != null);
const esc = t => String(t).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
const $ = id => document.getElementById(id);

/* Extracted to modular file */

/* Extracted to modular file */

/* Extracted to modular file */

/* Extracted to src/engine/evaluate.js */

/* Render Rows */
function renderRows(){
  const box = $("rows");
  box.innerHTML = "";

  rows.forEach((r, i) => {
    const row = document.createElement("div");
    const off = r.taken === false;
    const unset = !off && (r.lv == null || r.pass == null);
    row.className = "row" + (off ? " empty" : (r.pass === false ? " fail" : (unset ? " unset" : "")));

    const nameEl = document.createElement("div");
    nameEl.className = "name";

    if(r.el){
      // Elective dropdown selector
      const sel = document.createElement("select");
      sel.className = "name-elective-select";
      sel.setAttribute("aria-label", "Choose Elective " + r.el);

      const otherPureSciCount = rows.filter(other => other !== r && other.taken !== false && PURE_SCIENCES.includes(other.k)).length;

      ELECTIVE_OPTIONS.forEach(opt => {
        const op = document.createElement("option");
        op.value = opt.k;
        const isPure = PURE_SCIENCES.includes(opt.k);
        const blockPure = isPure && opt.k !== r.k && otherPureSciCount >= 2;
        const isDuplicate = rows.some(other => other !== r && other.taken !== false && other.k === opt.k);
        op.textContent = `Elective ${r.el}: ${opt.n}${blockPure ? " — Max 2 Pure Sci" : (isDuplicate ? " — Chosen elsewhere" : "")}`;
        if(blockPure || (isDuplicate && opt.k !== r.k)) op.disabled = true;
        if(r.k === opt.k) op.selected = true;
        sel.appendChild(op);
      });

      sel.addEventListener("change", (e) => {
        r.k = e.target.value;
        const info = SUB[r.k] || { lv: [3] };
        if(info.lv && info.lv.length === 1) r.lv = info.lv[0];
        else if(r.lv && !info.lv.includes(r.lv)) r.lv = info.lv[0];
        if(PURE_SCIENCES.includes(r.k)) r.lv = 3;
        render();
      });
      nameEl.appendChild(sel);
    } else if(r.sci || r.k === "SCI" || (PURE_SCIENCES.includes(r.k) && !r.el)){
      // Core Science selector: allows selecting Combined Science or splitting into Pure Sciences!
      const sel = document.createElement("select");
      sel.className = "name-elective-select";
      sel.setAttribute("aria-label", "Choose Science Option");

      const SCI_OPTIONS = [
        { k: "SCI", n: "Combined Science" },
        { k: "CHEM", n: "Pure Chemistry (G3)" },
        { k: "PHY", n: "Pure Physics (G3)" },
        { k: "BIO", n: "Pure Biology (G3)" },
        { k: "COMP", n: "Computing (G1/G2/G3)" }
      ];

      SCI_OPTIONS.forEach(opt => {
        const op = document.createElement("option");
        op.value = opt.k;
        const isDuplicate = rows.some(other => other !== r && other.taken !== false && other.k === opt.k);
        op.textContent = `Science: ${opt.n}${isDuplicate && opt.k !== r.k ? " — Chosen in Elective" : ""}`;
        if(isDuplicate && opt.k !== r.k) op.disabled = true;
        if(r.k === opt.k) op.selected = true;
        sel.appendChild(op);
      });

      sel.addEventListener("change", (e) => {
        r.k = e.target.value;
        r.sci = true;
        const info = SUB[r.k] || { lv: [3] };
        if(!r.lv || !info.lv.includes(r.lv)) r.lv = info.lv[0];
        if(PURE_SCIENCES.includes(r.k)) r.lv = 3;
        render();
      });
      nameEl.appendChild(sel);
    } else {
      nameEl.textContent = (SUB[r.k] && SUB[r.k].n) || r.k;
    }

    const currentSub = SUB[r.k] || { lv: [3, 2, 1] };
    const lvs = currentSub.lv || [3, 2, 1];

    // Level selector
    const lv = document.createElement("div");
    lv.className = "seg lv";
    [3, 2, 1].forEach(n => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "G" + n;
      if(!lvs.includes(n)){
        b.className = "na";
        b.disabled = true;
        b.title = `Not offered at G${n}`;
      } else {
        b.disabled = false;
        b.setAttribute("aria-pressed", !off && r.lv === n);
        b.addEventListener("click", () => {
          r.taken = true;
          r.lv = n;
          r.grade = n === 3 ? "A1" : (n === 2 ? "1" : "A");
          r.pass = true;
          r.fg = null;
          render();
        });
      }
      lv.appendChild(b);
    });

    // Pass / Fail or Grade Select Control
    let resultControl;
    if(detailedGradesMode){
      const gSeg = document.createElement("div");
      gSeg.className = "seg grade-seg";
      gSeg.setAttribute("role", "group");
      gSeg.setAttribute("aria-label", "Grades for " + ((SUB[r.k] && SUB[r.k].n) || r.k));

      const isOptional = Boolean(r.el || r.k === "SCI" || r.k === "HUM" || r.sci || PURE_SCIENCES.includes(r.k));

      if(r.lv == null){
        const bPrompt = document.createElement("button");
        bPrompt.type = "button";
        bPrompt.className = "na";
        bPrompt.disabled = true;
        bPrompt.textContent = "Select Level First";
        gSeg.appendChild(bPrompt);
      } else {
        const grades = GRADE_OPTIONS[r.lv] || [];
        grades.forEach(g => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = g;

          let isPass = true;
          if(r.lv === 3) isPass = ["A1", "A2", "B3", "B4", "C5", "C6"].includes(g);
          else if(r.lv === 2) isPass = parseInt(g, 10) <= 5;
          else if(r.lv === 1) isPass = ["A", "B", "C", "D"].includes(g);

          b.className = isPass ? "p" : "f";
          const isActive = !off && String(r.grade).toUpperCase() === String(g).toUpperCase();
          b.setAttribute("aria-pressed", isActive);

          b.addEventListener("click", () => {
            r.taken = true;
            r.grade = g;
            if(!r.lv && lvs.length === 1) r.lv = lvs[0];
            if(!r.lv && lvs.length > 1) r.lv = lvs.includes(2) ? 2 : lvs[0];
            updateRowPassFromGrade(r);
            render();
          });
          gSeg.appendChild(b);
        });
      }

      if(isOptional){
        const bNone = document.createElement("button");
        bNone.type = "button";
        bNone.textContent = "None";
        bNone.className = "x";
        bNone.setAttribute("aria-pressed", off);
        bNone.title = "Not taking this subject";
        bNone.addEventListener("click", () => {
          r.taken = false;
          r.lv = null;
          r.pass = null;
          r.grade = null;
          r.fg = null;
          render();
        });
        gSeg.appendChild(bNone);
      }

      resultControl = gSeg;
    } else {
      const pf = document.createElement("div");
      pf.className = "seg pf";
      const opts = [["Pass", true, "p"], ["Fail", false, "f"]];
      if(r.el || r.k === "SCI" || r.k === "HUM" || r.sci || PURE_SCIENCES.includes(r.k)) opts.push(["None", null, "x"]);

      opts.forEach(([t, v, c]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = t;
        b.className = c;
        if(v === null){
          b.setAttribute("aria-pressed", off);
          b.addEventListener("click", () => {
            r.taken = false;
            r.lv = null;
            r.pass = null;
            r.grade = null;
            r.fg = null;
            render();
          });
        } else {
          b.setAttribute("aria-pressed", !off && r.pass === v);
          b.addEventListener("click", () => {
            r.taken = true;
            r.pass = v;
            if(!r.lv && lvs.length === 1) r.lv = lvs[0];
            if(!r.lv && lvs.length > 1) r.lv = lvs.includes(2) ? 2 : lvs[0];
            if(v === false && r.lv === 3 && !r.fg) r.fg = 7;
            render();
          });
        }
        pf.appendChild(b);
      });
      resultControl = pf;
    }

    row.append(nameEl, lv, resultControl);

    // Detailed Grades Mode: Inline G3-to-G2 grade conversion note when a G3 subject is failed
    if(detailedGradesMode && !off && r.lv === 3 && r.pass === false){
      const fgw = document.createElement("div");
      fgw.className = "fgw detailed-conv-note";
      const g = String(r.grade).toUpperCase();
      const conv = ({
        "D7": { g2: "G2 Grade 3 Pass", note: "Counts as a G2 Grade 3 pass for Polytechnic (ELR2B2) & ITE pathways under MOE Full SBB rules." },
        "E8": { g2: "G2 Grade 4 Pass", note: "Counts as a G2 Grade 4 pass for Polytechnic (ELR2B2) & ITE pathways under MOE Full SBB rules." },
        "9":  { g2: "G2 Grade 6 / Ungraded", note: "Fails both G3 & G2. Usable as 5 points for ITE 3-Year Higher Nitec only." }
      })[g] || { g2: "G2 Pass Equivalent", note: "Converts to G2 pass equivalent." };

      fgw.innerHTML = `
        <span class="fgl" style="color:var(--amber);">🔄 Full SBB Conversion:</span>
        <span class="badge-g2-equiv" style="font-family:var(--f-mono);font-size:11.5px;font-weight:800;background:rgba(245,158,11,0.18);color:#fde68a;padding:2px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.35);">
          G3 ${g} &rarr; ${conv.g2}
        </span>
        <span class="fgc" style="color:#cbd5e1;font-size:11.5px;">${conv.note}</span>
      `;
      row.appendChild(fgw);
    }

    // Fail grade mapping (shown in Pass/Fail mode; Detailed mode selects D7/E8/9 directly)
    if(!detailedGradesMode && !off && r.lv === 3 && r.pass === false){
      if(!r.fg) r.fg = 7;
      const fgw = document.createElement("div");
      fgw.className = "fgw";
      const lab = document.createElement("span");
      lab.className = "fgl";
      lab.textContent = "G3 Fail Grade:";

      const seg = document.createElement("div");
      seg.className = "seg fg";
      [[7, "D7"], [8, "E8"], [9, "Grade 9"]].forEach(([v, txt]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = txt;
        b.setAttribute("aria-pressed", (r.fg || 7) === v);
        b.addEventListener("click", () => { r.fg = v; render(); });
        seg.appendChild(b);
      });

      const cap = document.createElement("span");
      cap.className = "fgc";
      cap.textContent = ({ 7: "→ MOE Full SBB Rule: A G3 D7 counts as a G2 Grade 3 pass", 8: "→ Converts to G2 Grade 4 (Pass)", 9: "→ Grade 9 (Usable for ITE aggregate; not Poly/JC)" })[r.fg || 7];
      fgw.append(lab, seg, cap);
      row.appendChild(fgw);
    }

    // G1 Mother Tongue contextual advisory note
    if(!off && r.k === "MTL" && r.lv === 1){
      const mtlCallout = document.createElement("div");
      mtlCallout.className = "fgw mtl-g1-note";
      const isPass = detailedGradesMode ? (r.grade && ["A", "B", "C", "D"].includes(String(r.grade).toUpperCase())) : r.pass;
      const statusTxt = isPass
        ? "✓ Meets JC/MI subject requirement (offer MTL 'B')"
        : (r.grade === "E" || r.pass === false ? "✕ Grade E does not fulfill JC/MI requirement" : "Grade A–D fulfills JC/MI requirement");
      mtlCallout.innerHTML = `
        <span class="fgl" style="color:var(--accent);">🗣️ G1 Mother Tongue:</span>
        <span class="badge-g1-mtl" style="font-family:var(--f-mono);font-size:11px;font-weight:800;background:rgba(56,189,248,0.15);color:var(--accent-light);padding:2px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);">
          ${statusTxt}
        </span>
        <span class="fgc" style="color:#cbd5e1;font-size:11.5px;">Not countable in L1R4, ELR2B2, or PFP ELMAB3; counts as 1–4 pts for ITE 3-Year.</span>
      `;
      row.appendChild(mtlCallout);
    }

    box.appendChild(row);
  });

  const pureSciCount = rows.filter(r => r.taken !== false && PURE_SCIENCES.includes(r.k)).length;
  const hasCombSci = rows.some(r => r.taken !== false && r.k === "SCI");

  if(pureSciCount > 2){
    const warn = document.createElement("div");
    warn.className = "empty-note";
    warn.style.cssText = "margin-top:10px;border-color:var(--bad-line);background:var(--bad-bg);color:var(--bad);font-weight:700;";
    warn.textContent = "⚠️ Our School does not offer Triple Science. Students can take at most 2 Pure Sciences (Double Science). Please adjust one elective.";
    box.appendChild(warn);
  } else if(hasCombSci && pureSciCount > 0){
    const warn = document.createElement("div");
    warn.className = "empty-note";
    warn.style.cssText = "margin-top:10px;border-color:var(--amber-line);background:var(--amber-bg);color:var(--amber);font-weight:700;";
    warn.textContent = "💡 Note: Students take either Combined Science OR Pure Sciences (Double Science), not both. If taking Pure Sciences, select Pure Science in the Science slot or set Combined Science to 'None'.";
    box.appendChild(warn);
  }
}

/* Extracted to modular file */

function renderSummary(e){
  $("c3").textContent = e.n3; $("c3").parentElement.classList.toggle("zero", e.n3 === 0);
  $("c2").textContent = e.n23 - e.n3; $("c2").parentElement.classList.toggle("zero", (e.n23 - e.n3) === 0);
  $("c1").textContent = e.n - e.n23; $("c1").parentElement.classList.toggle("zero", (e.n - e.n23) === 0);

  const pill = (k, label) => {
    const r = rows.find(x => x.k === k);
    if(!isSet(r)) return `<span style="color:var(--muted)">– ${label}: <i>Not Set</i></span>`;
    const gradeTxt = (detailedGradesMode && r.grade) ? `Grade ${r.grade}` : (r.pass ? "Pass" : "Fail");
    return `<span style="color:${r.pass ? "var(--ok)" : "var(--bad)"}">${r.pass ? "✓" : "✕"} ${label}: <i>G${r.lv} ${gradeTxt}</i></span>`;
  };
  let emHtml = pill("EL", "English") + pill("MATH", "Maths");
  const mtlRow = rows.find(x => x.k === "MTL" && x.taken !== false);
  if(mtlRow && isSet(mtlRow)){
    const mtlGradeTxt = (detailedGradesMode && mtlRow.grade) ? `Grade ${mtlRow.grade}` : (mtlRow.pass ? "Pass" : "Fail");
    const mtlExtra = (mtlRow.lv === 1 && mtlRow.pass) ? " (JC Met/MTL 'B')" : "";
    emHtml += `<span style="color:${mtlRow.pass ? "var(--ok)" : "var(--bad)"}">${mtlRow.pass ? "✓" : "✕"} MTL: <i>G${mtlRow.lv} ${mtlGradeTxt}${mtlExtra}</i></span>`;
  }
  const hmtlRow = rows.find(x => x.k === "HMTL" && x.taken !== false);
  if(hmtlRow && isSet(hmtlRow)){
    const hmtlGradeTxt = (detailedGradesMode && hmtlRow.grade) ? `Grade ${hmtlRow.grade}` : (hmtlRow.pass ? "Pass (+2 JC pts)" : "Fail");
    emHtml += `<span style="color:${hmtlRow.pass ? "var(--ok)" : "var(--bad)"}">${hmtlRow.pass ? "★" : "✕"} HMTL: <i>G${hmtlRow.lv} ${hmtlGradeTxt}</i></span>`;
  }
  $("em").innerHTML = emHtml;
}

function renderAggregateDashboard(aggregates){
  const dash = $("aggregateDashboard");
  if(!dash) return;
  dash.hidden = !detailedGradesMode;
  if(!detailedGradesMode) return;

  const l1 = aggregates?.l1r4;
  const poly = aggregates?.elr2b2;
  const pfp = aggregates?.elmab3;
  const ite = aggregates?.ite3Year || aggregates?.ite3yr;

  const ccaText = ccaGrade === "excellent" ? "-2 pts" : (ccaGrade === "good" ? "-1 pt" : "0 pts");

  const isJcOk = Boolean(l1?.qualifiesJc);
  const isMiOk = Boolean(l1?.qualifiesMi);
  const l1Eligible = isJcOk || isMiOk;
  const l1Badge = isJcOk ? "JC (≤16)" : (isMiOk ? "MI (≤20)" : "Prereqs");

  const isPolyGenOk = Boolean(poly?.qualifiesGeneral);
  const isPolyNurseOk = Boolean(poly?.qualifiesNursing);
  const polyEligible = isPolyGenOk || isPolyNurseOk;
  const polyBadge = isPolyGenOk ? "Poly (≤22)" : (isPolyNurseOk ? "Nursing (≤24)" : "Prereqs");

  const isPfpOk = Boolean(pfp?.pfpEligible || pfp?.pfp?.qualifies);
  const isIte2Ok = Boolean(pfp?.ite2Eligible || pfp?.ite2Year?.qualifies);
  const pfpEligible = isPfpOk || isIte2Ok;
  const pfpBadge = isPfpOk ? "PFP (≤12)" : (isIte2Ok ? "2-Yr (≤19)" : "Prereqs");

  const iteEligible = Boolean(ite?.eligible || ite?.qualifies);
  const iteBadge = iteEligible ? (ite?.bestType || ite?.type || "Qualified") : "Prereqs";

  const pfpGross = pfp?.gross != null ? pfp.gross : (pfp?.pfp?.gross ?? pfp?.ite2Year?.gross ?? "–");
  const pfpNet = pfp?.net != null ? pfp.net : (pfp?.pfp?.net ?? pfp?.ite2Year?.net ?? "–");
  const iteNetVal = ite?.netPoints != null ? ite.netPoints : (ite?.net != null ? ite.net : "–");
  const iteGrossVal = ite?.points != null ? ite.points : (ite?.gross != null ? ite.gross : "–");

  dash.innerHTML = `
    <div class="agg-dashboard-head">
      <div class="agg-dashboard-title-wrap">
        <span class="agg-dashboard-pill">MOE 2028</span>
        <span class="agg-dashboard-title">📊 Full SBB Aggregate Dashboard</span>
      </div>
      <div class="agg-dashboard-cca">CCA Bonus: <b>${ccaText}</b></div>
    </div>
    <div class="agg-cards-grid">
      <div class="agg-card ${l1Eligible ? "is-ok" : ""}">
        <div class="agg-card-top">
          <div class="agg-card-title">JC / MI <span class="agg-code">L1R4</span></div>
          <span class="agg-status-pill ${l1Eligible ? "pill-ok" : "pill-warn"}">
            <span class="agg-status-dot"></span>${l1Badge}
          </span>
        </div>
        <div class="agg-card-score">
          <span class="agg-card-val">${l1?.net != null ? l1.net : "–"}</span>
          <span class="agg-score-label">Net Score</span>
        </div>
        <div class="agg-card-meta">
          <span>Gross: <b>${l1?.gross ?? "–"}</b></span>
          <span class="agg-meta-sep">•</span>
          <span>Cut: <b>≤16</b></span>
        </div>
      </div>

      <div class="agg-card ${polyEligible ? "is-ok" : ""}">
        <div class="agg-card-top">
          <div class="agg-card-title">Poly <span class="agg-code">ELR2B2</span></div>
          <span class="agg-status-pill ${polyEligible ? "pill-ok" : "pill-warn"}">
            <span class="agg-status-dot"></span>${polyBadge}
          </span>
        </div>
        <div class="agg-card-score">
          <span class="agg-card-val">${poly?.net != null ? poly.net : "–"}</span>
          <span class="agg-score-label">Net Score</span>
        </div>
        <div class="agg-card-meta">
          <span>Gross: <b>${poly?.gross ?? "–"}</b></span>
          <span class="agg-meta-sep">•</span>
          <span>Cut: <b>≤22</b></span>
        </div>
      </div>

      <div class="agg-card ${pfpEligible ? "is-ok" : ""}">
        <div class="agg-card-top">
          <div class="agg-card-title">PFP / 2-Yr <span class="agg-code">ELMAB3</span></div>
          <span class="agg-status-pill ${pfpEligible ? "pill-ok" : "pill-warn"}">
            <span class="agg-status-dot"></span>${pfpBadge}
          </span>
        </div>
        <div class="agg-card-score">
          <span class="agg-card-val">${pfpGross}</span>
          <span class="agg-score-label">Gross</span>
        </div>
        <div class="agg-card-meta">
          <span>Net: <b>${pfpNet}</b></span>
          <span class="agg-meta-sep">•</span>
          <span>Cut: <b>≤12/19</b></span>
        </div>
      </div>

      <div class="agg-card ${iteEligible ? "is-ok" : ""}">
        <div class="agg-card-top">
          <div class="agg-card-title">ITE 3-Yr <span class="agg-code">HN</span></div>
          <span class="agg-status-pill ${iteEligible ? "pill-ok" : "pill-warn"}">
            <span class="agg-status-dot"></span>${iteBadge}
          </span>
        </div>
        <div class="agg-card-score">
          <span class="agg-card-val">${iteNetVal}</span>
          <span class="agg-score-label">Net Pts</span>
        </div>
        <div class="agg-card-meta">
          <span>Gross: <b>${iteGrossVal}</b></span>
          <span class="agg-meta-sep">•</span>
          <span>Scale: <b>1–5</b></span>
        </div>
      </div>
    </div>
  `;
}

function render(){
  if(detailedGradesMode){
    rows.forEach(r => {
      if(r.taken !== false && r.lv != null && !r.grade){
        if(r.pass === false){
          r.grade = r.lv === 3 ? (r.fg === 8 ? "E8" : (r.fg === 9 ? "9" : "D7")) : (r.lv === 2 ? "6" : "E");
          updateRowPassFromGrade(r);
        } else if(r.pass === true){
          const valid = GRADE_OPTIONS[r.lv] || [];
          r.grade = valid[0];
          updateRowPassFromGrade(r);
        }
      }
    });
  }

  renderRows();
  autoSave();
  const activeSubs = rows.filter(r => r.taken !== false && r.lv != null && r.pass != null);
  const e = evaluate(activeSubs, { cca: ccaGrade, detailed: detailedGradesMode });
  renderSummary(e);
  renderAggregateDashboard(e.aggregates);

  const sec5Box = $("sec5StatusCard");

  if(activeSubs.length === 0){
    if(sec5Box) { sec5Box.hidden = true; sec5Box.innerHTML = ""; }
    $("okN").textContent = "–"; $("badN").textContent = "–";
    const mOk = $("mobOkN"), mBad = $("mobBadN"), mBtnOk = $("mobBtnOkN");
    if(mOk) mOk.textContent = "–";
    if(mBad) mBad.textContent = "–";
    if(mBtnOk) mBtnOk.textContent = "–";
    $("okCards").innerHTML = `<div class="empty-note">Please set the Level (G1/G2/G3) and Result (Pass/Fail) for your subjects to see post-secondary pathways.</div>`;
    $("badCards").innerHTML = `<div class="empty-note">Pathway prerequisites will be evaluated once your subjects are set.</div>`;
    return;
  }

  const ok = PATHS.filter(p => e.out[p.id].state !== "bad");
  const bad = PATHS.filter(p => e.out[p.id].state === "bad");

  // Display Secondary 5 Eligibility Status Card when student does not qualify for tertiary direct entry
  if(sec5Box){
    const s5 = e.sec5;
    const polyOk = e.out.poly && e.out.poly.state !== "bad";
    const jcOk = e.out.jc && e.out.jc.state !== "bad";
    const miOk = e.out.mi && e.out.mi.state !== "bad";
    const qualifiesTertiary = polyOk || jcOk || miOk;

    if(s5 && s5.eligible && !qualifiesTertiary){
      sec5Box.hidden = false;
      const allG3Badge = s5.canTakeAllG3
        ? `<span class="sec5-badge-allg3" style="display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(52,211,153,0.2);color:#34d399;font-size:11.5px;font-weight:800;border:1px solid rgba(52,211,153,0.4);margin-top:6px;">★ Eligible to offer ALL subjects at G3 in Sec 5 (Gross ELMAB3 ≤ 19)</span>`
        : "";
      sec5Box.innerHTML = `
        <div class="card card-sec5" style="border-left:4px solid var(--accent);background:rgba(13,20,36,0.9);border:1px solid var(--rule);border-radius:12px;padding:14px 16px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:22px;">🏫</span>
              <h3 style="font-size:16px;font-weight:800;color:#fff;margin:0;">5th Year in Secondary School (Sec 5)</h3>
            </div>
            <span style="font-family:var(--f-mono);font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:rgba(56,189,248,0.2);color:var(--accent-light);border:1px solid rgba(56,189,248,0.4);">
              ✓ ELIGIBLE FOR SEC 5
            </span>
          </div>
          <p style="font-size:12.5px;color:#cbd5e1;line-height:1.5;margin:0 0 4px;">
            ${esc(s5.reasons[0] || "Eligible for the 5th year in secondary school under MOE SEC 2028 rules.")}
          </p>
          ${allG3Badge ? `<div>${allG3Badge}</div>` : ""}
          <div style="font-size:11.5px;color:var(--muted);line-height:1.45;background:rgba(0,0,0,0.25);padding:8px 10px;border-radius:8px;margin-top:8px;">
            ℹ️ <strong>Official MOE Criteria:</strong> Criteria 1: ≥3 G3 passes and not qualified for JC/MI/Poly direct entry; OR Criteria 2: ≤2 G3 passes with Gross ELMAB3 ≤ 21, ELB3 ≤ 14, or MAB3 ≤ 14 at G2 (Grade 1–5). Eligible students should approach their secondary school directly.
          </div>
        </div>
      `;
    } else {
      sec5Box.hidden = true;
      sec5Box.innerHTML = "";
    }
  }

  $("okN").textContent = ok.length;
  $("badN").textContent = bad.length;
  $("jOk").textContent = ok.length;
  $("jBad").textContent = bad.length;
  const mOk = $("mobOkN"), mBad = $("mobBadN"), mBtnOk = $("mobBtnOkN");
  if(mOk) mOk.textContent = ok.length;
  if(mBad) mBad.textContent = bad.length;
  if(mBtnOk) mBtnOk.textContent = ok.length;

  $("okCards").innerHTML = ok.length ? ok.map(p => card(p, e.out[p.id])).join("") : `<div class="empty-note">Prerequisites not yet met. At least 4 subjects offered required for 3-Year Higher Nitec.</div>`;
  $("badCards").innerHTML = bad.length ? bad.map(p => card(p, e.out[p.id])).join("") : `<div class="empty-note">None! All pathways are open with this combination.</div>`;
}

// Preset Handlers for Sec 2 Class
const prePureBtn = $("prePure");
if(prePureBtn){
  prePureBtn.addEventListener("click", () => {
    rows = [
      { k: "EL", lv: 3, pass: true },
      { k: "MATH", lv: 3, pass: true },
      { k: "MTL", lv: 3, pass: true },
      { k: "CHEM", lv: 3, pass: true, sci: true },
      { k: "HUM", lv: 3, pass: true },
      { k: "PHY", lv: 3, pass: true, el: 1, taken: true },
      { k: "AMATH", lv: 3, pass: true, el: 2, taken: true },
      { k: "LIT", lv: null, pass: null, el: 3, taken: false }
    ];
    render();
  });
}

const preCompBtn = $("preComp");
if(preCompBtn){
  preCompBtn.addEventListener("click", () => {
    rows = [
      { k: "EL", lv: 3, pass: true },
      { k: "MATH", lv: 3, pass: true },
      { k: "MTL", lv: 3, pass: true },
      { k: "SCI", lv: 3, pass: true, sci: true },
      { k: "HUM", lv: 3, pass: true },
      { k: "COMP", lv: 3, pass: true, el: 1, taken: true },
      { k: "AMATH", lv: null, pass: null, el: 2, taken: false },
      { k: "ART", lv: null, pass: null, el: 3, taken: false }
    ];
    render();
  });
}

$("preG3").addEventListener("click", () => {
  rows = [
    { k: "EL", lv: 3, pass: true },
    { k: "MATH", lv: 3, pass: true },
    { k: "MTL", lv: 3, pass: true },
    { k: "SCI", lv: 3, pass: true, sci: true },
    { k: "HUM", lv: 3, pass: true },
    { k: "AMATH", lv: 3, pass: true, el: 1, taken: true },
    { k: "LIT", lv: null, pass: null, el: 2, taken: false },
    { k: "ART", lv: null, pass: null, el: 3, taken: false }
  ];
  render();
});

$("prePoly").addEventListener("click", () => {
  rows = [
    { k: "EL", lv: 3, pass: true },
    { k: "MATH", lv: 3, pass: true },
    { k: "MTL", lv: 2, pass: true },
    { k: "SCI", lv: 3, pass: true, sci: true },
    { k: "HUM", lv: 3, pass: true },
    { k: "DT", lv: null, pass: null, el: 1, taken: false },
    { k: "AMATH", lv: null, pass: null, el: 2, taken: false },
    { k: "ART", lv: null, pass: null, el: 3, taken: false }
  ];
  render();
});

$("preG2").addEventListener("click", () => {
  rows = [
    { k: "EL", lv: 2, pass: true },
    { k: "MATH", lv: 2, pass: true },
    { k: "MTL", lv: 2, pass: true },
    { k: "SCI", lv: 2, pass: true, sci: true },
    { k: "HUM", lv: 2, pass: true },
    { k: "DT", lv: null, pass: null, el: 1, taken: false },
    { k: "NFS", lv: null, pass: null, el: 2, taken: false },
    { k: "ART", lv: null, pass: null, el: 3, taken: false }
  ];
  render();
});

$("preG1").addEventListener("click", () => {
  rows = [
    { k: "EL", lv: 1, pass: true },
    { k: "MATH", lv: 1, pass: true },
    { k: "MTL", lv: 1, pass: true },
    { k: "SCI", lv: 1, pass: true, sci: true },
    { k: "HUM", lv: null, pass: null, taken: false },
    { k: "EBS", lv: null, pass: null, el: 1, taken: false },
    { k: "DT", lv: null, pass: null, el: 2, taken: false },
    { k: "ART", lv: null, pass: null, el: 3, taken: false }
  ];
  render();
});

// Tab Switching for Pathways Panel
const tabOk = $("tabOk");
const tabBad = $("tabBad");
const paneOk = $("paneOk");
const paneBad = $("paneBad");

function switchTab(target){
  if(target === "ok"){
    if(tabOk) { tabOk.classList.add("is-active"); tabOk.setAttribute("aria-selected", "true"); }
    if(tabBad) { tabBad.classList.remove("is-active"); tabBad.setAttribute("aria-selected", "false"); }
    if(paneOk) paneOk.hidden = false;
    if(paneBad) paneBad.hidden = true;
  } else {
    if(tabBad) { tabBad.classList.add("is-active"); tabBad.setAttribute("aria-selected", "true"); }
    if(tabOk) { tabOk.classList.remove("is-active"); tabOk.setAttribute("aria-selected", "false"); }
    if(paneBad) paneBad.hidden = false;
    if(paneOk) paneOk.hidden = true;
  }
}

// Mobile 3-Tab Navigator Controller
let currentMobTab = "subjects";
function setMobTab(tab){
  currentMobTab = tab;
  document.body.setAttribute("data-mob-tab", tab);

  const mobTabSubj = $("mobTabSubj");
  const mobTabOk = $("mobTabOk");
  const mobTabBad = $("mobTabBad");

  if(mobTabSubj){
    mobTabSubj.classList.toggle("is-active", tab === "subjects");
    mobTabSubj.setAttribute("aria-selected", tab === "subjects");
  }
  if(mobTabOk){
    mobTabOk.classList.toggle("is-active", tab === "ok");
    mobTabOk.setAttribute("aria-selected", tab === "ok");
  }
  if(mobTabBad){
    mobTabBad.classList.toggle("is-active", tab === "bad");
    mobTabBad.setAttribute("aria-selected", tab === "bad");
  }

  if(tab === "ok"){
    switchTab("ok");
  } else if(tab === "bad"){
    switchTab("bad");
  }
}
setMobTab("subjects");

const mobTabSubj = $("mobTabSubj");
const mobTabOk = $("mobTabOk");
const mobTabBad = $("mobTabBad");
if(mobTabSubj) mobTabSubj.addEventListener("click", () => setMobTab("subjects"));
if(mobTabOk) mobTabOk.addEventListener("click", () => setMobTab("ok"));
if(mobTabBad) mobTabBad.addEventListener("click", () => setMobTab("bad"));

const mobViewBtn = $("mobViewBtn");
if(mobViewBtn) mobViewBtn.addEventListener("click", () => {
  setMobTab("ok");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

["mobBackBtnOk", "mobBackBtnBad"].forEach(id => {
  const b = $(id);
  if(b) b.addEventListener("click", () => {
    setMobTab("subjects");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

const presetSelect = $("presetSelect");
if(presetSelect){
  presetSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    const btn = $(val);
    if(btn) btn.click();
    setMobTab("subjects");
  });
}

if(tabOk && tabBad){
  tabOk.addEventListener("click", () => switchTab("ok"));
  tabBad.addEventListener("click", () => switchTab("bad"));
  [tabOk, tabBad].forEach((tab, idx, arr) => {
    tab.addEventListener("keydown", (e) => {
      if(e.key === "ArrowRight" || e.key === "ArrowLeft"){
        e.preventDefault();
        const next = arr[idx === 0 ? 1 : 0];
        next.focus();
        next.click();
      }
    });
  });
}

// Dialogs
[["ov","ovOpen","ovClose"], ["gl","glOpen","glClose"], ["npDlg","npOpen","npClose"], ["creditsDlg","creditsOpen","creditsClose"]].forEach(([d, o, c]) => {
  const dlg = $(d);
  const btnOpen = $(o);
  const btnClose = $(c);
  if(btnOpen && dlg){
    btnOpen.addEventListener("click", () => {
      dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "");
    });
  }
  if(btnClose && dlg){
    btnClose.addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));
  }
  if(dlg){
    dlg.addEventListener("click", (e) => { if(e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", hideTooltip);
  }
});

// 3-Mode Controller: [ Results | Course | Career ]
let currentAppMode = "results"; // "results" | "course" | "career"

function setAppMode(mode){
  if(!["results", "course", "career"].includes(mode)) mode = "results";
  currentAppMode = mode;

  const mainView = $("mainView");
  const rpView = $("rpView");
  const careerView = $("careerView");

  if(mainView) mainView.hidden = (mode !== "results");
  if(rpView) rpView.hidden = (mode !== "course");
  if(careerView) careerView.hidden = (mode !== "career");

  document.body.classList.toggle("results-mode", mode === "results");
  document.body.classList.toggle("course-mode", mode === "course");
  document.body.classList.toggle("career-mode", mode === "career");
  document.body.classList.toggle("rp-mode", mode === "course");

  // Update top 3-button toggle buttons
  const bRes = $("btnModeResults");
  const bCrs = $("btnModeCourse");
  const bCar = $("btnModeCareer");
  if(bRes){ bRes.classList.toggle("is-active", mode === "results"); bRes.setAttribute("aria-selected", mode === "results"); }
  if(bCrs){ bCrs.classList.toggle("is-active", mode === "course"); bCrs.setAttribute("aria-selected", mode === "course"); }
  if(bCar){ bCar.classList.toggle("is-active", mode === "career"); bCar.setAttribute("aria-selected", mode === "career"); }

  if(mode === "career"){
    renderCareerLadders();
    const activeSubs = rows.filter(r => r.taken !== false && r.lv != null && r.pass != null);
    const evalResult = evaluate(activeSubs, { cca: ccaGrade, detailed: detailedGradesMode });
    const highest = getHighestEligibleStartingStage(evalResult);
    if(highest){
      scrollToHighestEligibleStage(highest);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } else if(mode === "course"){
    renderBubbles(currentFilter);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    render();
  }
}

function setReverseMode(active){
  setAppMode(active ? "course" : "results");
}

const btnModeResults = $("btnModeResults");
const btnModeCourse = $("btnModeCourse");
const btnModeCareer = $("btnModeCareer");
if(btnModeResults) btnModeResults.addEventListener("click", () => setAppMode("results"));
if(btnModeCourse) btnModeCourse.addEventListener("click", () => setAppMode("course"));
if(btnModeCareer) btnModeCareer.addEventListener("click", () => setAppMode("career"));

["rpExitBtn", "rpExitBtnBottom", "careerExitBtn", "careerExitBtnBottom"].forEach(id => {
  const b = $(id);
  if(b) b.addEventListener("click", () => setAppMode("results"));
});

// Detailed Grades Mode & CCA Bonus Selectors
const toggleGradeMode = $("toggleGradeMode");
if(toggleGradeMode){
  if(toggleGradeMode.type === "checkbox"){
    toggleGradeMode.checked = detailedGradesMode;
  } else {
    toggleGradeMode.setAttribute("aria-pressed", detailedGradesMode);
  }
  toggleGradeMode.addEventListener("change", () => {
    detailedGradesMode = toggleGradeMode.type === "checkbox" ? toggleGradeMode.checked : !detailedGradesMode;
    try { localStorage.setItem(MODE_KEY, String(detailedGradesMode)); }catch(err){}
    render();
  });
  if(toggleGradeMode.type !== "checkbox"){
    toggleGradeMode.addEventListener("click", () => {
      detailedGradesMode = !detailedGradesMode;
      toggleGradeMode.setAttribute("aria-pressed", detailedGradesMode);
      try { localStorage.setItem(MODE_KEY, String(detailedGradesMode)); }catch(err){}
      render();
    });
  }
}

const ccaGradeSelect = $("ccaGradeSelect");
if(ccaGradeSelect){
  if(ccaGrade) ccaGradeSelect.value = ccaGrade;
  ccaGradeSelect.addEventListener("change", (e) => {
    ccaGrade = e.target.value;
    try { localStorage.setItem(CCA_KEY, ccaGrade); }catch(err){}
    render();
  });
}

// Save and Reset
$("reset").addEventListener("click", async () => {
  rows = blank();
  ccaGrade = "none";
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(CCA_KEY);
  }catch(e){}
  await clearSettings();
  const ccaSel = $("ccaGradeSelect");
  if(ccaSel) ccaSel.value = "none";
  render();
});

$("save").addEventListener("click", () => {
  autoSave();
});

// Mobile Jump Bar Observer
const jumpEl = $("jump");
if(jumpEl){
  jumpEl.addEventListener("click", (e) => {
    if(e.target.closest(".j-bad")){
      switchTab("bad");
    } else if(e.target.closest(".j-ok")){
      switchTab("ok");
    }
  });
}
if("IntersectionObserver" in window){
  new IntersectionObserver(([entry]) => {
    const below = !entry.isIntersecting && entry.boundingClientRect.top > 0;
    $("jump").classList.toggle("show", below);
  }, { rootMargin: "0px 0px -80px 0px" }).observe($("results"));
}

// Glossary Terms Dictionary & Interactive Tooltip Engine
/* Extracted to modular file */

/* Extracted to modular file */

/* Extracted to modular file */

let glTooltip = $("glTooltip");
if(!glTooltip){
  glTooltip = document.createElement("div");
  glTooltip.id = "glTooltip";
  glTooltip.className = "gl-tooltip";
  glTooltip.setAttribute("role", "tooltip");
  glTooltip.setAttribute("aria-hidden", "true");
  try { glTooltip.setAttribute("popover", "manual"); } catch(e){}
  document.body.appendChild(glTooltip);
}

let activeWord = null;

function showTooltip(el, info){
  const host = el.closest("dialog") || document.body;
  if(glTooltip.parentElement !== host){
    host.appendChild(glTooltip);
  }

  glTooltip.innerHTML = `<div class="gl-tooltip-title">${esc(info.title)}</div><p class="gl-tooltip-desc">${esc(info.desc)}</p>`;

  if(glTooltip.showPopover){
    try {
      if(!glTooltip.matches(":popover-open")){
        glTooltip.showPopover();
      }
    } catch(e){}
  }

  glTooltip.classList.add("show");
  glTooltip.setAttribute("aria-hidden", "false");

  const rect = el.getBoundingClientRect();
  const tipRect = glTooltip.getBoundingClientRect();

  let containerTop = 0;
  let containerLeft = 0;
  const isTopLayer = Boolean(glTooltip.matches && glTooltip.matches(":popover-open"));
  if(!isTopLayer && host !== document.body){
    const hostRect = host.getBoundingClientRect();
    containerTop = hostRect.top;
    containerLeft = hostRect.left;
  }

  let top = rect.top - tipRect.height - 8 - containerTop;
  if(rect.top - tipRect.height - 8 < 10){
    top = rect.bottom + 8 - containerTop;
  }
  if(isTopLayer || host === document.body){
    if(top + tipRect.height > window.innerHeight - 10){
      top = Math.max(10, window.innerHeight - tipRect.height - 10);
    }
    if(top < 10) top = 10;
  }

  let left = rect.left + (rect.width / 2) - (tipRect.width / 2) - containerLeft;
  if(isTopLayer || host === document.body){
    const maxLeft = window.innerWidth - tipRect.width - 12;
    if(left < 12) left = 12;
    if(left > maxLeft) left = maxLeft;
  }

  glTooltip.style.top = Math.round(top) + "px";
  glTooltip.style.left = Math.round(left) + "px";
}

function hideTooltip(){
  if(glTooltip){
    glTooltip.classList.remove("show");
    glTooltip.setAttribute("aria-hidden", "true");
    if(glTooltip.hidePopover){
      try {
        if(glTooltip.matches(":popover-open")){
          glTooltip.hidePopover();
        }
      } catch(e){}
    }
  }
  if(activeWord){
    activeWord.classList.remove("active");
    activeWord = null;
  }
}

function annotateGlossary(root){
  if(!root) return;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node){
        const parent = node.parentElement;
        if(!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if(["script", "style", "select", "option", "textarea", "input"].includes(tag)){
          return NodeFilter.FILTER_REJECT;
        }
        if(parent.closest(".gloss-word") || parent.closest("#aggregateDashboard") || parent.closest(".grade-seg") || parent.closest("#gl") || parent.closest("#creditsDlg") || parent.closest("#rpView") || parent.closest(".seg") || parent.closest(".gl-tooltip") || parent.closest(".tab-btn") || parent.closest(".mob-tab-btn") || parent.closest(".preset-select") || parent.closest(".mob-view-btn") || parent.closest(".mob-back-btn") || parent.closest(".rp-exit-btn")){
          return NodeFilter.FILTER_REJECT;
        }
        if(!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        GLOSSARY_REGEX.lastIndex = 0;
        return GLOSSARY_REGEX.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  while(walker.nextNode()){
    nodesToReplace.push(walker.currentNode);
  }

  nodesToReplace.forEach(node => {
    const text = node.nodeValue;
    GLOSSARY_REGEX.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while((match = GLOSSARY_REGEX.exec(text)) !== null){
      if(match.index > lastIndex){
        frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      let key = "sec";
      for(let i = 0; i < TERM_PATTERNS.length; i++){
        if(match[i + 1] !== undefined){
          key = TERM_PATTERNS[i].k;
          break;
        }
      }
      const span = document.createElement("span");
      span.className = "gloss-word";
      span.tabIndex = 0;
      span.setAttribute("role", "button");
      span.setAttribute("aria-label", `${match[0]}: View definition`);
      span.dataset.gloss = key;
      span.textContent = match[0];
      frag.appendChild(span);
      lastIndex = match.index + match[0].length;
    }

    if(lastIndex < text.length){
      frag.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    if(node.parentNode){
      node.parentNode.replaceChild(frag, node);
    }
  });
}

document.addEventListener("mouseover", (e) => {
  const target = e.target.closest(".gloss-word");
  if(target){
    const key = target.dataset.gloss;
    const info = GLOSSARY_MAP[key];
    if(info){
      if(activeWord && activeWord !== target) activeWord.classList.remove("active");
      activeWord = target;
      target.classList.add("active");
      showTooltip(target, info);
    }
  }
});

document.addEventListener("mouseout", (e) => {
  const target = e.target.closest(".gloss-word");
  if(target){
    const rel = e.relatedTarget;
    if(rel && (rel.closest(".gl-tooltip") || rel.closest(".gloss-word") === target)) return;
    hideTooltip();
  }
});

glTooltip.addEventListener("mouseleave", () => {
  hideTooltip();
});

document.addEventListener("click", (e) => {
  const target = e.target.closest(".gloss-word");
  if(target){
    e.preventDefault();
    e.stopPropagation();
    const key = target.dataset.gloss;
    const info = GLOSSARY_MAP[key];
    if(info){
      if(activeWord === target && glTooltip.classList.contains("show")){
        hideTooltip();
      } else {
        if(activeWord) activeWord.classList.remove("active");
        activeWord = target;
        target.classList.add("active");
        showTooltip(target, info);
      }
    }
  } else if(!e.target.closest("#glTooltip")){
    hideTooltip();
  }
});

document.addEventListener("focusin", (e) => {
  const target = e.target.closest(".gloss-word");
  if(target){
    const key = target.dataset.gloss;
    const info = GLOSSARY_MAP[key];
    if(info){
      if(activeWord) activeWord.classList.remove("active");
      activeWord = target;
      target.classList.add("active");
      showTooltip(target, info);
    }
  }
});

document.addEventListener("focusout", (e) => {
  if(!e.relatedTarget || !e.relatedTarget.closest(".gl-tooltip")){
    hideTooltip();
  }
});

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") hideTooltip();
});

document.addEventListener("scroll", hideTooltip, { capture: true, passive: true });
window.addEventListener("resize", hideTooltip, { passive: true });

const _origRender = render;
render = function(){
  _origRender();
  annotateGlossary(document.querySelector(".wrap"));
};

/* Reverse Planning Course & Bubble Engine */
/* Extracted to modular file */

/* Macro bubbles ordered exactly to match requested filter tabs: */
/* [All Pathways] [JC and MI] [Polytechnic] [PFP] [Arts Institutions] [ITE Higher NITEC] */
/* Extracted to modular file */

let compareList = [];
let activeCourseId = null;
let currentFilter = "all";
let currentSearchQuery = "";

function showToast(msg){
  let t = $("toastNotice");
  if(!t){
    t = document.createElement("div");
    t.id = "toastNotice";
    t.className = "toast-notice";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3400);
}

function renderBubbles(filter = "all"){
  currentFilter = filter;
  const canvas = $("rpBubblesCanvas");
  if(!canvas) return;
  canvas.innerHTML = "";

  const q = (currentSearchQuery || "").trim().toLowerCase();
  const filteredMacros = filter === "all" ? MACRO_BUBBLES : MACRO_BUBBLES.filter(m => m.id === filter);
  let totalVisibleCourses = 0;

  filteredMacros.forEach(macro => {
    const matchingCourses = macro.courses.filter(cId => {
      const c = COURSES_DATA[cId];
      if(!c) return false;
      if(!q) return true;
      const corpus = `${c.name} ${c.category} ${c.desc} ${c.metric} ${c.minBand} ${c.elReq} ${c.mathReq} ${c.sciReq} ${c.minGrades || ""} ${c.campuses || ""}`.toLowerCase();
      return corpus.includes(q);
    });

    if(!matchingCourses.length) return;
    totalVisibleCourses += matchingCourses.length;

    const mBox = document.createElement("section");
    mBox.className = `rp-macro-bubble rp-macro-${macro.id}`;

    const mHead = document.createElement("div");
    mHead.className = "rp-macro-header";
    mHead.innerHTML = `
      <div class="rp-macro-title">
        <span class="rp-macro-icon">${macro.icon}</span>
        <h3>${esc(macro.name)}</h3>
      </div>
      <span class="rp-macro-badge">${matchingCourses.length} ${matchingCourses.length === 1 ? "Course" : "Courses"}</span>
    `;

    const cloud = document.createElement("div");
    cloud.className = "rp-child-cloud";

    matchingCourses.forEach(cId => {
      const c = COURSES_DATA[cId];
      if(!c) return;
      const inCmp = compareList.includes(c.id);
      const isAct = activeCourseId === c.id;

      const b = document.createElement("div");
      b.className = `rp-child-bubble ${inCmp ? "in-compare" : ""} ${isAct ? "is-active" : ""}`;
      b.tabIndex = 0;
      b.setAttribute("role", "button");
      b.setAttribute("aria-label", `${c.name}: Inspect requirements`);
      b.dataset.id = c.id;

      b.innerHTML = `
        <div>
          <div class="rp-cb-top">
            <div class="rp-cb-info">
              <span class="rp-cb-icon">${c.icon}</span>
              <span class="rp-cb-name">${esc(c.name)}</span>
            </div>
          </div>
          <div style="margin-top:6px">
            <span class="rp-cb-metric">${esc(c.metric)}</span>
          </div>
        </div>
        <div class="rp-cb-foot">
          <span class="rp-cb-hint">Tap for Details &rarr;</span>
          <button type="button" class="rp-cb-cmp-btn ${inCmp ? "in-compare" : ""}" data-cmp-id="${c.id}">
            ${inCmp ? "✓ In Compare" : "+ Compare"}
          </button>
        </div>
      `;

      b.addEventListener("click", (e) => {
        if(e.target.closest(".rp-cb-cmp-btn")){
          e.stopPropagation();
          toggleCompare(c.id);
        } else {
          openInspector(c.id);
        }
      });

      cloud.appendChild(b);
    });

    mBox.append(mHead, cloud);
    canvas.appendChild(mBox);
  });

  if(totalVisibleCourses === 0){
    canvas.innerHTML = `
      <div class="empty-note" style="text-align:center;padding:32px 16px;">
        <div style="font-size:26px;margin-bottom:8px;">🔍</div>
        <b style="font-size:15px;color:#fff;display:block;margin-bottom:6px;">No matching pathways or courses found</b>
        <p style="margin:0;color:var(--muted);">No courses match "${esc(q)}" under the selected filter. Try searching for <i>Sports, Nursing, Computing, AI, Aerospace, Business, or Design</i>.</p>
      </div>
    `;
  }

  updateCompareCountBadge();
}

function openInspector(courseId){
  activeCourseId = courseId;
  const c = COURSES_DATA[courseId];
  if(!c) return;

  const pnl = $("rpInspector");
  if(!pnl) return;

  $("rpInspectIcon").textContent = c.icon;
  $("rpInspectCat").textContent = c.category;
  $("rpInspectName").textContent = c.name;
  $("rpInspectDesc").textContent = c.desc;

  const grid = $("rpInspectGrid");
  grid.innerHTML = `
    <div class="rp-req-box">
      <span class="rp-req-lbl">Admissions Metric</span>
      <b class="rp-req-val">${esc(c.metric)}</b>
      <span class="rp-req-sub">Net or gross score</span>
    </div>
    <div class="rp-req-box">
      <span class="rp-req-lbl">Full SBB Minimum</span>
      <b class="rp-req-val">${esc(c.minBand)}</b>
      <span class="rp-req-sub">Subject band criteria</span>
    </div>
    <div class="rp-req-box">
      <span class="rp-req-lbl">English Language</span>
      <b class="rp-req-val">${esc(c.elReq)}</b>
      <span class="rp-req-sub">Core prerequisite</span>
    </div>
    <div class="rp-req-box">
      <span class="rp-req-lbl">Mathematics</span>
      <b class="rp-req-val">${esc(c.mathReq)}</b>
      <span class="rp-req-sub">Course specific requirement</span>
    </div>
  `;

  const minGradesEl = $("rpInspectMinGrades");
  if(minGradesEl) minGradesEl.textContent = c.minGrades || "Check CourseFinder for specific prerequisites.";

  const campusesEl = $("rpInspectCampuses");
  if(campusesEl) campusesEl.textContent = c.campuses || "Available across post-secondary institutions.";

  const currSec = $("rpInspectCurriculumSec");
  const currBox = $("rpInspectCurriculum");
  if(currSec && currBox){
    if(c.curriculum){
      currBox.textContent = c.curriculum;
      currSec.hidden = false;
    } else {
      currSec.hidden = true;
    }
  }

  const combiBox = $("rpInspectCombi");
  combiBox.innerHTML = c.recommendedCombi.filter(r => r.taken !== false && r.lv != null).map(r => {
    const info = SUB[r.k] || { n: r.k };
    return `<span class="rp-combi-pill g${r.lv}">${esc(info.n)} (G${r.lv})</span>`;
  }).join("");

  const cmpBtn = $("rpInspectCompareBtn");
  const inCmp = compareList.includes(c.id);
  cmpBtn.classList.toggle("in-compare", inCmp);
  cmpBtn.textContent = inCmp ? "✓ In Compare (Remove)" : "+ Add to Compare";

  pnl.hidden = false;
  if(window.innerWidth <= 1024){
    pnl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Update active state in bubbles
  document.querySelectorAll(".rp-child-bubble").forEach(b => {
    b.classList.toggle("is-active", b.dataset.id === courseId);
  });
}

function closeInspector(){
  activeCourseId = null;
  const pnl = $("rpInspector");
  if(pnl) pnl.hidden = true;
  document.querySelectorAll(".rp-child-bubble").forEach(b => b.classList.remove("is-active"));
}

function toggleCompare(courseId){
  const idx = compareList.indexOf(courseId);
  if(idx === -1){
    compareList.push(courseId);
    const c = COURSES_DATA[courseId];
    if(c) showToast(`Added "${c.name}" to comparison table.`);
  } else {
    compareList.splice(idx, 1);
  }
  updateCompareCountBadge();
  renderBubbles(currentFilter);
  if(activeCourseId === courseId) openInspector(courseId);
  if(!$("rpComparePanel").hidden) renderCompareTable();
}

function updateCompareCountBadge(){
  const b = $("rpCompareCount");
  if(b) b.textContent = compareList.length;
}

function renderCompareTable(){
  const wrap = $("rpCompareTableWrap");
  if(!wrap) return;

  if(!compareList.length){
    wrap.innerHTML = `<div class="empty-note" style="margin:8px 0">No courses in comparison yet. Tap "+ Compare" on any course bubble to compare requirements side-by-side!</div>`;
    return;
  }

  const courses = compareList.map(id => COURSES_DATA[id]).filter(Boolean);

  wrap.innerHTML = `
    <table class="rp-compare-table">
      <thead>
        <tr>
          <th class="rp-th-feature">Criterion</th>
          ${courses.map(c => `
            <th class="rp-th-course">
              <div class="rp-th-top">
                <span>${c.icon}</span>
                <span>${esc(c.name)}</span>
              </div>
              <span class="rp-th-cat">${esc(c.category)}</span>
              <div class="rp-th-btns">
                <button type="button" class="rp-table-load-btn" data-load-id="${c.id}">Load into Subjects &amp; Results</button>
                <button type="button" class="rp-table-remove-btn" data-rm-id="${c.id}">&times; Remove</button>
              </div>
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="rp-td-lbl">Admissions Metric</td>
          ${courses.map(c => `<td><b style="color:var(--accent-light)">${esc(c.metric)}</b></td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">Full SBB Minimum</td>
          ${courses.map(c => `<td>${esc(c.minBand)}</td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">English Language</td>
          ${courses.map(c => `<td>${esc(c.elReq)}</td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">Mathematics</td>
          ${courses.map(c => `<td>${esc(c.mathReq)}</td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">Science / Electives</td>
          ${courses.map(c => `<td>${esc(c.sciReq)}</td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">Exact Minimum Grades (MER)</td>
          ${courses.map(c => `<td style="white-space:pre-line;line-height:1.4;">${esc(c.minGrades || "CourseFinder MER")}</td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">Institutions &amp; Campuses</td>
          ${courses.map(c => `<td>${esc(c.campuses || "Post-secondary institutions")}</td>`).join("")}
        </tr>
        <tr>
          <td class="rp-td-lbl">Minimum Combi</td>
          ${courses.map(c => `<td>${esc(c.combiSummary)}</td>`).join("")}
        </tr>
      </tbody>
    </table>
  `;

  wrap.querySelectorAll("[data-load-id]").forEach(btn => {
    btn.addEventListener("click", () => loadCourseIntoSubjects(btn.dataset.loadId));
  });
  wrap.querySelectorAll("[data-rm-id]").forEach(btn => {
    btn.addEventListener("click", () => toggleCompare(btn.dataset.rmId));
  });
}

function loadCourseIntoSubjects(courseId){
  const c = COURSES_DATA[courseId];
  if(!c) return;
  rows = JSON.parse(JSON.stringify(c.recommendedCombi));
  render();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(rows));
    updateSave();
  } catch(e){}

  setReverseMode(false);

  if(typeof setMobTab === "function"){
    setMobTab("subjects");
  }

  const s = $("subjects");
  if(s) s.scrollIntoView({ behavior: "smooth" });

  showToast(`✓ Loaded "${c.name}" minimum combination into Subjects & Results!`);
}

// Reverse Planning Event Wiring
const rpFilters = $("rpFilters");
if(rpFilters){
  rpFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".rp-filter");
    if(!btn) return;
    rpFilters.querySelectorAll(".rp-filter").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    renderBubbles(btn.dataset.filter);
  });
}

const rpSearchInput = $("rpSearchInput");
if(rpSearchInput){
  rpSearchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    renderBubbles(currentFilter);
  });
}

const rpInspectorClose = $("rpInspectorClose");
if(rpInspectorClose) rpInspectorClose.addEventListener("click", closeInspector);

const rpInspectCompareBtn = $("rpInspectCompareBtn");
if(rpInspectCompareBtn){
  rpInspectCompareBtn.addEventListener("click", () => {
    if(activeCourseId) toggleCompare(activeCourseId);
  });
}

const rpInspectLoadBtn = $("rpInspectLoadBtn");
if(rpInspectLoadBtn){
  rpInspectLoadBtn.addEventListener("click", () => {
    if(activeCourseId) loadCourseIntoSubjects(activeCourseId);
  });
}

const rpToggleCompare = $("rpToggleCompare");
const rpComparePanel = $("rpComparePanel");
const rpCloseCompare = $("rpCloseCompare");
const rpClearCompare = $("rpClearCompare");

if(rpToggleCompare && rpComparePanel){
  rpToggleCompare.addEventListener("click", () => {
    const isHidden = rpComparePanel.hidden;
    rpComparePanel.hidden = !isHidden;
    if(isHidden){
      renderCompareTable();
      rpComparePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

if(rpCloseCompare && rpComparePanel){
  rpCloseCompare.addEventListener("click", () => {
    rpComparePanel.hidden = true;
  });
}

if(rpClearCompare){
  rpClearCompare.addEventListener("click", () => {
    compareList = [];
    updateCompareCountBadge();
    renderCompareTable();
    renderBubbles(currentFilter);
    if(activeCourseId) openInspector(activeCourseId);
  });
}

// Nursing Ladder Quick Action Handlers
const npLoadIteBtn = $("npLoadIteBtn");
if(npLoadIteBtn){
  npLoadIteBtn.addEventListener("click", () => {
    const d = $("npDlg");
    if(d && d.close) d.close();
    loadCourseIntoSubjects("ite_hn_nursing");
  });
}
const npLoadPolyBtn = $("npLoadPolyBtn");
if(npLoadPolyBtn){
  npLoadPolyBtn.addEventListener("click", () => {
    const d = $("npDlg");
    if(d && d.close) d.close();
    loadCourseIntoSubjects("poly_nursing");
  });
}
const npInspectIteBtn = $("npInspectIteBtn");
if(npInspectIteBtn){
  npInspectIteBtn.addEventListener("click", () => {
    const d = $("npDlg");
    if(d && d.close) d.close();
    setReverseMode(true);
    openInspector("ite_hn_nursing");
  });
}
const npInspectPolyBtn = $("npInspectPolyBtn");
if(npInspectPolyBtn){
  npInspectPolyBtn.addEventListener("click", () => {
    const d = $("npDlg");
    if(d && d.close) d.close();
    setReverseMode(true);
    openInspector("poly_nursing");
  });
}

/* Career Ladders Visual Progression Engine */
/* Extracted to modular file */

let selectedCareerCluster = "computing";
let activeIslandObj = null;

function getHighestEligibleStartingStage(evalResult){
  if(!evalResult || !evalResult.out) return null;
  // 1. Junior College / MI (Stage 3 Academic Track)
  if((evalResult.out.jc && evalResult.out.jc.state !== "bad") || (evalResult.out.mi && evalResult.out.mi.state !== "bad")){
    return { stageNum: 3, name: "Junior College (2-Year A-Levels)", stageId: "stage-3", track: "jc" };
  }
  // 2. Polytechnic Year 1 (Stage 3 Applied Track)
  if(evalResult.out.poly && evalResult.out.poly.state !== "bad"){
    return { stageNum: 3, name: "Polytechnic Year 1 Diploma", stageId: "stage-3", track: "poly" };
  }
  // 3. Polytechnic Foundation Programme (Stage 2)
  if(evalResult.out.pfp && evalResult.out.pfp.state !== "bad"){
    return { stageNum: 2, name: "Polytechnic Foundation Programme (PFP)", stageId: "stage-pfp", track: "pfp" };
  }
  // 4. ITE Higher Nitec (Stage 1)
  if((evalResult.out.hn2 && evalResult.out.hn2.state !== "bad") || (evalResult.out.hn3 && evalResult.out.hn3.state !== "bad")){
    return { stageNum: 1, name: "ITE Higher Nitec", stageId: "stage-ite", track: "ite" };
  }
  return null;
}

function scrollToHighestEligibleStage(stageInfo){
  if(!stageInfo) return;
  const targetId = stageInfo.track === "jc" ? "stage-jc-track" : (stageInfo.track === "poly" ? "stage-poly-track" : stageInfo.stageId);
  requestAnimationFrame(() => {
    setTimeout(() => {
      const el = document.getElementById(targetId) || document.getElementById(stageInfo.stageId);
      if(el){
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 140);
  });
}

function renderCareerLadders(){
  const cluster = CAREER_LADDERS[selectedCareerCluster] || CAREER_LADDERS.computing;
  const activeSubs = rows.filter(r => r.taken !== false && r.lv != null && r.pass != null);
  const evalResult = evaluate(activeSubs, { cca: ccaGrade, detailed: detailedGradesMode });
  const highestStage = getHighestEligibleStartingStage(evalResult);

  const stageIte = cluster.stages.find(s => s.stageId === "stage-ite");
  const stagePfp = cluster.stages.find(s => s.stageId === "stage-pfp");
  const stagePoly = cluster.stages.find(s => s.stageId === "stage-poly");
  const stageJc = cluster.stages.find(s => s.stageId === "stage-jc");
  const stageUni = cluster.stages.find(s => s.stageId === "stage-uni");
  const stageCareer = cluster.stages.find(s => s.stageId === "stage-career");

  const isJcOpen = Boolean(stageJc && stageJc.islands.some(isl => isl.merCheck(evalResult)));

  // Render Cluster Summary Box
  const sumBox = $("careerSummaryBox");
  if(sumBox){
    let statusHtml = "";
    if(highestStage){
      statusHtml = `<span class="career-status-pill status-open">🎯 Auto-scrolling to: <strong>${esc(highestStage.name)}</strong> (Highest Eligible)</span>`;
    } else if(activeSubs.length === 0){
      statusHtml = `<span class="career-status-pill status-locked">ℹ️ Set subject grades in Results to view unlocked stages</span>`;
    } else {
      statusHtml = `<span class="career-status-pill status-locked">🔒 Foundation stages shown; check prerequisites</span>`;
    }

    const jcJumpHtml = isJcOpen
      ? `<button type="button" class="career-jump-btn ${highestStage && highestStage.track === "jc" ? "is-highest" : ""}" data-target-stage="stage-jc-track">🏛️ Stage 3: JC Route ${highestStage && highestStage.track === "jc" ? "★ Highest" : ""}</button>`
      : "";

    const jumpButtonsHtml = `
      <div class="career-jump-bar">
        <span class="career-jump-lbl">Jump to Entry Point:</span>
        ${jcJumpHtml}
        <button type="button" class="career-jump-btn ${highestStage && highestStage.track === "poly" ? "is-highest" : ""}" data-target-stage="stage-poly-track">🎓 Stage 3: Poly Diplomas ${highestStage && highestStage.track === "poly" ? "★ Highest" : ""}</button>
        <button type="button" class="career-jump-btn ${highestStage && highestStage.track === "pfp" ? "is-highest" : ""}" data-target-stage="stage-pfp">🚀 Stage 2: PFP ${highestStage && highestStage.track === "pfp" ? "★ Highest" : ""}</button>
        <button type="button" class="career-jump-btn ${highestStage && highestStage.track === "ite" ? "is-highest" : ""}" data-target-stage="stage-ite">⚙️ Stage 1: ITE ${highestStage && highestStage.track === "ite" ? "★ Highest" : ""}</button>
        <button type="button" class="career-jump-btn" data-target-stage="stage-uni">🎓 Stage 4: University</button>
        <button type="button" class="career-jump-btn" data-target-stage="stage-career">💼 Stage 5: Leadership</button>
      </div>
    `;

    sumBox.innerHTML = `
      <div class="career-summary-top">
        <div class="career-summary-title">
          <span>${cluster.icon}</span>
          <span>${esc(cluster.title)}</span>
        </div>
        ${statusHtml}
      </div>
      <p style="font-size:12.5px;color:#cbd5e1;margin:0;line-height:1.45;">${esc(cluster.summary)}</p>
      ${jumpButtonsHtml}
    `;

    sumBox.querySelectorAll(".career-jump-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetEl = document.getElementById(btn.dataset.targetStage);
        if(targetEl){
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // Render Mind Map Canvas with Stages and Islands
  const canvas = $("careerMapCanvas");
  if(!canvas) return;
  canvas.innerHTML = "";

  function createIslandCard(isl, stageTitle, isOpen, isHighestEntry){
    const islEl = document.createElement("div");
    islEl.className = `career-island ${isOpen ? "island-open" : "island-locked"}`;
    islEl.tabIndex = 0;
    islEl.setAttribute("role", "button");
    islEl.setAttribute("aria-label", `${isl.title}: Click for detailed curriculum and timeline`);

    islEl.innerHTML = `
      <div>
        <div class="island-top">
          <div>
            <div class="island-title">${esc(isl.title)}</div>
            <div class="island-inst">${esc(isl.institution)}</div>
          </div>
          <span style="font-size:22px;">${cluster.icon}</span>
        </div>
        <div class="island-badges">
          <span class="island-badge-time">⏱️ ${esc(isl.durationYears)}</span>
          <span class="island-badge-cumul">📅 ${esc(isl.cumulativeYears)}</span>
          ${isHighestEntry && isOpen ? `<span class="island-badge-highest">★ Recommended Entry</span>` : ""}
        </div>
        ${isl.isPaid ? `<div class="island-badge-paid">${esc(isl.payHighlight)}</div>` : ""}
      </div>
      <div>
        <div style="font-size:12px;color:#e2e8f0;font-weight:700;margin-top:4px;">Role: <span style="color:#34d399;">${esc(isl.role)}</span></div>
        <div class="island-status-foot">
          ${isOpen ? `<span class="open-txt">✓ Open with Your Results</span>` : `<span class="locked-txt">🔒 Prereqs needed</span>`}
          <span style="color:var(--muted);font-weight:700;">Details &rarr;</span>
        </div>
      </div>
    `;

    islEl.addEventListener("click", () => openIslandDetails(isl, { stageTitle }, isOpen));
    return islEl;
  }

  function appendDivider(label){
    const divLine = document.createElement("div");
    divLine.className = "island-stage-divider";
    divLine.innerHTML = `<span>${esc(label)}</span>`;
    canvas.appendChild(divLine);
  }

  // Stage 1: ITE Certification
  if(stageIte){
    const isHighest = Boolean(highestStage && highestStage.track === "ite");
    const s1Box = document.createElement("div");
    s1Box.id = "stage-ite";
    s1Box.className = `career-stage-row ${isHighest ? "is-highest-entry" : ""}`;
    s1Box.dataset.stageNum = 1;
    s1Box.innerHTML = `
      <div class="career-stage-h">
        <h3>
          <span style="color:${isHighest ? "var(--accent)" : "#34d399"};">●</span>
          ${esc(stageIte.stageTitle)}
          ${isHighest ? `<span class="stage-highest-badge">🎯 Your Highest Eligible Starting Point</span>` : ""}
        </h3>
        <span>${esc(stageIte.stageSubtitle)}</span>
      </div>
    `;
    const g1 = document.createElement("div");
    g1.className = "career-islands-grid";
    stageIte.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      g1.appendChild(createIslandCard(isl, stageIte.stageTitle, isOpen, isHighest));
    });
    s1Box.appendChild(g1);
    canvas.appendChild(s1Box);
    appendDivider("↓ Or consider early Polytechnic Foundation Programme (PFP)");
  }

  // Stage 2: PFP
  if(stagePfp){
    const isHighest = Boolean(highestStage && highestStage.track === "pfp");
    const s2Box = document.createElement("div");
    s2Box.id = "stage-pfp";
    s2Box.className = `career-stage-row ${isHighest ? "is-highest-entry" : ""}`;
    s2Box.dataset.stageNum = 2;
    s2Box.innerHTML = `
      <div class="career-stage-h">
        <h3>
          <span style="color:${isHighest ? "var(--accent)" : "#34d399"};">●</span>
          ${esc(stagePfp.stageTitle)}
          ${isHighest ? `<span class="stage-highest-badge">🎯 Your Highest Eligible Starting Point</span>` : ""}
        </h3>
        <span>${esc(stagePfp.stageSubtitle)}</span>
      </div>
    `;
    const g2 = document.createElement("div");
    g2.className = "career-islands-grid";
    stagePfp.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      g2.appendChild(createIslandCard(isl, stagePfp.stageTitle, isOpen, isHighest));
    });
    s2Box.appendChild(g2);
    canvas.appendChild(s2Box);
    appendDivider("↓ PFP foundation year feeds directly into Poly Diploma Year 1 (or direct Poly entry)");
  }

  // Stage 3: Post-Secondary Level (Diplomas & Junior College parallel)
  const isHighestPoly = Boolean(highestStage && highestStage.track === "poly");
  const isHighestJc = Boolean(highestStage && highestStage.track === "jc");
  const isHighestStage3 = isHighestPoly || isHighestJc;

  const s3Box = document.createElement("div");
  s3Box.id = "stage-3";
  s3Box.className = `career-stage-row ${isHighestStage3 ? "is-highest-entry" : ""}`;
  s3Box.dataset.stageNum = 3;

  if(!isJcOpen){
    // When JC is not eligible for the student, HIDE the JC panel completely! Stage 3 displays the entire panel of Professional Diplomas
    const s3Head = document.createElement("div");
    s3Head.className = "career-stage-h";
    s3Head.id = "stage-poly-track";
    s3Head.innerHTML = `
      <h3>
        <span style="color:${isHighestStage3 ? "var(--accent)" : "#34d399"};">●</span>
        ${esc(stagePoly.stageTitle)}
        ${isHighestStage3 ? `<span class="stage-highest-badge">🎯 Your Highest Eligible Starting Point</span>` : ""}
      </h3>
      <span>${esc(stagePoly.stageSubtitle)}</span>
    `;
    const s3Grid = document.createElement("div");
    s3Grid.className = "career-islands-grid";
    stagePoly.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      s3Grid.appendChild(createIslandCard(isl, stagePoly.stageTitle, isOpen, isHighestPoly));
    });
    s3Box.append(s3Head, s3Grid);
  } else {
    // When student meets JC prerequisites, show both Diplomas and JC on the SAME level in distinct panels!
    const s3Head = document.createElement("div");
    s3Head.className = "career-stage-h";
    s3Head.innerHTML = `
      <h3>
        <span style="color:${isHighestStage3 ? "var(--accent)" : "#34d399"};">●</span>
        Stage 3: Post-Secondary Pathways (Diplomas &amp; Pre-University)
        ${isHighestStage3 ? `<span class="stage-highest-badge">🎯 Your Highest Eligible Starting Point</span>` : ""}
      </h3>
      <span>Parallel Options: Applied Polytechnic / Work-Study Diplomas vs. Academic Junior College Track</span>
    `;

    const parallelWrap = document.createElement("div");
    parallelWrap.className = "career-parallel-wrap";

    // Panel A: Professional Diplomas
    const polyPanel = document.createElement("div");
    polyPanel.className = `career-track-panel track-poly ${isHighestPoly ? "is-highest-track" : ""}`;
    polyPanel.id = "stage-poly-track";
    polyPanel.innerHTML = `
      <div class="career-track-h">
        <h4>
          <span>🎓</span> ${esc(stagePoly.stageTitle.replace(/^Stage\s*\d+:\s*/i, ""))}
          ${isHighestPoly ? `<span class="stage-highest-badge" style="font-size:10px;padding:2px 7px;">★ Highest</span>` : ""}
        </h4>
        <span class="career-track-sub">${esc(stagePoly.stageSubtitle)}</span>
      </div>
    `;
    const polyGrid = document.createElement("div");
    polyGrid.className = "career-islands-grid";
    stagePoly.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      polyGrid.appendChild(createIslandCard(isl, stagePoly.stageTitle, isOpen, isHighestPoly));
    });
    polyPanel.appendChild(polyGrid);

    // Panel B: Junior College & Pre-University Route
    const jcPanel = document.createElement("div");
    jcPanel.className = `career-track-panel track-jc ${isHighestJc ? "is-highest-track" : ""}`;
    jcPanel.id = "stage-jc-track";
    jcPanel.innerHTML = `
      <div class="career-track-h">
        <h4>
          <span>🏛️</span> ${esc(stageJc.stageTitle.replace(/^Stage\s*\d+:\s*/i, ""))}
          ${isHighestJc ? `<span class="stage-highest-badge" style="font-size:10px;padding:2px 7px;">★ Highest</span>` : ""}
        </h4>
        <span class="career-track-sub">${esc(stageJc.stageSubtitle)}</span>
      </div>
    `;
    const jcGrid = document.createElement("div");
    jcGrid.className = "career-islands-grid";
    stageJc.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      jcGrid.appendChild(createIslandCard(isl, stageJc.stageTitle, isOpen, isHighestJc));
    });
    jcPanel.appendChild(jcGrid);

    parallelWrap.append(polyPanel, jcPanel);
    s3Box.append(s3Head, parallelWrap);
  }
  canvas.appendChild(s3Box);
  appendDivider("↓ Both JC A-Levels and Poly Diplomas qualify for University Degrees");

  // Stage 4: University Degrees (re-indexed from Stage 5)
  if(stageUni){
    const s4Box = document.createElement("div");
    s4Box.id = "stage-uni";
    s4Box.className = "career-stage-row";
    s4Box.dataset.stageNum = 4;
    const uniTitle = stageUni.stageTitle.replace(/^Stage\s*\d+:\s*/i, "Stage 4: ");
    s4Box.innerHTML = `
      <div class="career-stage-h">
        <h3>
          <span style="color:#34d399;">●</span>
          ${esc(uniTitle)}
        </h3>
        <span>${esc(stageUni.stageSubtitle)}</span>
      </div>
    `;
    const g4 = document.createElement("div");
    g4.className = "career-islands-grid";
    stageUni.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      g4.appendChild(createIslandCard(isl, uniTitle, isOpen, false));
    });
    s4Box.appendChild(g4);
    canvas.appendChild(s4Box);
    appendDivider("↓ Direct Progression to Senior Leadership & High-Value Industry Careers");
  }

  // Stage 5: Senior Leadership (re-indexed from Stage 6)
  if(stageCareer){
    const s5Box = document.createElement("div");
    s5Box.id = "stage-career";
    s5Box.className = "career-stage-row";
    s5Box.dataset.stageNum = 5;
    const leadTitle = stageCareer.stageTitle.replace(/^Stage\s*\d+:\s*/i, "Stage 5: ");
    s5Box.innerHTML = `
      <div class="career-stage-h">
        <h3>
          <span style="color:#34d399;">●</span>
          ${esc(leadTitle)}
        </h3>
        <span>${esc(stageCareer.stageSubtitle)}</span>
      </div>
    `;
    const g5 = document.createElement("div");
    g5.className = "career-islands-grid";
    stageCareer.islands.forEach(isl => {
      const isOpen = isl.merCheck(evalResult);
      g5.appendChild(createIslandCard(isl, leadTitle, isOpen, false));
    });
    s5Box.appendChild(g5);
    canvas.appendChild(s5Box);
  }
}

function openIslandDetails(isl, stage, isOpen){
  activeIslandObj = isl;
  const dlg = $("islandDlg");
  if(!dlg) return;

  const cluster = CAREER_LADDERS[selectedCareerCluster] || CAREER_LADDERS.nursing;
  $("islDlgIcon").textContent = cluster.icon;
  $("islDlgStageBadge").textContent = stage.stageTitle;
  $("islDlgTitle").textContent = isl.title;
  $("islDlgInst").textContent = isl.institution;
  $("islDlgDuration").textContent = isl.durationYears;
  $("islDlgCumulative").textContent = isl.cumulativeYears;
  $("islDlgRole").textContent = isl.role;
  $("islDlgCurriculum").textContent = isl.curriculum || isl.overview;
  $("islDlgMerText").textContent = isl.merText;

  const statEl = $("islDlgStatus");
  if(statEl){
    if(isOpen){
      statEl.style.background = "rgba(16, 185, 129, 0.2)";
      statEl.style.color = "#6ee7b7";
      statEl.style.border = "1px solid rgba(16, 185, 129, 0.4)";
      statEl.textContent = "✓ Eligible: Your currently selected subject combination meets the prerequisites for this stage!";
    } else {
      statEl.style.background = "rgba(239, 68, 68, 0.2)";
      statEl.style.color = "#fca5a5";
      statEl.style.border = "1px solid rgba(239, 68, 68, 0.4)";
      statEl.textContent = `🔒 Not Yet Eligible with Current Results: ${isl.merText}`;
    }
  }

  const paidSec = $("islDlgPaidSec");
  if(paidSec){
    paidSec.style.display = isl.compensation ? "block" : "none";
    $("islDlgCompensation").textContent = isl.compensation || "";
  }

  dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "");
}

const islandDlgClose = $("islandDlgClose");
if(islandDlgClose){
  islandDlgClose.addEventListener("click", () => {
    const d = $("islandDlg");
    if(d) d.close ? d.close() : d.removeAttribute("open");
  });
}

const islDlgLoadBtn = $("islDlgLoadBtn");
if(islDlgLoadBtn){
  islDlgLoadBtn.addEventListener("click", () => {
    if(!activeIslandObj || !activeIslandObj.recommendedCombiKey) return;
    const d = $("islandDlg");
    if(d) d.close ? d.close() : d.removeAttribute("open");
    loadCourseIntoSubjects(activeIslandObj.recommendedCombiKey);
    setAppMode("results");
  });
}

// Career Cluster Button Listeners
const careerClustersWrap = $("careerClusters");
if(careerClustersWrap){
  careerClustersWrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".career-cluster-btn");
    if(!btn) return;
    careerClustersWrap.querySelectorAll(".career-cluster-btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    selectedCareerCluster = btn.dataset.cluster;
    renderCareerLadders();
    const activeSubs = rows.filter(r => r.taken !== false && r.lv != null && r.pass != null);
    const evalResult = evaluate(activeSubs, { cca: ccaGrade, detailed: detailedGradesMode });
    const highest = getHighestEligibleStartingStage(evalResult);
    if(highest){
      scrollToHighestEligibleStage(highest);
    }
  });
}

async function initApp(){
  try {
    const [savedRows, savedMode, savedCca] = await Promise.all([
      loadSettings(SAVE_KEY),
      loadSettings(MODE_KEY),
      loadSettings(CCA_KEY)
    ]);

    if(savedRows && Array.isArray(savedRows) && savedRows.length === blank().length){
      const b = blank();
      savedRows.forEach((r, idx) => {
        if(r.k && !SUB[r.k]) r.k = b[idx].k;
        if(b[idx].sci) r.sci = true;
      });
      rows = savedRows;
    }

    if(savedMode !== undefined && savedMode !== null){
      detailedGradesMode = savedMode === true || savedMode === "true";
    }

    if(savedCca !== undefined && savedCca !== null){
      ccaGrade = savedCca;
    }
  } catch(e){}

  const toggleGradeMode = $("toggleGradeMode");
  if(toggleGradeMode){
    if(toggleGradeMode.type === "checkbox"){
      toggleGradeMode.checked = detailedGradesMode;
    } else {
      toggleGradeMode.setAttribute("aria-pressed", detailedGradesMode);
    }
  }

  const ccaGradeSelect = $("ccaGradeSelect");
  if(ccaGradeSelect && ccaGrade){
    ccaGradeSelect.value = ccaGrade;
  }

  setAppMode("results");
  render();
  renderBubbles("all");
  annotateGlossary(document.getElementById("ov"));
}

initApp();
