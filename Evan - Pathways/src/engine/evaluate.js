import { SUB, FG_G2, PURE_SCIENCES } from '../data/subjects.js';
import { normalizeGrade, getG3Points, getG2Points, getItePoints, isPassGrade } from '../data/grades.js';
import { calculateAllAggregates } from './aggregates.js';

function subjects(list){
  return (list || (typeof rows !== 'undefined' ? rows : [])).filter(r => r.taken !== false).map((r, i) => {
    const info = SUB[r.k] || { n: r.k, c: "O", lv: [3,2,1] };
    const rawGrade = (r.grade !== undefined && r.grade !== null && r.grade !== "") ? normalizeGrade(r.grade, r.lv) : null;
    let isPass = r.pass;
    if(rawGrade !== null){
      isPass = isPassGrade(rawGrade, r.lv);
    } else if(isPass === undefined){
      isPass = true;
    }
    const o = {
      id: i + ":" + r.k, k: r.k, lv: r.lv, pass: isPass,
      rawLv: r.lv, rawPass: isPass, fg: r.fg,
      grade: rawGrade, hasGrade: rawGrade !== null,
      c: info.c, fam: (r.k === "MTL" || r.k === "HMTL") ? "mt" : r.k
    };
    if(o.hasGrade){
      if(o.rawLv === 3){
        o.g3Pts = getG3Points(o.grade);
        o.g2Pts = getG2Points(o.grade, 3);
        o.itePts = getItePoints(o.grade, 3);
        if(!o.pass){
          o.fg = o.g3Pts;
          if(o.fg <= 8){ o.lv = 2; o.pass = true; o.g2 = o.g2Pts; o.mapped = true; }
        }
      } else if(o.rawLv === 2){
        o.g2Pts = getG2Points(o.grade, 2);
        o.itePts = getItePoints(o.grade, 2);
      } else if(o.rawLv === 1){
        o.itePts = getItePoints(o.grade, 1);
      }
    } else if(r.lv === 3 && !r.pass){
      o.fg = r.fg || 7;
      if(o.fg <= 8){ o.lv = 2; o.pass = true; o.g2 = FG_G2[o.fg]; o.mapped = true; }
    }
    return o;
  });
}

const isH = s => s.c === "H", isM = s => s.c === "M", isS = s => s.c === "S", isMS = s => isM(s) || isS(s), isHMS = s => isH(s) || isMS(s);
const count = list => new Set(list.map(s => s.fam)).size;

function fill(slots, pool){
  const used = new Set();
  return (function go(i){
    if(i === slots.length) return true;
    for(const s of pool){
      if(used.has(s.fam) || !slots[i](s)) continue;
      used.add(s.fam);
      if(go(i + 1)) return true;
      used.delete(s.fam);
    }
    return false;
  })(0);
}

