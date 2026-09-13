# Suscripciones por negocio

El negocio recibe un mes calendario gratuito y luego renueva por $10.000 CLP al mes. El plan incluye su equipo. Los negocios existentes reciben el mes al primer despliegue de esta versión. Las fechas quedan persistidas en la base central y no se reinician al desplegar o entrar.

Configurar en el backend Railway BILLING_ADMIN_EMAIL con el correo de una cuenta propietaria existente y controlada por el responsable de cobros. También se admite BILLING_ADMIN_USER_IDS con identificadores explícitos separados por comas. Sin estas variables nadie puede administrar cobros. No asignar esta función a administradores de clientes. La API de usuarios no permite cambiar el correo.

Entrar como responsable y abrir Suscripción. Guardar allí los datos bancarios, que se almacenan en MongoDB y no en GitHub. Cada propietario ve la cuenta y puede informar una transferencia. Un reporte pendiente nunca da acceso. El responsable verifica el abono en Santander fuera del sistema y confirma o rechaza la solicitud en el panel. Una confirmación añade un mes desde el mayor entre el vencimiento actual y la fecha de confirmación. Una doble confirmación de la misma solicitud no añade otro mes.

Al vencer se bloquean las operaciones del equipo en el backend con HTTP 402. Inicio de sesión, consulta de suscripción y reporte de pagos siguen disponibles. No se borran datos. Los enlaces de seguimiento ya compartidos siguen funcionando. El responsable global puede administrar cobros aunque su propio negocio esté vencido.

No hay cobros automáticos, tarjetas almacenadas ni integración activa con Mercado Pago. No registrar transferencias reales en pruebas. El historial conserva quién reportó y revisó, fechas, referencia, importe y vencimiento.

Pruebas: TEST_MONGO_URL=mongodb://127.0.0.1:18770 python -m pytest backend/tests/test_account_isolation.py -q
Usar exclusivamente una instancia MongoDB desechable para pruebas. El frontend se valida con yarn build en frontend.
