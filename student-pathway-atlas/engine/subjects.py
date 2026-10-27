"""Subject catalogue and the named subject groups the aggregate slots refer to.

Groups name a set of subject ids with a source. Slots accept groups, explicit subject ids, or "any".
A subject name that is not in the catalogue is accepted as an unknown "Others" subject: it can fill an
"any subject" slot only, and every result lists it in `input_problems`.

"""

import csv
import os
import re

RB = "source-pages/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_OLEVEL = {"file": RB + "post_secondary_admissions_jae_gce_o_level_subjects_and_categories.md"}
SRC_PSE_JCMI = {"file": RB + "post_secondary_admissions_pse_jc_and_mi.md"}
SRC_JC2026 = {"file": RB + "post_secondary_admissions_jae_junior_colleges_and_millennia_institute.md"}
SRC_POLY_PDF = {"file": RB + "pdf_transcribed__aggregate_types_2026_jae.md"}
SRC_ITE = {"file": RB + "ite__jie_aggregates.md"}
SRC_PFP2026 = {"file": RB + "post_secondary_admissions_pfp_eligibility_criteria.md"}
SRC_UNCLEAR = {"file": "README.md", "heading": "Assumptions: Rules MOE leaves unclear"}


def _s(sid, name, kind="OTHER", family=None, earlier=False, aliases=(), only_level=None):
    return {"id": sid, "name": name, "kind": kind, "family": family, "earlier": earlier, "aliases": list(aliases),
            "only_level": "G3" if earlier else only_level}


