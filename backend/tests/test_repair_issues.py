import unittest

from repair_issues import COMMON_REPAIR_ISSUES, build_issue_catalog, normalized_issue_name


class RepairIssueCatalogTests(unittest.TestCase):
    def test_defaults_have_no_quick_picks(self):
        self.assertEqual(build_issue_catalog([]), {
            "options": list(COMMON_REPAIR_ISSUES), "frequent": [],
        })

    def test_only_common_issues_appear_in_list_and_selected_issues_form_quick_picks(self):
        catalog = build_issue_catalog([
            {"name": "Pantalla", "count": 5},
            {"name": "Face ID", "count": 4},
            {"name": "Puerto USB", "count": 6},
            {"name": "Cámara", "count": 1},
            {"name": "Corto", "count": 2},
            {"name": "Conector USB", "count": 1},
            {"name": "", "count": 9},
        ])
        self.assertEqual(catalog["options"], list(COMMON_REPAIR_ISSUES))
        self.assertEqual(catalog["frequent"], [
            {"name": "Puerto USB", "count": 6},
            {"name": "Pantalla", "count": 5},
            {"name": "Face ID", "count": 4},
            {"name": "Corto", "count": 2},
            {"name": "Cámara", "count": 1},
        ])

    def test_manual_issue_is_normalized_and_common_issue_uses_fixed_label(self):
        self.assertEqual(normalized_issue_name("  puerto   USB "), "puerto USB")
        self.assertEqual(normalized_issue_name("camara"), "Cámara")
        with self.assertRaises(ValueError):
            normalized_issue_name("  ")


if __name__ == "__main__":
    unittest.main()
