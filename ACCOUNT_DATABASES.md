# Bases independientes por cuenta principal

Cada registro público crea una cuenta principal (rol admin, is_owner=true) y una
base `sf_<hash del tenant_id>`. Clientes, reparaciones, inventario, ajustes y
contador de tickets viven en esa base. Los administradores y técnicos creados
por Equipo pertenecen a la cuenta que los creó; no eligen una base de destino.

La base definida por DB_NAME es el directorio central: identidades y contraseñas
hasheadas, relación cuenta/propietario, claves de enlaces públicos y, si no hay
JWT_SECRET configurado, la clave de firma generada una sola vez. No contiene
nuevos clientes, reparaciones ni inventario. Todas las bases comparten clúster,
recursos y credencial de servicio; no son servidores ni respaldos independientes.

## Permisos

- Cuenta principal: administrador protegido contra desactivación/cambio de rol.
- Administrador: gestión del equipo, clientes, reparaciones e inventario.
- Técnico: clientes y reparaciones; sin inventario, estadísticas de stock,
  resultados de inventario en búsqueda, carga de fotos de inventario ni gestión
  del equipo. Restricciones aplicadas en API y navegación.
- Roles y cuenta se leen del directorio en cada petición: desactivar un usuario
  o cambiar su rol surte efecto inmediatamente en la API, incluso con token antiguo.
- El correo es único en el sistema. Cada persona inicia sesión con su correo.

## Antes de activar en una instalación existente

1. Haz un respaldo y detén los escritores (backend, tareas e integraciones).
2. Con MONGO_URL y DB_NAME del entorno, ejecuta dentro de backend:
   `python migrate_account_databases.py` (revisión sin cambios).
3. Ejecuta `python migrate_account_databases.py --apply`.
4. Despliega el nuevo backend y frontend y vuelve a iniciar sesión.
5. Verifica datos y permisos por cuenta. Conserva el respaldo.

La migración conserva las colecciones antiguas, copia solo documentos del
mismo tenant_id, verifica contenido y cantidad, y activa el enrutamiento al final.
Es reiniciable y no vuelve a copiar una cuenta ya activada. No la ejecutes con
escrituras concurrentes. Si hay datos huérfanos o correos duplicados, se detiene.
Para cuentas antiguas, el administrador más antiguo se convierte en propietario
si no existe uno definido; revisa esta asignación antes de migrar.
Una cuenta existente sin migrar recibe 503: nunca vuelve a la base compartida.
Una instalación vacía no necesita migración.

Los enlaces públicos nuevos usan tokens aleatorios únicos, no números REP
repetidos entre cuentas. Las etiquetas antiguas deben reimprimirse tras migrar.
Los enlaces se mantienen públicos para quien tenga el token, sin datos internos
como claves de desbloqueo o notas privadas.

## Atlas y Railway

MONGO_URL debe permitir al backend operar en el directorio central y en las bases
sf_ de las cuentas. Un permiso limitado únicamente a sistemaflow ya no basta.
No cambies credenciales o reglas de red sin revisar los permisos requeridos.
Atlas Free comparte límites de capacidad y colecciones entre todas estas bases;
este diseño no multiplica el almacenamiento gratuito ni incluye respaldos.
La autorización temporal de IP sigue venciendo: esta modificación del código no
cambia la lista de acceso de Atlas.

## Validación local

Con MongoDB desechable escuchando en 127.0.0.1:18770 y dependencias de desarrollo
pytest y httpx instaladas:

`python -m pytest backend/tests/test_account_isolation.py -q`

La prueba no utiliza Atlas: crea cuentas y bases locales aleatorias, comprueba
lectura/escritura cruzada, todos los métodos del inventario, búsqueda, dashboard,
permisos de equipo, tokens antiguos, enlaces públicos y migración idempotente.