SUBJECTS = [
    # --- First languages and mother tongues -------------------------------------------------------
    _s("english_language", "English Language", "EL", aliases=[
        "English", "EL", "ELL", "G3 English", "G3 English Language", "English Language (Syllabus A)",
        "English Language Syllabus A", "English Language (Syllabus T)", "English Language Syllabus T"]),
    _s("higher_chinese", "Higher Chinese", "HMTL", "chinese",
       aliases=["Higher Chinese Language", "HCL", "Higher Chinese Language (HCL)"], only_level="G3"),
    _s("higher_malay", "Higher Malay", "HMTL", "malay", aliases=["Higher Malay Language", "HML"], only_level="G3"),
    _s("higher_tamil", "Higher Tamil", "HMTL", "tamil", aliases=["Higher Tamil Language", "HTL"], only_level="G3"),
    # "Basic Chinese / Malay / Tamil" = SEAB's N(T) mother tongue (2026 codes 1202-1204), SEC G1 K120-K122 from 2027.
    _s("chinese", "Chinese", "MTL", "chinese", aliases=["Chinese Language", "CL", "Basic Chinese"]),
    _s("malay", "Malay", "MTL", "malay", aliases=["Malay Language", "ML", "Basic Malay"]),
    _s("tamil", "Tamil", "MTL", "tamil", aliases=["Tamil Language", "TL", "Basic Tamil"]),
    _s("chinese_b", "Chinese 'B'", "MTL_B", "chinese", aliases=["Chinese B", "Chinese Language 'B'", "Chinese Language B", "Chinese B Syllabus", "Chinese 'B' Syllabus", "Chinese Language B Syllabus", "Chinese Language 'B' Syllabus", "CLB", "BCL"]),
    _s("malay_b", "Malay 'B'", "MTL_B", "malay", aliases=["Malay B", "Malay Language 'B'", "Malay Language B", "Malay B Syllabus", "Malay 'B' Syllabus", "Malay Language B Syllabus", "Malay Language 'B' Syllabus", "MLB", "BML"]),
    _s("tamil_b", "Tamil 'B'", "MTL_B", "tamil", aliases=["Tamil B", "Tamil Language 'B'", "Tamil Language B", "Tamil B Syllabus", "Tamil 'B' Syllabus", "Tamil Language B Syllabus", "Tamil Language 'B' Syllabus", "TLB", "BTL"]),
    # MTL-in-lieu (JC page "MTL approved by MOE in lieu of an official MTL"); listed under Others on the O-Level page.
    _s("arabic", "Arabic as a Third Language", "MTL_IN_LIEU", "arabic",
       aliases=["Arabic", "Arabic as a 3rd Language", "Arabic (L3)"]),
    _s("bengali", "Bengali", "MTL_IN_LIEU", "bengali"),
    _s("burmese", "Burmese", "MTL_IN_LIEU", "burmese"),
    _s("french", "French", "MTL_IN_LIEU", "french"),
    _s("german", "German", "MTL_IN_LIEU", "german"),
    _s("gujarati", "Gujarati", "MTL_IN_LIEU", "gujarati"),
    _s("hindi", "Hindi", "MTL_IN_LIEU", "hindi"),
    _s("japanese", "Japanese", "MTL_IN_LIEU", "japanese"),
    _s("panjabi", "Panjabi", "MTL_IN_LIEU", "panjabi", aliases=["Punjabi"]),
    _s("thai", "Thai", "MTL_IN_LIEU", "thai"),
    _s("urdu", "Urdu", "MTL_IN_LIEU", "urdu"),
    # --- Humanities (current) -------------------------------------------------------------------
    _s("bahasa_indonesia", "Bahasa Indonesia as a Third Language",
       aliases=["Bahasa Indonesia", "Bahasa Indonesia as a 3rd Language", "BI"]),
    _s("chinese_sp", "Chinese (Special Programme)", aliases=["Chinese (Special Programmes)", "C(SP)", "CSP"]),
    _s("malay_sp", "Malay (Special Programme)", aliases=["Malay (Special Programmes)", "M(SP)", "MSP"]),
    _s("geography", "Geography", aliases=["Geog", "Pure Geography"]),
    _s("higher_art", "Higher Art"),
    _s("higher_music", "Higher Music"),
    _s("history", "History", aliases=["Hist", "Pure History"]),
    _s("hum_ss_geog", "Humanities (Social Studies, Geography)", aliases=[
        "Humanities (Social Studies/Geography)", "Hum(SS, Geog)", "Hum (SS, Geog)", "Humanities (SS, Geography)"]),
    _s("hum_ss_hist", "Humanities (Social Studies, History)", aliases=[
        "Humanities (Social Studies/History)", "Hum(SS, Hist)", "Hum (SS, Hist)", "Humanities (SS, History)"]),
    _s("hum_ss_lit_chi", "Humanities (Social Studies, Literature in Chinese)", aliases=[
        "Humanities (Social Studies/Literature in Chinese)", "Hum(SS, Lit in CL)", "Humanities (SS, Lit Chinese)"]),
    _s("hum_ss_lit_eng", "Humanities (Social Studies, Literature in English)", aliases=[
        "Humanities (Social Studies/Literature in English)", "Hum (SS, Lit in EL)", "Hum(SS, Lit in EL)",
        "Humanities (SS, Lit Eng)", "Hum(SS, Lit Eng)"]),
    _s("hum_ss_lit_mal", "Humanities (Social Studies, Literature in Malay)", aliases=[
        "Humanities (Social Studies/Literature in Malay)", "Hum(SS, Lit in ML)"]),
    _s("hum_ss_lit_tam", "Humanities (Social Studies, Literature in Tamil)", aliases=[
        "Humanities (Social Studies/Literature in Tamil)", "Hum(SS, Lit in TL)"]),
    _s("lit_chinese", "Literature in Chinese", aliases=["Chinese Literature"]),
    _s("lit_english", "Literature in English", aliases=["English Literature", "Lit Eng", "HUM(LIT E)"]),
    _s("lit_malay", "Literature in Malay", aliases=["Malay Literature"]),
    _s("lit_tamil", "Literature in Tamil", aliases=["Tamil Literature"]),
    # --- Mathematics ------------------------------------------------------------------------------
    _s("additional_mathematics", "Additional Mathematics", aliases=[
        "A Maths", "A Math", "AMath", "AMaths", "Add Maths", "Add Math", "AM", "Additional Math"]),
    _s("mathematics", "Mathematics", aliases=[
        "Maths", "Math", "E Maths", "E Math", "Elementary Mathematics", "Mathematics (Syllabus A)",
        "Mathematics Syllabus A", "Mathematics (Syllabus T)", "Mathematics Syllabus T", "G3 Mathematics"]),
    # --- Science (current) ------------------------------------------------------------------------
    _s("biology", "Biology", aliases=["Bio", "Pure Biology"]),
    _s("chemistry", "Chemistry", aliases=["Chem", "Pure Chemistry"]),
    _s("physics", "Physics", aliases=["Phy", "Pure Physics"]),
    _s("sci_chem_bio", "Science (Chemistry, Biology)", aliases=[
        "Science (Chem, Bio)", "Science (Chemistry/Biology)", "Sci (C,B)", "Sci (Chem, Bio)", "Sci(C,B)"]),
    _s("sci_phy_bio", "Science (Physics, Biology)", aliases=[
        "Science (Phy, Bio)", "Science (Physics/Biology)", "Sci (P,B)", "Sci (Phy, Bio)", "Sci(P,B)"]),
    _s("sci_phy_chem", "Science (Physics, Chemistry)", aliases=[
        "Science (Phy, Chem)", "Science (Phy,Chem)", "Science (Physics/Chemistry)", "Sci (P,C)", "Sci (Phy, Chem)",
        "Sci(P,C)"]),
    # N(T) / G1 Science: the "Science" of ITE's "Mathematics or Science".
    _s("science_t", "Science (Syllabus T)", aliases=["Science (T)", "Science Syllabus T", "G1 Science"],
       only_level="G1"),
    # --- Others (current) -------------------------------------------------------------------------
    _s("art", "Art"),
    _s("biotechnology", "Biotechnology"),
    _s("business_studies", "Business Studies", aliases=["Business"]),
    _s("computing", "Computing", aliases=["Comp"]),
    _s("design_technology", "Design & Technology", aliases=["Design and Technology", "D&T", "D & T",
                                                            "Design and Technology Syllabus T",
                                                            "Design & Technology (Syllabus T)"]),
    _s("design_studies", "Design Studies"),
    _s("drama", "Drama"),
    _s("economics", "Economics", aliases=["Econs"]),
    _s("electronics", "Electronics"),
    _s("exercise_sports_science", "Exercise and Sports Science", aliases=["Exercise & Sports Science"]),
    _s("music", "Music"),
    _s("nutrition_food_science", "Nutrition & Food Science", aliases=["Nutrition and Food Science", "NFS"]),
    _s("principles_of_accounts", "Principles of Accounts", aliases=["POA", "Principles of Account"]),
    _s("spanish", "Spanish"),
    # --- Religious Knowledge ----------------------------------------------------------------------
    _s("islamic_rk", "Islamic Religious Knowledge", "RK", aliases=["IRK"]),
    # --- Earlier GCE O-Level subjects (still valid for JAE) ---------------------------------------
    _s("art_design_aep", "Art & Design (AEP)", earlier=True),
    _s("combined_humanities", "Combined Humanities", earlier=True),
    _s("music_mep", "Music (MEP)", earlier=True),
    _s("mathematics_bcd", "Mathematics (Syllabus B, C or D)", earlier=True, aliases=[
        "Mathematics (Syllabus B)", "Mathematics (Syllabus C)", "Mathematics (Syllabus D)"]),
    _s("additional_combined_science", "Additional Combined Science", earlier=True),
    _s("additional_science", "Additional Science", earlier=True),
    _s("combined_science", "Combined Science", earlier=True),
    _s("engineering_science", "Engineering Science", earlier=True),
    _s("general_science", "General Science", earlier=True),
    _s("human_social_biology", "Human & Social Biology", earlier=True, aliases=["Human and Social Biology"]),
    _s("integrated_science", "Integrated Science", earlier=True),
    _s("physical_science", "Physical Science", earlier=True),
    _s("sci_phy_chem_bio", "Science (Physics, Chemistry, Biology)", earlier=True, aliases=[
        "Science (Phy, Chem, Bio)", "Science (Physics, Biology, Chemistry)"]),
    _s("art_design", "Art & Design", earlier=True, aliases=["Art and Design"]),
    _s("commerce", "Commerce", earlier=True),
    _s("commercial_studies", "Commercial Studies", earlier=True),
    _s("computer_studies", "Computer Studies", earlier=True),
    _s("creative_3d_animation", "Creative 3D Animation", earlier=True),
    _s("electricity_electronics", "Electricity & Electronics", earlier=True, aliases=["Electricity and Electronics"]),
    _s("english_first_language", "English as a First Language", earlier=True),
    _s("english_second_language", "English as a Second Language", earlier=True),
    _s("fashion_fabrics", "Fashion & Fabrics", earlier=True, aliases=["Fashion and Fabrics"]),
    _s("food_nutrition", "Food & Nutrition", earlier=True, aliases=["Food and Nutrition"]),
    _s("fundamentals_electronics", "Fundamentals of Electronics", earlier=True,
       aliases=["Fundamental of Electronics"]),
    _s("geom_building_drawing", "Geometrical & Building Drawing", earlier=True),
    _s("geom_mech_drawing", "Geometrical & Mechanical Drawing", earlier=True),
    _s("health_science", "Health Science", earlier=True),
    _s("home_management", "Home Management", earlier=True),
    _s("intro_enterprise_dev", "Introduction to Enterprise Development", earlier=True,
       aliases=["Intro to Enterprise Development"]),
    _s("media_studies_chinese", "Media Studies (Chinese)", earlier=True),
    _s("media_studies_english", "Media Studies (English)", earlier=True),
    _s("metalwork", "Metalwork", earlier=True),
    _s("metalwork_engineering", "Metalwork (Engineering)", earlier=True),
    _s("physical_education", "Physical Education", earlier=True),
    _s("woodwork", "Woodwork", earlier=True),
    _s("bible_knowledge", "Bible Knowledge", "RK", earlier=True),
    _s("buddhist_studies", "Buddhist Studies", "RK", earlier=True),
    _s("confucian_ethics", "Confucian Ethics", "RK", earlier=True),
    _s("hindu_studies", "Hindu Studies", "RK", earlier=True),
    _s("sikh_studies", "Sikh Studies", "RK", earlier=True),
    # --- N(T) Computer Applications (MOE FSBB FAQ: "Normal (Technical) Computer Applications (N(T) CPA)") -----
    _s("computer_applications", "Computer Applications", aliases=["CPA", "N(T) CPA", "Computer Applications (CPA)",
                                                                  "Computer Application"], only_level="G1"),
    # --- N(T) subjects ITE names as Science substitutes (JIE 'N' footnote *) ----------------------
    _s("mobile_robotics", "Mobile Robotics"),
    _s("smart_electrical_technology", "Smart Electrical Technology"),
    _s("mechanical_design_automation", "Mechanical Design & Automation", aliases=["Mechanical Design and Automation"]),
    _s("iot_applications", "IoT Applications", aliases=["Internet of Things Applications"]),
    _s("mobile_web_applications", "Mobile Web Applications"),
    # --- N(T) / G1 subjects in SEAB's lists (engine 0.1.6). No MOE or ITE rule names them in a slot list, so they
    # fill "any subject" slots only. N(T) 7066 / SEC G1 K129; N(T) A301 / SEC G1 K132 (a MOE-ITE Applied Subject).
    _s("elements_business_skills", "Elements of Business Skills"),
    _s("retail_operations", "Retail Operations"),
]

