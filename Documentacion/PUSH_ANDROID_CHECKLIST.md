# Push Android - Checklist EcoVigia

## 1) Firebase
- App Android registrada con package `com.ecovigia.app`.
- Archivo `google-services.json` en `android/app/google-services.json`.

## 2) Base de datos Supabase
- Ejecutar script: `supabase/sql/device_push_tokens.sql`.
- Confirmar que existe la tabla `public.device_push_tokens`.

## 3) Funcion `send-push` en Supabase

Crear y desplegar la funcion:

```bash
supabase functions deploy send-push
```

Secrets requeridos en Supabase:

```bash
supabase secrets set PUSH_WEBHOOK_KEY='tu_token_privado'
supabase secrets set FIREBASE_PROJECT_ID='tu-proyecto-firebase'
supabase secrets set FIREBASE_CLIENT_EMAIL='firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com'
supabase secrets set FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA\n-----END PRIVATE KEY-----\n'
```

La URL final del webhook queda asi:

```text
https://TU_PROJECT_REF.supabase.co/functions/v1/send-push
```

## 4) Variables de entorno del frontend
Agregar en `.env.local`:

```env
VITE_PUSH_WEBHOOK_URL="https://TU_PROJECT_REF.supabase.co/functions/v1/send-push"
VITE_PUSH_WEBHOOK_KEY="token_opcional_para_proteger_endpoint"
```

> Si no defines `VITE_PUSH_WEBHOOK_URL`, el registro de token funciona, pero no se enviaran pushes remotos.

## 5) Flujo implementado en la app
- Al iniciar sesión en Android se solicita permiso push y se registra token.
- El token se guarda/actualiza en `device_push_tokens`.
- Al crear:
  - noticia (`news`),
  - evento (`education_events`),
  - reporte de riesgo (`reports.type='emergency'`),
  se llama al webhook de push (`VITE_PUSH_WEBHOOK_URL`).

## 6) Prueba minima
1. Iniciar sesión en Android.
2. Revisar tabla `device_push_tokens` (debe aparecer token).
3. Crear noticia/evento/reporte riesgo.
4. Verificar que la funcion `send-push` responde y que FCM envia la notificacion.