function evaluate(list, options = {}){
  const subs = subjects(list), P = subs.filter(s => s.pass), P3 = P.filter(s => s.lv === 3), P23 = P.filter(s => s.lv >= 2);
  const n3 = count(P3), n23 = count(P23), n = count(P);
  const met = { g3: n3 >= 5, g3g2: n3 >= 4 && n23 >= 5, g2: n23 >= 5, g1: n >= 4 };
  const out = {};
  const R = (id) => ({ id, state: "bad", what: "", miss: [] });

  const hasExplicitGrades = subs.some(s => s.hasGrade);
  const agg = calculateAllAggregates(subs, options);
  const { l1r4, elr2b2, elmab3, ite3Year, sec5 } = agg;

  const pureSciCount = (list || (typeof rows !== 'undefined' ? rows : [])).filter(r => r.taken !== false && PURE_SCIENCES.includes(r.k)).length;
  const hasTripleSci = pureSciCount > 2;

  /* JC & MI */
  // For JC/MI, G3 Mathematics and Mother Tongue allow Grade A1–D7 to satisfy subject MER and count towards L1R4
  const P3Jc = subs.filter(s => (s.rawLv === 3 && s.rawPass) || ((isM(s) || s.fam === "mt") && s.rawLv === 3 && s.fg <= 7));

  function jcMiss(pool){
    const m = [], cnt = count(pool);
    // MOE rule: G3 English Language Grade A1 to C6 is compulsory even if HMTL is used as L1
    const hasG3ElPass = subs.some(s => s.k === "EL" && s.rawLv === 3 && s.rawPass);
    if(!hasG3ElPass) m.push("English Language passed at G3 (Grade A1 to C6 is compulsory)");
    if(cnt < 5) m.push(`5 subjects at G3 (currently has ${cnt})`);
    const hasL1 = pool.some(s => s.k === "EL" || s.k === "HMTL");
    if(!hasL1) m.push("English or Higher Mother Tongue passed at G3");
    if(!pool.some(isH)) m.push("Humanities passed at G3");
    // MOE minimum entry requirement for JC/MI: G3 Math or A-Math at Grade A1 to D7
    const hasJcMath = pool.some(isM) || subs.some(s => isM(s) && s.rawLv === 3 && (s.rawPass || s.fg <= 7));
    if(!hasJcMath) m.push("Mathematics at G3 (Grade A1 to D7 required)");
    // MOE Mother Tongue requirement: G1/G2 MTL pass, G3 MTL at Grade A1 to D7, or HMTL at Grade A1 to E8 (G3 MTL E8 is not accepted)
    const hasMtl = subs.some(s =>
      (s.k === "HMTL" && (s.rawPass || (s.rawLv === 3 && s.fg <= 8))) ||
      (s.k === "MTL" && ((s.rawLv < 3 && s.rawPass) || (s.rawLv === 3 && (s.rawPass || s.fg <= 7))))
    );
    if(!hasMtl) m.push("Mother Tongue passed (at G1, G2, G3 Grade A1–D7, or HMTL Grade A1–E8)");
    if(!m.length && !fill([s => s.k === "EL" || s.k === "HMTL", isH, isMS, isHMS, () => true], pool)) m.push("One more Hum/Math/Sci subject at G3");
    return m;
  }

  const hasHmtlBonus = subs.some(s => s.k === "EL" && s.rawLv === 3 && s.rawPass) && subs.some(s => s.k === "HMTL" && s.rawLv === 3 && s.rawPass);

  ["jc", "mi"].forEach(id => {
    const r = R(id);
    r.miss = jcMiss(P3Jc);
    const maxGross = id === "jc" ? 16 : 20;
    r.aggregate = {
      ...l1r4,
      cutoff: maxGross,
      meetsCutoff: l1r4.gross !== null && l1r4.gross <= maxGross,
      type: "L1R4"
    };
    if(hasExplicitGrades){
      if(l1r4.gross === null){
        r.miss.push(`Cannot compute L1R4 aggregate (${l1r4.error || "requires 5 G3 subjects"})`);
      } else if(l1r4.gross > maxGross){
        r.miss.push(`Gross L1R4 aggregate score must not exceed ${maxGross} (current gross: ${l1r4.gross})`);
      }
      if(!l1r4.merDetails.elMet && !r.miss.some(m => m.includes("English"))){
        r.miss.push("G3 English Language Grade A1 to C6 required");
      }
      if(!l1r4.merDetails.mathMet && !r.miss.some(m => m.includes("Mathematics"))){
        r.miss.push("G3 Mathematics Grade A1 to D7 required");
      }
      if(!l1r4.merDetails.mtlMet && !r.miss.some(m => m.includes("Mother Tongue"))){
        r.miss.push("Mother Tongue requirement not met (G3 A1–D7, G2 1–5, G1 A–D, or HMTL A1–E8)");
      }
    }
    if(!r.miss.length){
      r.state = "ok";
      if(hasExplicitGrades && l1r4.gross !== null){
        r.what = `Gross L1R4: ${l1r4.gross}, Net: ${l1r4.net} (cutoff ≤ ${maxGross}). Meets ${id.toUpperCase()} admission criteria!`;
      } else {
        r.what = id === "jc" ? "Gross L1R4 aggregate score of 16 or lower needed." : "Gross L1R4 aggregate score of 20 or lower needed.";
      }
      if(id === "jc" && (hasHmtlBonus || l1r4.hmtlBonus > 0)){
        r.note = "🌟 Higher Mother Tongue Advantage: Eligible for 2 bonus points off your JC net aggregate score (max 3 ordinary bonus points total for JC when combined with CCA).";
      }
    }
    if(id === "jc"){
      const jcNote = "JC requires C6 or better in English, and D7 or better in Math. Prerequisite check passed; admission remains subject to meeting the L1R4 ≤ 16 cut-off.";
      r.note = r.note ? `${r.note} ${jcNote}` : jcNote;
    }
    const g1MtlSub = subs.find(s => s.k === "MTL" && s.rawLv === 1);
    if(g1MtlSub){
      const g1MtlPass = g1MtlSub.hasGrade ? (g1MtlSub.itePts !== null && g1MtlSub.itePts <= 4) : g1MtlSub.rawPass;
      if(g1MtlPass){
        const g1Note = `ℹ️ Mother Tongue at G1: Passing G1 MTL (Grade A–D) fulfills the Mother Tongue requirement for ${id.toUpperCase()} admission (you will offer MTL 'B' at pre-university). Note that G1 MTL cannot be included in your L1R4 aggregate score (requires 5 other G3 subjects).`;
        r.note = r.note ? `${r.note} ${g1Note}` : g1Note;
      }
    }
    out[id] = r;
  });

  /* Poly Year 1 */
  (() => {
    const r = R("poly");
    if(!met.g3g2 && !met.g3) r.miss.push(`5 G3 passes, OR 4 G3 + 1 G2 pass (has ${n3} at G3)`);
    if(!P3.some(s => s.k === "EL")) r.miss.push("English passed at G3");
    // Under SEC 2028, Poly Year 1 allows 4 G3 + 1 G2 (e.g. G2 Mathematics)
    if(!P23.some(isM)) r.miss.push("Mathematics passed at G2 or G3");
    const g3Math = P3.some(isM);
    if(hasExplicitGrades){
      r.aggregate = {
        ...elr2b2,
        cutoff: 22,
        meetsCutoff: elr2b2.net !== null && elr2b2.net <= 22,
        type: elr2b2.type || "ELR2B2"
      };
      if(elr2b2.net === null){
        r.miss.push(`Cannot compute ELR2B2 (${elr2b2.error || "requires G3 EL, 2 G3 relevant, 1 G3 best, and 1 G2/G3 best"})`);
      } else if(!elr2b2.qualifiesGeneral && !elr2b2.qualifiesNursing){
        r.miss.push(`Net ELR2B2 aggregate score must not exceed 22 (current best net: ${elr2b2.net})`);
      }
    }
    if(!r.miss.length){
      if(!g3Math){
        r.state = "amber";
        r.what = hasExplicitGrades && elr2b2.net !== null
          ? `Net ELR2B2 (${elr2b2.type}): ${elr2b2.net}. Eligible for limited Diploma courses only (ELR2B2-A Humanities, Media, Early Childhood where Math is not R1/R2).`
          : "Eligible for limited Diploma courses only (ELR2B2-A Humanities, Media, Early Childhood where Math is not R1/R2).";
      } else {
        r.state = "ok";
        r.what = hasExplicitGrades && elr2b2.net !== null
          ? `Net ELR2B2 (${elr2b2.type}): ${elr2b2.net} (Gross: ${elr2b2.gross}, cutoff ≤ 22). Meets Polytechnic Diploma criteria!`
          : "Net ELR2B2 of 22 or less (Nursing: ELR2B2-C of 24 or less).";
      }
      r.req = [
        "English: G3 passed (Grade A1 to C6)",
        g3Math ? "Mathematics: G3 passed (all diploma courses eligible)" : "Mathematics: G2 passed (B2 subject — limited to courses where Math is not R1/R2, e.g. ELR2B2-A Humanities or Early Childhood)",
        "B2 subject: Taken at either G2 or G3 (Grade 1–4 equivalent; Grade 5/6 not accepted)",
        "Net aggregate ≤ 22 (includes deduction of up to 2 CCA bonus points)"
      ];
    }
    const hasComp = subs.some(s => s.k === "COMP" && s.pass);
    if(P23.some(isM) && !g3Math){
      r.note = "⚠️ Note on G2 Mathematics: In Poly Year 1, most Science, Technology, Engineering, Business, and Design diplomas require Mathematics at G3 as R1/R2. G2 Mathematics can serve as the 2nd best subject (B2) for diploma courses where Maths is not an R1/R2 prerequisite (e.g. Humanities/Media under ELR2B2-A, or Early Childhood / Chinese Studies).";
    } else if(hasComp){
      r.note = "💻 Computing Pathway: G3 Computing directly satisfies Relevant Subject 2 (R2) for Information & Digital Technologies / Computing diploma courses (ELR2B2-C) across all polytechnics!";
    } else {
      r.note = "Full SBB Pathway: You can enter Poly Y1 with 4 G3 subjects + 1 G2 subject. Computing & IT diplomas fall under ELR2B2-C (EL + Maths + Science/Computing/D&T + 2 Best).";
    }
    if(!met.g3){
      const safetyNote = "Peace of mind for G2 subjects: If you miss direct Poly or PFP entry, eligible students still have the official option of a 5th year in secondary school to sit for G3 subjects and qualify for Poly.";
      r.note = r.note ? `${r.note} ${safetyNote}` : safetyNote;
    }
    if(subs.some(s => s.k === "MTL" && s.rawLv === 1)){
      const g1PolyNote = "ℹ️ G1 Mother Tongue Note: G1 MTL cannot be included in your ELR2B2 aggregate (EL, R1, R2, and B1 must be G3; B2 must be at least G2 Grade 1–4). Most diploma courses do not require MTL as a prerequisite.";
      r.note = r.note ? `${r.note} ${g1PolyNote}` : g1PolyNote;
    }
    out.poly = r;
  })();

  /* PFP */
  (() => {
    const r = R("pfp");
    // MOE rule: G3 Grade 9 and G2 Grade 5 & 6 CANNOT be used for PFP admission (Grades 1–4 only)
    const pfpPool = subs.filter(s => {
      if(s.hasGrade) return s.g2Pts !== null && s.g2Pts <= 4;
      return s.pass && s.lv >= 2 && s.fg !== 5 && s.fg !== 6;
    });
    const nPfp = count(pfpPool);
    if(nPfp < 5) r.miss.push(`5 subjects at G2 Grade 1–4 or G3 A1–E8 (has ${nPfp}; Grade 5/6 not accepted for PFP)`);

    const ee = pfpPool.find(s => s.k === "EL");
    if(!ee || (ee.hasGrade ? ee.g2Pts > 3 : (ee.mapped && ee.g2 > 3))){
      r.miss.push("English at G2 Grade 1–3 (or G3 pass)");
    }
    const mm = pfpPool.find(isM);
    if(!mm || (mm.hasGrade ? mm.g2Pts > 3 : (mm.mapped && mm.g2 > 3))){
      r.miss.push("Mathematics at G2 Grade 1–3 (or G3 pass)");
    }
    if(hasExplicitGrades){
      r.aggregate = {
        ...elmab3.pfp,
        cutoff: 12,
        meetsCutoff: elmab3.pfp.gross !== null && elmab3.pfp.gross <= 12,
        type: "ELMAB3"
      };
      if(elmab3.pfp.gross === null){
        r.miss.push(`Cannot compute PFP ELMAB3 (${elmab3.pfp.errors[0] || "requires 5 subjects at G2/G3 Grade 1–4; Grade 5/6 not accepted"})`);
      } else if(elmab3.pfp.gross > 12){
        r.miss.push(`Gross ELMAB3 aggregate score must not exceed 12 (current score: ${elmab3.pfp.gross})`);
      } else if(!elmab3.pfp.qualifies){
        elmab3.pfp.errors.forEach(err => { if(!r.miss.includes(err)) r.miss.push(err); });
      }
    }
    if(!r.miss.length){
      r.state = "ok";
      r.what = hasExplicitGrades && elmab3.pfp.gross !== null
        ? `Gross ELMAB3: ${elmab3.pfp.gross} (cutoff ≤ 12). Qualified for Polytechnic Foundation Programme!`
        : "Gross ELMAB3 of 12 or less (progress directly to Poly foundation).";
      r.req = [
        "English: G3 pass or G2 Grade 1–3",
        "Maths: G3 pass or G2 Grade 1–3",
        "1 of the Best 3 subjects: G3 pass or G2 Grade 1–3",
        "2 other Best subjects: At least G2 Grade 4 (Grade 5 not accepted)",
        "Gross ELMAB3 score of 12 or lower (excluding CCA bonus points)"
      ];
      r.note = "⚠️ Important: PFP requires a strong pass (Grade 1–3 for EL & Maths; Grade 1–4 for others). Grade 5 passes do not qualify for PFP. Computing & IT diplomas fall under Engineering & Technology cluster (requires relevant subject ≤ 3).";
    }
    const safetyNote = "Peace of mind for G2 subjects: If you miss direct Poly or PFP entry, eligible students still have the official option of a 5th year in secondary school to sit for G3 subjects and qualify for Poly.";
    r.note = r.note ? `${r.note} ${safetyNote}` : safetyNote;
    if(subs.some(s => s.k === "MTL" && s.rawLv === 1)){
      const g1PfpNote = "ℹ️ G1 Mother Tongue Note: G1 MTL cannot be computed in your ELMAB3 aggregate for PFP (only G2 subjects and mapped G3 subjects count). You must have at least 5 other G2/G3 subjects to qualify.";
      r.note = r.note ? `${r.note} ${g1PfpNote}` : g1PfpNote;
    }
    out.pfp = r;
  })();

  /* 2-Year Higher Nitec */
  (() => {
    const r = R("hn2");
    const totalOffered = count(subs);
    if(totalOffered < 4){
      r.miss.push(`At least 4 subjects offered at any level (currently taking ${totalOffered})`);
      out.hn2 = r;
      return;
    }

    const g23Subs = subs.filter(s => s.rawLv >= 2 || (s.rawLv === 3 && s.fg <= 9));
    const distinctG23 = new Set(g23Subs.map(s => s.fam)).size;

    if(distinctG23 < 5){
      r.state = "amber";
      r.what = "Conditional eligibility via Accelerated Pathway: Complete Higher Nitec in ~2 years by performing strongly in Year 1 Semester 1.";
      r.req = [
        "Entry Requirement: At least 4 subjects offered at G1, G2, or G3 level (meets 3-Year Higher Nitec admission criteria)",
        "Accelerated Progression Criteria: Attain strong academic performance / qualifying GPA in Year 1 Semester 1 examinations",
        "Fast-Track Duration: Eligible students skip Year 1 Semester 2 and advance directly into Year 2, finishing in ~2 years",
        "Direct Entry Caveat: Direct Year 2 admission requires 5 G2/G3 subjects with ELMAB3 ≤ 19; this accelerated route is attained internally after enrolment"
      ];
      r.note = "⚡ Accelerated 2-Year Pathway: Students taking 4 G1 subjects (or fewer than 5 G2/G3 subjects) join Year 1 of Higher Nitec. By achieving strong examination results in Year 1 Semester 1, you can skip Year 1 Sem 2 and accelerate straight into Year 2, completing your Higher Nitec in ~2 years. Note that this internal progression route differs from direct SEC Year 2 entry (which requires 5 G2/G3 subjects with ELMAB3 ≤ 19).";
      out.hn2 = r;
      return;
    }

    const hasEl = subs.some(s => s.k === "EL" && (s.rawLv >= 2 || s.rawLv === 3));
    const hasMath = subs.some(s => isM(s) && (s.rawLv >= 2 || s.rawLv === 3));
    if(!hasEl) r.miss.push("English Language taken at G2 or G3");
    if(!hasMath) r.miss.push("Mathematics taken at G2 or G3");

    const elPass = P23.some(s => s.k === "EL");
    const mathPass = P23.some(isM);

    if(hasExplicitGrades){
      r.aggregate = {
        ...elmab3.ite2Year,
        cutoff: 19,
        meetsCutoff: elmab3.ite2Year.gross !== null && elmab3.ite2Year.gross <= 19,
        type: "ELMAB3"
      };
      if(elmab3.ite2Year.gross === null){
        r.miss.push("Insufficient subjects to compute ELMAB3 for 2-Year Higher Nitec");
      } else if(elmab3.ite2Year.gross > 19){
        r.miss.push(`Gross ELMAB3 aggregate score must not exceed 19 (current score: ${elmab3.ite2Year.gross})`);
      }
    } else {
      if(n23 < 3){
        r.miss.push(`At least 3 passes at G2 or G3 (has ${n23}; ELMAB3 ≤ 19 cannot be achieved with 3 or more failed subjects)`);
      } else if(!elPass && !mathPass){
        r.miss.push("Pass in English Language OR Mathematics at G2/G3 (all 2-Year courses require an EL or Math pass)");
      }
    }

    if(!r.miss.length){
      const directEntryMet = hasExplicitGrades
        ? (elmab3.ite2Year.gross !== null && elmab3.ite2Year.gross <= 19)
        : (n23 >= 4 && (elPass || mathPass));

      if(directEntryMet){
        r.state = "ok";
        r.what = hasExplicitGrades && elmab3.ite2Year.gross !== null
          ? `Gross ELMAB3: ${elmab3.ite2Year.gross} (cutoff ≤ 19). Direct PSE entry to 2-Year Higher Nitec!`
          : "Gross ELMAB3 of 19 or less (using G2-equivalent grades). Direct PSE entry to 2-Year Higher Nitec!";
        r.req = [
          "Gross ELMAB3 ≤ 19 computed based on G2 equivalent grades",
          "G3 Grade 9 and G2 Grade 6 can be used for aggregate computation",
          "Must meet specific minimum entry requirements (MER) of the course applied for"
        ];
        r.note = "Official MOE 2028 PSE direct entry to 2-Year Higher Nitec. Unlike PFP, 2-Year Higher Nitec accepts G2 Grade 5/6 and G3 Grade 9 for aggregate computation.";
      } else {
        r.state = "amber";
        r.what = "Conditional eligibility: Gross ELMAB3 of 19 or less needed; limited to courses matching your passed subjects.";
        r.req = [
          "Gross ELMAB3 ≤ 19 (achievable with strong passes in your remaining subjects)",
          (elPass && mathPass)
            ? "English & Maths passed: General course criteria met, contingent on aggregate cut-off"
            : !elPass
              ? "English not passed: Limited to Technology & Engineering courses where English pass is not an MER"
              : "Maths not passed: Limited to Business & Services courses where Maths pass is not an MER"
        ];
        r.note = "⚠️ Conditional for 2-Year Higher Nitec: Failing subjects adds 6 points each (G2 Grade 6) to your ELMAB3 aggregate. Course-specific MERs also apply. If ELMAB3 exceeds 19, 3-Year Higher Nitec offers a foundation route.";
      }
    }
    if(subs.some(s => s.k === "MTL" && s.rawLv === 1)){
      const g1Hn2Note = "ℹ️ G1 Mother Tongue Note: G1 MTL cannot be computed into ELMAB3 for direct 2-Year Higher Nitec entry (requires G2/G3 subjects). However, G1 MTL counts fully towards 3-Year Higher Nitec (and the internal accelerated 2-year route).";
      r.note = r.note ? `${r.note} ${g1Hn2Note}` : g1Hn2Note;
    }
    out.hn2 = r;
  })();

  /* 3-Year Higher Nitec */
  (() => {
    const r = R("hn3");
    if(hasExplicitGrades){
      r.aggregate = {
        ...ite3Year,
        cutoff: null,
        meetsCutoff: Boolean(ite3Year && ite3Year.eligible),
        type: (ite3Year && (ite3Year.bestType || ite3Year.type)) || "HN3"
      };
    }
    const totalOffered = count(subs);
    const mP = P.some(isM);
    const eP = P.some(s => s.k === "EL");
    const sP = P.some(s => isS(s) || s.k === "COMP");

    if(totalOffered < 4){
      r.miss.push(`At least 4 subjects offered at any level (currently taking ${totalOffered})`);
    } else if(eP && mP && n >= 3){
      r.state = "ok";
      r.what = "Eligible for all ITE course clusters (R2B2, R1B3-A/B/C, and B4 courses open).";
      r.req = [
        "R2B2 & R1B3: English & Maths passed (meets general criteria for all course clusters)",
        "Course Clusters Open: Applied & Health Sciences, Business & Services, Engineering, Info-Comm Technology, and Hospitality",
        "Aggregate calculation includes your 4 best subjects (G1 A–E / G2 1–6 / G3 A1–9 count)",
        "No grade requirement for the final Best subject (B2 in R2B2, B3 in R1B3, or B1–B4 in B4)"
      ];
      r.note = "In Year 1, students take foundational modules. Performing well in Year 1 Sem 1 allows acceleration into the 2-year route. Graduates can progress to Poly Diplomas or ITE Work-Study Diplomas.";
    } else if((mP || sP) && n >= 3){
      r.state = "ok";
      r.what = "Eligible for Technology, Engineering & Info-Comm clusters (R1B3-A/B and B4 open).";
      r.req = [
        "Maths or Science/Computing passed (meets R1 requirement for R1B3-A/B)",
        "At least 2 other subjects passed (B1 and B2; no grade requirement for B3)",
        "Courses requiring English (e.g. Business/Hospitality under R2B2 or R1B3-C) require an English pass"
      ];
      r.note = "Courses requiring an English pass (e.g. Business/Hospitality under R2B2 or R1B3-C) require English A1–E8 (G3), 1–5 (G2), or A–D (G1).";
    } else if(eP && n >= 3){
      r.state = "ok";
      r.what = "Eligible for Business, Services & Hospitality clusters (R1B3-C and B4 open).";
      r.req = [
        "English passed (meets R1 requirement for R1B3-C)",
        "At least 2 other subjects passed (B1 and B2; no grade requirement for B3)",
        "Courses requiring Maths (e.g. Engineering under R1B3-A/B) require a Maths pass"
      ];
      r.note = "Courses requiring a Mathematics pass (e.g. Engineering under R1B3-A/B) require Maths at G1/G2/G3.";
    } else {
      // Under B4, there is NO minimum grade requirement for the 4 subjects
      r.state = "amber";
      r.what = "Eligible for General clusters under Aggregate Type B4 (No specific subject passes required; all 4 subjects count towards aggregate).";
      r.req = [
        "Aggregate Type B4 has NO minimum grade requirement for B1 to B4",
        "G1 Grade E, G2 Grade 6, and G3 Grade 9 count for aggregate computation",
        "Specific course clusters under R2B2 and R1B3 will require passes in English, Maths, or Science"
      ];
    }
    if(totalOffered >= 4 && !met.g2){
      r.note = (r.note ? r.note + " " : "") + "Students offering G1 subjects enter Year 1 of 3-Year Higher Nitec and can qualify for an accelerated 2-year route based on Year 1 Sem 1 exam results.";
    }
    out.hn3 = r;
  })();

  /* NAFA Foundation & Arts */
  (() => {
    const r = R("nfp");
    if(!met.g2) r.miss.push(`5 G2 or G3 passes required (has ${n23})`);
    if(!P23.some(s => s.k === "EL")) r.miss.push("English at G2 grade 3 or better");
    if(!P23.some(isM)) r.miss.push("Maths passed at G2/G3");
    if(!r.miss.length){ r.state = "ok"; r.what = "ELMAB3 of 15 or less. Portfolio/audition required."; }
    out.nfp = r;
  })();

  (() => {
    const r = R("arts");
    if(!(met.g3 || met.g3g2)) r.miss.push(`5 G3 passes, or 4 G3 + 1 G2 (has ${n3} at G3)`);
    if(!P3.some(s => s.k === "EL")) r.miss.push("English passed at G3");
    if(!r.miss.length){ r.state = "ok"; r.what = "Direct Diploma entry (NAFA / LASALLE). Gross aggregate ≤ 21. Portfolio/audition required."; }
    r.note = "Maths is not compulsory for NAFA/LASALLE arts diplomas.";
    out.arts = r;
  })();

  const hasCombSci = subs.some(s => s.k === "SCI");
  if(pureSciCount > 2){
    Object.values(out).forEach(r => {
      r.state = "bad";
      r.miss.unshift("⚠️ Triple Science is not offered at our Secondary School (Maximum 2 Pure Sciences allowed: e.g. Phy+Chem or Chem+Bio).");
    });
  } else if(hasCombSci && pureSciCount > 0){
    Object.values(out).forEach(r => {
      r.state = "bad";
      r.miss.unshift("⚠️ Students take either Combined Science OR Pure Sciences (Double Science), not both. Please set Combined Science to 'None' when offering Pure Sciences.");
    });
  }

  out.sec5 = sec5;
  return { n3, n23, n, met, out, aggregates: agg, sec5 };
}

export { subjects, evaluate };