_HUM_CURRENT = ["bahasa_indonesia", "chinese_sp", "geography", "higher_art", "higher_music", "history",
                "hum_ss_geog", "hum_ss_hist", "hum_ss_lit_chi", "hum_ss_lit_eng", "hum_ss_lit_mal", "hum_ss_lit_tam",
                "lit_chinese", "lit_english", "lit_malay", "lit_tamil", "malay_sp"]
_SCI_CURRENT = ["biology", "chemistry", "physics", "sci_chem_bio", "sci_phy_bio", "sci_phy_chem"]
_SCI_EARLIER = ["additional_combined_science", "additional_science", "combined_science", "engineering_science",
                "general_science", "human_social_biology", "integrated_science", "physical_science", "sci_phy_chem_bio"]
_HUM_LIST_ALL = ["hum_ss_lit_eng", "hum_ss_lit_chi", "hum_ss_lit_mal", "hum_ss_lit_tam", "hum_ss_hist", "hum_ss_geog"]
_LIT = ["lit_english", "lit_chinese", "lit_malay", "lit_tamil"]
_MEDIA = ["media_studies_english", "media_studies_chinese"]
_F_AND_N = ["food_nutrition", "nutrition_food_science"]  # "Food & Nutrition/Nutrition & Food Science"
_COMPUTING = ["computing", "computer_studies"]  # "Computing/Computer Studies"
_ELECTRONICS = ["electronics", "fundamentals_electronics"]  # "Electronics/Fundamentals of Electronics"
_POLY_A_G1 = (["art", "business_studies", "combined_humanities", "economics", "geography", "higher_art",
               "higher_music", "history"] + _HUM_LIST_ALL + ["intro_enterprise_dev"] + _LIT + _MEDIA + ["music"])


