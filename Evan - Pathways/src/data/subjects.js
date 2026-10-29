const PURE_SCIENCES = ["PHY", "CHEM", "BIO"];

const SUB = {
  EL: { n: "English Language", c: "EL", lv: [3,2,1] },
  MATH: { n: "Mathematics", c: "M", lv: [3,2,1] },
  MTL: { n: "Mother Tongue", c: "MTL", lv: [3,2,1] },
  HMTL: { n: "Higher Mother Tongue (HMTL)", c: "MTL", lv: [3] },
  SCI: { n: "Science (Combined)", c: "S", lv: [3,2,1] },
  HUM: { n: "Humanities (Social Studies + Elective)", c: "H", lv: [3,2] },
  AMATH: { n: "Additional Mathematics", c: "M", lv: [3,2] },
  ART: { n: "Art", c: "O", lv: [3,2,1] },
  DT: { n: "Design & Technology (D&T)", c: "O", lv: [3,2,1] },
  NFS: { n: "Nutrition & Food Science", c: "O", lv: [3,2,1] },
  COMP: { n: "Computing", c: "O", lv: [3,2,1] },
  LIT: { n: "Literature in English", c: "H", lv: [3,2] },
  BIO: { n: "Pure Biology", c: "S", lv: [3] },
  CHEM: { n: "Pure Chemistry", c: "S", lv: [3] },
  PHY: { n: "Pure Physics", c: "S", lv: [3] },
  EBS: { n: "Business / Elements of Business Skills", c: "O", lv: [1] },
  BUS: { n: "Business / Elements of Business Skills", c: "O", lv: [1] }
};

const ELECTIVE_OPTIONS = [
  { k: "AMATH", n: "Additional Mathematics (Math - G2/G3)" },
  { k: "ART", n: "Art (G1/G2/G3)" },
  { k: "DT", n: "Design & Technology (D&T - G1/G2/G3)" },
  { k: "NFS", n: "Nutrition & Food Science (NFS - G1/G2/G3)" },
  { k: "COMP", n: "Computing (G1/G2/G3)" },
  { k: "LIT", n: "Literature in English (Hum - G2/G3)" },
  { k: "PHY", n: "Pure Physics (G3 only)" },
  { k: "CHEM", n: "Pure Chemistry (G3 only)" },
  { k: "BIO", n: "Pure Biology (G3 only)" },
  { k: "HMTL", n: "Higher Mother Tongue (HMTL - G3)" },
  { k: "EBS", n: "Business / Elements of Business Skills (G1 only)" }
];

const FG_G2 = { 7: 3, 8: 4, 9: 5 };

export { PURE_SCIENCES, SUB, ELECTIVE_OPTIONS, FG_G2 };
