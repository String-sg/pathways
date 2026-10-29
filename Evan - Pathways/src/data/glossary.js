const GLOSSARY_MAP = {
  sec: {
    title: "SEC",
    desc: "Singapore-Cambridge Secondary Education Certificate (taken at the end of Secondary 4 from 2027/2028)."
  },
  g_levels: {
    title: "G1, G2, G3 Levels",
    desc: "General 1, 2, and 3 under Full SBB. G3 is Express standard, G2 is N(A) standard, and G1 is N(T) standard."
  },
  full_sbb: {
    title: "Full SBB",
    desc: "Full Subject-Based Banding allows students to take subjects at G1, G2, or G3 levels based on their strengths."
  },
  l1r4: {
    title: "L1R4 Aggregate",
    desc: "First Language + 4 Relevant subjects (all at G3). Used for Junior College (≤16) and Millennia Institute (≤20)."
  },
  elr2b2: {
    title: "ELR2B2 Aggregate",
    desc: "English + 2 Relevant + Best 2 other subjects. Used for Polytechnic Year 1 diplomas (ELR2B2-A Humanities/Media; ELR2B2-B Business; ELR2B2-C STEM/IT; ELR2B2-D Design)."
  },
  elmab3: {
    title: "ELMAB3 Aggregate",
    desc: "English + Mathematics + Best 3 other subjects. Used for PFP (≤12) and 2-Year Higher Nitec (≤19)."
  },
  pfp: {
    title: "PFP (Polytechnic Foundation Programme)",
    desc: "A 1-year foundation leading directly to a poly diploma without a 5th year in secondary school."
  },
  gross_net: {
    title: "Gross vs Net Aggregate",
    desc: "JC (≤16) and PFP (≤12) require gross scores before CCA deduction. Poly Year 1 (≤22) is net after deducting up to 2 CCA bonus points."
  },
  higher_nitec: {
    title: "Higher Nitec",
    desc: "ITE qualification leading to employment or poly progression. 2-Year uses ELMAB3 (≤19); 3-Year uses R2B2, R1B3-A/B/C, or B4."
  },
  hmtl: {
    title: "HMTL (Higher Mother Tongue)",
    desc: "Higher Mother Tongue Language (G3). Passing both G3 English and HMTL awards 2 bonus points for JC admission (capped at 3 total bonus points)."
  },
  double_sci: {
    title: "Double Science",
    desc: "Our School offers Double Science (split into 2: Chemistry, Physics, Biology) and Combined Science. Triple Science is not offered."
  },
  comb_sci: {
    title: "Combined Science",
    desc: "Our School offers Combined Science and Double Science. Triple Science is not offered."
  },
  triple_sci: {
    title: "Triple Science",
    desc: "Triple Science is not offered at our School. Maximum 2 Pure Sciences are allowed."
  },
  computing: {
    title: "Computing & Business",
    desc: "Our school offers Computing across G1, G2, and G3 levels (qualifies for Poly IT ELR2B2-C and JC/MI L1R4). Business (EBS) is offered at G1 level."
  },
  coursefinder: {
    title: "CourseFinder",
    desc: "Official MOE directory (moe.gov.sg/coursefinder) to check entry requirements for specific diploma & Higher Nitec courses."
  },
  sports_science: {
    title: "Sports Science & Fitness",
    desc: "Foundational disciplines covering exercise physiology, biomechanics, anatomy, and sports nutrition. Offered in ITE (Higher Nitec in Sport Management) and Polytechnics (Diploma in Sport & Exercise Science)."
  },
  enrolled_nurse: {
    title: "Enrolled Nurse (EN)",
    desc: "A licensed healthcare professional registered with the Singapore Nursing Board (SNB) after completing the 3-Year Higher Nitec in Nursing at ITE College East. ENs provide direct patient care and can advance to Registered Nurse via Polytechnic Diploma or ITE Work-Study Diploma."
  },
  registered_nurse: {
    title: "Registered Nurse (RN)",
    desc: "A licensed nursing professional registered with SNB after completing a Polytechnic Diploma in Nursing, ITE Work-Study Diploma (WSDip), or University Degree. RNs lead care plans, administer medications, and supervise ENs."
  },
  wsdip_nursing: {
    title: "Work-Study Diploma (WSDip) in Nursing",
    desc: "A 3-year fully sponsored upgrading diploma by ITE and public healthcare clusters. Enrolled Nurses earn a full regular salary while undergoing structured part-time training to qualify as Registered Nurses."
  },
  g1_mtl: {
    title: "G1 Mother Tongue",
    desc: "Mother Tongue taken at G1 level. A Grade A to D satisfies the Mother Tongue subject requirement for Junior College and Millennia Institute admission (routing students to offer MTL 'B' at pre-university). G1 MTL cannot be included in L1R4, ELR2B2, or PFP ELMAB3 aggregates, but contributes 1–4 points in ITE 3-Year Higher Nitec."
  },
  mtl_b: {
    title: "MTL 'B' (Mother Tongue 'B')",
    desc: "A curriculum option at Junior College and Millennia Institute designed for students who took G1 Mother Tongue in secondary school or meet specific eligibility criteria, focusing on practical communication."
  }
};

