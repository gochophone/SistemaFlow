from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from datetime import datetime
from io import BytesIO


def format_clp(amount):
    """Format amount to Chilean Pesos"""
    if not amount:
        return "$0"
    return f"${amount:,.0f}".replace(",", ".")


def format_date(date_str):
    """Format ISO date string to readable format"""
    if not date_str:
        return "No especificada"
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime('%d/%m/%Y %H:%M')
    except:
        return date_str


def generate_delivery_pdf(repair_data, customer_data):
    """
    Generate a delivery order PDF
    
    Args:
        repair_data: Dictionary with repair information
        customer_data: Dictionary with customer information
    
    Returns:
        BytesIO object containing the PDF
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=20*mm, bottomMargin=20*mm)
    
    # Styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#09090B'),
        spaceAfter=5*mm,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#71717A'),
        spaceAfter=10*mm,
        alignment=TA_CENTER,
        fontName='Helvetica'
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#09090B'),
        spaceAfter=3*mm,
        spaceBefore=5*mm,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#09090B'),
        fontName='Helvetica'
    )
    
    # Build content
    content = []
    
    # Header
    content.append(Paragraph("TechFlow", title_style))
    content.append(Paragraph("ORDEN DE ENTREGA", subtitle_style))
    
    # Ticket number and date
    ticket_table_data = [
        ['N° de Orden:', repair_data.get('ticket_number', '')],
        ['Fecha de Entrega:', format_date(repair_data.get('delivered_date', datetime.now().isoformat()))]
    ]
    
    ticket_table = Table(ticket_table_data, colWidths=[40*mm, 80*mm])
    ticket_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F4F4F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#09090B')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E4E4E7')),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    content.append(ticket_table)
    content.append(Spacer(1, 8*mm))
    
    # Customer Information
    content.append(Paragraph("Información del Cliente", section_title_style))
    
    customer_data_table = [
        ['Nombre:', customer_data.get('name', repair_data.get('customer_name', ''))],
        ['Email:', customer_data.get('email', 'No especificado')],
        ['Teléfono:', customer_data.get('phone', 'No especificado')],
        ['RUT:', customer_data.get('rut', 'No especificado')],
    ]
    
    customer_table = Table(customer_data_table, colWidths=[40*mm, 120*mm])
    customer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F4F4F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#09090B')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E4E4E7')),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    content.append(customer_table)
    content.append(Spacer(1, 8*mm))
    
    # Device Information
    content.append(Paragraph("Información del Equipo", section_title_style))
    
    device_data_table = [
        ['Marca:', repair_data.get('device_brand', '')],
        ['Modelo:', repair_data.get('device_model', '')],
        ['IMEI:', repair_data.get('device_imei', '')],
        ['Color:', repair_data.get('device_color', 'No especificado')],
    ]
    
    device_table = Table(device_data_table, colWidths=[40*mm, 120*mm])
    device_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F4F4F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#09090B')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E4E4E7')),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    content.append(device_table)
    content.append(Spacer(1, 8*mm))
    
    # Service Details
    content.append(Paragraph("Detalles del Servicio", section_title_style))
    
    service_data_table = [
        ['Problema Reportado:', repair_data.get('reported_issue', '')],
        ['Diagnóstico:', repair_data.get('diagnosis', 'No especificado')],
        ['Notas de Reparación:', repair_data.get('notes', 'No especificado')],
    ]
    
    service_table = Table(service_data_table, colWidths=[40*mm, 120*mm])
    service_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F4F4F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#09090B')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E4E4E7')),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    content.append(service_table)
    content.append(Spacer(1, 8*mm))
    
    # Timeline
    content.append(Paragraph("Cronología del Servicio", section_title_style))
    
    timeline_data = [
        ['Fecha de Ingreso:', format_date(repair_data.get('received_date', ''))],
    ]
    
    if repair_data.get('completed_date'):
        timeline_data.append(['Fecha de Completado:', format_date(repair_data.get('completed_date', ''))])
    
    timeline_data.append(['Fecha de Entrega:', format_date(repair_data.get('delivered_date', datetime.now().isoformat()))])
    
    timeline_table = Table(timeline_data, colWidths=[40*mm, 120*mm])
    timeline_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F4F4F5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#09090B')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E4E4E7')),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    content.append(timeline_table)
    content.append(Spacer(1, 8*mm))
    
    # Cost
    budget = repair_data.get('budget_estimate', 0)
    if budget:
        content.append(Paragraph("Costo del Servicio", section_title_style))
        
        cost_data = [
            ['Total:', format_clp(budget)],
        ]
        
        cost_table = Table(cost_data, colWidths=[40*mm, 120*mm])
        cost_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#DCFCE7')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#166534')),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#86EFAC')),
            ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
            ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
        ]))
        content.append(cost_table)
        content.append(Spacer(1, 15*mm))
    
    # Signatures
    content.append(Spacer(1, 10*mm))
    
    signature_data = [
        ['', ''],
        ['_' * 40, '_' * 40],
        ['Firma del Cliente', 'Firma del Técnico'],
        ['', ''],
        ['RUT: _____________________', f'Técnico: {repair_data.get("assigned_technician", "_______________")}'],
    ]
    
    signature_table = Table(signature_data, colWidths=[85*mm, 85*mm])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
        ('FONTNAME', (0, 4), (-1, 4), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ]))
    content.append(signature_table)
    
    # Footer
    content.append(Spacer(1, 10*mm))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#71717A'),
        alignment=TA_CENTER,
        fontName='Helvetica-Oblique'
    )
    content.append(Paragraph(
        f"Documento generado el {datetime.now().strftime('%d/%m/%Y a las %H:%M')}",
        footer_style
    ))
    
    # Build PDF
    doc.build(content)
    buffer.seek(0)
    return buffer
