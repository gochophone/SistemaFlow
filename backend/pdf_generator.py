from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable, KeepInFrame
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from PIL import Image as PILImage, ImageOps
from datetime import datetime
from io import BytesIO
from urllib.request import Request, urlopen
from xml.sax.saxutils import escape


MAX_LOGO_BYTES = 10 * 1024 * 1024
MAX_LOGO_PIXELS = 16_000_000
RECEIPT_ACCENT = colors.HexColor("#2563EB")


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
    data = [[Paragraph("<b>{}</b>".format(escape(label)), styles["label"]), Paragraph(escape(compact(value)), styles["value"])] for label, value in rows]
    table = Table(data, colWidths=[35 * mm, 151 * mm], hAlign="LEFT")
    background = "#DCFCE7" if green else "#F4F4F5"
    border = "#86EFAC" if green else "#D4D4D8"
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor(background)), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor(border)), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm)]))
    return table


def company_header(company_name, company_logo_url, company_rut, company_address, delivery_date, styles,
                   logo_size_mm=28, date_label="Fecha"):
    meta_lines = [
        compact(company_name, "Mi negocio", 90),
        "RUT: " + compact(company_rut, "No configurado", 25),
        "Dirección: " + compact(company_address, "No configurada", 90),
        date_label + ": " + date(delivery_date),
    ]
    metadata = Paragraph("<b>{}</b><br/>{}".format(
        escape(meta_lines[0]), "<br/>".join(escape(line) for line in meta_lines[1:])
    ), styles["company_meta"])
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
            logo = Image(logo_buffer, width=logo_size_mm * mm, height=logo_size_mm * mm, kind="proportional")
        except Exception:
            logo = None

    if logo:
        header = Table([[logo, metadata]], colWidths=[(logo_size_mm + 6) * mm, (186 - logo_size_mm - 6) * mm], hAlign="LEFT")
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
    """Genera un comprobante de retiro A4 con la empresa junto al logo."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=10 * mm, bottomMargin=10 * mm)
    base = getSampleStyleSheet()
    accent = RECEIPT_ACCENT
    ink = colors.HexColor("#20242A")
    muted = colors.HexColor("#5B6470")
    styles = {
        "company_meta": ParagraphStyle("delivery_company_meta", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor=ink),
        "document": ParagraphStyle("delivery_document", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=ink),
        "order": ParagraphStyle("delivery_order", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=18, alignment=2, textColor=accent),
        "section": ParagraphStyle("delivery_section", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=ink, spaceBefore=4 * mm, spaceAfter=1.8 * mm),
        "label": ParagraphStyle("delivery_label", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=ink),
        "value": ParagraphStyle("delivery_value", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=10, textColor=ink),
        "small": ParagraphStyle("delivery_small", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=muted),
        "panel_title": ParagraphStyle("delivery_panel_title", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=accent),
    }

    def panel(title, rows):
        lines = [Paragraph(escape(title.upper()), styles["panel_title"])]
        for label, value in rows:
            lines.append(Paragraph("<b>{}:</b> {}".format(escape(label), escape(compact(value, limit=110))), styles["value"]))
        box = Table([[lines]], colWidths=[90 * mm])
        box.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.65, colors.HexColor("#D9DDE2")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ]))
        return box

    company_name = compact(company_name, "Mi negocio", 90)
    public_notes = []
    if repair_data.get("notes") and not repair_data.get("notes_private", False):
        public_notes.append(str(repair_data["notes"]).strip())
    public_notes.extend(
        str(note.get("text", "")).strip()
        for note in repair_data.get("note_entries", [])
        if not note.get("is_private", True) and str(note.get("text", "")).strip()
    )
    service_rows = [
        ("Problema informado", compact(repair_data.get("reported_issue"), limit=150)),
        ("Diagnóstico / trabajo", compact(repair_data.get("diagnosis"), limit=150)),
    ]
    if public_notes:
        service_rows.append(("Notas", compact(" · ".join(public_notes), limit=350)))

    order_header = Table([[
        Paragraph("Comprobante de retiro de equipo", styles["document"]),
        Paragraph("Orden N° {}".format(escape(compact(repair_data.get("ticket_number"), "—", 32))), styles["order"]),
    ]], colWidths=[112 * mm, 74 * mm])
    order_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    client = panel("Cliente", [
        ("Nombre", customer_data.get("name") or repair_data.get("customer_name")),
        ("RUT", customer_data.get("rut")),
        ("Teléfono", customer_data.get("phone")),
        ("Correo", customer_data.get("email")),
    ])
    equipment = panel("Equipo", [
        ("Marca y modelo", "{} {}".format(compact(repair_data.get("device_brand")), compact(repair_data.get("device_model")))),
        ("IMEI", repair_data.get("device_imei")),
        ("N° de serie", repair_data.get("device_serial")),
        ("Técnico", repair_data.get("assigned_technician")),
    ])
    identity = Table([[client, equipment]], colWidths=[93 * mm, 93 * mm])
    identity.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 3 * mm),
        ("LEFTPADDING", (1, 0), (1, 0), 3 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    signature_line = lambda: HRFlowable(width=65 * mm, thickness=0.7, color=ink, hAlign="CENTER")
    signatures = Table([
        [signature_line(), signature_line()],
        ["Firma de quien retira", "Firma del técnico"],
        [compact(customer_data.get("name") or repair_data.get("customer_name"), "", 60),
         compact(repair_data.get("assigned_technician"), "", 60)],
    ], colWidths=[93 * mm, 93 * mm])
    signatures.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 2), (-1, 2), muted),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))

    content = [
        HRFlowable(width="100%", thickness=2.5, color=accent, spaceAfter=4 * mm),
        company_header(company_name, company_logo_url, company_rut, company_address,
                       repair_data.get("delivered_date"), styles, logo_size_mm=36,
                       date_label="Fecha de entrega"),
        Spacer(1, 4 * mm),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#D9DDE2"), spaceAfter=4 * mm),
        order_header,
        Spacer(1, 4 * mm),
        Paragraph("Constancia de entrega del equipo asociado a esta orden. Las firmas al pie acreditan su retiro.", styles["small"]),
        Paragraph("DATOS DE RETIRO", styles["section"]),
        identity,
        Paragraph("TRABAJO Y OBSERVACIONES", styles["section"]),
        details(service_rows, styles),
    ]
    if repair_data.get("budget_estimate") is not None:
        payment_rows = [("Total del servicio", money(repair_data["budget_estimate"])),
                        ("Estado del pago", "Pagado" if repair_data.get("paid") else "Pendiente")]
        if repair_data.get("paid") and repair_data.get("paid_at"):
            payment_rows.append(("Fecha de pago", date(repair_data["paid_at"])))
        content += [Paragraph("COBRO", styles["section"]), details(payment_rows, styles, green=True)]
    content += [
        Spacer(1, 6 * mm),
        Paragraph("CONFIRMACIÓN DE ENTREGA", styles["section"]),
        Paragraph("La persona que firma confirma haber recibido el equipo identificado en este comprobante.", styles["small"]),
        Spacer(1, 12 * mm),
        signatures,
        Spacer(1, 5 * mm),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#D9DDE2"), spaceAfter=2 * mm),
        Paragraph("Conserve este comprobante como respaldo de la entrega de la orden indicada.", styles["small"]),
    ]
    # Una nota o dirección larga no debe crear una segunda página.
    doc.build([KeepInFrame(doc.width, doc.height - 12, content, mode="shrink", hAlign="CENTER", vAlign="TOP")])
    buffer.seek(0)
    return buffer


SALE_CATEGORIES = {
    "phone": "Smartphone", "notebook": "Notebook", "macbook": "MacBook",
    "board": "Placa base", "spare_part": "Repuesto", "other": "Otro",
}
SALE_CONDITIONS = {
    "new": "Nuevo", "used": "Usado", "refurbished": "Reacondicionado",
    "for_parts": "Para repuestos",
}


def generate_sale_delivery_pdf(sale, company_name="Mi negocio", company_logo_url=None, company_rut="", company_address=""):
    """Genera el comprobante de venta con el formato del PDF de entrega."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=10 * mm, bottomMargin=10 * mm)
    base = getSampleStyleSheet()
    accent = RECEIPT_ACCENT
    ink = colors.HexColor("#20242A")
    muted = colors.HexColor("#5B6470")
    styles = {
        "company_meta": ParagraphStyle("sale_company_meta", parent=base["Normal"], fontName="Helvetica", fontSize=9, leading=12, textColor=ink),
        "document": ParagraphStyle("sale_document", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=ink),
        "order": ParagraphStyle("sale_order", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=15, leading=18, alignment=2, textColor=accent),
        "section": ParagraphStyle("sale_section", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=ink, spaceBefore=4 * mm, spaceAfter=1.8 * mm),
        "label": ParagraphStyle("sale_label", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=ink),
        "value": ParagraphStyle("sale_value", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=10, textColor=ink),
        "small": ParagraphStyle("sale_small", parent=base["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=muted),
        "panel_title": ParagraphStyle("sale_panel_title", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=accent),
    }

    def panel(title, rows):
        lines = [Paragraph(escape(title.upper()), styles["panel_title"])]
        for label, value in rows:
            lines.append(Paragraph("<b>{}:</b> {}".format(escape(label), escape(compact(value, limit=110))), styles["value"]))
        box = Table([[lines]], colWidths=[90 * mm])
        box.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.65, colors.HexColor("#D9DDE2")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ]))
        return box

    category = sale.get("custom_category") if sale.get("category") == "other" else None
    category = category or SALE_CATEGORIES.get(sale.get("category"), "Otro")
    buyer = panel("Comprador", [
        ("Nombre", sale.get("customer_name")),
        ("RUT", sale.get("customer_rut")),
        ("Teléfono", sale.get("customer_phone")),
    ])
    article = panel("Artículo", [
        ("Nombre", sale.get("item_name")),
        ("Tipo", category),
        ("Estado", SALE_CONDITIONS.get(sale.get("condition"), "No especificado")),
        ("IMEI", sale.get("imei")),
        ("N° de serie", sale.get("serial_number")),
    ])
    identity = Table([[buyer, article]], colWidths=[93 * mm, 93 * mm])
    identity.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 3 * mm),
        ("LEFTPADDING", (1, 0), (1, 0), 3 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    observations = []
    if sale.get("condition_notes"):
        observations.append(("Detalle del estado", compact(sale["condition_notes"], limit=250)))
    if sale.get("notes"):
        observations.append(("Observaciones", compact(sale["notes"], limit=250)))

    order_header = Table([[
        Paragraph("Comprobante de venta y entrega", styles["document"]),
        Paragraph("Venta N° {}".format(escape(compact(sale.get("sale_number"), "—", 32))), styles["order"]),
    ]], colWidths=[112 * mm, 74 * mm])
    order_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    signature_line = lambda: HRFlowable(width=65 * mm, thickness=0.7, color=ink, hAlign="CENTER")
    signatures = Table([
        [signature_line(), signature_line()],
        ["Firma del comprador", "Firma de quien entrega"],
        [compact(sale.get("customer_name"), "", 60), compact(sale.get("sold_by_name"), "", 60)],
    ], colWidths=[93 * mm, 93 * mm])
    signatures.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 2), (-1, 2), muted),
        ("TOPPADDING", (0, 0), (-1, -1), 1 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
    ]))
    content = [
        HRFlowable(width="100%", thickness=2.5, color=accent, spaceAfter=4 * mm),
        company_header(company_name, company_logo_url, company_rut, company_address,
                       sale.get("sold_on"), styles, logo_size_mm=36, date_label="Fecha de venta"),
        Spacer(1, 4 * mm),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#D9DDE2"), spaceAfter=4 * mm),
        order_header,
        Spacer(1, 4 * mm),
        Paragraph("Constancia de venta y entrega del artículo indicado. Las firmas al pie acreditan su recepción.", styles["small"]),
        Paragraph("DATOS DE LA VENTA", styles["section"]),
        identity,
    ]
    if observations:
        content += [Paragraph("ESTADO Y OBSERVACIONES", styles["section"]), details(observations, styles)]
    content += [
        Paragraph("COBRO", styles["section"]),
        details([("Cantidad", str(sale.get("quantity") or 1)),
                 ("Precio unitario", money(sale.get("unit_price"))),
                 ("Total de la venta", money(sale.get("total_price")))], styles, green=True),
        Spacer(1, 6 * mm),
        Paragraph("CONFIRMACIÓN DE ENTREGA", styles["section"]),
        Paragraph("El comprador confirma haber recibido el artículo identificado en este comprobante.", styles["small"]),
        Spacer(1, 12 * mm),
        signatures,
        Spacer(1, 5 * mm),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#D9DDE2"), spaceAfter=2 * mm),
        Paragraph("Conserve este comprobante como respaldo de la venta y entrega indicadas.", styles["small"]),
    ]
    doc.build([KeepInFrame(doc.width, doc.height - 12, content, mode="shrink", hAlign="CENTER", vAlign="TOP")])
    buffer.seek(0)
    return buffer
