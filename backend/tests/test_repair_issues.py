import unittest

from repair_issues import COMMON_REPAIR_ISSUES, build_issue_catalog


class RepairIssueCatalogTests(unittest.TestCase):
    def test_defaults_exist_before_any_repair(self):
        self.assertEqual(build_issue_catalog([]), {
            "options": list(COMMON_REPAIR_ISSUES), "frequent": [],
        })

    def test_saved_custom_issues_and_top_five_are_grouped(self):
        catalog = build_issue_catalog([
            {"_id": "Pantalla", "count": 2},
            {"_id": " pantalla ", "count": 3},
            {"_id": "FaceID", "count": 4},
            {"_id": "Puerto USB", "count": 6},
            {"_id": "Cámara", "count": 1},
            {"_id": "corto", "count": 2},
            {"_id": "Conector USB", "count": 1},
            {"_id": "", "count": 9},
        ])
        self.assertEqual(catalog["options"][:len(COMMON_REPAIR_ISSUES)], list(COMMON_REPAIR_ISSUES))
        self.assertEqual(catalog["options"][len(COMMON_REPAIR_ISSUES):], ["Conector USB", "Puerto USB"])
        self.assertEqual(catalog["frequent"], [
            {"name": "Puerto USB", "count": 6},
            {"name": "Pantalla", "count": 5},
            {"name": "Face ID", "count": 4},
            {"name": "Corto", "count": 2},
            {"name": "Cámara", "count": 1},
        ])


if __name__ == "__main__":
    unittest.main()
