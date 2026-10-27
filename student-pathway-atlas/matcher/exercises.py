"""Which courses each admission exercise lists, which engine aggregate each uses, and which engine checks gate it.

Exercise ids follow data/exercises/exercises_2026-10-17.csv. A stream picks requirement records by
(institution_type, route) and maps the course's published aggregate type to an engine ID.

"""

RB = "source-pages/"

PSE_MER_SOURCE = {"file": RB + "post_secondary_admissions_pse_polytechnic_diploma_course.md",
                  "heading": "criterion 2: 'CourseFinder ... currently features information for 2026 admissions. "
                             "Revisit the pages in mid-2027 for updated course information specific to 2028 admission.'"}

PSE_DECISION = {"file": "README.md", "heading": "Assumptions: Who the first version serves "
                "(PSE 2028: eligibility and thresholds only; no cut-off comparison; each course marked "
                "\"2028 entry requirements not yet published\")"}

PFP_PAGE = RB + "post_secondary_admissions_pfp_eligibility_criteria.md"
SRC_PFP_MTL = {"file": "README.md", "heading": "Assumptions: PFP extra MTL grades"}
COURSE_REQUIREMENTS = [
    {"route": "PFP", "course_codes": ["N95"], "kind": "application", "id": "applying_requirement",
     "label": "Students applying to Tamil Studies with Early Education must also obtain one of these scores",
     "one_of": [["O-Level", "Higher Tamil Language", "B4"], ["O-Level", "Tamil Language", "B3"],
                ["N(A)-Level", "Tamil Language", "1"]],
     "source": {"file": PFP_PAGE, "heading": "Tamil Studies with Early Education (NP) (\"Students applying to the Tamil "
                                             "Studies with Early Education must also obtain one of the following scores\")"},
     "decision": SRC_PFP_MTL},
    {"route": "PFP", "course_codes": ["N70", "N88"], "kind": "progression",
     "one_of": [["O-Level", "Higher Chinese", "B4"], ["O-Level", "Chinese", "B3"], ["N(A)-Level", "Chinese", "1"]],
     "source": {"file": PFP_PAGE, "heading": "Courses with additional requirements for polytechnic Year 1"},
     "decision": SRC_PFP_MTL},
]
PROGRESSION_NOTE = "Needed to progress to Year 1 of this diploma: "

