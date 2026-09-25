from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from PIL import Image as PILImage, ImageOps
from datetime import datetime
from io import BytesIO
from urllib.request import Request, urlopen


MAX_LOGO_BYTES = 10 * 1024 * 1024
MAX_LOGO_PIXELS = 16_000_000


def compact(value, fallback="No especificado", limit=150):
    value = str(value or fallback).strip()
    return value if len(value) <= limit else value[:limit - 1].rstrip() + "…"


def date(value):
    if not value:
        return "No especificada"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return str(value)


def money(value):
    return "$0" if not value else "$" + "{:,.0f}".format(value).replace(",", ".")


def details(rows, styles, green=False):
    data = [[Paragraph("<b>{}</b>".format(label), styles["label"]), Paragraph(compact(value), styles["value"])] for label, value in rows]
    table = Table(data, colWidths=[35 * mm, 151 * mm], hAlign="LEFT")
    background = "#DCFCE7" if green else "#F4F4F5"
    border = "#86EFAC" if green else "#D4D4D8"
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor(background)), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor(border)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm)]))
    return table


def company_header(company_name, company_logo_url, company_rut, company_address, delivery_date, styles):
    meta_lines = [
        compact(company_name, "Mi negocio", 90),
        "RUT: " + compact(company_rut, "No configurado", 25),
        "Dirección: " + compact(company_address, "No configurada", 90),
        "Fecha: " + date(delivery_date or datetime.now()),
    ]
    metadata = Paragraph("<br/>".join(meta_lines), styles["company_meta"])
    logo = None
    if company_logo_url:
        try:
            request = Request(company_logo_url, headers={"User-Agent": "iFixFlow/1.0"})
            with urlopen(request, timeout=8) as response:
                logo_bytes = response.read(MAX_LOGO_BYTES + 1)
            if len(logo_bytes) > MAX_LOGO_BYTES:
                raise ValueError("El logo supera el máximo de 10 MB")

            with PILImage.open(BytesIO(logo_bytes)) as source_logo:
                if source_logo.width * source_logo.height > MAX_LOGO_PIXELS:
                    raise ValueError("Las dimensiones del logo son demasiado grandes")
                source_logo.load()
                source_logo = ImageOps.exif_transpose(source_logo)
                source_logo.thumbnail((800, 800), PILImage.Resampling.LANCZOS)

                if source_logo.mode in ("RGBA", "LA") or "transparency" in source_logo.info:
                    rgba_logo = source_logo.convert("RGBA")
                    prepared_logo = PILImage.new("RGB", rgba_logo.size, "white")
                    prepared_logo.paste(rgba_logo, mask=rgba_logo.getchannel("A"))
                else:
                    prepared_logo = source_logo.convert("RGB")

                logo_buffer = BytesIO()
                prepared_logo.save(logo_buffer, format="JPEG", quality=88, optimize=True)
                logo_buffer.seek(0)
            logo = Image(logo_buffer, width=28 * mm, height=28 * mm, kind="proportional")
        except Exception:
            logo = None

    if logo:
        header = Table([[logo, metadata]], colWidths=[34 * mm, 152 * mm], hAlign="LEFT")
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 1 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
        ]))
        return header
    return Table([[metadata]], colWidths=[80 * mm], hAlign="CENTER", style=TableStyle([
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
        "company_meta": ParagraphStyle("company_meta", parent=base["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, alignment=TA_LEFT, textColor=colors.HexColor("#3F3F46")),
        "document": ParagraphStyle("document", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=9, alignment=TA_CENTER, textColor=colors.HexColor("#52525B"), spaceAfter=3 * mm),
        "section": ParagraphStyle("section", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=9, leading=10, spaceBefore=3.5 * mm, spaceAfter=1.8 * mm),
        "label": ParagraphStyle("label", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=9),
        "value": ParagraphStyle("value", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=9),
    }
    company_name = compact(company_name, "Mi negocio", 90)
    equipment = "{} {}".format(compact(repair_data.get("device_brand")), compact(repair_data.get("device_model")))
    content = [
        company_header(company_name, company_logo_url, company_rut, company_address, repair_data.get("delivered_date"), styles),
        Paragraph("ORDEN DE ENTREGA", styles["document"]),
        details([("N° de orden", repair_data.get("ticket_number", ""))], styles),
        Paragraph("Cliente", styles["section"]),
        details([("Nombre", customer_data.get("name") or repair_data.get("customer_name")), ("Teléfono", customer_data.get("phone")), ("RUT", customer_data.get("rut")), ("Correo", customer_data.get("email"))], styles),
        Spacer(1, 5 * mm),
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
    content += [Spacer(1, 12 * mm), signatures]
    doc.build(content)
    buffer.seek(0)
    return buffer
