import unittest

import helpers  # noqa: F401  (sets sys.path)
from engine import grades as G
from engine import subjects as SUB


class TestLevelsAndGrades(unittest.TestCase):
    def test_level_aliases(self):
        self.assertEqual(G.normalise_level("O"), "G3")
        self.assertEqual(G.normalise_level("n(a)"), "G2")
        self.assertEqual(G.normalise_level("N(T)"), "G1")
        self.assertEqual(G.normalise_level("G2"), "G2")
        self.assertIsNone(G.normalise_level("IB"))

    def test_grade_normalising(self):
        self.assertEqual(G.normalise_grade("G3", "9"), "F9")
        self.assertEqual(G.normalise_grade("G3", "b3"), "B3")
        self.assertEqual(G.normalise_grade("G2", "U"), "6")
        self.assertEqual(G.normalise_grade("G1", "U"), "U")
        self.assertEqual(G.normalise_grade("G3", "Merit"), "MERIT")
        self.assertEqual(G.normalise_grade("G3", "AB"), "ABS")
        self.assertIsNone(G.normalise_grade("G2", "A1"))

    def test_school_cockpit_mark_bands(self):
        self.assertEqual(G.mark_to_grade("G3", 75), "A1")
        self.assertEqual(G.mark_to_grade("G3", 74.9), "A2")
        self.assertEqual(G.mark_to_grade("G3", 39), "F9")
        self.assertEqual(G.mark_to_grade("G2", 50), "5")
        self.assertEqual(G.mark_to_grade("G2", 49), "6")
        self.assertEqual(G.mark_to_grade("G1", 59), "D")

    def test_grade_at_or_better(self):
        self.assertTrue(G.grade_at_or_better("G3", "B4", "C6"))
        self.assertTrue(G.grade_at_or_better("G3", "C6", "C6"))
        self.assertFalse(G.grade_at_or_better("G3", "D7", "C6"))
        self.assertTrue(G.grade_at_or_better("G2", "5", "5"))
        self.assertFalse(G.grade_at_or_better("G1", "E", "D"))


class TestScales(unittest.TestCase):
    def p(self, scale, level, grade):
        return G.points(G.SCALES[scale], level, grade)

    def test_ite_points_pse(self):  # 3-year Higher Nitec table
        self.assertEqual(self.p("ITE_POINTS_PSE", "G3", "D7"), 1)
        self.assertEqual(self.p("ITE_POINTS_PSE", "G3", "E8"), 2)
        self.assertEqual(self.p("ITE_POINTS_PSE", "G3", "F9"), 3)
        self.assertEqual(self.p("ITE_POINTS_PSE", "G2", "3"), 1)
        self.assertEqual(self.p("ITE_POINTS_PSE", "G2", "6"), 4)
        self.assertEqual(self.p("ITE_POINTS_PSE", "G1", "E"), 5)
        self.assertIsNone(self.p("ITE_POINTS_PSE", "G1", "U"))
        self.assertTrue(G.is_mer_unusable(G.SCALES["ITE_POINTS_PSE"], "G2", "6"))

    def test_g2_equivalent_poly_pfp(self):  # grade 9, G2 5-6 and G1 unusable
        self.assertEqual(self.p("G2EQ_NO_FAIL", "G3", "B3"), 1)
        self.assertEqual(self.p("G2EQ_NO_FAIL", "G3", "C6"), 2)
        self.assertEqual(self.p("G2EQ_NO_FAIL", "G3", "E8"), 4)
        self.assertIsNone(self.p("G2EQ_NO_FAIL", "G3", "F9"))
        self.assertIsNone(self.p("G2EQ_NO_FAIL", "G2", "5"))
        self.assertIsNone(self.p("G2EQ_NO_FAIL", "G1", "A"))

    def test_g2_equivalent_ite_2year(self):  # 9 -> 5, G2 6 counts
        self.assertEqual(self.p("G2EQ_FULL", "G3", "F9"), 5)
        self.assertEqual(self.p("G2EQ_FULL", "G2", "6"), 6)
        self.assertIsNone(self.p("G2EQ_FULL", "G1", "A"))

    def test_jie_scales(self):
        self.assertEqual(self.p("ITE_POINTS_JIEH", "G2", "5"), 5)
        self.assertIsNone(self.p("ITE_POINTS_JIEH", "G2", "6"))
        self.assertEqual(self.p("ITE_POINTS_JIEH", "G3", "F9"), 5)
        self.assertIsNone(self.p("ITE_POINTS_JIEH", "G1", "A"))
        self.assertEqual(self.p("ITE_POINTS_JIEN", "G2", "6"), 4)
        self.assertEqual(self.p("ITE_POINTS_JIEN", "G1", "U"), 5)
        self.assertEqual(self.p("ITE_POINTS_JIEN", "G3", "F9"), 3)
        self.assertIsNone(self.p("PFP_2026", "G3", "F9"))
        self.assertEqual(self.p("PFP_2026", "G3", "D7"), 3)

    def test_o_points(self):
        self.assertEqual(self.p("O_POINTS", "G3", "F9"), 9)
        self.assertIsNone(self.p("O_POINTS", "G2", "1"))
        self.assertIsNone(self.p("G3_POINTS_NO9", "G3", "F9"))


