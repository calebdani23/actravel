# Decisiones técnicas y de producto

## 2026-08-21 — Week 02 capability-scope amendment and runtime evidence correction

The maintainer-authorized correction closes this foundation at Manager persistence, Admin-only assignment, the typed eight-capability registry/evaluator, fail-closed role semantics, and safe Manager route/navigation. `canCapability()` has no production callers here. No new sensitive business action is governed by the keys; `week-02-sensitive-capability-enforcement` must bind each real action to server plus RPC/RLS and existing audit/event contracts before delivery. Existing Admin/role route enforcement is authoritative and is not capability enforcement. The E2E fixture now calls `await connection()` before reading the environment, so the build reports it dynamic; Playwright observes a real fallback redirect, instrumented read counts, and typed authorization denial. Admin browser evidence is explicitly create/edit/display control availability, while server action tests remain mutation authority. Static SQL remains the accepted substitute for unavailable local Postgres; `0061` was not applied remotely.

## 2026-08-21 — Week 02 work unit 4 keeps Manager migration atomic and narrow

The verified local inventory ends at `0060`, so `0061_manager_capability_foundation.sql` is the next identifier. The migration only expands `roles_name_check`, upserts `manager` with the `Gerencia` label, and adds Manager to the existing role-catalog read predicate. `has_role`, `is_admin`, Admin-only role/profile-role writes, all CRM/quote/audit/`leads` policies, and physical data remain unchanged. Local Docker/PostgreSQL remains unavailable, so migration application is not claimed; static SQL contracts plus the guarded isolated Playwright fixture provide the bounded evidence without production mutation. Tasks, notifications, Mi día, generic capability schema/RPC, and broad RLS rewrites remain out of scope.

## 2026-08-21 — Week 02 work unit 4 corrective retry

The first work-unit-4 record incorrectly marked the browser-assigned evidence complete without executing Playwright. On retry, the isolated E2E-only route is guarded by `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`, uses the production AdminShell, page-composition, authorization, and staff form seams, and is 404 outside the E2E environment. `npx playwright test e2e/manager-capability.spec.ts` passed 2/2, covering Manager navigation, dashboard healthy/unhealthy fallback, account zero dashboard reads, direct denial, Admin Manager create/edit/display, and Manager plus non-Admin assignment denial. The local SQL harness remains blocked at `127.0.0.1:54322 ECONNREFUSED`; no linked or production database was mutated.

## 2026-08-20 — Week 01 final independent gate: PASS

Under final verification token `sha256:e031596ae703108ce9841aad44373afe2b0f4a301a54e52d775ca4d3c802cbf5`, the amended gate passes: `0057` did not execute; authoritative absence plus exact `0060`/live-catalog equivalence is accepted as the requirement disposition, not historical provenance. Production remains read-only, no replay/repair/mutation is authorized, Week 02 is planning-only next action, and `0061+` remains separately gated.

## 2026-08-20 — Week 01 amendment: absent 0057 with equivalent effects

The maintainer-approved token `sha256:10f4ad85c10c004edab347f07603c0465d29bd7f812d54fc6025c262e592232d` accepts `0057` as `ABSENT_WITH_EFFECT_EQUIVALENCE`. The authoritative 59-row ledger proves `0057` did not execute; exact LF-normalized local/production `0060` and live durable effects prove the intended equivalent production outcome. This changes the requirement, not history. Production remains read-only, no replay/repair/mutation is authorized, `0061+` remains separately gated, and a fresh independent verifier retains final authority.

## 2026-08-20 — Week 01 final integration remains blocked

The final reconciliation binds provider evidence, production recovery manifest `24a882a7158383c946b99c1ea55374f6c2f7b038fd30441f56e39f8510e10fe3`, and preserved type evidence. Read-only source backup/local restore passed; all 59 ledger rows and 16 catalog categories matched, with cleanup and secret scan passing. The authoritative ledger still lacks `0057`; normalized `0060` and live durable effects equal the intended `0057` outcome, but historical execution provenance is not proven. The current parent contract does not define `ABSENT_WITH_EFFECT_EQUIVALENCE` as sufficient, so the sole gate remains **BLOCKED**. Closure requires historical `0057` proof or a maintainer-approved requirement amendment; `0061+` remains separately gated. Evidence: `openspec/changes/week-01-operational-gate-closure/packet/evidence-manifest.md` and `verify-report.md`.