def _g(members, source, heading, note=None, earlier_by_category=None):
    d = {"members": list(members), "source": dict(source, heading=heading)}
    if note:
        d["note"] = note
    if earlier_by_category:
        d["earlier_by_category"] = earlier_by_category
    return d


EARLIER_BY_CATEGORY = {
    "categories": ["JAE_HUMANITIES", "JAE_MATHEMATICS", "JAE_SCIENCE"],
    "source": dict(SRC_UNCLEAR, heading="Assumptions: Rules MOE leaves unclear (Earlier O-Level subjects: "
                                            "\"Yes\", by MOE category)"),
    "also_source": dict(SRC_OLEVEL, heading="List of earlier GCE O-Level subjects (categories)"),
}
_EBC = EARLIER_BY_CATEGORY["categories"]


GROUPS = {
    # MOE O-Level categories (2027 JAE, 2026 O-Level results) — current + earlier subjects.
    "JAE_HUMANITIES": _g(_HUM_CURRENT + ["art_design_aep", "combined_humanities", "music_mep"], SRC_OLEVEL,
                         "Humanities + List of earlier GCE O-Level subjects > Humanities"),
    "JAE_MATHEMATICS": _g(["additional_mathematics", "mathematics", "mathematics_bcd"], SRC_OLEVEL,
                          "Mathematics + earlier > Mathematics"),
    "JAE_SCIENCE": _g(_SCI_CURRENT + _SCI_EARLIER, SRC_OLEVEL, "Science + earlier > Science"),
    "RELIGIOUS_KNOWLEDGE": _g(["islamic_rk", "bible_knowledge", "buddhist_studies", "confucian_ethics", "hindu_studies",
                               "sikh_studies"], SRC_OLEVEL, "Religious Knowledge + earlier > Religious Knowledge"),
    "HMTL": _g(["higher_chinese", "higher_malay", "higher_tamil"], SRC_JC2026,
               "What cannot be used for aggregate computation (Higher MTL list)"),
    "MTL": _g(["chinese", "malay", "tamil"], SRC_JC2026, "What cannot be used (MTL list)"),
    "MTL_IN_LIEU": _g(["arabic", "bengali", "burmese", "french", "german", "gujarati", "hindi", "japanese", "panjabi",
                       "thai", "urdu"], SRC_JC2026, "Grade requirements for specific subjects (MTL-in-lieu list)"),
    "MTL_B": _g(["chinese_b", "malay_b", "tamil_b"], SRC_JC2026, "Mother Tongue 'B' Syllabus"),
    "SP_OR_BI": _g(["chinese_sp", "malay_sp", "bahasa_indonesia"], SRC_JC2026,
                   "Bonus points for JC admission (Chinese (SP) / Malay (SP) / Bahasa Indonesia grade)"),
    "ENGLISH": _g(["english_language"], SRC_JC2026, "L1 / EL slots: English (Language)"),
    "MATHS_OR_AMATHS": _g(["mathematics", "additional_mathematics"], SRC_JC2026,
                          "Grade requirements: Any 1 Mathematics (Additional Mathematics, Mathematics)"),
    "ITE_MATHEMATICS": _g(["mathematics", "additional_mathematics"], SRC_UNCLEAR,
                          "Assumptions: Rules MOE leaves unclear (JIE 'N' Mathematics: Additional Mathematics "
                          "counts as Mathematics)",
                          note=("This reading covers the JIE 'N' Mathematics slots; the 2027 ITE 3-year 'Mathematics' slots use it by "
                                "analogy (their successors).")),
    # 2028 PSE lists (L1R4 on G3 subjects).
    "PSE_HUMANITIES": _g(_HUM_CURRENT, SRC_PSE_JCMI, "G3 subjects for L1R4 aggregate computation > Humanities"),
    "PSE_MATHEMATICS": _g(["additional_mathematics", "mathematics"], SRC_PSE_JCMI,
                          "G3 subjects for L1R4 aggregate computation > Mathematics"),
    "PSE_SCIENCE": _g(_SCI_CURRENT, SRC_PSE_JCMI, "G3 subjects for L1R4 aggregate computation > Science"),
    # Polytechnic relevant-subject groups (2027 JAE PDF; also "based on 2026 JAE" for PSE 2028).
    "POLY_A_G1": _g(_POLY_A_G1, SRC_POLY_PDF, "Poly > ELR2B2-A > 1st Group of Relevant Subjects (22)", earlier_by_category=_EBC),
    "POLY_A_G2": _g(["additional_mathematics", "art", "business_studies", "chinese", "combined_humanities",
                     "creative_3d_animation", "design_technology", "design_studies", "economics"] + _F_AND_N +
                    ["geography", "higher_art", "higher_chinese", "higher_malay", "higher_music", "higher_tamil",
                     "history"] + _HUM_LIST_ALL + ["intro_enterprise_dev"] + _LIT +
                    ["malay", "mathematics"] + _MEDIA + ["music", "principles_of_accounts", "tamil"],
                    SRC_POLY_PDF, "Poly > ELR2B2-A > 2nd Group of Relevant Subjects (35)", earlier_by_category=_EBC),
    "POLY_B_G1": _g(["additional_mathematics", "mathematics"], SRC_POLY_PDF, "Poly > ELR2B2-B > 1st Group (2)", earlier_by_category=_EBC),
    "POLY_B_G2": _g(_POLY_A_G1 + ["principles_of_accounts"], SRC_POLY_PDF, "Poly > ELR2B2-B > 2nd Group (23)", earlier_by_category=_EBC),
    "POLY_C_G1": _g(["additional_mathematics", "mathematics"], SRC_POLY_PDF, "Poly > ELR2B2-C (Poly) > 1st Group (2)", earlier_by_category=_EBC),
    "POLY_C_G2": _g(["biology", "biotechnology", "chemistry"] + _COMPUTING + ["creative_3d_animation",
                    "design_technology"] + _F_AND_N + _ELECTRONICS + ["exercise_sports_science", "physics",
                    "sci_chem_bio", "sci_phy_bio", "sci_phy_chem"],
                    SRC_POLY_PDF, "Poly > ELR2B2-C (Poly) > 2nd Group (13)", earlier_by_category=_EBC),
    "POLY_D_G1": _g(["additional_mathematics", "mathematics"], SRC_POLY_PDF, "Poly > ELR2B2-D > 1st Group (2)", earlier_by_category=_EBC),
    "POLY_D_G2": _g(["art", "biology", "biotechnology", "chemistry"] + _COMPUTING + ["creative_3d_animation",
                    "design_technology", "design_studies"] + _F_AND_N + _ELECTRONICS + ["higher_art"] + _MEDIA +
                    ["physics", "sci_chem_bio", "sci_phy_bio", "sci_phy_chem"],
                    SRC_POLY_PDF, "Poly > ELR2B2-D > 2nd Group (17)", earlier_by_category=_EBC),
    # ITE 2-year Higher Nitec (JAE) groups.
    "ITE_R1B3B_R1": _g(["additional_mathematics", "mathematics", "principles_of_accounts"], SRC_POLY_PDF,
                       "ITE > ELR1B3-B > R1 (3)"),
    "ITE_C_G1": _g(["additional_mathematics", "mathematics"], SRC_POLY_PDF, "ITE > ELR2B2-C (ITE) > R2 1st Group (2)"),
    "ITE_C_G2": _g(["biology", "biotechnology", "chemistry", "combined_science"] + _COMPUTING +
                   ["design_technology"] + _ELECTRONICS + ["human_social_biology", "integrated_science", "physics",
                   "engineering_science", "sci_chem_bio", "sci_phy_bio", "sci_phy_chem", "physical_science",
                   "sci_phy_chem_bio"],
                   SRC_POLY_PDF, "ITE > ELR2B2-C (ITE) > R2 2nd Group (16)"),
    # ITE "Science" (JIE 'N' Mathematics-or-Science; PSE 3-year R1B3-B).
    "SCIENCE_ANY_LEVEL": _g(_SCI_CURRENT + _SCI_EARLIER + ["science_t"], SRC_UNCLEAR,
                            "Assumptions: Rules MOE leaves unclear ('standard N-Level core Science (Physics, "
                            "Chemistry, Biology) subjects count as Science')",
                            note=("MOE's O-Level Science category (pure and combined sciences, incl. the N(A) combined "
                                  "sciences and earlier sciences) plus N(T) / G1 Science (Syllabus T). JIE 'N' also takes "
                                  "ITE_SCIENCE_SUBSTITUTES; the 2027 R1B3-B slot does not (no source).")),
    "ITE_SCIENCE_SUBSTITUTES": _g(["mobile_robotics", "smart_electrical_technology", "mechanical_design_automation",
                                   "iot_applications", "mobile_web_applications"], SRC_ITE,
                                  "1.2 footnote * (can be used in lieu of Science)"),
    # PFP 2026 cluster relevant subjects.
    "PFP_REL_SCI": _g(["design_technology"] + _F_AND_N + ["sci_chem_bio", "sci_phy_bio", "sci_phy_chem"], SRC_PFP2026,
                      "Sciences Cluster / Design, Engineering and Technology Cluster / Nursing: Any 1 relevant subject"),
    "PFP_REL_HUM": _g(["art", "geography", "history", "hum_ss_geog", "hum_ss_hist", "hum_ss_lit_eng", "lit_english",
                       "principles_of_accounts"], SRC_PFP2026,
                      "Humanities, Art, Media and Business Cluster / ECDE / Tamil Studies: Any 1 relevant subject"),
}

