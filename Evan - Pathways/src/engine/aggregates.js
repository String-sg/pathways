import { getG3Points, getG2Points, getItePoints, getCCABonus } from '../data/grades.js';

/**
 * Computes L1R4 for JC and MI admissions under MOE SEC 2028 rules.
 * All subjects must be taken at G3 level.
 * L1: G3 English or HMTL (evaluates both and selects best valid score).
 * R1: Humanities (G3).
 * R2: Math or Science (G3).
 * R3: Humanities, Math, or Science (G3).
 * R4: Any remaining G3 subject.
 * MTL/HMTL rule: Only one score allowed if both are taken for the same language.
 */
export function calculateL1R4(subs, options = {}) {
  const g3Subs = subs.filter(s => s.rawLv === 3 && s.g3Pts !== null && s.g3Pts !== undefined);
  const ccaBonus = getCCABonus(options.cca);
  const clepBonus = options.clep ? 2 : 0;

  const elSub = subs.find(s => s.k === "EL" && s.rawLv === 3);
  const elMet = !!(elSub && elSub.g3Pts <= 6);

  const mathSub = subs.find(s => (s.k === "MATH" || s.k === "AMATH") && s.rawLv === 3 && s.g3Pts <= 7);
  const mathMet = !!mathSub;

  const hmtlSub = subs.find(s => s.k === "HMTL");
  const mtlSub = subs.find(s => s.k === "MTL");
  let mtlMet = false;
  if (hmtlSub && (hmtlSub.hasGrade ? (hmtlSub.rawLv === 3 && hmtlSub.g3Pts <= 8) : (hmtlSub.rawLv === 3 && hmtlSub.rawPass))) {
    mtlMet = true;
  } else if (mtlSub) {
    if (mtlSub.hasGrade) {
      if (mtlSub.rawLv === 3 && mtlSub.g3Pts <= 7) mtlMet = true;
      else if (mtlSub.rawLv === 2 && mtlSub.g2Pts <= 5) mtlMet = true;
      else if (mtlSub.rawLv === 1 && mtlSub.itePts !== null && mtlSub.itePts !== undefined && mtlSub.itePts <= 4) mtlMet = true;
    } else {
      if (mtlSub.rawLv === 3 && (mtlSub.rawPass || mtlSub.fg <= 7)) mtlMet = true;
      else if (mtlSub.rawLv === 2 && mtlSub.rawPass) mtlMet = true;
      else if (mtlSub.rawLv === 1 && mtlSub.rawPass) mtlMet = true;
    }
  }

  const canGetHmtlBonus = elMet && hmtlSub && hmtlSub.rawLv === 3 && hmtlSub.g3Pts <= 6;

  const candidateL1s = [];
  if (elSub && elSub.g3Pts !== null) candidateL1s.push({ sub: elSub, isHmtl: false });
  if (hmtlSub && hmtlSub.rawLv === 3 && hmtlSub.g3Pts !== null) candidateL1s.push({ sub: hmtlSub, isHmtl: true });

  let best = null;

  for (const l1Obj of candidateL1s) {
    const l1 = l1Obj.sub;
    const pool = g3Subs.filter(s => s.id !== l1.id && !(l1Obj.isHmtl && s.fam === "mt") && s.k !== "RK");
    const r1List = pool.filter(s => s.c === "H");
    for (const r1 of r1List) {
      const poolAfterR1 = pool.filter(s => s.id !== r1.id);
      const r2List = poolAfterR1.filter(s => s.c === "M" || s.c === "S");
      for (const r2 of r2List) {
        const poolAfterR2 = poolAfterR1.filter(s => s.id !== r2.id);
        const r3List = poolAfterR2.filter(s => s.c === "H" || s.c === "M" || s.c === "S");
        for (const r3 of r3List) {
          const poolAfterR3 = poolAfterR2.filter(s => s.id !== r3.id);
          for (const r4 of poolAfterR3) {
            const used = [r1, r2, r3, r4];
            const mtCount = used.filter(s => s.fam === "mt").length;
            if (mtCount > 1) continue;
            const gross = l1.g3Pts + r1.g3Pts + r2.g3Pts + r3.g3Pts + r4.g3Pts;
            if (!best || gross < best.gross) {
              best = {
                gross,
                l1, r1, r2, r3, r4,
                l1Type: l1Obj.isHmtl ? "HMTL" : "EL"
              };
            }
          }
        }
      }
    }
  }

  const merMet = elMet && mathMet && mtlMet;
  if (!best) {
    const fallbackHmtlBonus = canGetHmtlBonus ? 2 : 0;
    const fallbackOrdinaryBonus = Math.min(3, ccaBonus + fallbackHmtlBonus + (options.affiliationBonus || 0));
    const fallbackTotalBonus = fallbackOrdinaryBonus + clepBonus;
    return {
      gross: null,
      net: null,
      eligible: false,
      cutoff: 16,
      meetsCutoff: false,
      merMet,
      merDetails: { elMet, mathMet, mtlMet },
      bonusPoints: fallbackTotalBonus,
      ordinaryBonus: fallbackOrdinaryBonus,
      clepBonus,
      hmtlBonus: fallbackHmtlBonus,
      qualifiesJc: false,
      qualifiesMi: false,
      error: "Insufficient G3 subjects satisfying L1R4 subject categories (L1, R1 Hum, R2 Math/Sci, R3 Hum/Math/Sci, R4 Any)."
    };
  }

  // MOE rule: 2 HMTL bonus points are strictly awarded only when English is L1, not when HMTL is chosen as L1
  const hmtlBonus = (best.l1Type === "EL" && canGetHmtlBonus) ? 2 : 0;
  const ordinaryBonus = Math.min(3, ccaBonus + hmtlBonus + (options.affiliationBonus || 0));
  const totalBonus = ordinaryBonus + clepBonus;
  const net = Math.max(0, best.gross - totalBonus);
  const qualifiesJc = merMet && best.gross <= 16;
  const qualifiesMi = merMet && best.gross <= 20;
  return {
    gross: best.gross,
    net,
    eligible: qualifiesJc || qualifiesMi,
    cutoff: 16,
    meetsCutoff: qualifiesJc,
    breakdown: {
      l1: { k: best.l1.k, grade: best.l1.grade, pts: best.l1.g3Pts, type: best.l1Type },
      r1: { k: best.r1.k, grade: best.r1.grade, pts: best.r1.g3Pts },
      r2: { k: best.r2.k, grade: best.r2.grade, pts: best.r2.g3Pts },
      r3: { k: best.r3.k, grade: best.r3.grade, pts: best.r3.g3Pts },
      r4: { k: best.r4.k, grade: best.r4.grade, pts: best.r4.g3Pts }
    },
    bonusPoints: totalBonus,
    ordinaryBonus,
    clepBonus,
    hmtlBonus,
    merMet,
    merDetails: { elMet, mathMet, mtlMet },
    qualifiesJc,
    qualifiesMi
  };
}

