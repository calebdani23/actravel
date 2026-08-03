# Entorno AC Travel

## Configuración local

1. Copiar `.env.example` a `.env.local`.
2. Completar solo las variables necesarias para el bloque en desarrollo.
3. No guardar secretos reales en git. `.env.local` está cubierto por `.gitignore` mediante `.env.*`.

## Variables

### Sitio

- `NEXT_PUBLIC_SITE_URL`: URL pública del sitio. En local puede ser `http://localhost:3000`. También se usa para convertir CTAs trackeados de WhatsApp a URLs absolutas dentro de correos, porque los clientes de email no resuelven de forma confiable rutas relativas.
- Para el smoke post-deploy, `NEXT_PUBLIC_SITE_URL` debe ser un origin limpio (`https://www.actravel.com`) sin path, query ni hash; de ahí dependen `robots`, las URLs locales de home/quote/`sitemap.xml`, canonical URLs, assets absolutos de email y CTAs absolutos trackeados de WhatsApp.
- `NEXT_PUBLIC_META_PIXEL_ID`: pixel público de Meta/Facebook para el sitio. Si existe, el layout público localizado carga el base pixel fuera de `/admin`, dispara `PageView` en carga inicial y cambios de ruta App Router, `ViewContent` en detalles públicos, `InitiateCheckout` al abrir cotización, `Lead` al enviar exitosamente la cotización y `Contact` al hacer click en el CTA centralizado de WhatsApp. El browser también conserva first-touch marketing context (`utm_*`, `fbclid`, `landingPath`, `referrer`, `_fbc`, `_fbp`) para enviarlo como contexto cliente/advisory y persistirlo en Supabase sin tratarlo como verdad canónica del sistema. Valor/documentación de referencia para este MVP: `1929420407723543`.
- `META_CONVERSIONS_API_ACCESS_TOKEN`: token server-only opcional para enviar el evento crítico `Lead` por Meta Conversions API después de guardar exitosamente la cotización. Si falta este token o el pixel público, la app omite CAPI sin romper la persistencia principal.
- `META_CONVERSIONS_TEST_EVENT_CODE`: código opcional de Meta para validar eventos controlados en staging/producción sin cambiar la lógica de negocio.
- `NEXT_PUBLIC_DEFAULT_LOCALE`: idioma inicial, `es`.
- `NEXT_PUBLIC_DEFAULT_CURRENCY`: moneda inicial, `MXN`.

### Modelo operativo Meta / WhatsApp

- **Sí** usamos Meta para atribución y medición comercial real: visitas, detalles, inicio de cotización, envío exitoso y click a WhatsApp.
- **Sí** persistimos atribución útil en Supabase dentro del payload de cada `quote_request`; esto permite revisar campañas aunque la conversación posterior siga fuera del sitio.
- **No** conectamos WhatsApp Cloud API en este MVP. El número operativo actual se mantiene manual y los CTAs públicos siguen abriendo `wa.me`.
- **No** dependemos del contenido de mensajes inbound de WhatsApp para medir campañas. La lectura operativa se hace desde Ads Manager/Event Manager más la persistencia del lead en Supabase.
- Para deduplicación de `Lead`, el browser y el server comparten `metaLeadEventId`; así Pixel y CAPI pueden coexistir sin inflar conversiones. En CAPI el server usa URL/event context propios de la request y ya no promueve `_fbp`, `_fbc`, landing URL o referrer enviados por hidden fields como señales confiables.

### Lectura operativa mínima en Meta

1. Confirmar en **Events Manager** que `ViewContent`, `InitiateCheckout`, `Lead` y `Contact` llegan con volumen razonable.
2. Confirmar en **Ads Manager** que las campañas pueden atribuir `Lead` sin depender de chats inbound.
3. Si se habilita `META_CONVERSIONS_TEST_EVENT_CODE`, enviar una cotización controlada y validar recepción del evento server-side antes de retirar el código de prueba.
4. Si CAPI falla o no está configurado, la cotización sigue entrando a Supabase; revisar el payload persistido y los logs de servidor antes de tocar operación comercial.

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`: URL pública del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key pública para cliente browser y SSR.
- `SUPABASE_SECRET_KEY`: secret key server-only para tareas administrativas/bootstrap y provisioning interno de staff desde `/admin/staff`. Nunca usar en cliente ni exponerlo al browser.
- `SUPABASE_DB_URL`: cadena Postgres para ejecutar `npm run db:seed` desde un entorno seguro.
- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`: credenciales locales/hosting para crear el primer administrador con `npm run db:bootstrap-admin`.
- `BOOTSTRAP_ASESOR_EMAIL`, `BOOTSTRAP_ASESOR_PASSWORD`, `BOOTSTRAP_ASESOR_NAME`: credenciales locales/hosting para crear el asesor principal.
- `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`: credenciales opcionales dedicadas para Playwright. Si faltan, los E2E reutilizan `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`.

Para crear el primer usuario administrador, configura `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en un entorno local/hosting seguro y ejecuta `npm run db:bootstrap-admin`. El asesor principal se crea si también existen `BOOTSTRAP_ASESOR_EMAIL` y `BOOTSTRAP_ASESOR_PASSWORD`. El script carga `.env.local` y luego `.env` automáticamente si las variables no vienen ya del entorno. No inventar ni commitear estas credenciales.

Las cotizaciones comerciales standalone no agregan variables de entorno. El browser deriva el endpoint TUS desde `NEXT_PUBLIC_SUPABASE_URL`: para proyectos hosted usa `https://<project-ref>.storage.supabase.co/storage/v1/upload/resumable` y para local/custom conserva el origin con `/storage/v1/upload/resumable`. La carga usa el JWT de la sesión y la publishable key; nunca expone `SUPABASE_SECRET_KEY`. El hosting debe permitir ese origin de Storage y HTTPS/CORS normales del proyecto.

