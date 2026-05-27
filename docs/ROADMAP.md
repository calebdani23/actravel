# Roadmap AC Travel MVP

## MVP v1

1. ✅ Bloque 1 — Setup base: Next.js, TypeScript, Tailwind, shadcn/ui, rutas `/es`, `/en`, admin base, Supabase scaffolding y documentación.
2. ✅ Bloque 2 — Identidad visual: tokens, tema, Navbar, Footer, WhatsApp CTA, LanguageSwitch y CurrencySwitch.
3. ✅ Bloque 3 — Sitio público: home completa, servicios, paquetes, promociones, destinos, cotizar, nosotros, contacto y legales provisionales.
4. ✅ Bloque 4 — Supabase: migraciones, catálogos, roles, RLS, seed y bootstrap admin/asesor completados con credenciales reales fuera de git.
5. ✅ Bloque 5 — Formulario y leads: QuoteForm, validación Zod y creación server-only de contacto/lead/quote_request/evento; email y Google Sheets quedan como logs de frontera seguros hasta contar con credenciales e integraciones reales.
6. ✅ Bloque 6 — Panel interno: login funcional, dashboard, leads, notas, estados, catálogo, pagos, reservas, documentos, plantillas y logs ligeros; upload completo de archivos y refresh proactivo de sesión quedan diferidos.
7. ✅ Bloque 7 — WhatsApp tracking: endpoint fail-open de registro y redirección a `wa.me`, CTAs públicos cableados y hash de IP opcional con salt server-only.
8. ✅ Bloque 8 — Notificaciones: envío real de emails de cotización con Resend, templates bilingües code-owned y logs `queued`/`sent`/`failed`/`skipped` sin bloquear el formulario.
9. ✅ Bloque 9 — Google Sheets: implementación server-only completa para copiar leads Supabase → Google Sheets con logs; sincronización live verificada con cotización real.
10. ✅ Bloque 10 — QA y lanzamiento: verificación final local completada; estado de lanzamiento listo para MVP.

## Estado de lanzamiento MVP

- **Ready for MVP launch**: la app compila, lint/test pasan, los smoke checks públicos/admin básicos responden y Google Sheets live sync fue confirmado.
- **Google Sheets operativo**: una cotización real persistió en Supabase y registró `sheet_sync_logs.status = success` con fila escrita en la pestaña configurada.

## Fase 2

- WhatsApp Cloud API y webhooks de mensajes.
- Bandeja de conversaciones.
- Mercado Pago y Stripe con webhooks.
- Google Drive API.
- Generación de PDFs.
- Reportes avanzados.
- Calendario integrado.

## Fase 3

- Bot de calificación inicial.
- Portal de cliente.
- Motor de agenda propio.
- Automatizaciones comerciales.
- Scoring de leads.
- IA para cotizaciones y respuestas.
- APIs de sugerencias de viaje.
- Dashboard financiero.
- Gestión avanzada de proveedores.
