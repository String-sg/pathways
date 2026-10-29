const CAREER_LADDERS = {
  computing: {
    id: "computing",
    title: "Computing, AI & Cybersecurity Career Ladder",
    icon: "💻",
    summary: "Explore complete post-secondary pathways into tech leadership — from ITE systems training, PFP, and Polytechnic Year 1 diplomas to direct Junior College A-Levels leading to premier university Computer Science degrees and CTO roles!",
    stages: [
      {
        stageNum: 1,
        stageId: "stage-ite",
        stageTitle: "Stage 1: IT & Systems Foundation",
        stageSubtitle: "Secondary School & ITE Certification (G1/G2/G3)",
        islands: [
          {
            id: "isl_ite_cyber",
            title: "ITE Higher Nitec in Cyber & Network Security / IT",
            institution: "ITE College Central / East / West (School of Info-Comm Tech)",
            role: "Junior Systems & Network Administrator",
            durationYears: "2 to 3 Years",
            cumulativeYears: "2 to 3 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "3-Yr: Math or Sci/Comp passed (G1/G2/G3) | 2-Yr: ELMAB3 ≤ 19",
            recommendedCombiKey: "ite_hn2_cyber",
            overview: "Network configuration (Cisco), Linux/Windows server administration, cybersecurity defense tools, firewall management, and technical troubleshooting.",
            curriculum: "Network Fundamentals, Server Virtualization, Cybersecurity Essentials, Python Scripting, Ethical Hacking Basics, 24-week attachment.",
            compensation: "Industry training allowances (S$700–S$1,000/mo) with vendor certifications (CompTIA, Cisco CCNA)."
          }
        ]
      },
      {
        stageNum: 2,
        stageId: "stage-pfp",
        stageTitle: "Stage 2: Polytechnic Foundation Programme (PFP)",
        stageSubtitle: "1-Year Poly Foundation replacing Sec 5 for G2 Students",
        islands: [
          {
            id: "isl_pfp_comp",
            title: "PFP: Technology & Computing Foundation",
            institution: "All 5 Polytechnics (SP, NP, NYP, TP, RP)",
            role: "Poly Foundation Student → Direct Poly Diploma Year 1",
            durationYears: "1 Year Foundation + 3 Years Poly",
            cumulativeYears: "4 Years to Diploma",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.pfp.state !== "bad",
            merText: "5 G2 subjects Grade 1–4 (EL & Math Grade 1–3, ELMAB3 ≤ 12)",
            recommendedCombiKey: "pfp_stem",
            overview: "Direct foundation year at polytechnic replacing Sec 5! Covers foundational programming, applied mathematics, physics, and design thinking with guaranteed direct entry to poly diplomas.",
            curriculum: "Foundations of Coding (Python), Engineering Math, Digital Logic, Cyber Ethics, Poly Academic Preparation.",
            compensation: "Eligible for CDC/PFP training bursaries and polytechnic foundation study grants."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-poly",
        stageTitle: "Stage 3: Professional Computing Diplomas",
        stageSubtitle: "Polytechnic Full-Time Direct vs. 💰 Paid Work-Study",
        islands: [
          {
            id: "isl_poly_comp_direct",
            title: "Polytechnic Diploma in Applied AI / Cybersecurity / IT",
            institution: "SP / NP / NYP / TP / RP (3-Year Diploma)",
            role: "Software Developer / Cybersecurity Analyst / AI Engineer",
            durationYears: "3 Years",
            cumulativeYears: "3 Years (Direct from SEC)",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.poly.state !== "bad",
            merText: "4 G3 + 1 G2 pass (Net ELR2B2-C ≤ 22; Math & Science/Comp passed)",
            recommendedCombiKey: "poly_comp",
            overview: "Full-stack software engineering, deep learning algorithms, cloud architecture (AWS/Azure), penetration testing, and digital forensics. Direct entry with 4 G3 + 1 G2!",
            curriculum: "Data Structures & Algorithms, Machine Learning, Cloud DevOps, Full-Stack Web Development, Secure Software Development, Capstone Project.",
            compensation: "Smart Nation scholarships and tech company sponsorships offer full tuition waivers + S$1,000/mo stipend."
          },
          {
            id: "isl_wsd_cyber",
            title: "ITE Work-Study Diploma in Cyber Security & Operations",
            institution: "ITE in Partnership with GovTech, CSIT & Tech Enterprises",
            role: "Security Operations Centre (SOC) Analyst",
            durationYears: "2.5 Years",
            cumulativeYears: "4.5 to 5.5 Years",
            isPaid: true,
            payHighlight: "💰 Earn S$2,200 – S$3,000/month salary + 100% company tuition sponsorship!",
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "Higher Nitec in IT / Cybersecurity with aptitude interview",
            recommendedCombiKey: "ite_hn2_cyber",
            overview: "Work inside a real 24/7 Security Operations Centre (SOC) defending Singapore's cyber infrastructure while earning full monthly salary and a completely free diploma!",
            curriculum: "Threat Hunting & Incident Response, SIEM Configuration, Cloud Security Architecture, Malware Analysis, Certified Ethical Hacker (CEH) prep.",
            compensation: "Monthly salary (S$2,200 to S$3,000/mo), CPF, shift allowances, guaranteed career progression, and zero tuition debt."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-jc",
        stageTitle: "Stage 3: Junior College & Pre-University Route",
        stageSubtitle: "GCE A-Levels Academic Pre-U Track (2 Years in JC / 3 Years in MI)",
        islands: [
          {
            id: "isl_jc_comp",
            title: "Junior College: JC Science & Computing Stream (H2 Computing & Math)",
            institution: "Junior Colleges offering H2 Computing (e.g. YIJC, JPJC, ASRJC, DHS, HCI, NJC)",
            role: "Pre-University A-Level Student (Direct fast-track to B.Comp Computer Science)",
            durationYears: "2 Years",
            cumulativeYears: "2 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.mi.state !== "bad",
            merText: "5 G3 subjects (Gross L1R4 ≤ 16 for JC / ≤ 20 for MI; G3 EL C6, Math D7)",
            recommendedCombiKey: "jc_sci",
            overview: "Pre-university academic preparation offering H2 Computing (Python programming, object-oriented design, database architecture, network protocols) alongside H2 Mathematics and H2 Physics. Prepares directly for university Computer Science degrees without polytechnic detours!",
            curriculum: "GCE A-Levels: H2 Computing, H2 Mathematics, H2 Physics / Further Mathematics, General Paper, Project Work.",
            compensation: "MOE Pre-University Scholarships and Edusave awards available for top performers."
          }
        ]
      },
      {
        stageNum: 4,
        stageId: "stage-uni",
        stageTitle: "Stage 4: University Computer Science Degree",
        stageSubtitle: "Bachelor of Computing (B.Comp) in CS / AI / Cybersecurity",
        islands: [
          {
            id: "isl_uni_comp",
            title: "University B.Comp in Computer Science / Artificial Intelligence",
            institution: "NUS (School of Computing) / NTU / SMU / SUTD / SIT",
            role: "Senior Software Engineer / AI Research Scientist",
            durationYears: "3 to 4 Years",
            cumulativeYears: "5 to 7 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.poly.state !== "bad" || evalResult.out.pfp.state !== "bad" || evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "GCE A-Levels (from JC) OR Polytechnic Diploma in Computing / IT",
            recommendedCombiKey: "jc_sci",
            overview: "Advanced algorithms, computer vision, large language models (LLM), distributed cloud systems, and cryptographic protocols. Direct entry from either JC A-Levels or Poly Diploma!",
            curriculum: "Distributed Systems, Operating Systems Kernel Design, Deep Learning Architectures, Applied Cryptography, Software Product Management, Honors Thesis.",
            compensation: "Top starting salaries in Singapore (averaging S$5,500 to S$7,500/month) with international tech firms."
          }
        ]
      },
      {
        stageNum: 5,
        stageId: "stage-career",
        stageTitle: "Stage 5: Tech Leadership & Chief Technology Officer",
        stageSubtitle: "Chief Information Security Officer (CISO) / Head of AI / Tech Founder",
        islands: [
          {
            id: "isl_career_comp_lead",
            title: "Chief Technology Officer (CTO) / Chief Information Security Officer (CISO)",
            institution: "Global Tech Companies, Fintech Unicorns, Government Agencies (GovTech/DSTA)",
            role: "Chief Technology Officer (CTO) / CISO / Principal AI Architect",
            durationYears: "Ongoing",
            cumulativeYears: "8+ Years",
            isPaid: true,
            payHighlight: "💰 S$12,000 – S$25,000+/month executive technology salary",
            merCheck: (evalResult) => true,
            merText: "B.Comp / M.Sc + Proven track record of high-impact engineering leadership",
            recommendedCombiKey: "jc_sci",
            overview: "Architects national-scale digital infrastructure, leads engineering teams of hundreds of developers, and sets artificial intelligence governance for Singapore and global enterprises.",
            curriculum: "Enterprise System Architecture, Corporate Governance, Strategic AI Investment, Board Advisory.",
            compensation: "Executive compensation ($12,000 to $25,000+/month) plus equity stock grants."
          }
        ]
      }
    ]
  },

  nursing: {
    id: "nursing",
    title: "Nursing & Healthcare Career Ladder",
    icon: "🩺",
    summary: "Structured progression from Enrolled Nurse (ITE) to Registered Nurse (Polytechnic / Work-Study Diploma), Junior College fast-track, and University Nursing Degrees. Under Full SBB, no student is locked out of nursing!",
    stages: [
      {
        stageNum: 1,
        stageId: "stage-ite",
        stageTitle: "Stage 1: Foundational Practice",
        stageSubtitle: "Secondary School & ITE Certification (G1/G2/G3)",
        islands: [
          {
            id: "isl_ite_nursing",
            title: "ITE 3-Yr Higher Nitec in Nursing",
            institution: "ITE College East (School of Health Sciences)",
            role: "Enrolled Nurse (EN)",
            durationYears: "3 Years",
            cumulativeYears: "3 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad",
            merText: "Min 4 subjects offered at G1/G2/G3 with English & Math passed (R1B3-C)",
            recommendedCombiKey: "ite_hn_nursing",
            overview: "Foundational healthcare modules, high-tech simulation wards, anatomy, and supervised patient care in public hospitals.",
            curriculum: "Anatomy & Physiology, Basic Nursing Procedures, Infection Control, Medical-Surgical Nursing, and 39 weeks of hospital rotations.",
            compensation: "Public healthcare clusters offer training bursaries ($500–$800/mo) and sign-on incentives for ITE nursing students."
          }
        ]
      },
      {
        stageNum: 2,
        stageId: "stage-pfp",
        stageTitle: "Stage 2: Polytechnic Foundation Programme (PFP)",
        stageSubtitle: "1-Year Poly Foundation replacing Sec 5 for G2 Students",
        islands: [
          {
            id: "isl_pfp_nursing",
            title: "PFP: Healthcare & Nursing Foundation",
            institution: "Nanyang Poly (NYP) & Ngee Ann Poly (NP)",
            role: "Poly Foundation Student → Direct Entry into Diploma in Nursing",
            durationYears: "1 Year Foundation + 3 Years Poly",
            cumulativeYears: "4 Years to Registered Nurse",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.pfp.state !== "bad",
            merText: "5 G2 subjects Grade 1–4 (EL & Math Grade 1–3, ELMAB3 ≤ 12)",
            recommendedCombiKey: "pfp_health",
            overview: "Skip Sec 5 and enter polytechnic 1 year early! Focuses on healthcare biology, clinical communication, and science foundations to prepare for the Diploma in Nursing.",
            curriculum: "Bioscience Fundamentals, Health Communication, Quantitative Skills, Healthcare Ethics, Simulation Prep.",
            compensation: "Eligible for MOH Holdings healthcare study grants and cluster sponsorship packages."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-poly",
        stageTitle: "Stage 3: Professional Nursing Diplomas",
        stageSubtitle: "Polytechnic Full-Time vs. 💰 Paid Work-Study",
        islands: [
          {
            id: "isl_poly_nursing_direct",
            title: "Polytechnic Diploma in Nursing (Direct Entry)",
            institution: "Nanyang Poly (NYP) / Ngee Ann Poly (NP)",
            role: "Registered Nurse (RN)",
            durationYears: "3 Years",
            cumulativeYears: "3 Years (Direct from SEC)",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.poly.state !== "bad",
            merText: "4 G3 + 1 G2 pass (Net ELR2B2-C ≤ 24; English, Math & Science passed)",
            recommendedCombiKey: "poly_nursing",
            overview: "Direct entry from Secondary School with preferential net cut-off of 24. Prepares students for immediate registration as Registered Nurses (RN).",
            curriculum: "Pathophysiology, Advanced Pharmacology, Acute Care, Paediatric & Geriatric Nursing, 32+ weeks hospital rotations.",
            compensation: "MOH Holdings Healthcare Scholarships provide 100% tuition sponsorship + S$900–S$1,000 monthly living allowance."
          },
          {
            id: "isl_wsd_nursing",
            title: "ITE Work-Study Diploma (WSDip) in Nursing",
            institution: "ITE with SingHealth, NHG & NUHS Hospital Clusters",
            role: "Registered Nurse (RN)",
            durationYears: "3 Years",
            cumulativeYears: "6 Years (ITE + Work-Study)",
            isPaid: true,
            payHighlight: "💰 Earn S$2,000 – S$2,600/month full salary + 100% course sponsorship by hospital!",
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad",
            merText: "Higher Nitec in Nursing (Enrolled Nurse) with hospital sponsorship",
            recommendedCombiKey: "ite_hn_nursing",
            overview: "Outstanding earn-as-you-learn pathway! Work as an Enrolled Nurse earning full monthly salary while your hospital sponsors 100% of your diploma tuition fees.",
            curriculum: "On-the-job clinical coaching (70%) combined with block-release classroom and simulation training (30%) at ITE and hospitals.",
            compensation: "Regular full-time salary ($2,000 to $2,600/mo) plus CPF, hospital bonuses, medical benefits, and zero tuition debt."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-jc",
        stageTitle: "Stage 3: Junior College & Pre-University Route",
        stageSubtitle: "GCE A-Levels Academic Pre-U Track (2 Years in JC / 3 Years in MI)",
        islands: [
          {
            id: "isl_jc_nursing",
            title: "Junior College: Pre-U Science Stream (H2 Biology & Chemistry)",
            institution: "All Junior Colleges islandwide",
            role: "Pre-University A-Level Student (Direct fast-track to NUS/SIT BSc Nursing or Medicine)",
            durationYears: "2 Years",
            cumulativeYears: "2 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.mi.state !== "bad",
            merText: "5 G3 subjects (Gross L1R4 ≤ 16 for JC / ≤ 20 for MI; G3 EL C6, Math D7)",
            recommendedCombiKey: "jc_sci",
            overview: "2-year A-Level academic preparation in H2 Biology and H2 Chemistry. Qualifies directly for the Bachelor of Science in Nursing at NUS, SIT, or direct university healthcare/medical courses without diploma detours.",
            curriculum: "GCE A-Levels: H2 Biology, H2 Chemistry, H2 Mathematics, General Paper, Project Work.",
            compensation: "MOH Holdings Pre-University Healthcare Scholarships offer full funding and early clinical attachments."
          }
        ]
      },
      {
        stageNum: 4,
        stageId: "stage-uni",
        stageTitle: "Stage 4: University Nursing Degree",
        stageSubtitle: "Bachelor of Science in Nursing (Honours)",
        islands: [
          {
            id: "isl_uni_nursing",
            title: "University Bachelor of Science in Nursing",
            institution: "National University of Singapore (NUS Alice Lee Centre) / SIT",
            role: "Staff Nurse / Senior Staff Nurse (BSc Nursing)",
            durationYears: "2 to 3 Years",
            cumulativeYears: "5 to 6 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.poly.state !== "bad" || evalResult.out.pfp.state !== "bad" || evalResult.out.hn3.state !== "bad",
            merText: "GCE A-Levels (from JC) OR Polytechnic Diploma / Work-Study Diploma in Nursing",
            recommendedCombiKey: "poly_nursing",
            overview: "Advanced clinical reasoning, healthcare leadership, translational research, and specialized clinical electives. Diploma graduates receive accelerated exemptions!",
            curriculum: "Health Informatics, Nursing Research & Biostatistics, Complex Clinical Management, Palliative Care, Capstone Project.",
            compensation: "Hospital sponsorship packages offer full tuition payment + S$2,500–S$3,200 monthly study grant for in-service diploma nurses."
          }
        ]
      },
      {
        stageNum: 5,
        stageId: "stage-career",
        stageTitle: "Stage 5: Senior Clinical Leadership & Specialisation",
        stageSubtitle: "Senior Practice & Master's Qualification",
        islands: [
          {
            id: "isl_career_nursing_lead",
            title: "Advanced Practice Nurse (APN) / Nurse Clinician",
            institution: "Public Healthcare Clusters & MOH",
            role: "Advanced Practice Nurse (APN) / Nurse Director",
            durationYears: "Ongoing",
            cumulativeYears: "8+ Years",
            isPaid: true,
            payHighlight: "💰 S$6,000 – S$12,000+/month senior clinical specialist salary",
            merCheck: (evalResult) => true,
            merText: "BSc Nursing + Master of Nursing & Board Certification",
            recommendedCombiKey: "poly_nursing",
            overview: "APNs hold clinical prescribing authority, run specialized outpatient clinics, lead hospital ward operations, and mentor clinical teams.",
            curriculum: "Master of Nursing, Advanced Health Assessment, Pharmacology Prescribing, Clinical Decision Making, Executive Healthcare Leadership.",
            compensation: "Senior healthcare professional salary scale ($6,000 to $12,000+/month) with retention bonuses."
          }
        ]
      }
    ]
  },

  aerospace: {
    id: "aerospace",
    title: "Aerospace & Aviation Engineering Ladder",
    icon: "✈️",
    summary: "From aircraft technician (ITE) to Licensed Aircraft Engineer (LAE), Junior College physical science routes, and University Aeronautical Engineer. Singapore is Asia's aerospace hub with world-class MRO facilities.",
    stages: [
      {
        stageNum: 1,
        stageId: "stage-ite",
        stageTitle: "Stage 1: Technical Foundation",
        stageSubtitle: "Secondary School & ITE Certification (G1/G2/G3)",
        islands: [
          {
            id: "isl_ite_aero",
            title: "ITE Higher Nitec in Aerospace Technology / Avionics",
            institution: "ITE College Central (School of Engineering)",
            role: "Junior Aircraft Technician",
            durationYears: "2 to 3 Years",
            cumulativeYears: "2 to 3 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "3-Yr: Min 4 subjects at G1 (R1B3-A Math pass) | 2-Yr: ELMAB3 ≤ 19 at G2",
            recommendedCombiKey: "ite_hn3_eng",
            overview: "Hands-on aircraft maintenance on real aircraft in ITE's aerospace hangar. Learn aircraft structural repair, propulsion systems, and digital avionics.",
            curriculum: "Aviation Legislation, Aerodynamics, Aircraft Materials & Hardware, Gas Turbine Engine Maintenance, Electrical Fundamentals.",
            compensation: "Apprenticeship allowances (S$600–S$1,000/mo) available through CAAS-approved maintenance organizations."
          }
        ]
      },
      {
        stageNum: 2,
        stageId: "stage-pfp",
        stageTitle: "Stage 2: Polytechnic Foundation Programme (PFP)",
        stageSubtitle: "1-Year Poly Foundation replacing Sec 5 for G2 Students",
        islands: [
          {
            id: "isl_pfp_aero",
            title: "PFP: Engineering & Aerospace Technology",
            institution: "SP / NP / TP / RP",
            role: "Poly Foundation Student → Direct Entry into Diploma in Aerospace",
            durationYears: "1 Year Foundation + 3 Years Poly",
            cumulativeYears: "4 Years to Diploma",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.pfp.state !== "bad",
            merText: "5 G2 subjects Grade 1–4 (EL, Math & Science Grade 1–3, ELMAB3 ≤ 12)",
            recommendedCombiKey: "pfp_stem",
            overview: "Fast-track polytechnic foundation for G2 students with strong maths and science aptitude. Skip Sec 5 and enter polytechnic 1 year early to prepare for Aerospace Engineering diplomas!",
            curriculum: "Applied Mechanics, Aerodynamic Principles, Digital Fabrication, Engineering Mathematics, Poly Academic Prep.",
            compensation: "Eligible for aviation industry pre-diploma study grants."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-poly",
        stageTitle: "Stage 3: Applied Aerospace Diplomas",
        stageSubtitle: "Polytechnic Full-Time vs. 💰 Paid Work-Study",
        islands: [
          {
            id: "isl_poly_aero_direct",
            title: "Polytechnic Diploma in Aerospace Engineering",
            institution: "SP / NP / TP / NYP / RP",
            role: "Aerospace Engineer Trainee / Quality Specialist",
            durationYears: "3 Years",
            cumulativeYears: "3 Years (Direct from SEC)",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.poly.state !== "bad",
            merText: "4 G3 + 1 G2 pass (Net ELR2B2-C ≤ 22; Math & Science/D&T passed)",
            recommendedCombiKey: "poly_eng",
            overview: "CAAS SAR-66 accredited aerospace curriculum. Covers advanced flight mechanics, avionics simulation, and composite aircraft manufacturing.",
            curriculum: "Aircraft Propulsion, Aerodynamics & Flight Mechanics, Digital Electronics, Unmanned Aerial Systems (UAS), Inspection & NDT.",
            compensation: "SIAEC and ST Engineering scholarships cover 100% course fees with guaranteed employment upon graduation."
          },
          {
            id: "isl_wsd_aero",
            title: "ITE Work-Study Diploma in Aircraft Maintenance",
            institution: "ITE with SIA Engineering Company & ST Engineering",
            role: "Aircraft Maintenance Specialist / Trainee LAE",
            durationYears: "2.5 Years",
            cumulativeYears: "4.5 to 5.5 Years",
            isPaid: true,
            payHighlight: "💰 Earn S$2,100 – S$2,800/month salary + 100% employer course sponsorship!",
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "Higher Nitec in Aerospace / Mechanical / Electrical with interview",
            recommendedCombiKey: "ite_hn2_eng",
            overview: "Work right inside aircraft hangars at Changi Airport! Earn full salary with SIAEC or ST Engineering while completing SAR-66 basic license modules.",
            curriculum: "Airframe Systems, Jet Engine Overhaul, Line & Base Maintenance, Human Factors in Aviation, CAAS Basic Licensing prep.",
            compensation: "Monthly salary (S$2,100 to S$2,800/mo), CPF, shift allowances, flight pass privileges, and full company tuition payment."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-jc",
        stageTitle: "Stage 3: Junior College & Pre-University Route",
        stageSubtitle: "GCE A-Levels Academic Pre-U Track (2 Years in JC / 3 Years in MI)",
        islands: [
          {
            id: "isl_jc_aero",
            title: "Junior College: Pre-U Physical Sciences Stream (H2 Physics & Math)",
            institution: "All Junior Colleges islandwide",
            role: "Pre-University A-Level Student (Direct pathway to University B.Eng Aerospace)",
            durationYears: "2 Years",
            cumulativeYears: "2 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.mi.state !== "bad",
            merText: "5 G3 subjects (Gross L1R4 ≤ 16 for JC / ≤ 20 for MI; G3 EL C6, Math D7)",
            recommendedCombiKey: "jc_sci",
            overview: "2-year rigorous A-Level academic preparation in H2 Physics, H2 Mathematics, and Chemistry. Prepares for direct entry into NTU Aerospace Engineering or NUS Mechanical Engineering (Aeronautical) without diploma detours!",
            curriculum: "GCE A-Levels: H2 Physics (Fluid Mechanics, Thermodynamics, Kinematics), H2 Mathematics, H2 Chemistry, General Paper, Project Work.",
            compensation: "DSTA and RSAF Pre-University Scholarships offer full tuition sponsorship and allowances."
          }
        ]
      },
      {
        stageNum: 4,
        stageId: "stage-uni",
        stageTitle: "Stage 4: Aeronautical Engineering Degree",
        stageSubtitle: "Bachelor of Engineering (B.Eng) in Aerospace / Mechanical",
        islands: [
          {
            id: "isl_uni_aero",
            title: "University B.Eng in Aerospace Engineering",
            institution: "Nanyang Technological University (NTU) / SIT-University of Glasgow",
            role: "Aeronautical Design Engineer / Fleet Systems Lead",
            durationYears: "3 to 4 Years",
            cumulativeYears: "5 to 7 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.poly.state !== "bad" || evalResult.out.pfp.state !== "bad" || evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "GCE A-Levels (from JC) OR Polytechnic Diploma in Aerospace / Mechanical Engineering",
            recommendedCombiKey: "jc_sci",
            overview: "Advanced computational fluid dynamics (CFD), hypersonic propulsion, space launch systems, and autonomous aerial robotics. Open to both JC A-Level and Poly diploma graduates!",
            curriculum: "Advanced Fluid Mechanics, Orbital Mechanics, Aircraft Structural Dynamics, Gas Dynamics, Avionics Architecture, Flight Design Project.",
            compensation: "DSTA, RSAF, and aerospace corporate scholarships offer full funding and high-paying starting salaries (S$4,500–S$5,500/mo)."
          }
        ]
      },
      {
        stageNum: 5,
        stageId: "stage-career",
        stageTitle: "Stage 5: Industry Leadership",
        stageSubtitle: "Licensed Aircraft Engineer (LAE) & Chief Engineer",
        islands: [
          {
            id: "isl_career_lae",
            title: "CAAS Licensed Aircraft Engineer (LAE) / Chief Engineer",
            institution: "Commercial Airlines, Aerospace MRO & Defense",
            role: "Licensed Aircraft Engineer (LAE Cat B1/B2) / Chief Technical Officer",
            durationYears: "Ongoing",
            cumulativeYears: "8+ Years",
            isPaid: true,
            payHighlight: "💰 S$6,500 – S$14,000+/month high-responsibility salary",
            merCheck: (evalResult) => true,
            merText: "CAAS SAR-66 License + Type Rating Certification",
            recommendedCombiKey: "jc_sci",
            overview: "Sole authority to sign off aircraft airworthiness certificates for commercial flights (e.g. Boeing 787, Airbus A350). Holds absolute responsibility for passenger flight safety.",
            curriculum: "Aircraft Type Ratings, Airworthiness Regulatory Sign-off, Safety Management Systems (SMS), Quality Assurance Auditing.",
            compensation: "Top engineering remuneration ($6,500 to $14,000+/month) with international career mobility across global aviation hubs."
          }
        ]
      }
    ]
  },

  robotics: {
    id: "robotics",
    title: "Robotics, Electrical & Smart Systems Ladder",
    icon: "⚡",
    summary: "From robotics technician (ITE) to automation technologist (Poly/Work-Study), Junior College computing routes, and AI robotics engineer. Powering smart ports, semiconductor foundries, and automated factories.",
    stages: [
      {
        stageNum: 1,
        stageId: "stage-ite",
        stageTitle: "Stage 1: Applied Technical Skills",
        stageSubtitle: "Secondary School & ITE Certification (G1/G2/G3)",
        islands: [
          {
            id: "isl_ite_robotics",
            title: "ITE Higher Nitec in Robotics & Mechatronics / Electrical",
            institution: "ITE College Central / East / West",
            role: "Automation & Robotics Technician",
            durationYears: "2 to 3 Years",
            cumulativeYears: "2 to 3 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "3-Yr: Min 4 subjects at G1 (R1B3-A Math pass) | 2-Yr: ELMAB3 ≤ 19",
            recommendedCombiKey: "ite_hn2_eng",
            overview: "Programmable logic controllers (PLC), pneumatic actuators, robotic arm calibration, and electrical circuit diagnostics.",
            curriculum: "Microcontroller Programming, Industrial Sensors, Electro-Pneumatics, 3D CAD Modeling, Industrial Robot Integration.",
            compensation: "Industry training allowances (S$600–S$900/mo) with guaranteed polytechnic progression eligibility."
          }
        ]
      },
      {
        stageNum: 2,
        stageId: "stage-pfp",
        stageTitle: "Stage 2: Polytechnic Foundation Programme (PFP)",
        stageSubtitle: "1-Year Poly Foundation replacing Sec 5 for G2 Students",
        islands: [
          {
            id: "isl_pfp_robotics",
            title: "PFP: Engineering & Smart Systems",
            institution: "SP / NP / NYP / TP / RP",
            role: "Poly Foundation Student → Direct Entry into Robotics Diploma",
            durationYears: "1 Year Foundation + 3 Years Poly",
            cumulativeYears: "4 Years to Diploma",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.pfp.state !== "bad",
            merText: "5 G2 subjects Grade 1–4 (EL, Math & Science/D&T Grade 1–3, ELMAB3 ≤ 12)",
            recommendedCombiKey: "pfp_stem",
            overview: "Hands-on polytechnic foundation for G2 students leading straight into diplomas in Robotics & Mechatronics without sitting for Sec 5 examinations!",
            curriculum: "Principles of Automation, Circuit Fundamentals, Computer Aided Design, Applied Mathematics, Project Prototyping.",
            compensation: "Eligible for engineering bursaries and poly study awards."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-poly",
        stageTitle: "Stage 3: Advanced Engineering Diplomas",
        stageSubtitle: "Polytechnic Full-Time vs. 💰 Paid Work-Study",
        islands: [
          {
            id: "isl_poly_robotics_direct",
            title: "Polytechnic Diploma in Robotics & Automation / Electrical",
            institution: "SP / NP / NYP / TP / RP",
            role: "Robotics Technologist / Assistant Engineer",
            durationYears: "3 Years",
            cumulativeYears: "3 Years (Direct from SEC)",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.poly.state !== "bad",
            merText: "4 G3 + 1 G2 pass (Net ELR2B2-C ≤ 22; Math & Science/D&T passed)",
            recommendedCombiKey: "poly_eng",
            overview: "Machine vision, ROS (Robot Operating System), embedded AI microprocessors, IoT network architecture, and collaborative robots (Cobots).",
            curriculum: "Control Engineering, Applied AI for Robotics, Machine Learning, Power Electronics, Autonomous Mobile Robots (AMR), Industry Capstone.",
            compensation: "A*STAR and Economic Development Board (EDB) industry sponsorships offer full tuition waivers + living allowances."
          },
          {
            id: "isl_wsd_robotics",
            title: "ITE Work-Study Diploma in Automation & Robotics",
            institution: "ITE with Semiconductor & Precision Engineering Firms",
            role: "Automation Specialist / Lead Robotics Technician",
            durationYears: "2.5 Years",
            cumulativeYears: "4.5 to 5.5 Years",
            isPaid: true,
            payHighlight: "💰 Earn S$2,000 – S$2,700/month salary + 100% employer tuition sponsorship!",
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "Higher Nitec in Engineering / Electronics with employer interview",
            recommendedCombiKey: "ite_hn2_eng",
            overview: "Work directly on high-tech automated cleanrooms and robotized assembly lines. The manufacturing employer pays your full diploma tuition and regular monthly pay.",
            curriculum: "Smart Factory Integration, Python for Industrial Automation, SCADA Systems, Robotic Vision Inspection, Predictive Maintenance.",
            compensation: "Full monthly salary (S$2,000–S$2,700/mo), shift allowances, CPF, health insurance, and zero tuition debt."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-jc",
        stageTitle: "Stage 3: Junior College & Pre-University Route",
        stageSubtitle: "GCE A-Levels Academic Pre-U Track (2 Years in JC / 3 Years in MI)",
        islands: [
          {
            id: "isl_jc_robotics",
            title: "Junior College: Pre-U Physics & Computing Stream",
            institution: "All Junior Colleges islandwide",
            role: "Pre-University A-Level Student (Direct pathway to University B.Eng Robotics & AI)",
            durationYears: "2 Years",
            cumulativeYears: "2 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.mi.state !== "bad",
            merText: "5 G3 subjects (Gross L1R4 ≤ 16 for JC / ≤ 20 for MI; G3 EL C6, Math D7)",
            recommendedCombiKey: "jc_sci",
            overview: "2-year A-Level academic preparation in H2 Computing, H2 Physics, and H2 Mathematics. Directly qualifies for top university degrees in Robotics Engineering, Electrical Engineering, and Artificial Intelligence without polytechnic detours!",
            curriculum: "GCE A-Levels: H2 Computing, H2 Physics, H2 Mathematics, H2 Further Math / Chemistry, General Paper.",
            compensation: "DSTA and Agency for Science, Technology and Research (A*STAR) scholarships offer tuition fees + stipends."
          }
        ]
      },
      {
        stageNum: 4,
        stageId: "stage-uni",
        stageTitle: "Stage 4: University Robotics Degree",
        stageSubtitle: "Bachelor of Engineering in Robotics & AI",
        islands: [
          {
            id: "isl_uni_robotics",
            title: "University B.Eng in Robotics Systems / Electrical Eng",
            institution: "NUS / NTU / SUTD / SIT",
            role: "Robotics Research Engineer / Automation Architect",
            durationYears: "3 to 4 Years",
            cumulativeYears: "5 to 7 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.poly.state !== "bad" || evalResult.out.pfp.state !== "bad" || evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "GCE A-Levels (from JC) OR Polytechnic Diploma in Engineering / Robotics / Computing",
            recommendedCombiKey: "jc_sci",
            overview: "Deep reinforcement learning, surgical robotics, humanoid locomotion, autonomous swarm systems, and industrial smart robotics.",
            curriculum: "Robotic Kinematics & Dynamics, Computer Vision, Digital Signal Processing, Embedded Systems Design, Autonomous Navigation, Honors Thesis.",
            compensation: "Starting graduate salaries average S$4,800 to S$6,200/month with high global demand."
          }
        ]
      },
      {
        stageNum: 5,
        stageId: "stage-career",
        stageTitle: "Stage 5: Industry Leadership",
        stageSubtitle: "Principal Robotics Architect & R&D Lead",
        islands: [
          {
            id: "isl_career_robotics_lead",
            title: "Principal Automation Architect / VP of Engineering",
            institution: "Multinational Tech Giants, Deep-Tech Startups, GovTech",
            role: "Principal Robotics Architect / Engineering Director",
            durationYears: "Ongoing",
            cumulativeYears: "8+ Years",
            isPaid: true,
            payHighlight: "💰 S$8,000 – S$18,000+/month executive engineering pay",
            merCheck: (evalResult) => true,
            merText: "B.Eng / M.Sc + Track record of automated systems deployment",
            recommendedCombiKey: "jc_sci",
            overview: "Directs company-wide automation strategy, architects factory-scale autonomous systems, and patents novel robotics intellectual property.",
            curriculum: "System Architecture, Deep Tech Patenting, Technology Strategy, Venture Leadership.",
            compensation: "Executive compensation ($8,000 to $18,000+/month) plus equity stock options in high-growth robotics firms."
          }
        ]
      }
    ]
  },

  sports: {
    id: "sports",
    title: "Sports Science, Fitness & Athletic Performance",
    icon: "🏃",
    summary: "From fitness coach (ITE) to high-performance sports scientist, Junior College sports science pathways, and clinical exercise physiologists. Supporting Singapore's elite Olympic/Team Singapore athletes.",
    stages: [
      {
        stageNum: 1,
        stageId: "stage-ite",
        stageTitle: "Stage 1: Fundamental Fitness Coaching",
        stageSubtitle: "Secondary School & ITE Certification (G1/G2/G3)",
        islands: [
          {
            id: "isl_ite_sport",
            title: "ITE Higher Nitec in Sport Management (Sports Science)",
            institution: "ITE College Central / East / West (School of Business & Services)",
            role: "Certified Fitness Instructor / Sports Coordinator",
            durationYears: "2 to 3 Years",
            cumulativeYears: "2 to 3 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "3-Yr: English passed (G1/G2/G3) | 2-Yr: ELMAB3 ≤ 19",
            recommendedCombiKey: "ite_hn_sport",
            overview: "Anatomy & exercise physiology, gym fitness programming, health screening, sports event management, and athletic conditioning.",
            curriculum: "Exercise Physiology, Fitness Appraisal & Testing, Sports Facility Operations, Sports Marketing & Sponsorship, Standard First Aid & CPR/AED.",
            compensation: "Industry coaching attachments provide S$600–S$1,000/mo living allowances + industry fitness certifications."
          }
        ]
      },
      {
        stageNum: 2,
        stageId: "stage-pfp",
        stageTitle: "Stage 2: Polytechnic Foundation Programme (PFP)",
        stageSubtitle: "1-Year Poly Foundation replacing Sec 5 for G2 Students",
        islands: [
          {
            id: "isl_pfp_sport",
            title: "PFP: Sports Science, Health & Wellness",
            institution: "Republic Polytechnic (RP)",
            role: "Poly Foundation Student → Direct Entry into Diploma in Sport Science",
            durationYears: "1 Year Foundation + 3 Years Poly",
            cumulativeYears: "4 Years to Diploma",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.pfp.state !== "bad",
            merText: "5 G2 subjects Grade 1–4 (EL, Math & Science/NFS Grade 1–3, ELMAB3 ≤ 12)",
            recommendedCombiKey: "pfp_sport",
            overview: "Skip Sec 5 and enter Republic Poly directly! Build solid scientific foundations in human biology, nutrition, and exercise testing to enter the Diploma in Sport & Exercise Science.",
            curriculum: "Human Movement Foundations, Wellness Science, Coaching Communication, Applied Mathematics, Fitness Conditioning.",
            compensation: "Eligible for SportSG youth grants and polytechnic study bursaries."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-poly",
        stageTitle: "Stage 3: Professional Sports Diplomas",
        stageSubtitle: "Polytechnic Full-Time vs. 💰 Paid Work-Study",
        islands: [
          {
            id: "isl_poly_sport_direct",
            title: "Polytechnic Diploma in Sport & Exercise Science",
            institution: "Republic Poly (RP) / Singapore Poly (SP) / Ngee Ann (NP)",
            role: "Sports Scientist / Strength & Conditioning Coach",
            durationYears: "3 Years",
            cumulativeYears: "3 Years (Direct from SEC)",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.poly.state !== "bad",
            merText: "4 G3 + 1 G2 pass (Net ELR2B2-C ≤ 22; Math & Science/NFS passed)",
            recommendedCombiKey: "poly_sport",
            overview: "In-depth biomechanics, sports nutrition, performance analysis, VO2 max testing, sports psychology, and elite athlete rehabilitation.",
            curriculum: "Advanced Biomechanics, Exercise Prescription, Sports Nutrition, Sports Psychology, Performance Analytics with GPS/Heart Rate telemetry, 20-week internship.",
            compensation: "SportSG and national sports association scholarships available with training grants."
          },
          {
            id: "isl_wsd_sport",
            title: "ITE Work-Study / Technical Diploma in Health & Exercise Coaching",
            institution: "ITE in Partnership with Sport Singapore & Fitness Academies",
            role: "Head Performance Coach / Wellness Director",
            durationYears: "2.5 Years",
            cumulativeYears: "4.5 to 5.5 Years",
            isPaid: true,
            payHighlight: "💰 Earn S$1,900 – S$2,600/month salary + 100% course sponsorship!",
            merCheck: (evalResult) => evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "Higher Nitec in Sport Management with fitness screening",
            recommendedCombiKey: "ite_hn_sport",
            overview: "Work directly in high-performance athletic training facilities and wellness academies while earning full monthly pay and receiving a fully sponsored diploma.",
            curriculum: "Strength & Conditioning Protocols, Corrective Exercise Strategies, Client Health Management, Sports Technology Integration, Group Coaching Leadership.",
            compensation: "Monthly salary (S$1,900 to S$2,600/month) plus coaching commission bonuses and 100% employer tuition sponsorship."
          }
        ]
      },
      {
        stageNum: 3,
        stageId: "stage-jc",
        stageTitle: "Stage 3: Junior College & Pre-University Route",
        stageSubtitle: "GCE A-Levels Academic Pre-U Track (2 Years in JC / 3 Years in MI)",
        islands: [
          {
            id: "isl_jc_sport",
            title: "Junior College: Pre-U Sports & Life Sciences Stream",
            institution: "Junior Colleges offering Biology/PE streams (e.g. TMJC, VJC, RJC, ACJC)",
            role: "Pre-University A-Level Student (Direct pathway to NTU Sports Science / SIT Physiotherapy)",
            durationYears: "2 Years",
            cumulativeYears: "2 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.mi.state !== "bad",
            merText: "5 G3 subjects (Gross L1R4 ≤ 16 for JC / ≤ 20 for MI; G3 EL C6, Math D7)",
            recommendedCombiKey: "jc_sci",
            overview: "2-year A-Level academic preparation in H2 Biology, H2 Chemistry/Physics, and H2 Mathematics. Fast-tracks into NTU/NIE Sports Science & Management, or professional Physiotherapy degrees at SIT without diploma detours!",
            curriculum: "GCE A-Levels: H2 Biology (Human Physiology, Cellular Energetics), H2 Chemistry, H2 Mathematics / PE, General Paper, Project Work.",
            compensation: "Singapore National Olympic Council (SNOC) and Sports Excellence (spex) Scholarships available."
          }
        ]
      },
      {
        stageNum: 4,
        stageId: "stage-uni",
        stageTitle: "Stage 4: University Sports Degree",
        stageSubtitle: "B.Sc in Sports Science & Management / Physiotherapy",
        islands: [
          {
            id: "isl_uni_sport",
            title: "University B.Sc in Sports Science & Management / Physiotherapy",
            institution: "Nanyang Technological University (NTU/NIE) / SIT",
            role: "High-Performance Sports Scientist / Sports Physiotherapist",
            durationYears: "3 to 4 Years",
            cumulativeYears: "5 to 7 Years from Sec 4",
            isPaid: false,
            merCheck: (evalResult) => evalResult.out.jc.state !== "bad" || evalResult.out.poly.state !== "bad" || evalResult.out.pfp.state !== "bad" || evalResult.out.hn3.state !== "bad" || evalResult.out.hn2.state !== "bad",
            merText: "GCE A-Levels (from JC) OR Polytechnic Diploma in Sports Science / Allied Health",
            recommendedCombiKey: "jc_sci",
            overview: "Advanced cardiovascular physiology, molecular exercise science, injury biomechanics, neuromuscular adaptation, and clinical physiotherapy.",
            curriculum: "Motor Control & Learning, Exercise Biochemistry, Advanced Sports Nutrition, Orthopedic Rehabilitation, Capstone Sports Science Thesis.",
            compensation: "Starting graduate salaries range from S$3,800 to S$5,200/month with national team deployment opportunities."
          }
        ]
      },
      {
        stageNum: 5,
        stageId: "stage-career",
        stageTitle: "Stage 5: National Sports Leadership",
        stageSubtitle: "Head of High Performance & Elite Sports Directorate",
        islands: [
          {
            id: "isl_career_sport_lead",
            title: "Head of Sports Science / National Team Director",
            institution: "Singapore Sport Institute (SSI), Olympic Council, International Teams",
            role: "Head of High Performance / Chief Exercise Physiologist",
            durationYears: "Ongoing",
            cumulativeYears: "8+ Years",
            isPaid: true,
            payHighlight: "💰 S$6,000 – S$14,000+/month sports leadership pay",
            merCheck: (evalResult) => true,
            merText: "B.Sc / M.Sc Sports Science + High-Performance coaching record",
            recommendedCombiKey: "jc_sci",
            overview: "Directs national athletic science preparation for the Olympic Games, Asian Games, and SEA Games. Designs sports science support systems for top national athletes.",
            curriculum: "Elite Sports Policy, High-Performance Strategy, Applied Sports Technology, Olympic Campaign Management.",
            compensation: "Executive sports science leadership compensation ($6,000 to $14,000+/month) with international tournament travel."
          }
        ]
      }
    ]
  }
};

export { CAREER_LADDERS };