SUBJECTS_BY_ID = {s["id"]: s for s in SUBJECTS}

# Common student spellings. Each maps to MOE's subject; merged into `aliases` so they
# reach definitions.json. Ambiguous shorthands are NOT here (see LEVEL_SPECIFIC_NAMES and the README).
_LIT_FORMS = {"lit_english": ("Eng", "English"), "lit_chinese": ("Chi", "Chinese"), "lit_malay": ("Mal", "Malay"),
              "lit_tamil": ("Tam", "Tamil")}
_SCI_FORMS = {"sci_phy_chem": (("Physics", "Chemistry"), ("Phy", "Chem"), ("P", "C")),
              "sci_chem_bio": (("Chemistry", "Biology"), ("Chem", "Bio"), ("C", "B")),
              "sci_phy_bio": (("Physics", "Biology"), ("Phy", "Bio"), ("P", "B"))}
_HUM_FORMS = {"hum_ss_geog": ("Geography", "Geog"), "hum_ss_hist": ("History", "Hist"),
              "hum_ss_lit_eng": ("Literature in English", "Lit Eng", "Eng Lit", "English Lit"),
              "hum_ss_lit_chi": ("Literature in Chinese", "Lit Chi", "Chinese Lit"),
              "hum_ss_lit_mal": ("Literature in Malay", "Lit Mal", "Malay Lit"),
              "hum_ss_lit_tam": ("Literature in Tamil", "Lit Tam", "Tamil Lit")}
