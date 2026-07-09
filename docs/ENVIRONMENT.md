# Entorno AC Travel

## Configuración local

1. Copiar `.env.example` a `.env.local`.
2. Completar solo las variables necesarias para el bloque en desarrollo.
3. No guardar secretos reales en git. `.env.local` está cubierto por `.gitignore` mediante `.env.*`.

## Variables

### Sitio

- `NEXT_PUBLIC_SITE_URL`: URL pública del sitio. En local puede ser `http://localhost:3000`.
- `NEXT_PUBLIC_DEFAULT_LOCALE`: idioma inicial, `es`.
- `NEXT_PUBLIC_DEFAULT_CURRENCY`: moneda inicial, `MXN`.

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key pública para cliente browser y SSR.
- `SUPABASE_SECRET_KEY`: secret key server-only para tareas administrativas/bootstrap y provisioning interno de staff desde `/admin/staff`. Nunca usar en cliente ni exponerlo al browser.
- `SUPABASE_DB_URL`: cadena Postgres para ejecutar `npm run db:seed` desde un entorno seguro.
- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`: credenciales locales/hosting para crear el primer administrador con `npm run db:bootstrap-admin`.
- `BOOTSTRAP_ASESOR_EMAIL`, `BOOTSTRAP_ASESOR_PASSWORD`, `BOOTSTRAP_ASESOR_NAME`: credenciales locales/hosting para crear el asesor principal.

Para crear el primer usuario administrador, configura `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en un entorno local/hosting seguro y ejecuta `npm run db:bootstrap-admin`. El asesor principal se crea si también existen `BOOTSTRAP_ASESOR_EMAIL` y `BOOTSTRAP_ASESOR_PASSWORD`. El script carga `.env.local` y luego `.env` automáticamente si las variables no vienen ya del entorno. No inventar ni commitear estas credenciales.

`/admin/staff` también depende de `SUPABASE_SECRET_KEY` porque usa Supabase Auth Admin APIs server-side para crear usuarios, sincronizar `profiles/profile_roles` y registrar auditoría. Si falta esta variable, el provisioning interno debe fallar claramente en servidor.

> Desviación deliberada del prompt maestro: aunque el prompt histórico menciona los nombres legacy de Supabase, este proyecto usa exclusivamente el modelo moderno configurado por el usuario: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.

### WhatsApp

- `NEXT_PUBLIC_WHATSAPP_PHONE`: número internacional sin símbolos para links `wa.me`. Valor base: `529988453455`.
- `WHATSAPP_CLICK_HASH_SALT`: secreto server-only opcional para hashear IPs en el tracking de clicks. Si no está configurado, no se guarda IP ni hash.
- `META_WHATSAPP_VERIFY_TOKEN`: token compartido para validar el `hub.challenge` del webhook Meta/WhatsApp.
- `META_APP_SECRET`: app secret server-only usado para validar `X-Hub-Signature-256` del webhook inbound.
- `META_WHATSAPP_PHONE_NUMBER_ID`: `phone_number_id` exacto aceptado por `/api/meta/whatsapp`.
- `WHATSAPP_INBOUND_TRIGGER_TEXTS`: lista opcional de textos permitidos para captura inbound automática. Acepta separadores por coma, `|` o salto de línea. El valor por defecto cubre `!Hola! Quiero mas informacion.` con normalización tolerante a acentos/puntuación.
- `WHATSAPP_INBOUND_RAW_PAYLOAD_LIMIT_BYTES`: límite opcional de bytes serializados retenidos en `whatsapp_inbound_messages.raw_payload`; valor recomendado `12000`.

El webhook inbound falla en modo cerrado si falta `META_APP_SECRET` o `META_WHATSAPP_PHONE_NUMBER_ID`. Las solicitudes con firma inválida no deben persistir payloads. Los leads inbound/manual no disparan emails ni Google Sheets de cotización en este cambio.

### Email

- `RESEND_API_KEY`: API key server-only de Resend para notificaciones reales del MVP.
- `EMAIL_FROM`: remitente verificado en Resend.
- `EMAIL_ADMIN`: correo receptor para avisos internos.

Bloque 8 usa Resend exclusivamente para emails de cotización. Si falta `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN` o el email del cliente, la solicitud de cotización se guarda de todos modos y `notification_logs` registra `skipped` o `failed` sin exponer respuestas del proveedor al cliente.

### Google Sheets

- `GOOGLE_SHEETS_CLIENT_EMAIL`: email del service account.
- `GOOGLE_SHEETS_PRIVATE_KEY`: private key del service account. Mantener saltos de línea escapados (`\\n`) según el provider de hosting; la app los normaliza solo en servidor.
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID de la hoja destino.
- `GOOGLE_SHEETS_LEADS_TAB`: nombre de la pestaña de leads.

Bloque 9 escribe filas reales desde el flujo server-side de cotización cuando las cuatro variables anteriores existen y el spreadsheet está compartido con el service account. Si falta configuración o Google Sheets falla, la cotización se guarda de todos modos y `sheet_sync_logs` queda en `skipped` o `failed` sin exponer secretos ni errores del proveedor al visitante.

> Estado actual de lanzamiento: con Google Sheets API habilitada, una cotización real confirmó escritura live en la hoja destino y `sheet_sync_logs.status = success`.

## Notas de seguridad

- No exponer `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, credenciales bootstrap, claves de email o claves de Google en componentes cliente.
- Supabase Auth usa perfiles/roles en `profiles`, `roles` y `profile_roles`; RLS solo permite lectura anónima de catálogo publicado.
- El alta/baja de usuarios en la app no crea, suspende ni elimina mailboxs de Hostinger; esa operación sigue manual en hPanel.
- El toggle activo/inactivo de `/admin/staff` solo controla autorización interna vía `profiles.is_active`. En este MVP no se sincroniza con baneos/unbaneos de Supabase Auth.