/**
 * Computes ELR2B2 for Polytechnic Diploma courses.
 * EL, R1, R2, B1 use G3 subject grade.
 * B2 uses G2 equivalent grade (can be taken at G2 or G3; Grade 5 and 6 not accepted for ELR2B2).
 * Evaluates ELR2B2-A, B, C, D and selects the best score.
 */
export function calculateELR2B2(subs, options = {}) {
  const ccaBonus = getCCABonus(options.cca);
  const elSub = subs.find(s => s.k === "EL" && s.rawLv === 3 && s.g3Pts !== null);
  const elMet = !!(elSub && elSub.g3Pts <= 6);

  if (!elSub) {
    return {
      gross: null, net: null, type: null, types: {},
      merMet: false, bonusPoints: ccaBonus, qualifiesGeneral: false, qualifiesNursing: false,
      error: "G3 English Language is required for ELR2B2 computation."
    };
  }

  const g3OtherSubs = subs.filter(s => s.id !== elSub.id && s.rawLv === 3 && s.g3Pts !== null && s.g3Pts <= 8 && s.k !== "RK");
  const b2Pool = subs.filter(s => s.id !== elSub.id && s.g2Pts !== null && s.g2Pts !== undefined && s.g2Pts <= 4 && s.k !== "RK");

  const typeRules = {
    "ELR2B2-A": {
      isR1: s => s.c === "H" || s.k === "ART",
      isR2: s => s.c === "H" || s.c === "M" || s.c === "S" || s.k === "ART"
    },
    "ELR2B2-B": {
      isR1: s => s.c === "M",
      isR2: s => s.c === "H" || s.c === "S" || s.c === "O"
    },
    "ELR2B2-C": {
      isR1: s => s.c === "M",
      isR2: s => s.c === "S" || s.k === "COMP" || s.k === "DT"
    },
    "ELR2B2-D": {
      isR1: s => s.k === "ART" || s.k === "DT" || s.c === "H" || s.c === "M" || s.c === "S",
      isR2: () => true
    }
  };

  const resultsByType = {};
  let bestOverall = null;

  for (const [typeName, rules] of Object.entries(typeRules)) {
    let bestForType = null;
    const r1Candidates = g3OtherSubs.filter(rules.isR1);

    for (const r1 of r1Candidates) {
      const poolAfterR1 = g3OtherSubs.filter(s => s.id !== r1.id);
      const r2Candidates = poolAfterR1.filter(rules.isR2);

      for (const r2 of r2Candidates) {
        const poolAfterR2 = poolAfterR1.filter(s => s.id !== r2.id);
        for (const b1 of poolAfterR2) {
          const poolForB2 = b2Pool.filter(s => s.id !== r1.id && s.id !== r2.id && s.id !== b1.id);
          for (const b2 of poolForB2) {
            const used = [r1, r2, b1, b2];
            const mtCount = used.filter(s => s.fam === "mt").length;
            if (mtCount > 1) continue;
            const b2Pt = b2.rawLv === 3 ? b2.g2Pts : b2.g2Pts;
            const gross = elSub.g3Pts + r1.g3Pts + r2.g3Pts + b1.g3Pts + b2Pt;
            if (!bestForType || gross < bestForType.gross) {
              bestForType = { gross, r1, r2, b1, b2, b2Pt };
            }
          }
        }
      }
    }

    if (bestForType) {
      const net = Math.max(0, bestForType.gross - ccaBonus);
      resultsByType[typeName] = {
        gross: bestForType.gross,
        net,
        breakdown: {
          el: { k: elSub.k, grade: elSub.grade, pts: elSub.g3Pts },
          r1: { k: bestForType.r1.k, grade: bestForType.r1.grade, pts: bestForType.r1.g3Pts },
          r2: { k: bestForType.r2.k, grade: bestForType.r2.grade, pts: bestForType.r2.g3Pts },
          b1: { k: bestForType.b1.k, grade: bestForType.b1.grade, pts: bestForType.b1.g3Pts },
          b2: { k: bestForType.b2.k, grade: bestForType.b2.grade, pts: bestForType.b2Pt, lv: bestForType.b2.rawLv }
        }
      };
      if (!bestOverall || net < bestOverall.net) {
        bestOverall = { typeName, ...resultsByType[typeName] };
      }
    }
  }

  if (!bestOverall) {
    return {
      gross: null, net: null, eligible: false, cutoff: 22, meetsCutoff: false, type: null, types: {},
      merMet: elMet, bonusPoints: ccaBonus, qualifiesGeneral: false, qualifiesNursing: false,
      error: "Insufficient subjects meeting G3/G2 criteria for ELR2B2 computation."
    };
  }

  const qualifiesGeneral = elMet && bestOverall.net <= 22;
  const qualifiesNursing = !!(elMet && resultsByType["ELR2B2-C"] && resultsByType["ELR2B2-C"].net <= 24);

  return {
    gross: bestOverall.gross,
    net: bestOverall.net,
    eligible: qualifiesGeneral || qualifiesNursing,
    cutoff: 22,
    meetsCutoff: qualifiesGeneral,
    type: bestOverall.typeName,
    types: resultsByType,
    breakdown: bestOverall.breakdown,
    bonusPoints: ccaBonus,
    merMet: elMet,
    qualifiesGeneral,
    qualifiesNursing
  };
}