COMMON_SPELLINGS = {
    "mathematics": ["EMath", "EMaths", "Elementary Maths", "E Mathematics"],
    "additional_mathematics": ["Additional Maths", "Add Mathematics", "Addmath", "Addmaths"],
    "chemistry": ["Pure Chem"],
    "physics": ["Phys", "Pure Phy", "Pure Phys"],
    "biology": ["Pure Bio"],
    "nutrition_food_science": ["F&N", "FN", "N&FS"],
    "design_technology": ["DT"],
}
for _sid, (_short, _long) in _LIT_FORMS.items():
    COMMON_SPELLINGS[_sid] = ["Lit (%s)" % _short, "Lit (%s)" % _long, "Literature (%s)" % _short,
                              "Literature (%s)" % _long, "%s Lit" % _short, "%s Lit" % _long, "Lit %s" % _short,
                              "Lit %s" % _long]
for _sid, _forms in _SCI_FORMS.items():
    COMMON_SPELLINGS[_sid] = ["%s (%s, %s)" % (pre, x, y) for a, b in _forms
                              for pre in ("Science", "Sci", "Combined Science", "Combined Sci")
                              for x, y in ((a, b), (b, a))]
for _sid, _forms in _HUM_FORMS.items():
    COMMON_SPELLINGS[_sid] = ["%s (%s, %s)" % (pre, ss, f) for pre in ("Humanities", "Hum", "Combined Humanities")
                              for ss in ("SS", "Social Studies") for f in _forms]
for _sid, _names in COMMON_SPELLINGS.items():
    for _n in _names:
        if _n not in SUBJECTS_BY_ID[_sid]["aliases"] and _n != SUBJECTS_BY_ID[_sid]["name"]:
            SUBJECTS_BY_ID[_sid]["aliases"].append(_n)


# How a subject name is normalised before lookup (data, exported to definitions.json for the JavaScript port).
# Steps, in order: strip + lower case; curly quotes -> straight; drop quotes; inside parentheses split on the separator
# regex and rejoin with ","; "&" (now only outside parentheses) -> " and "; collapse whitespace; no space around
# "/ , ".
NAME_NORMALISE = {
    # ordered replacements (both ports): curly quotes -> straight; "-" -> " " so "E-Math" = "E Math"
    "quote_map": [["\u2019", "'"], ["\u2018", "'"], ["\u201c", '"'], ["\u201d", '"'], ["-", " "]],
    "drop_chars": ["'", '"'],
    "parens_regex": r"\(([^()]*)\)",
    "separator_in_parens_regex": r"\s*(?:,|/|&|\band\b)\s*",
    "parens_joiner": ",",
    "amp_outside_parens": ["&", " and "],
    "tight_chars": "/,()",
}
_SEP_IN_PARENS = re.compile(NAME_NORMALISE["separator_in_parens_regex"])
_PARENS = re.compile(NAME_NORMALISE["parens_regex"])