EXERCISES = [
    {"id": "JAE-2027", "label": "JAE 2027", "results": "2026 O-Level results (any combined 2 years)",
     "streams": [
         {"name": "Junior college", "institution_types": ["JC"], "route": "JAE",
          "aggregates": {"L1R5": "L1R5(2026)"}, "gates": [["jc_gross"], ["jc_subjects", "jc_conditional"]],
          "mer": "none"},
         {"name": "Millennia Institute", "institution_types": ["MI"], "route": "JAE",
          "aggregates": {"L1R4": "L1R4(2026)"}, "gates": [["mi_gross"], ["mi_subjects", "mi_conditional"]],
          "mer": "none"},
         {"name": "Polytechnic diploma", "institution_types": ["Polytechnic"], "route": "JAE",
          "aggregates": {"ELR2B2-A": "ELR2B2-A(2026)", "ELR2B2-B": "ELR2B2-B(2026)",
                         "ELR2B2-C": "ELR2B2-C:POLY(2026)", "ELR2B2-D": "ELR2B2-D(2026)"},
          "gates": [["poly_net"]], "nursing_gate": "nursing_net", "nursing_replaces": "poly_net", "mer": "course"},
         {"name": "ITE 2-year Higher Nitec", "institution_types": ["ITE"], "route": "JAE",
          "aggregates": {"ELB4-A": "ELB4-A(2026)", "ELR1B3-B": "ELR1B3-B(2026)", "ELR2B2-C": "ELR2B2-C:ITE(2026)"},
          "gates": [["ite_sat5"]], "aggregate_gates": False, "mer": "course"},
     ]},
    {"id": "DPP-2027", "label": "JIE 'H' / DPP (Dec 2026)", "results": "2026 N(A)-Level results (+ O-Level subjects)",
     "streams": [
         {"name": "ITE 2-year Higher Nitec (DPP)", "institution_types": ["ITE"], "route": "JIEH",
          "aggregates": {"ELMAB3": "ELMAB3:DPP(2026)"}, "gates": [["dpp_na"], ["dpp_gross"]], "mer": "course",
          "mer_total_max": 19},
     ]},
    {"id": "JIE-N-2027", "label": "JIE 'N' (Dec 2026)", "results": "2026 N-Level results (O-Level holders may apply)",
     "streams": [
         {"name": "ITE 3-year Higher Nitec", "institution_types": ["ITE"], "route": "JIEN",
          "aggregates": {"MAS1B3": "MAS1B3(2026)", "ELB3": "ELB3(2026)", "B4": "B4(2026)", "MAB3": "MAB3(2026)",
                         "ELMAB2": "ELMAB2(2026)"},
          "gates": [], "aggregate_gates": False, "mer": "course"},
     ]},
    {"id": "PFP-2027", "label": "PFP (Jan 2027)", "results": "2026 N(A)-Level results (+ O-Level subjects)",
     "streams": [
         {"name": "Polytechnic Foundation Programme", "institution_types": ["Polytechnic"], "route": "PFP",
          "aggregates": {"*": "ELMAB3:PFP(2026)"}, "gates": [["pfp_na"], ["pfp_gross"]], "mer": "course",
          "mer_total_max": 12, "net_range": "none"},
     ]},
    {"id": "PSE-2028", "label": "PSE 2028", "results": "2027 SEC results (+ earlier GCE results, any combined 2 years)",
     "course_list": "2026", "net_range": "none", "requirements_note": "2028 entry requirements not yet published",
     "requirements_note_detail": "MOE says to revisit CourseFinder in mid-2027 for 2028 course information",
     "requirements_note_source": PSE_MER_SOURCE, "requirements_note_decision": PSE_DECISION,
     "streams": [
         {"name": "Junior college", "institution_types": ["JC"], "route": "JAE", "aggregates": {"*": "L1R4(2027)"},
          "gates": [["jc_gross"], ["jcmi_subjects", "jc_conditional"]], "mer": "none"},
         {"name": "Millennia Institute", "institution_types": ["MI"], "route": "JAE", "aggregates": {"*": "L1R4(2027)"},
          "gates": [["mi_gross"], ["jcmi_subjects", "mi_conditional"]], "mer": "none"},
         {"name": "Polytechnic diploma", "institution_types": ["Polytechnic"], "route": "JAE",
          "aggregates": {"ELR2B2-A": "ELR2B2-A(2027)", "ELR2B2-B": "ELR2B2-B(2027)", "ELR2B2-C": "ELR2B2-C(2027)",
                         "ELR2B2-D": "ELR2B2-D(2027)"},
          "gates": [["poly_net"]], "nursing_gate": "nursing_net", "nursing_replaces": "poly_net", "mer": "unpublished"},
         {"name": "Polytechnic Foundation Programme", "institution_types": ["Polytechnic"], "route": "PFP",
          "aggregates": {"*": "ELMAB3:PFP(2027)"}, "gates": [["pfp_gross"]], "mer": "unpublished"},
         {"name": "ITE 2-year Higher Nitec", "institution_types": ["ITE"], "route": "JAE",
          "aggregates": {"*": "ELMAB3:ITE(2027)"}, "gates": [["ite2_gross"]], "mer": "unpublished"},
         {"name": "ITE 3-year Higher Nitec", "institution_types": ["ITE"], "route": "JIEN",
          "aggregates": {"ELMAB2": "R2B2(2027)", "MAB3": "R1B3-A(2027)", "MAS1B3": "R1B3-B(2027)",
                         "ELB3": "R1B3-C(2027)", "B4": "B4(2027)"},
          "aggregate_map_source": {"file": RB + "ite__jie_aggregates.md",
                                   "heading": "1.2 last paragraph / 7.2 (a) slide 18: R2B2 (ELMAB2), R1B3-A (MAB3), "
                                              "R1B3-B (MA/SB3), R1B3-C (ELB3), B4 - a school-hosted MOE deck, not MOE's site"},
          "gates": [["ite3_mer"]], "mer": "unpublished"},
     ]},
]

EXERCISE_IDS = [e["id"] for e in EXERCISES]
EXERCISES_BY_ID = {e["id"]: e for e in EXERCISES}


def aggregate_for(stream, record):
    a = stream["aggregates"]
    return a.get(record["aggregate_type"]) or a.get("*")
