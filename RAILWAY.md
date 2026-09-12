# Desplegar SistemaFlow en Railway

## Backend (servicio existente)

Esta configuración permite desplegar el backend desde la raíz del repositorio.
`requirements.txt` enumera las dependencias completas de Python y
`railway.toml` arranca `server:app` con el directorio de importación correcto.
Mantén sincronizados `requirements.txt` y `backend/requirements.txt`: Railpack
copia el archivo raíz antes de instalar las dependencias y todavía no incluye
la carpeta backend en esa capa de compilación.

1. Conecta este repositorio y selecciona la rama que contiene estos cambios.
2. En Settings → Source, deja Root Directory vacío (raíz del repositorio).
3. Usa `/railway.toml` como ruta de configuración si Railway pide una.
4. Elimina comandos de build/start anteriores que apuntaran a `main:app`.
5. En Variables configura:

| Variable | Valor |
|---|---|
| `MONGO_URL` | URI real de MongoDB Atlas o del servicio MongoDB de Railway |
| `DB_NAME` | `sistemaflow` (o el nombre de tu base existente) |
| `JWT_SECRET` | Clave larga y aleatoria; conserva la actual si ya está en uso |
| `CORS_ORIGINS` | URL HTTPS del frontend, sin barra final; separa varias con comas |
| `CLOUDINARY_CLOUD_NAME` | Nombre de tu cuenta Cloudinary |
| `CLOUDINARY_API_KEY` | Clave de Cloudinary |
| `CLOUDINARY_API_SECRET` | Secreto de Cloudinary |
| `RESEND_API_KEY` | Clave de Resend para notificaciones |
| `SENDER_EMAIL` | Remitente autorizado en Resend |

Railway proporciona `PORT`. No uses localhost como dirección de MongoDB en Railway.
Guarda los secretos en Variables, nunca en GitHub.

6. Despliega y genera un dominio público en Settings → Networking.
7. Comprueba `https://TU-BACKEND/health` y `https://TU-BACKEND/docs`.
   `/health` comprueba que el proceso responde; no certifica la conexión a MongoDB.
   Prueba también iniciar sesión y consultar órdenes para comprobar la base de datos.

### Alternativa: Root Directory = /backend

También está soportada. Selecciona `/backend/railway.toml` como archivo de
configuración (la ruta del archivo es relativa al repositorio, no a Root Directory).
El comando de inicio en ese caso es:

```sh
uvicorn server:app --host 0.0.0.0 --port $PORT
```

## Frontend: servicio separado

El servicio backend no publica la interfaz React. Crea otro servicio desde el mismo
repositorio, con Root Directory `/frontend` y archivo de configuración
`/frontend/railway.toml`.

- Build command: `CI=false yarn build`
- Start command: `npx --yes serve@14.2.4 -s build -l tcp://0.0.0.0:$PORT`
- Variable de compilación: `REACT_APP_BACKEND_URL=https://TU-BACKEND`
  (sin `/api` y sin barra final; el código añade `/api`).
- Genera su dominio público y añádelo a `CORS_ORIGINS` del backend.
- Vuelve a compilar el frontend cada vez que cambies `REACT_APP_BACKEND_URL`.

`CI=false` permite compilar con las advertencias ESLint existentes; los errores
de compilación siguen deteniendo el despliegue.

`yarn start` es el servidor de desarrollo; para producción sirve la carpeta `build`.
Selecciona explícitamente `/frontend/railway.toml` para que ese servicio no
herede la configuración del backend en la raíz.