def _norm_parens(m):
    parts = [p.strip() for p in _SEP_IN_PARENS.split(m.group(1))]
    return "(" + NAME_NORMALISE["parens_joiner"].join(p for p in parts if p) + ")"


def _norm(name):
    s = str(name).strip().lower()
    for a, b in NAME_NORMALISE["quote_map"]:
        s = s.replace(a, b)
    for ch in NAME_NORMALISE["drop_chars"]:
        s = s.replace(ch, "")
    s = _PARENS.sub(_norm_parens, s)  # ',', '/', '&', 'and' equal inside parentheses
    amp, amp_to = NAME_NORMALISE["amp_outside_parens"]
    s = s.replace(amp, amp_to)
    s = " ".join(s.split())
    for ch in NAME_NORMALISE["tight_chars"]:
        s = s.replace(" " + ch, ch).replace(ch + " ", ch)
    return s


ALIAS_INDEX = {}
for _sub in SUBJECTS:
    for _n in [_sub["name"], _sub["id"]] + _sub["aliases"]:
        ALIAS_INDEX.setdefault(_norm(_n), _sub["id"])


# ----------------------------------------------------------------------------------- levels SEAB examines (0.1.6)
# SEAB's syllabus lists, one row per (system, subject): data/taxonomy/subjects_by_level.csv (166 rows, with notes and
# the SEAB page for each row). A row maps to a subject by its engine_id, else by its SEAB name or engine name.
EXAMINED_LEVELS = {
    "file": "data/taxonomy/subjects_by_level.csv",
    "source": {"file": "data/taxonomy/subjects_by_level.csv",
               "heading": "SEAB syllabus lists: 2026 GCE O-Level, N(A)-Level and N(T)-Level; 2027 SEC G1 / G2 / G3 "
                          "(school and private candidates; source_url per row)"},
    "level_codes": {"O": "G3", "NA": "G2", "NT": "G1", "G1": "G1", "G2": "G2", "G3": "G3"},
    # which systems a row's exam year reads; a row with no year reads every system
    "groups": [
        {"id": "gce", "max_year": 2026, "systems": ["O2026", "NA2026", "NT2026"],
         "labels": {"G3": "O-Level", "G2": "N(A)", "G1": "N(T)"}, "order": ["G3", "G2", "G1"]},
        {"id": "sec", "min_year": 2027, "systems": ["SEC2027"],
         "labels": {"G1": "G1", "G2": "G2", "G3": "G3"}, "order": ["G1", "G2", "G3"]},
    ],
    "no_year": {"labels": {"G1": "G1", "G2": "G2", "G3": "G3"}, "order": ["G1", "G2", "G3"]},
    "earlier_group": "gce",
    "text": "{subject} {verb} examined at {levels} only.",
}
SEAB_ROWS_SKIPPED = []


def _load_examined_levels():
    path = os.path.join(ROOT, EXAMINED_LEVELS["file"])
    codes = EXAMINED_LEVELS["level_codes"]
    for sub in SUBJECTS:
        sub["levels_by_system"] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            sid = (r["engine_id"].strip() or ALIAS_INDEX.get(_norm(r["subject_seab_name"]))
                   or ALIAS_INDEX.get(_norm(r["engine_name"])))
            if not sid:
                SEAB_ROWS_SKIPPED.append((r["system"], r["subject_seab_name"]))
                continue
            got = SUBJECTS_BY_ID[sid]["levels_by_system"].setdefault(r["system"], [])
            for lv in r["levels"].split(";"):
                g = codes[lv.strip()]
                if g not in got:
                    got.append(g)
            got.sort()


_load_examined_levels()


def _examined_group(year):
    if year is None:
        return None
    for g in EXAMINED_LEVELS["groups"]:
        if ("max_year" in g and year <= g["max_year"]) or ("min_year" in g and year >= g["min_year"]):
            return g
    return None


def examined_levels(sid, year):
    """(levels, view) for a subject and exam year, or None when neither SEAB's lists nor the catalogue say anything.
    view = the group (labels, order) used to name the levels."""
    s = SUBJECTS_BY_ID[sid]
    g = _examined_group(year)
    systems = g["systems"] if g else [x for grp in EXAMINED_LEVELS["groups"] for x in grp["systems"]]
    levels = set()
    for sy in systems:
        levels.update(s["levels_by_system"].get(sy, []))
    if not levels and s.get("only_level"):
        levels = {s["only_level"]}
    if not levels:
        return None
    if s["earlier"]:
        view = next(x for x in EXAMINED_LEVELS["groups"] if x["id"] == EXAMINED_LEVELS["earlier_group"])
    else:
        view = g or EXAMINED_LEVELS["no_year"]
    return levels, view


def examined_text(sid, found):
    """'Science is examined at G1 only.' / 'Bengali is examined at G2 and G3 only.' (earlier subjects: 'was')."""
    levels, view = found
    names = [view["labels"][lv] for lv in view["order"] if lv in levels]
    joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
    s = SUBJECTS_BY_ID[sid]
    return EXAMINED_LEVELS["text"].format(subject=s["name"], verb="was" if s["earlier"] else "is", levels=joined)


