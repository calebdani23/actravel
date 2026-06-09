# AC Travel — Roadmap priorizado de siguientes pasos

> Estado base actual: el MVP ya quedó funcional y listo para operar en modo inicial.
>
> Este documento define los siguientes pasos recomendados para evolucionar el producto de forma gradual, priorizada y accionable.

## 0. Criterios de uso de este roadmap

- Trabajar por bloques pequeños y verificables.
- No abrir demasiados frentes a la vez; cerrar un bloque antes de iniciar el siguiente, salvo tareas muy acotadas.
- Mantener a **Supabase como fuente de verdad**.
- Mantener todas las integraciones externas como efectos secundarios controlados, nunca como dependencia para guardar leads.
- Registrar decisiones importantes en `docs/DECISIONS.md` y avances en `docs/PROGRESS.md`.

## 1. Supuestos operativos actuales

### Ya funciona

- Sitio público bilingüe.
- Formulario de cotización real.
- Persistencia en Supabase.
- Panel interno MVP.
- Tracking de WhatsApp.
- Emails admin con Resend.
- Google Sheets sync real.

### Restricción aceptada por ahora

- **Resend sigue en modo limitado para correos a terceros** mientras no exista un dominio propio verificado.
- Se asume temporalmente que:
  - el correo al admin sí opera,
  - el correo al cliente puede quedar restringido por Resend hasta que exista dominio oficial,
  - esta limitación **no bloquea** el trabajo del resto del producto.

## 2. Orden recomendado de trabajo

La recomendación es avanzar en este orden:

1. **P0 — Hardening operativo y estabilidad**
2. **P1 — Conversión pública y UX comercial**
3. **P1 — Profundización del panel interno**
4. **P1 — Catálogo dinámico y publicación real desde admin**
5. **P2 — Observabilidad, automatización y escalamiento**
6. **P3 — Integraciones avanzadas y fase 2**

---

## 3. P0 — Hardening operativo y estabilidad

Objetivo: reducir riesgo productivo, spam, duplicados y fallos silenciosos.

### Bloque P0.1 — Protección de endpoints públicos

**Objetivo**: proteger el formulario y tracking de abuso.

#### Implementar

- Rate limiting en:
  - `/api/quote-request`
  - `/api/whatsapp-click`
- Honeypot o captcha ligero para el formulario.
- Validación adicional de payloads sospechosos.
- Reglas mínimas anti-spam por IP, user-agent o fingerprint simple.

#### Resultado esperado

- Menos spam.
- Menos costos innecesarios por integraciones.
- Menos ruido en leads.

### Bloque P0.2 — Idempotencia y reintentos controlados

**Objetivo**: evitar efectos secundarios duplicados o inconsistentes.

#### Implementar

- Idempotencia más fuerte para:
  - emails
  - Google Sheets
  - WhatsApp tracking si aplica
- Reintentos manuales o seguros desde admin para:
  - `notification_logs.failed`
  - `sheet_sync_logs.failed`
- Estado intermedio opcional tipo `processing` cuando haga falta.

#### Resultado esperado

- Menos duplicados.
- Mejor recuperación ante fallos externos.

### Bloque P0.3 — Seguridad y sesión

**Objetivo**: endurecer acceso administrativo y revisar seguridad base.

#### Implementar

- Middleware de refresh/control de sesión para admin.
- Revisión de políticas RLS con datos reales y roles reales.
- Activar protección de contraseñas filtradas en Supabase Auth.
- Revisar advisors de Supabase y documentar warnings aceptados.

#### Resultado esperado

- Admin más robusto.
- Menor riesgo de acceso inconsistente.

---

## 4. P1 — Conversión pública y UX comercial

Objetivo: aumentar calidad de leads y mejorar conversión sin rehacer el MVP.

### Bloque P1.1 — Optimización del home y páginas comerciales

#### Implementar

- Refinar hero principal.
- Mejorar estructura de CTA por sección.
- Añadir bloques de confianza:
  - beneficios
  - proceso de atención
  - FAQs
  - señales de confianza/comercialización
- Ajustar copy de servicios, paquetes, promociones y destinos.

#### Resultado esperado

- Mejor entendimiento del valor de AC Travel.
- Más intención de contacto.

### Bloque P1.2 — Optimización del formulario

#### Implementar

- Afinar campos opcionales vs obligatorios.
- Mejorar mensajes de ayuda y placeholders.
- Mejor feedback post-submit.
- Detectar abandono o puntos de fricción.
- Preparar variantes del formulario por campaña o contexto.

#### Resultado esperado

- Más formularios completados.
- Leads mejor calificados.

#### Estado

- 🟡 Parcial sólido: el formulario ya guarda borrador local, recupera intentos recientes y deja una señal mínima de abandono/fricción en el dispositivo; aún faltan analítica agregada y experimentación por campaña.

### Bloque P1.3 — SEO básico real

#### Implementar

- Metadata por página.
- Open Graph y Twitter cards.
- Sitemap.
- Robots.
- Canonicals.
- Mejoras progresivas al manejo de `lang` SSR.

#### Resultado esperado

- Mejor indexación.
- Mejor compartibilidad.

#### Estado

- 🟡 Mayormente cubierto salvo `lang` SSR perfecto: metadata, OG/Twitter, sitemap, robots, canonicals y alternates están activos; el `lang` inicial del root layout sigue limitado por la estructura App Router actual.

---

## 5. P1 — Profundización del panel interno

Objetivo: convertir el panel MVP en una herramienta operativa diaria.

### Bloque P1.4 — Leads y seguimiento comercial

#### Implementar

- Búsqueda real por:
  - nombre
  - email
  - teléfono
  - destino