/**
 * Computes ELMAB3 based on G2 equivalent grades.
 * Handles PFP rules (Gross <= 12, strict grade criteria, no Grade 5/6),
 * ITE 2-Year Higher Nitec rules (Gross <= 19, allows G3 9 and G2 6),
 * and Sec 5 progression rules.
 */
export function calculateELMAB3(subs, options = {}) {
  const ccaBonus = getCCABonus(options.cca);
  const elSubs = subs.filter(s => s.k === "EL" && s.g2Pts !== null && s.g2Pts !== undefined);
  const mathSubs = subs.filter(s => (s.k === "MATH" || s.k === "AMATH") && s.g2Pts !== null && s.g2Pts !== undefined);

  const computeBase = (poolFilter) => {
    let best = null;
    for (const el of elSubs.filter(poolFilter)) {
      for (const ma of mathSubs.filter(s => s.id !== el.id && poolFilter(s))) {
        const otherPool = subs.filter(s => s.id !== el.id && s.id !== ma.id && s.k !== "RK" && s.g2Pts !== null && poolFilter(s));
        const sorted = [...otherPool].sort((a, b) => a.g2Pts - b.g2Pts);
        const chosen = [];
        const fams = new Set([el.fam, ma.fam]);
        for (const s of sorted) {
          if (chosen.length === 3) break;
          if (fams.has(s.fam)) continue;
          fams.add(s.fam);
          chosen.push(s);
        }
        if (chosen.length === 3) {
          const gross = el.g2Pts + ma.g2Pts + chosen[0].g2Pts + chosen[1].g2Pts + chosen[2].g2Pts;
          if (!best || gross < best.gross) {
            best = { gross, el, ma, b: chosen };
          }
        }
      }
    }
    return best;
  };

  // PFP: Grade 9 at G3 and Grade 5 & 6 at G2 cannot be used (g2Pts must be <= 4)
  const pfpBase = computeBase(s => s.g2Pts <= 4);
  let pfpResult = { gross: null, net: null, qualifies: false, errors: [] };

  if (pfpBase) {
    const elOk = pfpBase.el.g2Pts <= 3;
    const maOk = pfpBase.ma.g2Pts <= 3;
    const b1Ok = pfpBase.b[0].g2Pts <= 3;
    const errors = [];
    if (!elOk) errors.push("PFP requires English Language at G2 Grade 1–3 or G3 pass");
    if (!maOk) errors.push("PFP requires Mathematics at G2 Grade 1–3 or G3 pass");
    if (!b1Ok) errors.push("PFP requires at least one of the 3 Best subjects at G2 Grade 1–3 or G3 pass");
    if (pfpBase.gross > 12) errors.push(`Gross ELMAB3 score must not exceed 12 (current gross: ${pfpBase.gross})`);
    pfpResult = {
      gross: pfpBase.gross,
      net: Math.max(0, pfpBase.gross - ccaBonus),
      breakdown: {
        el: { k: pfpBase.el.k, grade: pfpBase.el.grade, pts: pfpBase.el.g2Pts },
        ma: { k: pfpBase.ma.k, grade: pfpBase.ma.grade, pts: pfpBase.ma.g2Pts },
        b1: { k: pfpBase.b[0].k, grade: pfpBase.b[0].grade, pts: pfpBase.b[0].g2Pts },
        b2: { k: pfpBase.b[1].k, grade: pfpBase.b[1].grade, pts: pfpBase.b[1].g2Pts },
        b3: { k: pfpBase.b[2].k, grade: pfpBase.b[2].grade, pts: pfpBase.b[2].g2Pts }
      },
      qualifies: errors.length === 0,
      errors
    };
  } else {
    pfpResult.errors.push("Insufficient subjects meeting PFP grade requirements (G2 Grade 1–4 only)");
  }

  // ITE 2-Year: Allows G3 9 (mapped to 5) and G2 6 (6)
  const iteBase = computeBase(() => true);
  let iteResult = { gross: null, net: null, qualifies: false };
  if (iteBase) {
    iteResult = {
      gross: iteBase.gross,
      net: Math.max(0, iteBase.gross - ccaBonus),
      breakdown: {
        el: { k: iteBase.el.k, grade: iteBase.el.grade, pts: iteBase.el.g2Pts },
        ma: { k: iteBase.ma.k, grade: iteBase.ma.grade, pts: iteBase.ma.g2Pts },
        b1: { k: iteBase.b[0].k, grade: iteBase.b[0].grade, pts: iteBase.b[0].g2Pts },
        b2: { k: iteBase.b[1].k, grade: iteBase.b[1].grade, pts: iteBase.b[1].g2Pts },
        b3: { k: iteBase.b[2].k, grade: iteBase.b[2].grade, pts: iteBase.b[2].g2Pts }
      },
      qualifies: iteBase.gross <= 19
    };
  }

  // Sec 5 aggregates (all subjects must have at least Grade 5 at G2, no Grade 6)
  const sec5Base = computeBase(s => s.g2Pts <= 5);
  let elb3 = null;
  let mab3 = null;

  if (elSubs.length > 0) {
    for (const el of elSubs.filter(s => s.g2Pts <= 5)) {
      const pool = subs.filter(s => s.id !== el.id && s.g2Pts !== null && s.g2Pts <= 5 && s.k !== "RK");
      const sorted = [...pool].sort((a, b) => a.g2Pts - b.g2Pts);
      const chosen = [];
      const fams = new Set([el.fam]);
      for (const s of sorted) {
        if (chosen.length === 3) break;
        if (fams.has(s.fam)) continue;
        fams.add(s.fam);
        chosen.push(s);
      }
      if (chosen.length === 3) {
        const sum = el.g2Pts + chosen[0].g2Pts + chosen[1].g2Pts + chosen[2].g2Pts;
        if (elb3 === null || sum < elb3) elb3 = sum;
      }
    }
  }

  if (mathSubs.length > 0) {
    for (const ma of mathSubs.filter(s => s.g2Pts <= 5)) {
      const pool = subs.filter(s => s.id !== ma.id && s.g2Pts !== null && s.g2Pts <= 5 && s.k !== "RK");
      const sorted = [...pool].sort((a, b) => a.g2Pts - b.g2Pts);
      const chosen = [];
      const fams = new Set([ma.fam]);
      for (const s of sorted) {
        if (chosen.length === 3) break;
        if (fams.has(s.fam)) continue;
        fams.add(s.fam);
        chosen.push(s);
      }
      if (chosen.length === 3) {
        const sum = ma.g2Pts + chosen[0].g2Pts + chosen[1].g2Pts + chosen[2].g2Pts;
        if (mab3 === null || sum < mab3) mab3 = sum;
      }
    }
  }

  const primaryGross = pfpResult.gross ?? iteResult.gross ?? null;
  const primaryNet = pfpResult.net ?? iteResult.net ?? null;
  const pfpEligible = Boolean(pfpResult.qualifies);
  const ite2Eligible = Boolean(iteResult.qualifies);
  const eligible = pfpEligible || ite2Eligible;

  return {
    gross: primaryGross,
    net: primaryNet,
    eligible,
    pfpEligible,
    ite2Eligible,
    qualifiesPfp: pfpEligible,
    qualifiesIte2: ite2Eligible,
    cutoff: pfpEligible ? 12 : 19,
    meetsCutoff: eligible,
    pfp: pfpResult,
    ite2Year: iteResult,
    sec5: {
      elmab3: sec5Base ? sec5Base.gross : null,
      elb3,
      mab3
    }
  };
}