def default_level(sid, year):
    """The one level SEAB examines the subject at for that year (or the catalogue's only_level), else None."""
    found = examined_levels(sid, year)
    if found and len(found[0]) == 1:
        return next(iter(found[0]))
    return None


def resolve_subject(name):
    """Subject name or alias -> catalogue id, or None if unknown (level-free; see resolve_subject_at)."""
    if name is None:
        return None
    return ALIAS_INDEX.get(_norm(name))


# Bare names whose meaning depends on the level. At a level not listed the name is ambiguous: it is NOT mapped,
# and the row is reported in input_problems.
_SS_HINT = ("Social Studies is examined with an elective: Humanities (Social Studies, Geography / History / "
            "Literature in English, Chinese, Malay or Tamil) - enter that subject")
_SS_SOURCE = {"file": RB + "post_secondary_admissions_jae_gce_o_level_subjects_and_categories.md",
              "heading": "Humanities (Social Studies appears only as Humanities (Social Studies, ...))"}
LEVEL_SPECIFIC_NAMES = {
    "social studies": {"by_level": {}, "hint": _SS_HINT, "source": _SS_SOURCE},
    "ss": {"by_level": {}, "hint": _SS_HINT, "source": _SS_SOURCE},
    "science": {"by_level": {"G1": "science_t"},
                "hint": ("'Science' alone is the N(T) / G1 Science subject; at G2 / G3 name the subject in full, "
                         "e.g. 'Science (Physics, Chemistry)'"),
                "source": {"file": RB + "post_secondary_admissions_pse_ite_3_year_higher_nitec.md",
                           "heading": "Aggregate types and subjects (R1B3-B: Mathematics or Science; G1 subject names)"}},
}

ONLY_LEVEL_SOURCES = {
    "HMTL": {"file": RB + "post_secondary_admissions_pse_jc_and_mi.md",
             "heading": "Grade requirements for specific subjects (MTL at G1 / G2 / G3; HMTL graded A1 to E8 only)"},
    "earlier": {"file": RB + "post_secondary_admissions_jae_gce_o_level_subjects_and_categories.md",
                "heading": "List of earlier GCE O-Level subjects"},
    "computer_applications": {"file": RB + "psle_fsbb_full_subject_based_banding_faq.md",
                              "heading": "Computing: Normal (Technical) Computer Applications (N(T) CPA); GCE N-Level CPA"},
    "science_t": {"file": RB + "ite__jie_aggregates.md",
                  "heading": "1.2 Group M/S ('Mathematics or Science' at N(T)); 'Syllabus T' = N(T)"},
}


def resolve_subject_at(name, level):
    """Level-aware resolution -> (subject_id or None, hint or None).

    hint is set when the name is ambiguous at this level (e.g. bare 'Science' at G2 / G3, or with no level).
    """
    if name is None:
        return None, None
    key = _norm(name)
    spec = LEVEL_SPECIFIC_NAMES.get(key)
    if spec is not None:
        sid = spec["by_level"].get(level)
        return (sid, None) if sid else (None, spec["hint"])
    return ALIAS_INDEX.get(key), None


def group_members(group_name):
    """The group exactly as its source lists it (unchanged meaning for every existing caller, e.g. the matcher)."""
    return GROUPS[group_name]["members"]


printed_members = group_members

_EFFECTIVE = {}


def slot_members(group_name):
    """Members an aggregate SLOT accepts: the printed list, plus - for groups with `earlier_by_category` - every earlier
    O-Level subject of a category (Humanities / Mathematics / Science) that the printed list already contains."""
    if group_name in _EFFECTIVE:
        return _EFFECTIVE[group_name]
    spec = GROUPS[group_name]
    members = list(spec["members"])
    printed = set(members)
    for cat in spec.get("earlier_by_category", []):
        cat_members = GROUPS[cat]["members"]
        if printed & set(cat_members):
            members += [m for m in cat_members if SUBJECTS_BY_ID[m]["earlier"] and m not in printed]
            printed = set(members)
    _EFFECTIVE[group_name] = members
    return members


def check_catalogue():
    """Self-check used by the tests: every group member exists, ids unique, aliases unambiguous."""
    problems = []
    ids = [s["id"] for s in SUBJECTS]
    if len(ids) != len(set(ids)):
        problems.append("duplicate subject ids")
    for g, spec in GROUPS.items():
        for m in spec["members"]:
            if m not in SUBJECTS_BY_ID:
                problems.append("group %s: unknown member %s" % (g, m))
    for s in SUBJECTS:
        if s.get("only_level") not in (None, "G1", "G2", "G3"):
            problems.append("%s: bad only_level" % s["id"])
    for key, spec in LEVEL_SPECIFIC_NAMES.items():
        if key in ALIAS_INDEX:
            problems.append("level-specific name %r is also a plain alias" % key)
        for sid in spec["by_level"].values():
            if sid not in SUBJECTS_BY_ID:
                problems.append("level-specific name %r -> unknown %s" % (key, sid))
    seen = {}
    for s in SUBJECTS:
        for n in [s["name"]] + s["aliases"]:
            k = _norm(n)
            if k in seen and seen[k] != s["id"]:
                problems.append("alias %r maps to %s and %s" % (n, seen[k], s["id"]))
            seen[k] = s["id"]
    return problems