class TestCatalogue(unittest.TestCase):
    def test_catalogue_consistent(self):
        self.assertEqual(SUB.check_catalogue(), [])

    def test_aliases(self):
        r = SUB.resolve_subject
        self.assertEqual(r("A Maths"), "additional_mathematics")
        self.assertEqual(r("HCL"), "higher_chinese")
        self.assertEqual(r("Hum(SS, Geog)"), "hum_ss_geog")
        self.assertEqual(r("Humanities (Social Studies/Geography)"), "hum_ss_geog")
        self.assertEqual(r("Science (Phy,Chem)"), "sci_phy_chem")
        self.assertEqual(r("Chinese ‘B’"), "chinese_b")
        self.assertEqual(r("Business"), "business_studies")
        self.assertEqual(r("Design and Technology"), "design_technology")
        self.assertEqual(r("Punjabi"), "panjabi")
        self.assertEqual(r("Elements of Business Skills"), "elements_business_skills")  # added in 0.1.6 (SEAB N(T))
        self.assertIsNone(r("Underwater Basket Weaving"))

    def test_poly_and_ite_group_sizes(self):
        n = lambda g: len(SUB.printed_members(g))  # noqa: E731  (as printed; earlier subjects join separately)
        self.assertEqual(n("POLY_A_G1"), 22)  # 22 printed names
        self.assertEqual(n("POLY_A_G2"), 36)  # 35 printed, "Food & Nutrition/NFS" = 2 subjects
        self.assertEqual(n("POLY_B_G2"), 23)
        self.assertEqual(n("POLY_C_G2"), 16)  # 13 printed, 3 of them name 2 subjects
        self.assertEqual(n("POLY_D_G2"), 20)  # 17 printed, 3 of them name 2 subjects
        self.assertEqual(n("ITE_C_G2"), 18)  # 16 printed, 2 of them name 2 subjects
        self.assertEqual(n("ITE_R1B3B_R1"), 3)

    def test_poly_vs_ite_c_lists_differ(self):
        poly, ite = set(SUB.printed_members("POLY_C_G2")), set(SUB.printed_members("ITE_C_G2"))
        self.assertIn("combined_science", ite)
        self.assertNotIn("combined_science", poly)
        self.assertIn("exercise_sports_science", poly)
        self.assertNotIn("exercise_sports_science", ite)

    def test_pse_lists_have_no_earlier_subjects(self):
        self.assertNotIn("combined_humanities", SUB.group_members("PSE_HUMANITIES"))
        self.assertIn("combined_humanities", SUB.group_members("JAE_HUMANITIES"))
        self.assertIn("combined_science", SUB.group_members("JAE_SCIENCE"))


if __name__ == "__main__":
    unittest.main()