## 2026-08-17 — Baseline reconciliation remains blocked

### Decision

Publish the Week 01 evidence packet with one sole final gate, `BLOCKED`, and do not allocate `0061+`.

### Verified facts

The exact linked Supabase ref `bdyhakpmxegoipbmbtjb` and URL matched the required target. Read-only ledger evidence shows remote migrations through `0060` but not `0057`; remote-only named entries include `0051_crm_resolver_advisor_visibility_hotfix` and `drop_public_rate_limits_write_policy`. Local tracked types, migrations, package manifests, and the unrelated intake image remained unchanged by this work. Guarded lint, build, and quote-notification validation passed with external boundaries disabled.

### Blockers

Environment role, independent review, manual reconciliation of ambiguous findings, and all disposable rehearsal prerequisites remain unverified or unavailable. No provider mutation, repair, type regeneration, application change, or real external traffic was performed. Evidence: `openspec/changes/baseline-reconcile-operational-closure/packet/`.

## 2026-07-20

### Decisión

Retirar Google Sheets completamente de la operación productiva activa y dejar a Supabase como única fuente de verdad para intake y seguimiento de cotizaciones.

### Contexto

El sprint de consolidación pidió cerrar explícitamente si Google Sheets seguía, quedaba como respaldo o se retiraba. La app ya persistía correctamente en Supabase y los flujos no-Sheets (emails, tracking de WhatsApp y Meta) podían seguir operando sin depender de una copia adicional.

### Alternativas consideradas

- Mantener Sheets como copia operativa y seguir gestionando incidentes/reintentos desde admin.
- Dejar Sheets configurado pero "dormido" detrás de variables de entorno.
- Retirar el runtime, quitar los workflows activos y conservar únicamente el historial existente.

### Motivo

La opción más segura para producción es desconectar por completo el boundary retirado: evita intentos accidentales, reduce superficie operativa y elimina una dependencia externa sin tocar datos históricos ya registrados.

### Impacto

Las nuevas cotizaciones ya no intentan sincronizar a Google Sheets ni crean nuevas filas en `sheet_sync_logs`. `/admin/dashboard` y `/admin/logs` dejan de tratar Sheets como incidencia activa/retryable. La documentación y `.env.example` dejan de presentar `GOOGLE_SHEETS_*` como configuración vigente.

## 2026-07-09

### Decisión

Implementar provisioning interno de cuentas `admin`/`asesor` dentro de `/admin/staff`, pero mantener la gestión de mailboxs Hostinger fuera de la app en este batch.

### Contexto

AC Travel ya dependía de Supabase Auth + `profiles` + `profile_roles` para autorización, pero el alta/cambio de cuentas internas seguía manual por scripts o dashboard. También se evaluó si el panel debía automatizar mailboxs Hostinger.

### Alternativas consideradas

- Integrar CRUD de mailboxs Hostinger dentro del panel admin.
- Mantener completamente manual tanto Auth como perfiles/roles.
- Crear solo usuarios Auth sin auditoría ni protecciones de último admin.

### Motivo

El valor MVP inmediato está en permitir altas/bajas y cambios de rol app-side con trazabilidad y guardrails (`last admin`, self-demotion, self-deactivation). Automatizar Hostinger agrega coupling y manejo de secretos/proveedor con bajo valor inmediato y soporte API insuficiente para este batch.

### Impacto

El onboarding operativo queda: crear mailbox en Hostinger/hPanel primero, luego crear acceso AC Travel en `/admin/staff`. La app registra `admin_account_events`, no persiste contraseñas iniciales y ofrece solo cambio de contraseña self-service en `/admin/account`. El estado activo/inactivo de staff es deliberadamente app-level: controla `profiles.is_active` para permitir o bloquear autorización en AC Travel, pero no intenta suspender mailboxs ni sincronizar baneos/unbaneos en Supabase Auth para este MVP.