/**
 * Computes ITE 3-Year Higher Nitec Aggregate Types (R2B2, R1B3-A, R1B3-B, R1B3-C, B4)
 * using ITE aggregate points table (1 to 5).
 */
export function calculateIte3Year(subs, options = {}) {
  const ccaBonus = getCCABonus(options.cca);
  const pool = subs.filter(s => s.itePts !== null && s.itePts !== undefined && s.k !== "RK");

  // MER subject pass check: G3 A1-E8 (pt <= 2), G2 1-5 (pt <= 3), G1 A-D (pt <= 4)
  const isMerPass = s => s.itePts <= (s.rawLv === 3 ? 2 : s.rawLv === 2 ? 3 : 4);

  const elSubs = pool.filter(s => s.k === "EL");
  const mathSubs = pool.filter(s => s.c === "M");
  const sciSubs = pool.filter(s => s.c === "S" || s.k === "COMP");

  const computeType = (rRules, minPassCount) => {
    let best = null;
    for (const r1 of pool.filter(rRules.r1)) {
      const poolAfterR1 = pool.filter(s => s.id !== r1.id);
      const r2Candidates = rRules.r2 ? poolAfterR1.filter(rRules.r2) : [null];
      for (const r2 of r2Candidates) {
        const poolAfterR2 = r2 ? poolAfterR1.filter(s => s.id !== r2.id) : poolAfterR1;
        const sorted = [...poolAfterR2].sort((a, b) => a.itePts - b.itePts);
        const bSlots = r2 ? 2 : 3;
        const chosen = [];
        const fams = new Set([r1.fam, ...(r2 ? [r2.fam] : [])]);
        for (const s of sorted) {
          if (chosen.length === bSlots) break;
          if (fams.has(s.fam)) continue;
          fams.add(s.fam);
          chosen.push(s);
        }
        if (chosen.length === bSlots) {
          const used = [r1, ...(r2 ? [r2] : []), ...chosen];
          const passes = used.filter(isMerPass).length;
          if (passes >= minPassCount) {
            const gross = used.reduce((sum, item) => sum + item.itePts, 0);
            if (!best || gross < best.gross) {
              best = { gross, net: Math.max(0, gross - ccaBonus), used };
            }
          }
        }
      }
    }
    return best;
  };

  const types = {
    "R2B2": computeType({ r1: s => s.k === "EL" && isMerPass(s), r2: s => s.c === "M" && isMerPass(s) }, 3),
    "R1B3-A": computeType({ r1: s => s.c === "M" && isMerPass(s) }, 3),
    "R1B3-B": computeType({ r1: s => (s.c === "M" || s.c === "S" || s.k === "COMP") && isMerPass(s) }, 3),
    "R1B3-C": computeType({ r1: s => s.k === "EL" && isMerPass(s) }, 3),
    "B4": (() => {
      const sorted = [...pool].sort((a, b) => a.itePts - b.itePts);
      const chosen = [];
      const fams = new Set();
      for (const s of sorted) {
        if (chosen.length === 4) break;
        if (fams.has(s.fam)) continue;
        fams.add(s.fam);
        chosen.push(s);
      }
      if (chosen.length === 4) {
        const gross = chosen.reduce((sum, item) => sum + item.itePts, 0);
        return { gross, net: Math.max(0, gross - ccaBonus), used: chosen };
      }
      return null;
    })()
  };

  let bestType = null;
  let lowestNet = Infinity;
  for (const [t, data] of Object.entries(types)) {
    if (data && data.net < lowestNet) {
      lowestNet = data.net;
      bestType = t;
    }
  }

  const grossVal = bestType ? types[bestType].gross : null;
  const netVal = bestType ? types[bestType].net : null;
  const eligible = Boolean(bestType && grossVal !== null && pool.length >= 4);

  return {
    bestType,
    type: bestType,
    gross: grossVal,
    net: netVal,
    points: grossVal,
    netPoints: netVal,
    eligible,
    qualifies: eligible,
    types,
    bonusPoints: ccaBonus
  };
}

