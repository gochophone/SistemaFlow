# Correo de autenticación

Railway backend requiere `RESEND_API_KEY` (solo envío, dominio ifixflow.com) y
`SENDER_EMAIL=Ifixflow <no-reply@ifixflow.com>`. No guardar la clave en GitHub.
Verificar en Resend los registros DKIM y SPF/MX antes de activar el envío.

El registro solicita código y solo crea la identidad y negocio al verificarlo.
La prueba mensual comienza al verificar. Las cuentas existentes pueden iniciar
sesión normalmente y recuperar su contraseña por el mismo formulario público.
La recuperación nunca cambia roles, tenant, suspensión o suscripción.

Códigos: seis cifras, 10 minutos, máximo cinco intentos, un solo uso atómico.
Mongo almacena HMAC con el secreto de firma y nonce, nunca el código original.
Reenvío: un minuto, cinco solicitudes por correo y propósito por hora.
Límite conservador global: 90 solicitudes de correo de autenticación al día UTC.
El límite cuenta también direcciones desconocidas para evitar revelar usuarios.
Al cambiar contraseña aumenta token_version, invalidando sesiones anteriores.

Pruebas: `python -m pytest backend/tests/test_account_isolation.py -q` usa
Mongo local desechable y sustituye el transporte de correo; no envía mensajes reales.
