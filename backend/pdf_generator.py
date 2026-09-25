from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from datetime import datetime
from io import BytesIO
from urllib.request import Request, urlopen


def compact(value, fallback="No especificado", limit=150):
    value = str(value or fallback).strip()
    return value if len(value) <= limit else value[:limit - 1].rstrip() + "…"


def date(value):
    if not value:
        return "No especificada"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M")
    except (TypeError, ValueError):
        return str(value)


def money(value):
    return "$0" if not value else "$" + "{:,.0f}".format(value).replace(",", ".")


def details(rows, styles, green=False):
    data = [[Paragraph("<b>{}</b>".format(label), styles["label"]), Paragraph(compact(value), styles["value"])] for label, value in rows]
    table = Table(data, colWidths=[35 * mm, 151 * mm], hAlign="LEFT")
    background = "#DCFCE7" if green else "#F4F4F5"
    border = "#86EFAC" if green else "#D4D4D8"
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor(background)), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor(border)), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2.2 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2.2 * mm), ("TOPPADDING", (0, 0), (-1, -1), 1.25 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.25 * mm)]))
    return table


def company_header(company_name, company_logo_url, company_rut, company_address, delivery_date, styles):
    name = Paragraph(company_name, styles["company"])
    meta_lines = [
        "RUT: " + compact(company_rut, "No configurado", 25),
        "Dirección: " + compact(company_address, "No configurada", 90),
        "Fecha: " + date(delivery_date or datetime.now()),
    ]
    metadata = Paragraph("<br/>".join(meta_lines), styles["company_meta"])
    logo = None
    if company_logo_url:
        try:
            request = Request(company_logo_url, headers={"User-Agent": "iFixFlow/1.0"})
            with urlopen(request, timeout=4) as response:
                logo = Image(BytesIO(response.read(3 * 1024 * 1024)), width=28 * mm, height=28 * mm, kind="proportional")
        except Exception:
            logo = None

    if logo:
        header = Table([[logo, name, metadata]], colWidths=[47 * mm, 92 * mm, 47 * mm], hAlign="CENTER")
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 1 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
        ]))
        return header
    return Table([[name, metadata]], colWidths=[110 * mm, 76 * mm], hAlign="CENTER", style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))


def generate_delivery_pdf(repair_data, customer_data, company_name="Mi negocio", company_logo_url=None, company_rut="", company_address=""):
    """Genera una orden de entrega compacta en una sola hoja."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=10 * mm, bottomMargin=9 * mm)
    base = getSampleStyleSheet()
    styles = {
        "company": ParagraphStyle("company", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=23, leading=25, alignment=TA_CENTER, spaceAfter=1 * mm),
        "company_meta": ParagraphStyle("company_meta", parent=base["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=colors.HexColor("#3F3F46")),
        "document": ParagraphStyle("document", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=9, alignment=TA_CENTER, textColor=colors.HexColor("#52525B"), spaceAfter=3 * mm),
        "section": ParagraphStyle("section", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=9, leading=10, spaceBefore=2.6 * mm, spaceAfter=1.1 * mm),
        "label": ParagraphStyle("label", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=9),
        "value": ParagraphStyle("value", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=9),
        "footer": ParagraphStyle("footer", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=7, leading=8, alignment=TA_CENTER, textColor=colors.HexColor("#71717A")),
    }
    company_name = compact(company_name, "Mi negocio", 90)
    equipment = "{} {}".format(compact(repair_data.get("device_brand")), compact(repair_data.get("device_model")))
    content = [
        company_header(company_name, company_logo_url, company_rut, company_address, repair_data.get("delivered_date"), styles),
        Paragraph("ORDEN DE ENTREGA", styles["document"]),
        details([("N° de orden", repair_data.get("ticket_number", ""))], styles),
        Paragraph("Cliente", styles["section"]),
        details([("Nombre", customer_data.get("name") or repair_data.get("customer_name")), ("Teléfono", customer_data.get("phone")), ("RUT", customer_data.get("rut")), ("Correo", customer_data.get("email"))], styles),
        Spacer(1, 4 * mm),
        Paragraph("Equipo y servicio", styles["section"]),
        details([("Equipo", equipment), ("IMEI / serie", repair_data.get("device_imei") or repair_data.get("device_serial")), ("Problema", compact(repair_data.get("reported_issue"), limit=150)), ("Diagnóstico", compact(repair_data.get("diagnosis"), limit=150)), ("Notas", compact(repair_data.get("notes"), limit=150))], styles),
    ]
    if repair_data.get("budget_estimate"):
        content += [Paragraph("Cobro", styles["section"]), details([("Total del servicio", money(repair_data["budget_estimate"]))], styles, green=True)]
    technician = compact(repair_data.get("assigned_technician"), "_______________________", 45)
    signature_line = lambda: HRFlowable(width=50 * mm, thickness=0.6, color=colors.HexColor("#18181B"), spaceBefore=0, spaceAfter=0, hAlign="CENTER")
    signatures = Table([
        [signature_line(), signature_line()],
        ["Firma del cliente", "Firma del técnico"],
        ["", "Técnico: " + technician],
    ], colWidths=[93 * mm, 93 * mm])
    signatures.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 0.8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.8 * mm),
    ]))
    footer = "Documento generado por {} el {}".format(company_name, datetime.now().strftime("%d/%m/%Y a las %H:%M"))
    content += [Spacer(1, 10 * mm), signatures, Spacer(1, 2 * mm), Paragraph(footer, styles["footer"])]
    doc.build(content)
    buffer.seek(0)
    return buffer
