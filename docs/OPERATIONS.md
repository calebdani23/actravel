# Operación AC Travel MVP

## Objetivo

Este documento define la rutina mínima para operar el MVP en producción y responder rápido ante fallos.

## Arquitectura operativa actual

- **Web/app**: Vercel
- **Base de datos, Auth, Storage**: Supabase
- **Correo transaccional**: Resend
- **Correo empresarial**: proveedor externo del dominio (ej. Hostinger)
- **Canal principal comercial**: WhatsApp
- **Fuente de verdad**: Supabase

> Meta se usa en producción para atribución y medición del funnel web. WhatsApp sigue siendo un número manual; este MVP no depende de WhatsApp Cloud API ni de leer el contenido de mensajes inbound para operar campañas.

> En producción, los leads se gestionan en Supabase y en el panel admin. Google Sheets puede quedar desactivado si no se configuraron sus variables en Vercel.

## Revisión diaria (10 minutos)

### 1. Dashboard

Abrir `/admin/dashboard` y revisar:

- leads del día
- emails fallidos
- incidentes abiertos
- clicks de WhatsApp
- alertas visibles

### 2. Logs

Abrir `/admin/logs` y revisar:

- `notification_logs`
- estados `failed`, `queued`, `ambiguous`

Acción esperada:

- reintentar si aplica
- dejar responsable si algo no se resuelve en el momento

### 3. Leads

Abrir `/admin/leads` y revisar:

- leads nuevos
- leads sin asignar
- leads sin seguimiento
- leads manuales o provenientes del sitio

Acción esperada:

- asignar
- mover estado
- dejar nota
- registrar seguimiento

### 4. Correo operativo

Revisar el inbox operativo configurado en `EMAIL_ADMIN`:

- llegaron correos de cotización
- no hay rebotes
- no hay errores extraños del remitente
- si el correo no llegó pero el lead sí existe, revisar `notification_logs` antes de asumir pérdida de la cotización

## Revisión semanal (20–30 minutos)

### 1. Smoke test real

Enviar una cotización real de prueba y confirmar:

- se guarda el lead
- aparece en admin
- llega el email admin
- llega el email cliente
- CTA de WhatsApp funciona

### 2. Calidad de datos

Abrir `/admin/data-quality` y revisar:

- duplicados por teléfono/email
- eventos `contact_identity_ambiguous`
- backlog de limpieza

### 3. Catálogo

Revisar:

- destinos
- servicios
- paquetes
- promociones
- relaciones entre verticales
- imágenes
- detalle público

### 4. Infraestructura

- último deploy en Vercel
- estado de Supabase
- estado del dominio de envío en Resend

## Qué monitorear por proveedor

### Vercel

- último deploy productivo
- funciones con errores
- rutas API críticas:
  - `/api/quote-request`
  - `/api/whatsapp-click`

### Supabase

- login admin funcionando
- inserciones recientes de leads/cotizaciones
- buckets correctos:
  - `catalog-media`
  - `documents`
  - `payment-proofs`
- advisors conocidos

### Resend

- dominio/subdominio en estado `Verified`
- `EMAIL_FROM` correcto
- `EMAIL_ADMIN` apunta al inbox interno vigente
- sin rebotes ni rechazos extraños

### WhatsApp

- CTA públicos abren número correcto
- la operación comercial sigue manual en el número vigente

### Meta

- Events Manager recibe `ViewContent`, `InitiateCheckout`, `Lead` y `Contact`
- Ads Manager puede atribuir `Lead` sin depender de mensajes inbound
- si CAPI está habilitado, la prueba semanal muestra deduplicación sana entre browser Pixel y server Lead

## Incidentes comunes y primera respuesta

### La cotización no entra

1. Revisar logs de Vercel para `/api/quote-request`
2. Confirmar si existe `lead` o `quote_request` en Supabase
3. Revisar `/admin/logs`
4. Si el lead existe, continuar operación manual

### El lead se guardó, pero no llegó el correo

1. Revisar `notification_logs`
2. Confirmar `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN`
3. Si el estado es `skipped`, `failed` o `ambiguous`, continuar el seguimiento del lead manualmente porque la persistencia ya ocurrió
4. Reintentar desde `/admin/logs` si aplica

### No cargan publicaciones del catálogo

1. Revisar `/admin/catalog/...`
2. Confirmar migraciones aplicadas en Supabase
3. Revisar si hubo cambio reciente en relaciones o columnas

## Secretos y accesos sensibles

Nunca exponer ni compartir fuera del entorno seguro:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_DB_URL`
- `RESEND_API_KEY`
- `WHATSAPP_CLICK_HASH_SALT`
- `PUBLIC_RATE_LIMIT_SALT`
- credenciales bootstrap
- cookies/sesiones admin

## Deudas técnicas no bloqueantes conocidas

- `middleware` → `proxy` pendiente en Next.js
- leaked password protection pendiente si el plan de Supabase no lo permite
- E2E automáticos aún no cubren todo el flujo productivo
- optimizaciones de performance/DB pueden hacerse después del lanzamiento

## Rutina mínima recomendada

### Todos los días

- dashboard
- logs
- leads
- inbox operativo

### Todas las semanas

- una cotización real de prueba
- revisión de data quality
- revisión de catálogo
- revisión de despliegue e integraciones
