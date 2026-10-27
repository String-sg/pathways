"""Common student spellings resolve to MOE's subjects; ambiguous ones are reported.
Spellings invented in the way students type them."""

import unittest

from engine import check_inputs
from engine import subjects as SUB
from helpers import picks, row, run

EXPECT = {
    "mathematics": ["E Math", "EMath", "E-Math", "e-maths", "Elementary Mathematics", "Math", "Maths", "MATHS"],
    "additional_mathematics": ["A Math", "AMath", "A-Math", "a-maths", "Add Math", "Add Maths", "ADD MATHS",
                               "Additional Maths"],
    "chemistry": ["Pure Chem", "Pure Chemistry", "Chem", "CHEM"],
    "physics": ["Pure Phy", "Phys", "Pure Physics", "Phy"],
    "biology": ["Bio", "Pure Bio", "Pure Biology"],
    "sci_phy_chem": ["Combined Science (Physics, Chemistry)", "Sci (Phy/Chem)", "Science (Chem/Phy)",
                     "combined sci (p/c)", "SCIENCE (PHYSICS & CHEMISTRY)"],
    "sci_chem_bio": ["Science (Chem/Bio)", "Combined Science (Chemistry, Biology)", "Sci (Bio, Chem)", "Science (C/B)"],
    "sci_phy_bio": ["Sci (Phy/Bio)", "Combined Science (Biology, Physics)", "Science (P, B)"],
    "hum_ss_geog": ["Combined Humanities (SS, Geog)", "Humanities (SS/Geog)", "Hum (Social Studies, Geography)"],
    "hum_ss_hist": ["Humanities (SS/Hist)", "Combined Humanities (SS, History)", "HUM (SS & HIST)"],
    "hum_ss_lit_eng": ["Humanities (SS, Eng Lit)", "Combined Humanities (Social Studies, Lit Eng)"],
    "hum_ss_lit_chi": ["Humanities (SS, Lit Chi)"],
    "hum_ss_lit_mal": ["Humanities (SS, Malay Lit)"],
    "hum_ss_lit_tam": ["Combined Humanities (SS, Literature in Tamil)"],
    "lit_english": ["Lit (Eng)", "Literature (English)", "Eng Lit", "English Lit", "lit eng"],
    "lit_chinese": ["Lit (Chi)", "Literature (Chinese)", "Chinese Lit", "Chi Lit"],
    "lit_malay": ["Lit (Malay)", "Malay Lit", "Literature (Mal)"],
    "lit_tamil": ["Lit (Tamil)", "Tamil Lit", "Lit Tam"],
    "nutrition_food_science": ["F&N", "F & N", "FN", "NFS", "Nutrition and Food Science"],
    "computer_applications": ["Computer Applications", "CPA", "N(T) CPA"],
    "principles_of_accounts": ["POA", "poa"],
    "design_technology": ["D&T", "DT", "Design and Technology"],
    "chinese": ["CL"], "malay": ["ML"], "tamil": ["TL"],
    "higher_chinese": ["HCL"], "higher_malay": ["HML"], "higher_tamil": ["HTL"],
    "english_language": ["EL", "english"],
}


class TestSpellings(unittest.TestCase):
    def test_each_spelling_resolves(self):
        for sid, names in EXPECT.items():
            for n in names:
                self.assertEqual(SUB.resolve_subject(n), sid, n)

    def test_catalogue_still_unambiguous(self):
        self.assertEqual(SUB.check_catalogue(), [])

    def test_moe_names_unchanged(self):
        # MOE's earlier subject names keep their meaning (they are not student shorthand).
        self.assertEqual(SUB.resolve_subject("Food & Nutrition"), "food_nutrition")
        self.assertEqual(SUB.resolve_subject("Combined Science"), "combined_science")
        self.assertEqual(SUB.resolve_subject("Combined Humanities"), "combined_humanities")

    def test_spellings_reach_the_export(self):
        sub = SUB.SUBJECTS_BY_ID["mathematics"]
        self.assertIn("EMath", sub["aliases"])
        self.assertIn("Lit (Eng)", SUB.SUBJECTS_BY_ID["lit_english"]["aliases"])

    def test_bare_social_studies_is_reported(self):
        for name, level in (("Social Studies", "O"), ("SS", "N(A)"), ("social studies", "N(T)")):
            res = check_inputs([{"subject": name, "level": level, "grade": "A1" if level == "O" else
                                 ("1" if level == "N(A)" else "A"), "year": 2026}])
            p = res["input_problems"][0]
            self.assertEqual(p["field"], "subject", name)
            self.assertIn("examined with an elective", p["problem"])

    def test_computer_applications_is_an_nt_subject(self):
        rows = [{"subject": s, "level": "N(T)", "grade": g, "year": 2026}
                for s, g in (("English Language", "C"), ("Mathematics", "B"), ("CPA", "A"), ("Art", "B"))]
        r = run("B4(2026)", rows)
        self.assertEqual(r.input_problems, [])
        self.assertIn("computer_applications", [s["subject_id"] for s in r.slots])
        self.assertEqual(r.gross, 1 + 2 + 2 + 3)
        self.assertEqual(check_inputs([{"subject": "Computer Applications", "grade": "A", "year": 2026}])
                         ["entries"][0]["level"], "G1")  # only level: defaulted with a warning

    def test_shorthand_changes_scores_correctly(self):
        # Before the aliases these fell to 'Others'; now they fill category slots.
        rows = [row("EL", "B3"), row("E-Math", "A2"), row("Pure Chem", "B3"), row("Eng Lit", "B4"),
                row("Combined Humanities (SS, Geog)", "C5"), row("F&N", "A2"), row("CL", "B3")]
        r = run("L1R5(2026)", rows)
        self.assertEqual(r.input_problems, [])
        p = picks(r)
        self.assertEqual(p["R1"][0], "lit_english")
        self.assertEqual(p["R2"][0], "mathematics")
        self.assertEqual(r.gross, 3 + 4 + 2 + 3 + 2 + 3)  # R3 Chem; R4/R5 F&N 2 + CL 3 (Hum C5 left out)
        c = run("ELR2B2-C:POLY(2026)", rows)
        self.assertEqual(picks(c)["R2"][0], "nutrition_food_science")  # F&N A2 is on the 2nd group, beats Chem B3
        self.assertEqual(c.gross, 3 + 2 + 2 + 3 + 3)  # B: Chem B3, CL B3 (or Lit B4 left out)


if __name__ == "__main__":
    unittest.main()