El despliegue de Cotizaciones requiere `0053`–`0056`, `0058`, `0059` y `0060`; `0057` puede estar presente o ausente porque `0060` repite su revocación de escritura directa. `0059` reserva el registro con PDF inicial y `0060` elimina los escritores de compatibilidad. Los PDF de hasta 20 MiB viajan browser → Storage por TUS en chunks de 6 MiB; Server Actions reciben solo metadatos o un UUID de intent y el servidor descarga el objeto reservado para validar MIME, tamaño, firma `%PDF-` y SHA-256 confiable.

`/admin/staff` también depende de `SUPABASE_SECRET_KEY` porque usa Supabase Auth Admin APIs server-side para crear usuarios, sincronizar `profiles/profile_roles` y registrar auditoría. Si falta esta variable, el provisioning interno debe fallar claramente en servidor.

`/admin/account` no usa `SUPABASE_SECRET_KEY` para cambio self-service de correo: el usuario autenticado solicita el cambio con su propia sesión Supabase vía `auth.updateUser({ email })`, por lo que la verificación del buzón sigue del lado de Supabase Auth.

Para que el cambio self-service de correo funcione correctamente en hosting/producción:

- Supabase Auth debe tener configurado su proveedor de emails transaccionales.
- Conviene mantener habilitado **Secure Email Change** para cuentas internas; así Supabase puede requerir confirmación desde el correo actual y el nuevo.
- Si después se agrega `emailRedirectTo`, la URL de retorno deberá estar permitida en el allow-list de redirects de Supabase Auth.

> Desviación deliberada del prompt maestro: aunque el prompt histórico menciona los nombres legacy de Supabase, este proyecto usa exclusivamente el modelo moderno configurado por el usuario: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.

### WhatsApp

- `NEXT_PUBLIC_WHATSAPP_PHONE`: número internacional sin símbolos para links `wa.me`. Valor base: `529988453455`.
- `WHATSAPP_CLICK_HASH_SALT`: secreto server-only opcional para hashear IPs en el tracking de clicks. Si no está configurado, no se guarda IP ni hash.

El modelo vigente mantiene WhatsApp como canal manual: el sitio mide clicks y continuidad del funnel, pero no intenta leer ni automatizar el contenido de conversaciones inbound.

### Email

- `RESEND_API_KEY`: API key server-only de Resend para notificaciones reales del MVP.
- `EMAIL_FROM`: remitente verificado en Resend. Debe usar un dominio/remitente validado en Resend antes de habilitar envíos reales.
- `EMAIL_ADMIN`: inbox interno que recibe la notificación administrativa de cada cotización. Este valor es la única frontera de configuración para el destinatario interno; cambiarlo implica actualizar el entorno de hosting y aplicar el redeploy/restart que corresponda.
- El smoke `npm run test:post-deploy-smoke` valida que `EMAIL_FROM` y `EMAIL_ADMIN` existan y contengan direcciones de email válidas antes de aprobar un deploy.

Bloque 8 usa Resend exclusivamente para emails de cotización. Si falta `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN` o el email del cliente, la solicitud de cotización se guarda de todos modos y `notification_logs` registra `skipped`, `failed` o `ambiguous` sin exponer respuestas del proveedor al cliente.

Los correos de cotización usan dos variantes dentro de un shell compartido de AC Travel:

- aviso interno para `EMAIL_ADMIN`, optimizado para triage operativo del lead;
- confirmación al cliente, optimizada para confianza, siguientes pasos y CTA de WhatsApp.

Ningún fallo de email debe bloquear la persistencia del lead/cotización; la revisión operativa se hace desde `notification_logs` y el inbox configurado en `EMAIL_ADMIN`.

### Local E2E safety switch

- `E2E_DISABLE_EXTERNAL_BOUNDARIES`: cuando vale `1`, `true`, `yes` u `on`, la app omite envíos reales de Resend y Meta Conversions API, pero mantiene el flujo normal de UI, validación, persistencia en Supabase, tracking redirect de WhatsApp y visibilidad en `/admin`.
- `npm run test:e2e` activa este switch automáticamente dentro del `webServer` de Playwright para que una máquina local con secretos reales no dispare tráfico externo por accidente.

### Google Sheets retirement

- Google Sheets ya no forma parte del runtime productivo ni del modelo operativo diario.
- No configurar `GOOGLE_SHEETS_*` en nuevos entornos; pueden eliminarse del hosting cuando ya no sean necesarias para auditoría externa.
- `sheet_sync_logs` se conserva solo como historial de integraciones retiradas. No se crean nuevas filas desde el intake actual y ya no existe retry operativo desde `/admin`.

## Notas de seguridad

- No exponer `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, credenciales bootstrap, claves de email o secretos retirados de integraciones legacy en componentes cliente.
- No exponer `META_CONVERSIONS_API_ACCESS_TOKEN` ni `META_CONVERSIONS_TEST_EVENT_CODE` en componentes cliente.
- Supabase Auth usa perfiles/roles en `profiles`, `roles` y `profile_roles`; RLS solo permite lectura anónima de catálogo publicado.
- El alta/baja de usuarios en la app no crea, suspende ni elimina mailboxs de Hostinger; esa operación sigue manual en hPanel.
- El cambio self-service de correo en `/admin/account` tampoco crea, renombra ni elimina mailboxs de Hostinger; solo inicia el flujo verificado de Supabase Auth para el login de la app.
- El toggle activo/inactivo de `/admin/staff` solo controla autorización interna vía `profiles.is_active`. En este MVP no se sincroniza con baneos/unbaneos de Supabase Auth.
