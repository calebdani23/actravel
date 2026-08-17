# Progreso AC Travel Mx MVP

## 2026-08-17 — Week 01 evidence packet

The bounded baseline reconciliation packet is recorded under `openspec/changes/baseline-reconcile-operational-closure/packet/`. Exact provider ref/URL identity passed a read-only preflight; remote ledger/catalog/policy evidence was captured without mutation. Guarded lint, build, and quote-notification tests passed with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`; the build-owned `next-env.d.ts` change was restored from its known clean preimage. Tracked database types, migrations, manifests, and `docs/about/helps/intakes/image.png` were preserved.

The sole final gate is **BLOCKED**. Rehearsal is `unavailable` because no approved disposable target, authorization, tooling/cost, credentials, backup, cleanup proof, or independent sign-off was supplied. Week 01 remains active and `0061+` remains unsafe.

## Estado general

Bloques 1–10 completados en alcance MVP actual. La operación activa queda consolidada sobre Supabase y efectos no-Sheets; Google Sheets fue retirado de la ruta productiva sin borrar historial previo. El proyecto permanece en estado **ready for MVP launch** con validación local final pasada.

## Completado

- ✅ Confirmado que el repositorio no tenía una app Next.js existente: no había `package.json`, `app/`, `src/` ni archivos de configuración Next/Tailwind en la raíz.
- ✅ Creado proyecto base Next.js con TypeScript, ESLint, Tailwind CSS y App Router.
- ✅ Preparadas rutas públicas base `/es` y `/en` mediante `app/[locale]`.
- ✅ Agregados placeholders mínimos para las rutas públicas del prompt maestro en español e inglés, incluyendo segmentos ingleses correctos como `/en/packages` y `/en/deals`.
- ✅ Preparadas rutas admin `/admin/login` y `/admin/dashboard` con layout administrativo.
- ✅ Configurado shadcn/ui con estilo `new-york`, `neutral`, CSS variables y componentes base `Button`/`Card`.
- ✅ Instaladas dependencias de preparación: Supabase, React Hook Form, Zod, TanStack Table y Framer Motion.
- ✅ Agregado scaffolding Supabase para cliente browser, server y service role sin secretos.
- ✅ Agregado formulario admin mínimo que llama Supabase Auth si existen variables públicas y muestra fallback claro si no están configuradas.
- ✅ Agregado guard ligero al dashboard admin: muestra mensaje/setup o pide login antes de presentar el placeholder.
- ✅ Mejorado manejo de idioma para rutas públicas: el cliente actualiza `document.documentElement.lang` según `/es` o `/en`.
- ✅ Creado `.env.example` con las variables del prompt maestro.
- ✅ Creada estructura inicial de carpetas para `app`, `components`, `lib`, `db`, `public/images` y `public/brand`.
- ✅ Creados placeholders de API para futuros bloques sin implementar lógica fuera de alcance.
- ✅ Refinados tokens visuales de marca (`--ac-orange`, `--ac-red`, `--ac-light-bg`, `--ac-blue`) con neutros cálidos y suaves para evitar saturación.
- ✅ Extraído el shell público en componentes modulares: `Navbar`, `Footer`, `WhatsAppCta`, `LanguageSwitch`, `CurrencySwitch` y `BrandMark`.
- ✅ Agregado switch de idioma que conserva rutas conocidas entre español e inglés y vuelve al home localizado si no reconoce el mapeo.
- ✅ Agregado switch de moneda cliente como preferencia visual en `localStorage`, sin conversión ni lógica de precios.
- ✅ Integrado CTA directo `wa.me` en navbar, footer y botón flotante móvil-first, sin tracking aún.
- ✅ Pulido visual inicial de home y placeholders sin implementar contenido de negocio completo del Bloque 3.
- ✅ Confirmada conexión con Supabase vía MCP; el proyecto responde correctamente y el esquema `public` aún no tiene tablas creadas.
- ✅ Implementado Bloque 3 del sitio público con páginas bilingües explícitas para home, servicios, paquetes, promociones, detalle de promoción, destinos, detalle de destino, cotizar, nosotros/about, contacto/contact y legales provisionales.
- ✅ Centralizado contenido público estático bilingüe para poder migrarlo después a Supabase sin rehacer la UI.
- ✅ Agregados componentes reutilizables para secciones públicas, tarjetas, bloques de confianza, vista previa de cotización y aviso legal.
- ✅ Verificado que segmentos cruzados inválidos respondan `404`, por ejemplo `/es/services` y `/en/servicios`.
- ✅ Implementado Bloque 4: migraciones Supabase de identidad, CRM, catálogo, operaciones, logs, storage y RLS; seed idempotente; bootstrap admin opcional; scripts de base de datos; tipos Supabase y helpers de roles.
- ✅ Aplicadas correcciones de seguridad/rendimiento posteriores al Bloque 4: `0009_security_advisor_fixes.sql`, `0010_fk_indexes.sql`, `0011_restrict_helper_function_execute.sql` y `0012_grant_authenticated_helper_execute.sql`.
- ✅ Corregida la regresión de RLS donde `authenticated` no podía ejecutar `has_role`, `is_admin` ni `is_assigned_lead` después de restringir los grants de helpers.
- ✅ Alineados app, bootstrap y documentación al modelo moderno de llaves Supabase: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`, como desviación deliberada del prompt maestro legacy.
- ✅ Ejecutado bootstrap seguro con variables locales: existen usuarios Auth, perfiles activos y asignaciones de rol para `admin` y `asesor`.
- ✅ Implementado Bloque 5: QuoteForm bilingüe en `/es/cotizar` y `/en/quote`, validación Zod, API server-only `/api/quote-request`, normalización/dedupe de contacto por WhatsApp/email, creación de `contacts`, `leads`, `quote_requests` y `lead_events`.
- ✅ Agregados logs de frontera seguros para email en `notification_logs`; `sheet_sync_logs` se conserva únicamente como historial legacy de la integración retirada.
- ✅ Implementado Bloque 6: panel interno protegido por Supabase Auth/RLS con shell y navegación por rol, dashboard, listado/detalle de leads, acciones básicas de estado/asignación/notas, CRUD MVP de catálogo, plantillas, pagos, reservas, documentos y logs ligeros de lectura.
- ✅ Corregida la política de lectura de objetos privados para que el acceso autenticado de staff no aplique a cualquier bucket: catálogo sigue legible para staff, y `documents`/`payment-proofs` quedan limitados a `admin`, `operaciones` y/o `finanzas` según el bucket privado.
- ✅ Alineado `/admin/leads` con la visibilidad prevista de navegación: acceso de página para `admin` y `asesor`; otros roles dependen de sus módulos dedicados y de RLS.
- ✅ Implementado Bloque 7: `/api/whatsapp-click` registra clicks de WhatsApp de forma fail-open y redirige a `wa.me`; CTAs públicos usan links trackeados y el hash de IP solo se guarda si existe `WHATSAPP_CLICK_HASH_SALT`.
- ✅ Implementado Bloque 8: emails de cotización reales con Resend desde frontera server-only, templates bilingües, logs de notificación y manejo no bloqueante de errores/ausencia de configuración.
- ✅ Retirado Google Sheets de la ruta server-side de cotización y de las superficies admin/ops activas; las cotizaciones siguen persistiendo en Supabase con notificaciones/email, tracking de WhatsApp y Meta intactos.
- ✅ Actualizada la documentación operativa y de entorno para declarar a Supabase como fuente única de verdad y a `sheet_sync_logs` como historial legacy sin retry operativo.
- ✅ Implementado P0.3 de seguridad/sesión: middleware coarse para `/admin/:path*` que refresca cookies Supabase con `auth.getUser()`, redirige visitantes sin sesión a `/admin/login`, deja la decisión de redirigir desde `/admin/login` al chequeo completo de `getAdminSession()` para evitar loops con usuarios sin rol/perfil válido, conserva los guards de roles en páginas/actions y agrega headers base (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- ✅ Cerrado P1.6: las acciones de plantillas en lead detail ahora tienen cobertura runtime para WhatsApp trackeado, cuerpo codificado, copiado de contenido y estado deshabilitado de email cuando falta correo; se agregó `npm run test:lead-template-actions`.
- ✅ Corregidos los remanentes previos a P1.8 más críticos: `npm run build` volvió a verde; pagos/documentos ya soportan reemplazo real de archivo con limpieza best-effort del objeto anterior/al borrar; el catálogo público ahora sí cae a fallback estático utilizable cuando Supabase no devuelve contenido; la búsqueda de leads amplió cobertura por términos/quote payload; y el formulario guarda borrador local con señal mínima de abandono/fricción para recuperación posterior.
- ✅ Corregido el home público para consumir catálogo vivo publicado en destinos/promociones/servicios, de modo que las publicaciones admin ya se reflejan en la portada.
- ✅ Cerrado P1.8 con una mejora MVP coherente: admin de catálogo ya permite subir hero/thumbnail a `catalog-media` o guardar URLs administradas con validación/normalización server-side, limpiar/reemplazar media previa con cleanup best-effort, conservar publicación al editar, y usar thumbnail en cards + hero en detalle cuando existe.
- ✅ Implementada la segunda etapa profunda de P2.3 sin merges destructivos: nueva vista admin `/admin/data-quality` con auditoría exacta de duplicados por email/teléfono, conteo de eventos `contact_identity_ambiguous`, dependencias por contacto para planear merges, recomendación canónica determinista y explicación explícita de por qué la unicidad dura sigue diferida hasta contar con playbook transaccional y backlog limpio.
- ✅ Implementado provisioning interno de usuarios `admin` y `asesor`: nueva vista `/admin/staff`, alta server-side con Supabase Auth Admin API, sincronización a `profiles` + `profile_roles`, auditoría `admin_account_events`, guardrails contra self-demotion/self-deactivation/last-admin lockout, filtro compartido de asesores activos para selectores y ruta `/admin/account` para cambio self-service de contraseña.
- ✅ Extendido `/admin/account` con cambio self-service de correo: validación de correo + confirmación, uso seguro de `supabase.auth.updateUser({ email })` en contexto del usuario autenticado, mensajería de verificación pendiente y auditoría `staff_email_change_requested` sin afirmar falsamente que el cambio ya terminó.
- ✅ Completada la gestión independiente de cotizaciones comerciales en `/admin/quotes`, `/admin/quotes/new` y `/admin/quotes/[id]`: portafolio filtrable y paginado, versiones inmutables, PDF canónico privado, ciclo de vida transaccional, actividad auditada y separación explícita respecto a Solicitudes del cliente.
- ✅ Integradas Cotizaciones con Contacto 360 y detalle de oportunidad sin conservar formularios de mutación embebidos; Operaciones y Finanzas tienen lectura acotada y handoff explícito de la versión aceptada hacia reservas/pagos, sin creación automática.
- ✅ Proyectados los PDF canónicos en Documentos como registros de solo lectura; las acciones genéricas rechazan edición/borrado de documentos ligados a cotizaciones antes de tocar Storage.
- ✅ Añadido el cutover `0057_quote_rpc_cutover.sql`: elimina políticas/grants de escritura directa sobre `quote_versions`, conserva lectura RLS y mantiene la firma legacy de aceptación como wrapper seguro sobre `crm_accept_quote` con gate de PDF y control transaccional.
- ✅ Implementado registro obligatorio de cotización con PDF inicial: `0059` reserva IDs/ruta sin crear cabecera y finaliza atómicamente una V1 lista; `0060` elimina `crm_create_quote`, linking legado nuevo, wrapper de aceptación y toda escritura directa de versiones, con invariant diferido para nuevas cabeceras.
- ✅ Migradas las cargas de PDF inicial y de versiones a TUS resumible directo browser → Supabase Storage (6 MiB por chunk, máximo 20 MiB, sin upsert), con progreso/cancelación/reanudación y Server Actions sin bytes que descargan y verifican el objeto antes de finalizar.

## En proceso

- P0.3 queda documentado para el alcance MVP actual: se revisó un snapshot fresco de Supabase Security Advisors el 2026-07-20; `auth_leaked_password_protection` sigue diferido como limitación externa del plan actual, y los warnings `SECURITY DEFINER` de `has_role`, `is_admin` e `is_assigned_lead` permanecen aceptados para el modelo RLS vigente.

## Pendiente

- Completar QA manual de negocio en el entorno de hosting final: mobile real, copy bilingüe, sesión/roles con usuarios reales, flujo de cotización con credenciales productivas y revisión visual final.
- Mantener como deuda externa diferida la protección de contraseñas filtradas (leaked password protection) mientras el proyecto siga en el plan actual de Supabase; reabrir solo cuando el plan permita activarla y entonces validar login normal, recuperación de contraseña y bloqueo de credenciales filtradas.
- Repetir revisión/archivo de snapshot de Supabase Security Advisors solo ante cambios de Auth/RLS o antes del lanzamiento final; estado base actual ya revisado: warning de leaked password protection diferido por plan y helpers `SECURITY DEFINER` aceptados para el modelo RLS actual.
- Tratar como trabajo futuro, fuera de P0.3: MFA/SSO, rediseño completo de políticas RLS/helpers, mapas finos de rol en middleware, expansión de auditoría y limpieza de advisors puramente de performance.

## Bloqueos

- El `lang` inicial renderizado por el root layout sigue siendo una limitación parcial: Next.js solo permite `<html>` en `app/layout.tsx`, así que la corrección completa SSR requeriría una reestructuración mayor del árbol/ruteo. Se mantiene la corrección cliente y el SEO/metadatos sí respetan locale.
- No exponer ni commitear `SUPABASE_SECRET_KEY` ni credenciales bootstrap; deben quedarse solo en el entorno local/hosting seguro.
- Las limpiezas de objetos de intents fallidos son best-effort bajo RLS y también aparecen como incidencias de recuperación; una caída de red puede dejar el intent/objeto pendiente hasta reintento o limpieza operativa.
- El middleware admin solo hace refresh/redirect coarse por sesión Supabase; perfiles activos, roles internos y permisos por módulo siguen validados en servidor con `requireAdminRole([...])` y RLS.

## Última actualización

2026-08-03 — Completado el cutover de PDF inicial obligatorio y cargas directas TUS: aplicación sin bytes en Server Actions, linking legado retirado, migración independiente `0060`, pruebas de ambas cadenas con/sin `0057` y conservación de enlaces históricos. No se aplicaron migraciones remotas.
