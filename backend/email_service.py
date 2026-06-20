import os
import asyncio
import logging
import resend
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

resend.api_key = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

logger = logging.getLogger(__name__)

def create_repair_ready_email_html(customer_name: str, ticket_number: str, device_info: str, diagnosis: str = None) -> str:
    """Create HTML email template for repair completion notification"""
    diagnosis_section = f"""
        <tr>
            <td style="padding: 20px; background-color: #F4F4F5; border-left: 4px solid #10B981;">
                <h3 style="margin: 0 0 10px 0; color: #09090B; font-size: 16px; font-weight: 600;">Diagnóstico</h3>
                <p style="margin: 0; color: #52525B; font-size: 14px; line-height: 1.6;">{diagnosis}</p>
            </td>
        </tr>
    """ if diagnosis else ""
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #F4F4F5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; background-color: #09090B; border-radius: 8px 8px 0 0;">
                                <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700; font-family: 'Chivo', sans-serif;">
                                    ✓ Reparación Completada
                                </h1>
                                <p style="margin: 10px 0 0 0; color: #A1A1AA; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">
                                    ServiceTech - Sistema de Gestión
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                <p style="margin: 0 0 20px 0; color: #09090B; font-size: 16px; line-height: 1.6;">
                                    Estimado/a <strong>{customer_name}</strong>,
                                </p>
                                
                                <p style="margin: 0 0 30px 0; color: #52525B; font-size: 15px; line-height: 1.6;">
                                    Nos complace informarle que su equipo ha sido reparado exitosamente y está listo para ser retirado.
                                </p>
                                
                                <!-- Info Box -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background-color: #F4F4F5; border-radius: 6px;">
                                    <tr>
                                        <td style="padding: 20px;">
                                            <table role="presentation" style="width: 100%;">
                                                <tr>
                                                    <td style="padding: 8px 0;">
                                                        <span style="color: #71717A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Número de Orden</span>
                                                        <p style="margin: 5px 0 0 0; color: #09090B; font-size: 18px; font-weight: 600; font-family: 'Chivo', sans-serif;">{ticket_number}</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; border-top: 1px solid #E4E4E7;">
                                                        <span style="color: #71717A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Equipo</span>
                                                        <p style="margin: 5px 0 0 0; color: #09090B; font-size: 16px; font-weight: 500;">{device_info}</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                {diagnosis_section}
                                
                                <!-- Status Badge -->
                                <table role="presentation" style="margin: 30px 0;">
                                    <tr>
                                        <td style="padding: 12px 24px; background-color: #D1FAE5; border: 1px solid #6EE7B7; border-radius: 6px;">
                                            <span style="color: #047857; font-size: 14px; font-weight: 600;">✓ Estado: Completado - Listo para Retirar</span>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 30px 0 0 0; color: #52525B; font-size: 15px; line-height: 1.6;">
                                    Por favor, acérquese a nuestras oficinas durante nuestro horario de atención para retirar su equipo.
                                </p>
                                
                                <p style="margin: 20px 0 0 0; color: #52525B; font-size: 14px; line-height: 1.6;">
                                    Si tiene alguna pregunta, no dude en contactarnos.
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 40px; background-color: #FAFAFA; border-top: 1px solid #E4E4E7; border-radius: 0 0 8px 8px;">
                                <p style="margin: 0; color: #71717A; font-size: 12px; text-align: center;">
                                    © 2024 ServiceTech. Sistema de Gestión de Servicio Técnico.<br>
                                    Este es un correo automático, por favor no responda a este mensaje.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

async def send_repair_ready_notification(
    customer_email: str,
    customer_name: str,
    ticket_number: str,
    device_brand: str,
    device_model: str,
    diagnosis: str = None
):
    """Send email notification when repair is completed"""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not configured. Email notification skipped.")
        return {"status": "skipped", "reason": "API key not configured"}
    
    device_info = f"{device_brand} {device_model}"
    html_content = create_repair_ready_email_html(
        customer_name=customer_name,
        ticket_number=ticket_number,
        device_info=device_info,
        diagnosis=diagnosis
    )
    
    params = {
        "from": SENDER_EMAIL,
        "to": [customer_email],
        "subject": f"✓ Su equipo {device_info} está listo - {ticket_number}",
        "html": html_content
    }
    
    try:
        # Run sync SDK in thread to keep FastAPI non-blocking
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Repair completion email sent to {customer_email} for ticket {ticket_number}")
        return {
            "status": "success",
            "email_id": email.get("id"),
            "recipient": customer_email
        }
    except Exception as e:
        logger.error(f"Failed to send email to {customer_email}: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
            "recipient": customer_email
        }
