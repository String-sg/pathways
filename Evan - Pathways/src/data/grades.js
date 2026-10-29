// MOE SEC 2028 Official Grade Scales and Conversion Tables

export const G3_GRADES = ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "9"];
export const G2_GRADES = ["1", "2", "3", "4", "5", "6"];
export const G1_GRADES = ["A", "B", "C", "D", "E"];

// Numerical point values for G3 / O-Level grades
export const G3_POINTS = {
  "A1": 1, "A2": 2, "B3": 3, "B4": 4, "C5": 5, "C6": 6, "D7": 7, "E8": 8, "9": 9, "F9": 9
};

// Mapping of G3 / O-Level grade to G2 / N(A)-Level grade (Official MOE SEC 2028)
// A1 to B3 -> 1 | B4 to C6 -> 2 | D7 -> 3 | E8 -> 4 | 9 -> 5
export const G3_TO_G2_MAP = {
  "A1": 1, "A2": 1, "B3": 1,
  "B4": 2, "C5": 2, "C6": 2,
  "D7": 3,
  "E8": 4,
  "9": 5, "F9": 5,
  1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 4, 9: 5
};

// Conversion of G3, G2, G1 grades to ITE aggregate points (for 3-Year Higher Nitec)
// G3 A1-D7 / G2 1-3 / G1 A -> 1
// G3 E8    / G2 4   / G1 B -> 2
// G3 9     / G2 5   / G1 C -> 3
//            G2 6   / G1 D -> 4
//                     G1 E -> 5
export const ITE_POINTS_TABLE = {
  G3: {
    "A1": 1, "A2": 1, "B3": 1, "B4": 1, "C5": 1, "C6": 1, "D7": 1,
    "E8": 2,
    "9": 3, "F9": 3,
    1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 3
  },
  G2: {
    "1": 1, "2": 1, "3": 1,
    "4": 2,
    "5": 3,
    "6": 4,
    1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 4
  },
  G1: {
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "E": 5
  }
};

// CCA Grade bonus points
export const CCA_BONUS_POINTS = {
  "EXCELLENT": 2,
  "A1": 2,
  "A2": 2,
  "GOOD": 1,
  "B3": 1,
  "B4": 1,
  "B5": 1,
  "C6": 1,
  "FAIR": 0,
  "NONE": 0
};

// Helper: Normalize grade input string/number
export function normalizeGrade(val, lv = 3) {
  if (val === undefined || val === null || val === "") return null;
  const s = String(val).trim().toUpperCase();
  if (lv === 3) {
    if (s === "F9" || s === "9") return "9";
    if (["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8"].includes(s)) return s;
    const n = parseInt(s, 10);
    const map = { 1: "A1", 2: "A2", 3: "B3", 4: "B4", 5: "C5", 6: "C6", 7: "D7", 8: "E8", 9: "9" };
    if (map[n]) return map[n];
  } else if (lv === 2) {
    if (["1", "2", "3", "4", "5", "6"].includes(s)) return s;
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 6) return String(n);
  } else if (lv === 1) {
    if (["A", "B", "C", "D", "E"].includes(s)) return s;
    const n = parseInt(s, 10);
    const map = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };
    if (map[n]) return map[n];
  }
  return s;
}

// Helper: Get G3 points (1..9)
export function getG3Points(grade) {
  if (grade === undefined || grade === null || grade === "") return null;
  const norm = normalizeGrade(grade, 3);
  return G3_POINTS[norm] ?? null;
}

// Helper: Map G3 grade to G2 grade points (1..5)
export function mapG3ToG2(grade) {
  if (grade === undefined || grade === null || grade === "") return null;
  const norm = normalizeGrade(grade, 3);
  return G3_TO_G2_MAP[norm] ?? null;
}

// Helper: Get G2 points (1..6)
export function getG2Points(grade, lv = 2) {
  if (grade === undefined || grade === null || grade === "") return null;
  if (lv === 3) return mapG3ToG2(grade);
  const norm = normalizeGrade(grade, 2);
  const n = parseInt(norm, 10);
  return (n >= 1 && n <= 6) ? n : null;
}

// Helper: Get ITE aggregate points (1..5)
export function getItePoints(grade, lv = 1) {
  if (grade === undefined || grade === null || grade === "") return null;
  if (lv === 3) {
    const norm = normalizeGrade(grade, 3);
    return ITE_POINTS_TABLE.G3[norm] ?? null;
  }
  if (lv === 2) {
    const norm = normalizeGrade(grade, 2);
    return ITE_POINTS_TABLE.G2[norm] ?? null;
  }
  const norm = normalizeGrade(grade, 1);
  return ITE_POINTS_TABLE.G1[norm] ?? null;
}

// Helper: Check if grade is a pass at given level
export function isPassGrade(grade, lv = 3) {
  if (grade === undefined || grade === null || grade === "") return false;
  if (lv === 3) {
    const pts = getG3Points(grade);
    return pts !== null && pts <= 6; // A1 to C6
  }
  if (lv === 2) {
    const pts = getG2Points(grade, 2);
    return pts !== null && pts <= 5; // 1 to 5
  }
  if (lv === 1) {
    const norm = normalizeGrade(grade, 1);
    return ["A", "B", "C", "D"].includes(norm); // A to D
  }
  return false;
}

// Helper: Resolve CCA bonus points
export function getCCABonus(cca) {
  if (typeof cca === "number") return Math.max(0, Math.min(2, cca));
  if (!cca) return 0;
  const key = String(cca).trim().toUpperCase();
  return CCA_BONUS_POINTS[key] ?? 0;
}