- Filtros más potentes por:
  - estatus
  - asesor
  - fecha
  - moneda
  - origen
- Timeline más útil.
- Acciones rápidas:
  - abrir WhatsApp
  - copiar plantilla
  - registrar seguimiento
  - cambiar estado

#### Resultado esperado

- Mejor operación comercial diaria.

#### Estado

- 🟡 Parcial fuerte: búsqueda/filtros ya cubren más combinaciones reales (contacto, destino, summary/source y payload de cotización), pero aún se puede profundizar con ranking/FTS más avanzado.

### Bloque P1.5 — Documentos y comprobantes reales

#### Implementar

- Upload real a Storage.
- Validación de MIME/tamaño.
- Generación automática de path/naming.
- Vista previa segura.
- Descarga segura.
- Mejor UX de documentos y comprobantes.

#### Resultado esperado

- Menos trabajo manual fuera del sistema.

#### Estado

- ✅ Implementado en nivel MVP operativo: upload real, validación MIME/tamaño, path seguro automático, preview/download firmados y reemplazo/eliminación con limpieza best-effort de objetos previos.

### Bloque P1.6 — Plantillas y productividad interna

#### Implementar

- Plantillas reutilizables por canal.
- Variables dinámicas prellenadas.
- Copiar/usar plantilla desde lead detail.
- Mejor organización de plantillas por categoría.

#### Resultado esperado

- Respuesta más rápida y consistente.

#### Estado

- ✅ Implementado y verificado: lead detail ahora cubre acciones de plantilla con WhatsApp trackeado, copiado y email deshabilitado cuando falta correo.

---

## 6. P1 — Catálogo dinámico y publicación real desde admin

Objetivo: dejar de depender de contenido estático para catálogo comercial.

### Bloque P1.7 — Catálogo público dinámico

#### Implementar

- Leer desde Supabase:
  - destinos
  - promociones
  - servicios
- Mostrar solo contenido publicado.
- Mantener fallback razonable si faltan datos.

#### Resultado esperado

- Publicación real desde admin.
- Menor duplicidad entre contenido y operación.

#### Estado

- ✅ Implementado y verificado: el catálogo público ahora prioriza filas publicadas desde Supabase y mantiene fallback estático razonable.

### Bloque P1.8 — Media management básico

#### Implementar

- Manejo de imágenes desde Storage o URLs administradas.
- Hero/thumbnail por catálogo.
- Estado draft/published más claro.

#### Resultado esperado

- Mejor presentación pública.
- Operación más sostenible.

#### Estado

- ✅ Implementado y verificado: flujo admin de media real para catálogo con upload a `catalog-media` o URL administrada, validación/normalización server-side, preferencia thumbnail/hero en público y estados draft/published/archive más claros.

---

## 7. P2 — Observabilidad, monitoreo y automatización útil

Objetivo: tener visibilidad real del estado operativo del MVP.

### Bloque P2.1 — Observabilidad operativa

#### Implementar

- Dashboard de salud operativa:
  - leads hoy
  - emails fallidos
  - syncs fallidos
  - clicks WhatsApp
- Vista de errores recientes.
- Señales mínimas de alerta.

### Bloque P2.2 — Retry y mantenimiento operativo

#### Implementar

- Reintento manual de emails fallidos.
- Reintento manual de sync a Sheets.
- Marcado claro de incidentes resueltos/no resueltos.

### Bloque P2.3 — Calidad de datos

#### Implementar

- Reglas mejores de deduplicación.
- Normalización más fuerte de teléfono/email.
- Posible constraint o estrategia de identidad más robusta.

---

## 8. P3 — Integraciones y fase 2

Objetivo: expandir el producto cuando el MVP ya esté estable.

### Líneas recomendadas

- WhatsApp Cloud API.
- Bandeja de conversaciones.
- Mercado Pago / Stripe.
- Google Drive.
- PDFs automáticos.
- Automatizaciones comerciales.
- Reportes más avanzados.
- Calendario.
- Portal de cliente.

---

## 9. Secuencia sugerida por sprints

### Sprint recomendado 1

- P0.1 Protección de endpoints públicos
- P0.2 Idempotencia y reintentos controlados
- P0.3 Seguridad y sesión

### Sprint recomendado 2

- P1.1 Optimización de home y páginas comerciales
- P1.2 Optimización del formulario
- P1.3 SEO básico real

### Sprint recomendado 3

- P1.4 Leads y seguimiento comercial
- P1.5 Documentos y comprobantes reales
- P1.6 Plantillas y productividad interna

### Sprint recomendado 4

- P1.7 Catálogo público dinámico
- P1.8 Media management básico

### Sprint recomendado 5

- P2.1 Observabilidad operativa
- P2.2 Retry operativo
- P2.3 Calidad de datos

---

## 10. Recomendación ejecutiva final

Si hubiera que elegir solo lo más importante inmediatamente después del MVP, el orden recomendado sería:

1. **Anti-spam + rate limiting**
2. **Retry/idempotencia de email y Sheets**
3. **Middleware de sesión + endurecimiento RLS/Auth**
4. **Mejora fuerte del flujo de leads en panel interno**
5. **Catálogo dinámico desde Supabase**
6. **SEO + mejora de conversión pública**

## 11. Estado del email cliente mientras no exista dominio propio

Mientras no exista dominio verificado en Resend:

- el sistema puede seguir operativo para admin y pruebas internas,
- el correo al cliente puede fallar por restricción del proveedor,
- esta limitación debe asumirse como **restricción temporal conocida**, no como bug de aplicación.

Cuando exista dominio propio:

- verificar dominio en Resend,
- ajustar `EMAIL_FROM`,
- reprobar envío al cliente,
- cerrar esa restricción operativa.
