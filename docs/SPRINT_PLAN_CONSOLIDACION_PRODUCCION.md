# Sprint plan — consolidación productiva MVP

## Objetivo

Consolidar la operación productiva inmediata de AC Travel con foco en **atribución y medición comercial con Meta sin depender de una integración directa de WhatsApp Business Cloud API**, cobertura E2E de los flujos críticos y cierre de ambigüedades operativas alrededor de Google Sheets, sin abrir una fase grande de producto nuevo.

## Por qué este sprint sigue ahora

El MVP ya está en un punto operable. El siguiente mayor retorno no está en agregar más alcance funcional, sino en validar el embudo real, reducir riesgo de fallos silenciosos y dejar claro qué componentes sí forman parte del modelo operativo de producción.

## Alcance

- Definir y activar una estrategia Meta basada en **Pixel + Conversions API + Marketing/Ads attribution**, sin bloquear el número celular operativo de WhatsApp.
- Cobertura E2E de journeys críticos del negocio.
- Decisión y ejecución sobre el rol de Google Sheets en producción.
- Hardening puntual de bajo costo si no bloquea lo anterior.

## Fuera de alcance / no-goals

- Rediseño mayor del sitio o del panel admin.
- Nuevas integraciones comerciales no necesarias para la operación inmediata.
- Refactor amplio de arquitectura, catálogo o RLS.
- Automatizaciones avanzadas de reporting fuera de las mínimas necesarias para operar.
- Integrar WhatsApp Cloud API como canal obligatorio del MVP si eso fuerza abandonar el número celular operativo actual.
- Intentar capturar automáticamente el contenido de chats inbound del WhatsApp personal/celular sin una plataforma oficial de mensajería conectada.

## Workstreams priorizados

### 1) P0 — Replantear Meta hacia atribución y medición sin Cloud API de WhatsApp

**Owner focus sugerido:** Ops + Técnico

**Tareas concretas**

- Confirmar la decisión de producto/operación: el número celular operativo actual **se mantiene manual** y no se conecta a WhatsApp Cloud API en esta etapa.
- Definir el objetivo real de Meta en producción:
  - atribuir campañas
  - medir conversiones
  - registrar clics/visitas/quotes
  - optimizar anuncios sin perder el número operativo actual
- Implementar/revisar instrumentación de eventos web:
  - view de página clave
  - view de detalle de verticales
  - inicio de cotización
  - envío exitoso de cotización
  - click a WhatsApp
- Evaluar si conviene agregar **Conversions API** server-side para reforzar la señal de eventos críticos.
- Definir qué campos de atribución deben persistirse en Supabase (por ejemplo `source`, `campaignContext`, `ctwa_clid` o equivalentes si llegan por query/ref).
- Documentar cómo leer resultados desde Meta Ads Manager/Marketing API sin depender del contenido de mensajes inbound.

**Resultado esperado**

- Meta queda integrado como canal de medición y atribución útil para operar campañas reales, sin forzar una integración de mensajería que invalide el número celular actual.

### 2) P0 — Cobertura E2E de flujos críticos

**Owner focus sugerido:** Técnico

**Tareas concretas**

- Implementar E2E del flujo principal de cotización pública.
- Cubrir el camino crítico de notificación/continuación por WhatsApp donde aplique.
- Cubrir acceso admin básico y visualización del lead generado.
- Cubrir que el tracking/atribución de campañas no rompa el journey principal.
- Agregar fixtures o entorno de prueba estable para no depender de datos manuales.
- Definir qué integraciones externas se mockean y cuáles se validan en smoke tests reales.

**Resultado esperado**

- Existe una red mínima de regresión para los journeys que más impactan operación e ingresos.

### 3) P1 — Resolver Google Sheets como parte o no del modelo operativo

**Owner focus sugerido:** Product + Ops + Técnico

**Tareas concretas**

- Decidir explícitamente si Google Sheets sigue activo en producción, queda como respaldo temporal o se retira.
- Si sigue activo: documentar ownership, tab objetivo, manejo de fallos y criterio de soporte.
- Si se retira: apagar sincronización productiva de forma segura y actualizar documentación/operación.
- Alinear `docs/PROGRESS.md`, `docs/OPERATIONS.md` y variables de entorno con la decisión final.

**Resultado esperado**

- Ya no existe ambigüedad sobre el papel de Google Sheets en operación diaria.

### 4) P2 — Hardening puntual de cierre

**Owner focus sugerido:** Técnico

**Tareas concretas**

- Revisar observabilidad mínima de errores en intake, notificaciones y syncs.
- Confirmar checklist pendiente de seguridad externa ya identificado en Supabase/Auth.
- Añadir uno o dos smoke checks operativos de post-deploy si todavía faltan.
- Revisar que `NEXT_PUBLIC_SITE_URL`, dominios de email y enlaces absolutos en correos queden totalmente consistentes.

**Resultado esperado**

- Menos riesgo residual sin convertir el sprint en una fase grande de hardening.

## Dependencias y necesidades de entorno/configuración

- Acceso a Meta Business Manager / Ads Manager del negocio.
- Acceso para crear y validar Pixel / dataset / Conversions API token si se usa.
- Confirmación de la estrategia operativa: el número celular actual seguirá siendo el canal manual principal de WhatsApp.
- Credenciales/env vigentes para Supabase, Resend y cualquier integración Meta aplicable.
- Entorno de pruebas E2E con datos controlados y criterio claro para mocks vs validación real.
- Decisor de negocio/operación disponible para cerrar la decisión sobre Google Sheets.

## Checklist de validación / aceptación

- [ ] Existe una decisión explícita y documentada de **no usar WhatsApp Cloud API** mientras el número operativo siga siendo un celular/manual.
- [ ] El Pixel/atribución Meta registra correctamente al menos los eventos críticos definidos.
- [ ] Si se usa Conversions API, existe al menos una prueba controlada de evento server-side bien recibido.
- [ ] Los flujos E2E críticos corren en local o CI y tienen resultado estable.
- [ ] Quedó documentado si Google Sheets sigue, se limita o se retira de producción.
- [ ] La documentación operativa y de entorno quedó alineada con la realidad vigente.
- [ ] No quedan dependencias externas “asumidas” sin dueño ni criterio de verificación.

## Orden recomendado de ejecución

1. Cerrar la decisión operativa: Meta se usa para atribución/medición y el número de WhatsApp sigue siendo manual.
2. Implementar o validar Pixel/atribución/Conversions API para los eventos críticos del funnel.
3. Montar E2E del journey principal de cotización y revisión admin.
4. Tomar decisión final sobre Google Sheets y ejecutar el ajuste correspondiente.
5. Aplicar hardening puntual restante solo si no desplaza P0/P1.

## Nota de ejecución

Este sprint debe medirse por **capacidad operativa comprobada**, **atribución usable de campañas**, y **claridad del modelo productivo**, no por volumen de cambios. Si surge la necesidad de automatizar conversaciones reales de WhatsApp, tratarlo como un frente separado de fase posterior, no mezclarlo con esta consolidación.