const TERM_PATTERNS = [
  { re: "\\bG1\\s+Mother\\s+Tongue\\b", k: "g1_mtl" },
  { re: "\\bMTL\\s+'?B'?\\b", k: "mtl_b" },
  { re: "\\bMother\\s+Tongue\\s+'?B'?\\b", k: "mtl_b" },
  { re: "\\bEnrolled\\s+Nurse(?:s)?\\b", k: "enrolled_nurse" },
  { re: "\\bRegistered\\s+Nurse(?:s)?\\b", k: "registered_nurse" },
  { re: "\\bWork-Study\\s+Diploma(?:s)?\\b", k: "wsdip_nursing" },
  { re: "\\bSport(?:s)?\\s+(?:Science|Management)\\b", k: "sports_science" },
  { re: "\\bFull\\s+Subject-Based\\s+Banding\\b", k: "full_sbb" },
  { re: "\\bHigher\\s+Mother\\s+Tongue\\b", k: "hmtl" },
  { re: "\\bCombined\\s+Science\\b", k: "comb_sci" },
  { re: "\\bDouble\\s+Science\\b", k: "double_sci" },
  { re: "\\bTriple\\s+Science\\b", k: "triple_sci" },
  { re: "\\bGross\\s+vs\\s+Net\\b", k: "gross_net" },
  { re: "\\bHigher\\s+Nitec\\b", k: "higher_nitec" },
  { re: "\\bCourseFinder\\b", k: "coursefinder" },
  { re: "\\bFull\\s+SBB\\b", k: "full_sbb" },
  { re: "\\bELR2B2-C\\b", k: "elr2b2" },
  { re: "\\bELR2B2\\b", k: "elr2b2" },
  { re: "\\bELMAB3\\b", k: "elmab3" },
  { re: "\\bL1R4\\b", k: "l1r4" },
  { re: "\\bHMTL\\b", k: "hmtl" },
  { re: "\\bPFP\\b", k: "pfp" },
  { re: "\\bSEC\\b", k: "sec" },
  { re: "\\b[Cc]omputing\\b", k: "computing" },
  { re: "\\b[Gg]ross\\b", k: "gross_net" },
  { re: "\\b[Nn]et\\b", k: "gross_net" },
  { re: "\\bG1,\\s*G2,\\s*G3\\b", k: "g_levels" },
  { re: "\\bG1\\/G2\\/G3\\b", k: "g_levels" },
  { re: "\\bG3\\b", k: "g_levels" },
  { re: "\\bG2\\b", k: "g_levels" },
  { re: "\\bG1\\b", k: "g_levels" }
];

const GLOSSARY_REGEX = new RegExp(TERM_PATTERNS.map(item => `(${item.re})`).join("|"), "g");

export { GLOSSARY_MAP, TERM_PATTERNS, GLOSSARY_REGEX };
