"""Los presupuestos con IVA se muestran desglosados en el comprobante."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pdf_generator


def test_delivery_pdf_breaks_down_vat_and_keeps_legacy_total(monkeypatch):
    rows = []
    original_details = pdf_generator.details

    def collect_details(values, styles, green=False):
        rows.extend(values)
        return original_details(values, styles, green)

    monkeypatch.setattr(pdf_generator, "details", collect_details)
    repair = {
        "ticket_number": "REP-00001", "device_brand": "Apple", "device_model": "iPhone 13",
        "reported_issue": "Pantalla", "budget_estimate": 119000, "vat_included": True,
    }
    pdf = pdf_generator.generate_delivery_pdf(repair, {"name": "Ana"})
    assert pdf.getvalue().startswith(b"%PDF")
    assert ("Valor neto", "$100.000") in rows
    assert ("IVA (19%)", "$19.000") in rows
    assert ("Total con IVA", "$119.000") in rows

    rows.clear()
    repair.pop("vat_included")
    pdf_generator.generate_delivery_pdf(repair, {"name": "Ana"})
    assert ("Total del servicio", "$119.000") in rows
    assert not any(label == "IVA (19%)" for label, _ in rows)