## 2026-05-27

### Decisión

Declarar el MVP listo para lanzamiento después de verificar el sync live de Google Sheets con una cotización real.

### Contexto

La verificación final local pasa (`lint`, `build`, pruebas enfocadas y smoke checks básicos). Después de habilitar Google Sheets API en el proyecto configurado, una cotización real persistió en Supabase y registró `sheet_sync_logs.status = success` con fila `Leads!A1:S1`.

### Alternativas consideradas

- Marcar Google Sheets como exitoso por tener tests locales.
- Revertir o desactivar la integración de Sheets.
- Marcar el blocker externo como resuelto después de ver evidencia live en Supabase y Google Sheets.

### Motivo

No se debe inventar éxito externo; el estado se actualiza solo después de confirmar una fila real escrita y el log exitoso. Supabase sigue siendo la fuente de verdad y el formulario conserva leads aunque una integración externa falle en el futuro.

### Impacto

El lanzamiento queda en estado `ready for MVP launch`; ya no hay blocker externo de Google Sheets API pendiente.

## 2026-05-27

### Decisión

Restringir la lectura de objetos privados de Storage por bucket y rol, sin ampliar el alcance a upload completo en Bloque 6.

### Contexto

La política previa `staff read private storage objects` permitía que ciertos roles autenticados leyeran objetos de cualquier bucket por no acotar el predicado al bucket privado esperado. El panel de pagos/documentos solo necesita metadata y URLs firmadas para `payment-proofs` y `documents`.

### Alternativas consideradas

- Mantener la política amplia y depender solo de la UI.
- Construir flujos completos de carga, path generation y validación de archivos en este pase.

### Motivo

La corrección mínima segura era limitar lectura a `catalog-media` para staff autenticado y a `documents`/`payment-proofs` solo para roles operativos/financieros/admin. Ese endurecimiento quedó activo; después se añadió el flujo MVP de upload administrado solo para `catalog-media`, sin ampliar el alcance de buckets privados operativos.

### Impacto

Roles no autorizados ya no pueden leer objetos de buckets privados arbitrarios por esta política. `catalog-media` sí admite gestión/upload para marketing/admin dentro del panel, mientras `documents` y `payment-proofs` conservan su manejo privado y acotado por rol.

## 2026-05-27

### Decisión

Mantener Bloque 5 como persistencia CRM server-only y logs de frontera para email/Google Sheets, sin envío ni sincronización reales hasta contar con credenciales e integraciones dedicadas.

### Contexto

El formulario de cotización ya crea `contacts`, `leads`, `quote_requests` y `lead_events`. El prompt maestro menciona emails y Google Sheets, pero los bloques dedicados a proveedor de email y sync real siguen siendo posteriores. Las variables oficiales para esta frontera son `EMAIL_ADMIN`, `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_SPREADSHEET_ID` y `GOOGLE_SHEETS_LEADS_TAB`.

### Alternativas consideradas

- Inventar credenciales o nombres alternos para completar delivery/sync.
- Agregar una integración parcial de proveedor antes de Bloques 8–9.

### Motivo

Evita falsos positivos operativos y mantiene una frontera segura: Supabase recibe el lead, y los logs dejan trazabilidad de la intención de notificar/sincronizar hasta que existan credenciales reales y se implemente el proveedor correspondiente.

### Impacto

Con credenciales ausentes, las filas de log quedan como `skipped` con razón explícita. Con credenciales presentes, Bloque 5 puede marcar intención `queued`, pero la entrega/sync reales siguen bloqueados por la implementación de Bloques 8–9.

## 2026-05-26

### Decisión

Usar únicamente los nombres modernos de llaves Supabase: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para cliente/SSR y `SUPABASE_SECRET_KEY` para código privilegiado server-only.

### Contexto

