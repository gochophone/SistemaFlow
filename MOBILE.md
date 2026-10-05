# iFixFlow para Android y iPhone

El proyecto móvil reutiliza la interfaz React y el backend HTTPS actual. Los proyectos nativos están en `frontend/android` y `frontend/ios`; los datos permanecen en Railway y MongoDB.

## Preparar una compilación

Requisitos: Node.js 22 o posterior; Android Studio y SDK para Android; Xcode 26 o posterior para iOS. Instala dependencias con `cd frontend && yarn install --frozen-lockfile`. La URL del backend es pública y no contiene contraseñas:

```sh
cd frontend
REACT_APP_BACKEND_URL=https://sistemaflow-production.up.railway.app npm run mobile:sync
```

`mobile:sync` compila React y copia el resultado a ambos proyectos. Se debe repetir después de cada cambio web que se quiera incorporar a la app nativa. El backend admite los orígenes locales de Capacitor para iOS y Android.

## Android

Abre `frontend/android` en Android Studio o ejecuta `npm run mobile:android` con `REACT_APP_BACKEND_URL` configurada. Para una prueba local, ejecuta `cd frontend/android && ./gradlew assembleDebug`; el APK queda en `app/build/outputs/apk/debug/`. También puedes lanzar manualmente la acción **Android test APK** en GitHub y descargar su artefacto. Es un APK de prueba; para distribución estable en Google Play hace falta firmar una versión de lanzamiento con una clave privada.

## iPhone

Abre `frontend/ios/App/App.xcodeproj` con Xcode o ejecuta `npm run mobile:ios` con `REACT_APP_BACKEND_URL` configurada. Para instalar en teléfonos de prueba mediante TestFlight hay que configurar la cuenta Apple Developer, firma, identificador `com.ifixflow.app` y App Store Connect. La publicación en App Store requiere además revisión de Apple. No hay credenciales ni certificados de firma en este repositorio.

## Comprobaciones antes de distribuir

Prueba en teléfonos reales el inicio de sesión, las fotos de cámara y galería, el escaneo de IMEI/serie, el visor y la función de compartir PDF, los enlaces de seguimiento, las etiquetas y el aspecto de cada pantalla. La impresión directa de etiquetas todavía depende de `window.print()` y requiere validación en los dispositivos y las impresoras que se utilizarán.

La app nativa muestra el estado de suscripción sin ofrecer pagos dentro de la app. Antes de enviarla a las tiendas, revisa las reglas de compra de servicios digitales de Apple y Google para el modelo de suscripción de iFixFlow.
