const PATHS = [
  { id: "jc", url: "https://www.moe.gov.sg/post-secondary/admissions/pse/jc-and-mi", name: "Junior College", next: "2-year A-Level course → University" },
  { id: "mi", url: "https://www.moe.gov.sg/post-secondary/admissions/pse/jc-and-mi", name: "Millennia Institute", next: "3-year A-Level course → University" },
  { id: "poly", url: "https://www.moe.gov.sg/post-secondary/admissions/pse/polytechnic-diploma-course", name: "Polytechnic Year 1", next: "3-year Diploma → Polytechnic" },
  { id: "pfp", url: "https://www.moe.gov.sg/post-secondary/admissions/pse/pfp", name: "Polytechnic Foundation (PFP)", next: "1-year foundation → Poly Diploma" },
  { id: "hn2", url: "https://www.moe.gov.sg/post-secondary/admissions/pse/ite-2-year-higher-nitec", name: "2-Year Higher Nitec", next: "Direct entry to Year 2 → Higher Nitec" },
  { id: "hn3", url: "https://www.moe.gov.sg/post-secondary/admissions/pse/ite-3-year-higher-nitec", name: "3-Year Higher Nitec", next: "Entry into Year 1 → Higher Nitec" },
  { id: "nfp", url: "https://www.nafa.edu.sg/admissions/foundation-admissions", name: "NAFA Foundation (NFP)", next: "Arts Foundation → NAFA Diploma" },
  { id: "arts", url: "https://www.lasalle.edu.sg/study/admissions/diploma-admissions/", name: "Arts Institutions (NAFA/LASALLE)", next: "Direct Diploma in Creative Arts" }
];

const KIND = {
  jc: { c: "#2f5d8a", t: "Academic: 2-year A-Levels" },
  mi: { c: "#6b4fa0", t: "Academic: 3-year A-Levels" },
  poly: { c: "#11707e", t: "Applied Diploma" },
  pfp: { c: "#2660a4", t: "Foundation Year into Poly" },
  hn2: { c: "#b8571a", t: "ITE 2-Year Direct" },
  hn3: { c: "#b8571a", t: "ITE 3-Year Foundation" },
  nfp: { c: "#9a6a2c", t: "Arts Foundation" },
  arts: { c: "#a3324a", t: "Arts Diploma" }
};

export { PATHS, KIND };