El prompt maestro histórico mencionaba los nombres legacy de Supabase, pero el usuario pidió explícitamente no usarlos; además confirmó que las variables modernas ya están configuradas localmente junto con las credenciales bootstrap.

### Alternativas consideradas

- Mantener compatibilidad con ambos pares de variables.
- Usar fallback silencioso a los nombres legacy.

### Motivo

Aceptar ambos nombres reintroduciría el modelo legacy que el usuario quiere evitar. La app, scripts y docs deben fallar claramente si faltan las variables modernas.

### Impacto

Los clientes browser/server usan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; bootstrap/admin usa `SUPABASE_SECRET_KEY`. La documentación registra esta desviación deliberada respecto del prompt maestro.

## 2026-05-26

### Decisión

Restringir los helpers RLS (`has_role`, `is_admin`, `is_assigned_lead`) para que no sean ejecutables por `anon`, pero sí por `authenticated` y `service_role`.

### Contexto

La corrección de seguridad posterior al Bloque 4 revocó `execute` desde `public`, pero solo volvió a concederlo a `service_role`. Eso rompía las políticas que evalúan roles para usuarios autenticados.

### Alternativas consideradas

- Volver a conceder ejecución a `public`.
- Cambiar las políticas para no usar helpers.

### Motivo

Conceder solo a `authenticated` mantiene cerrado el acceso anónimo directo y restaura el comportamiento esperado de las políticas role-based.

### Impacto

Las políticas RLS de staff pueden evaluar roles nuevamente. Los helpers siguen siendo `security definer` con `search_path = public` y no son ejecutables por `anon`.

## 2026-05-26

### Decisión

No crear el usuario administrador inicial sin email, password y service-role disponibles en configuración segura.

### Contexto

El bootstrap existe en `db/seed/bootstrap-admin.ts`, pero las credenciales operativas son secretos y no deben inventarse ni guardarse en git.

### Alternativas consideradas

- Generar una contraseña temporal inventada.
- Insertar registros directamente en `auth.users` por SQL.

### Motivo

Crear credenciales irreversibles o manipular tablas internas de Auth directamente sería inseguro. El flujo seguro es ejecutar `npm run db:bootstrap-admin` desde un entorno con `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` reales.

### Impacto

El administrador inicial queda pendiente hasta que el usuario proporcione esos valores fuera de git; no bloquea la fundación de esquema/RLS.

## 2026-05-26

### Decisión

Crear la base como una aplicación Next.js con App Router en la raíz del repositorio, usando npm como package manager.

### Contexto

El prompt maestro solicita Next.js, TypeScript, Tailwind CSS, shadcn/ui y una arquitectura preparada para Supabase. El repositorio no tenía aplicación existente ni package manager configurado.

### Alternativas consideradas

- Crear la app en un subdirectorio.
- Usar pnpm/yarn.

### Motivo

El usuario indicó usar npm si no había package manager especificado. La estructura recomendada del prompt maestro asume `app/`, `components/`, `lib/` y `db/` en la raíz.

### Impacto

Los siguientes bloques pueden continuar directamente sobre App Router y la estructura sugerida.

## 2026-05-26

### Decisión

Configurar shadcn/ui manualmente con estilo `new-york`, base `neutral`, React Server Components y CSS variables.

### Contexto

Bloque 1 exige instalar/configurar shadcn/ui, pero solo requiere una base limpia y placeholders mínimos.

### Alternativas consideradas

- Ejecutar el CLI de shadcn para agregar muchos componentes iniciales.
- No agregar componentes UI hasta Bloque 2.

### Motivo

La configuración manual mantiene el alcance pequeño, deja `components.json` listo y agrega solo `Button`/`Card` necesarios para placeholders.

### Impacto

Bloques posteriores pueden usar `npx shadcn@latest add ...` o continuar agregando componentes compatibles con la configuración existente.

## 2026-05-26

### Decisión

Agregar scaffolding de Supabase (`browser`, `server` y `service role`) y un login/guard admin mínimo sin conectar a un proyecto real ni crear migraciones todavía.