/**
 * Evaluates Secondary 5 Eligibility under MOE SEC 2028 rules.
 * Criteria 1: 3 or more G3 passes (A1 to C6), and not qualify for JC, MI, or Poly Diploma.
 * Criteria 2: 2 or fewer G3 passes, and attain gross ELMAB3 <= 21, ELB3 <= 14, or MAB3 <= 14 (all at least Grade 5 at G2).
 * All-G3 offer condition: Gross ELMAB3 <= 19 at G2.
 */
export function evaluateSec5Eligibility(subs, options = {}, polyResult = null, jcResult = null, miResult = null) {
  const g3PassCount = subs.filter(s => s.rawLv === 3 && s.rawPass).length;
  const elmab3Data = calculateELMAB3(subs, options);
  const { elmab3, elb3, mab3 } = elmab3Data.sec5;

  const polyQualified = polyResult ? polyResult.qualifiesGeneral : false;
  const jcQualified = jcResult ? jcResult.qualifiesJc : false;
  const miQualified = miResult ? miResult.qualifiesMi : false;
  const qualifiesForTertiary = polyQualified || jcQualified || miQualified;

  const meetsCriteria1 = g3PassCount >= 3 && !qualifiesForTertiary;
  const meetsCriteria2 = g3PassCount <= 2 && (
    (elmab3 !== null && elmab3 <= 21) ||
    (elb3 !== null && elb3 <= 14) ||
    (mab3 !== null && mab3 <= 14)
  );

  const eligible = meetsCriteria1 || meetsCriteria2;
  const canTakeAllG3 = elmab3 !== null && elmab3 <= 19;

  const reasons = [];
  if (meetsCriteria1) {
    reasons.push(`Criteria 1 met: ${g3PassCount} G3 passes and not qualified for JC/MI/Poly direct entry.`);
  }
  if (meetsCriteria2) {
    reasons.push(`Criteria 2 met: ≤2 G3 passes with qualifying aggregate (ELMAB3: ${elmab3 ?? "N/A"} ≤ 21, ELB3: ${elb3 ?? "N/A"} ≤ 14, or MAB3: ${mab3 ?? "N/A"} ≤ 14).`);
  }
  if (!eligible) {
    reasons.push("Does not meet Criteria 1 (≥3 G3 passes without tertiary entry) or Criteria 2 (qualifying G2 aggregates).");
  }
  if (canTakeAllG3) {
    reasons.push(`Eligible to offer all subjects at G3 in Sec 5 (Gross ELMAB3: ${elmab3} ≤ 19).`);
  }

  return {
    eligible,
    criteriaMet: meetsCriteria1 && meetsCriteria2 ? "both" : meetsCriteria1 ? "criteria1" : meetsCriteria2 ? "criteria2" : "none",
    canTakeAllG3,
    g3PassCount,
    aggregates: { elmab3, elb3, mab3 },
    reasons
  };
}

/**
 * Master function to calculate all post-secondary aggregates for a subject list.
 */
export function calculateAllAggregates(subs, options = {}) {
  const l1r4 = calculateL1R4(subs, options);
  const elr2b2 = calculateELR2B2(subs, options);
  const elmab3 = calculateELMAB3(subs, options);
  const ite3Year = calculateIte3Year(subs, options);
  const sec5 = evaluateSec5Eligibility(subs, options, elr2b2, l1r4, l1r4);
  return {
    l1r4,
    elr2b2,
    elmab3,
    ite3Year,
    ite3yr: ite3Year,
    sec5
  };
}