### Contexto

Bloque 1 pide conectar/preparar Supabase Auth, pero el Scope Guard prohíbe implementar lógica de fases posteriores. La revisión pidió que el setup pudiera afirmar honestamente una base de Auth para usuarios internos.

### Alternativas consideradas

- Crear migraciones y políticas RLS en Bloque 1.
- Implementar producto completo de login admin en Bloque 1.

### Motivo

Las migraciones, roles y RLS están asignadas al Bloque 4. El setup actual evita secretos, prepara helpers reutilizables y ofrece un formulario mínimo que usa `signInWithPassword` cuando las variables públicas existen, con fallback si no están configuradas.

### Impacto

La app compila sin requerir variables reales. `/admin/login` y `/admin/dashboard` muestran mensajes claros sin Supabase configurado; con variables reales, el login base puede crear sesión para usuarios existentes.

## 2026-05-26

### Decisión

Resolver las rutas públicas faltantes con un catch-all placeholder validado por locale/segmento, usando los segmentos ingleses del prompt maestro.

### Contexto

La navegación y el prompt maestro referencian rutas públicas que aún no tenían páginas reales. Bloque 1 no debe construir contenido de negocio completo.

### Alternativas consideradas

- Crear una carpeta y página por cada ruta pública.
- Quitar enlaces hasta bloques posteriores.

### Motivo

Un placeholder validado evita enlaces rotos, mantiene la diferencia correcta entre segmentos en español e inglés y limita el alcance a scaffolding.

### Impacto

Las páginas públicas existen como placeholders obvios; bloques posteriores podrán reemplazarlas por páginas específicas.

## 2026-05-26

### Decisión

Mantener `app/layout.tsx` con `lang="es"` inicial y ajustar `document.documentElement.lang` en cliente para `/en`.

### Contexto

Next.js requiere que `<html>` viva en el root layout. Reestructurar layouts para resolver el atributo inicial perfecto sería desproporcionado para Bloque 1.

### Alternativas consideradas

- Reestructurar toda la app para renderizar `<html>` por locale.
- Dejar `/en` permanentemente con `lang="es"`.

### Motivo

El ajuste cliente es la mejora mínima correctaable dentro del scope de setup y documenta la limitación de SSR inicial.

### Impacto

Después de hidratar, `/en` queda con `document.documentElement.lang = "en"`; una solución SSR completa queda para un bloque futuro si se prioriza SEO/accesibilidad avanzada.

## 2026-05-26

### Decisión

Mantener los CTAs públicos de WhatsApp como enlaces directos `wa.me` durante Bloque 2 y dejar el tracking para el bloque dedicado.

### Contexto

El prompt maestro describe una ruta intermedia de tracking, pero el alcance de Bloque 2 pide identidad visual y scaffolding público, con preferencia explícita por links directos `wa.me` por ahora.

### Alternativas consideradas

- Conectar todos los CTAs al endpoint placeholder `/api/whatsapp-click`.
- Implementar tracking completo antes del bloque correspondiente.

### Motivo

Evita adelantar lógica de analytics/leads y mantiene el foco en conversión visual móvil-first.

### Impacto

Navbar, footer, hero y botón flotante abren WhatsApp directamente. El Bloque 7 deberá reemplazar o envolver estos CTAs con tracking.

## 2026-05-26

### Decisión

Implementar moneda como preferencia visual cliente con `localStorage`, sin conversión ni precios.

### Contexto

Bloque 2 solicita `CurrencySwitch`, pero las reglas de precios y promociones pertenecen a bloques posteriores y no debe implementarse conversión automática.

### Alternativas consideradas

- Guardar la preferencia en cookie desde servidor.
- Conectar moneda a datos de promociones desde Supabase.

### Motivo

`localStorage` resuelve el scaffolding visual sin afectar SSR, base de datos ni contenido de negocio.

### Impacto

El switch recuerda MXN/USD en el navegador; Bloque 3+ podrá consumir esa preferencia cuando existan precios y formularios.
