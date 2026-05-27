# Prompt maestro para Codex — AC Travel MVP v1

> Archivo recomendado en el repositorio: `docs/AC_TRAVEL_MVP_MASTER_PROMPT.md`
> Proyecto: **AC Travel — Travel Agency Web Platform**
> Versión del documento: `v1.0`
> Estado: **Guía base para construcción del MVP v1**
> Última actualización sugerida: actualizar en cada bloque de avance importante.

---

## 0. Cómo debe usar Codex este documento

Este documento es la guía maestra para construir el MVP v1 de la plataforma web de **AC Travel**.

Codex debe usar este archivo como fuente principal de contexto funcional, técnico y de producto durante el desarrollo. Antes de hacer cambios importantes, debe revisar este documento y respetar el alcance definido.

### Reglas de trabajo para Codex

1. No construir funcionalidades fuera del MVP sin dejarlo documentado como propuesta futura.
2. Priorizar una arquitectura limpia, mantenible y escalable.
3. Mantener el foco principal: conversión de visitantes a conversaciones por WhatsApp Business.
4. No diseñar la web como ecommerce cerrado; AC Travel vende viajes personalizados mediante asesoría.
5. Usar Supabase como fuente principal de datos.
6. Usar Google Sheets solo como copia operativa automática de leads, no como fuente de verdad.
7. Preparar la arquitectura para WhatsApp Cloud API, pagos automatizados y documentos futuros, aunque no se implementen completos en MVP.
8. Mantener compatibilidad bilingüe: español e inglés.
9. Mantener compatibilidad de moneda: MXN y USD.
10. Implementar seguridad desde el inicio: autenticación, roles, RLS en Supabase y protección de datos personales.
11. Documentar decisiones técnicas importantes en `/docs/DECISIONS.md`.
12. Documentar avance y pendientes en `/docs/PROGRESS.md`.
13. No usar datos sensibles reales dentro del código fuente.
14. Todas las variables sensibles deben ir en `.env.local` y documentarse en `.env.example`.
15. Antes de finalizar cada bloque, ejecutar pruebas básicas, lint, build y revisar errores.

---

## 1. Resumen del proyecto

**AC Travel** necesita una plataforma web moderna, bilingüe y orientada a conversión, cuyo objetivo principal es captar visitantes desde redes sociales, campañas y búsquedas orgánicas para llevarlos a una conversación calificada por WhatsApp Business.

La plataforma debe permitir:

* Presentar la agencia.
* Mostrar servicios, destinos, promociones y paquetes vacacionales.
* Facilitar contacto rápido por WhatsApp Business.
* Capturar solicitudes de cotización.
* Registrar leads en Supabase.
* Sincronizar automáticamente leads con Google Sheets.
* Permitir al admin/asesor gestionar seguimiento comercial desde un panel interno.
* Registrar pagos manuales, reservas y documentos básicos.
* Preparar el sistema para futuras integraciones con WhatsApp Cloud API, Mercado Pago, Stripe, Google Drive, calendario y generación automática de documentos.

El MVP debe resolver bien lo esencial: **atraer, explicar, convertir, registrar y dar seguimiento**.

---

## 2. Identidad de marca

### Nombre oficial

Usar consistentemente:

```text
AC Travel
```

### Frase principal

```text
Suma viajes, suma experiencias, suma sueños.
```

### Personalidad de marca

La marca debe sentirse:

* Cercana.
* Familiar.
* Confiable.
* Humana.
* Alegre.
* Práctica.
* Clara.
* Comercial.
* Elegante sin sentirse fría.

### Estilo visual deseado

La web debe sentirse:

```text
Elegante, familiar y comercial.
```

Debe combinar:

* Limpieza visual.
* Jerarquía clara.
* Imágenes aspiracionales de playa, hoteles, vacaciones, familia y experiencias.
* Llamados a la acción claros hacia WhatsApp.
* Sensación de atención humana, no de plataforma impersonal.

### Colores de marca

Usar estos colores como tokens base:

```css
--ac-orange: #ee592a;
--ac-red: #eb0816;
--ac-light-bg: #f8eef7;
--ac-blue: #1b8bad;
```

Recomendación de uso:

* `#ee592a`: color principal para CTAs, acentos y botones importantes.
* `#eb0816`: énfasis comercial, promociones o alertas visuales moderadas.
* `#f8eef7`: fondos suaves, secciones alternas.
* `#1b8bad`: acento secundario, confianza, detalles informativos.

Evitar saturar la interfaz con rojo/naranja. Usar espacios blancos, fondos claros y contraste limpio.

---

## 3. Decisiones confirmadas del producto

| Área                  | Decisión                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Mercado principal     | México                                                                                              |
| Monedas               | MXN y USD                                                                                           |
| Idiomas               | Español e inglés                                                                                    |
| Dominio candidato     | `actravel.com` o `actravel.com.mx`                                                                  |
| Correo candidato      | `atencion@actravel.com` o `ventas@actravel.com`                                                     |
| WhatsApp oficial      | `+52 998 845 3455`                                                                                  |
| Atención inicial      | Manual por WhatsApp Business                                                                        |
| Futuro WhatsApp       | Preparar arquitectura para WhatsApp Cloud API                                                       |
| Equipo inicial        | 1 admin que también será asesor principal                                                           |
| Roles futuros         | Admin, asesor, operaciones, finanzas, marketing                                                     |
| Servicios principales | Paquetes vacacionales completos                                                                     |
| Destinos iniciales    | Cancún, Riviera Maya, Playa del Carmen                                                              |
| Precios públicos      | Mostrar “Desde” o “Consultar”                                                                       |
| Pagos actuales        | Transferencia directa, por definir datos bancarios                                                  |
| Pagos futuros         | Transferencia, OXXO, tarjeta, Mercado Pago, Stripe, pagos parciales y completos                     |
| Sesiones privadas     | Gratuitas, solo para clientes con conversación iniciada por WhatsApp                                |
| Google Sheets         | Debe recibir leads automáticamente                                                                  |
| Panel interno         | Bilingüe o al menos preparado para bilingüe, pero puede iniciar en español si se prioriza velocidad |
| Estilo visual         | Elegante, familiar y comercial                                                                      |

---

## 4. Objetivo principal del MVP

Construir una web bilingüe para AC Travel que permita:

1. Mostrar servicios, destinos y promociones.
2. Convertir visitantes en conversaciones por WhatsApp.
3. Capturar solicitudes de cotización.
4. Registrar leads en Supabase.
5. Sincronizar automáticamente leads a Google Sheets.
6. Permitir a un admin/asesor gestionar leads, cotizaciones, pagos manuales, reservas y documentos básicos.

El MVP debe estar preparado para crecer, pero no debe intentar construir todo de una vez.

---

## 5. Fuera de alcance del MVP v1

No construir todavía:

* Bot automático de WhatsApp.
* Bandeja completa de conversaciones WhatsApp dentro del panel.
* WhatsApp Cloud API completamente funcional.
* Pagos automatizados con webhooks.
* Portal de cliente.
* Generador avanzado de PDFs.
* Calendario propio complejo.
* API de vuelos/hoteles con precios finales.
* Sincronización bidireccional con Google Sheets.
* CRM con automatizaciones avanzadas.
* Motor de disponibilidad en tiempo real.
* Sistema multiempresa.
* App móvil.

Sí se debe preparar la arquitectura para estas funciones futuras.

---

## 6. Stack tecnológico recomendado

### Frontend

* Next.js.
* TypeScript.
* Tailwind CSS.
* shadcn/ui.
* Framer Motion para animaciones sutiles.
* React Hook Form.
* Zod.
* TanStack Table para tablas administrativas.

### Backend / datos

* Supabase Postgres.
* Supabase Auth.
* Supabase Storage.
* Supabase Row Level Security.
* API Routes / Server Actions de Next.js.
* Supabase Edge Functions si se requiere para integraciones futuras.

### Integraciones MVP

* WhatsApp link prellenado.
* Email transaccional con Resend o SendGrid.
* Google Sheets API para copiar leads automáticamente.
* Calendario externo mediante link privado.

### Integraciones futuras

* WhatsApp Cloud API.
* Mercado Pago.
* Stripe.
* Google Drive API.
* Google Calendar API.
* APIs de sugerencias de viaje.

### Hosting recomendado

* Vercel para Next.js.
* Supabase administrado para base de datos, auth y storage.

---

## 7. Estructura recomendada de carpetas

Codex puede ajustar según la versión de Next.js, pero se recomienda una estructura clara como esta:

```text
ac-travel/
├─ app/
│  ├─ [locale]/
│  │  ├─ page.tsx
│  │  ├─ servicios/
│  │  ├─ paquetes/
│  │  ├─ promociones/
│  │  │  ├─ page.tsx
│  │  │  └─ [slug]/page.tsx
│  │  ├─ destinos/
│  │  ├─ cotizar/
│  │  ├─ nosotros/
│  │  ├─ contacto/
│  │  ├─ privacidad/
│  │  ├─ terminos/
│  │  └─ pagos-cancelaciones/
│  ├─ admin/
│  │  ├─ login/
│  │  ├─ dashboard/
│  │  ├─ leads/
│  │  ├─ promociones/
│  │  ├─ destinos/
│  │  ├─ servicios/
│  │  ├─ pagos/
│  │  ├─ reservas/
│  │  ├─ documentos/
│  │  ├─ plantillas/
│  │  └─ usuarios/
│  ├─ api/
│  │  ├─ quote-request/
│  │  ├─ whatsapp-click/
│  │  ├─ google-sheets/
│  │  └─ notifications/
│  └─ layout.tsx
├─ components/
│  ├─ public/
│  ├─ admin/
│  ├─ forms/
│  ├─ ui/
│  └─ shared/
├─ lib/
│  ├─ supabase/
│  ├─ validations/
│  ├─ whatsapp/
│  ├─ email/
│  ├─ google-sheets/
│  ├─ i18n/
│  ├─ currency/
│  └─ utils/
├─ db/
│  ├─ migrations/
│  ├─ seed/
│  └─ schema-notes.md
├─ docs/
│  ├─ AC_TRAVEL_MVP_MASTER_PROMPT.md
│  ├─ DECISIONS.md
│  ├─ PROGRESS.md
│  ├─ ENVIRONMENT.md
│  └─ ROADMAP.md
├─ public/
│  ├─ images/
│  └─ brand/
├─ .env.example
├─ README.md
└─ package.json
```

---

## 8. Rutas públicas MVP

Usar estructura por idioma:

```text
/es
/en
```

### Rutas en español

```text
/es
/es/servicios
/es/paquetes
/es/promociones
/es/promociones/[slug]
/es/destinos
/es/destinos/[slug]
/es/cotizar
/es/nosotros
/es/contacto
/es/privacidad
/es/terminos
/es/pagos-cancelaciones
```

### Rutas en inglés

```text
/en
/en/services
/en/packages
/en/deals
/en/deals/[slug]
/en/destinations
/en/destinations/[slug]
/en/quote
/en/about
/en/contact
/en/privacy
/en/terms
/en/payments-cancellations
```

---

## 9. Navegación pública

### Menú principal

Español:

```text
Inicio
Paquetes
Promociones
Destinos
Servicios
Nosotros
Cotizar
```

Inglés:

```text
Home
Packages
Deals
Destinations
Services
About
Quote
```

### Controles visibles

* Switch de idioma: `ES / EN`.
* Switch de moneda: `MXN / USD`.
* Botón principal: `Cotizar por WhatsApp` / `Quote on WhatsApp`.
* Botón flotante de WhatsApp.

---

## 10. Home pública

La página principal debe incluir:

1. Hero aspiracional.
2. Frase principal: `Suma viajes, suma experiencias, suma sueños.`
3. CTA principal hacia WhatsApp.
4. CTA secundario hacia promociones.
5. Bloque de promesa de valor.
6. Destinos destacados: Cancún, Riviera Maya, Playa del Carmen.
7. Promociones destacadas.
8. Servicios principales.
9. Cómo funciona.
10. Formulario corto o CTA a cotización completa.
11. Bloque de confianza.
12. CTA final.

### Mensaje comercial sugerido en español

```text
Planeamos contigo tus próximas vacaciones con atención personalizada, opciones claras y seguimiento humano de principio a fin.
```

### Mensaje comercial sugerido en inglés

```text
We help you plan your next vacation with personalized attention, clear options, and human support from start to finish.
```

---

## 11. Servicios principales

Mostrar estos servicios:

* Hoteles.
* Tours.
* Paquetes vacacionales.
* Traslados.
* Renta de autos.
* Casas vacacionales.
* Vuelos.
* Paquetes completos con vuelo, estancia, actividades y transporte cuando aplique.

La prioridad comercial son los paquetes vacacionales completos.

---

## 12. Destinos iniciales

Crear inicialmente estos destinos:

1. Cancún.
2. Riviera Maya.
3. Playa del Carmen.

Cada destino debe permitir:

* Nombre ES / EN.
* Slug ES / EN.
* Descripción ES / EN.
* Imagen principal.
* Galería opcional.
* Estado: activo/inactivo.
* Orden de aparición.
* CTA a WhatsApp.

---

## 13. Promociones

Las promociones son ofertas internas publicadas por AC Travel Mx.

### Estados de promoción

```text
borrador
publicada
pausada
archivada
```

### Visibilidad

```text
publica
privada
interna
```

### Campos mínimos

* Título ES.
* Título EN.
* Slug ES.
* Slug EN.
* Destino.
* Tipo de promoción.
* Imagen principal.
* Galería opcional.
* Descripción ES.
* Descripción EN.
* Incluye ES.
* Incluye EN.
* No incluye ES.
* No incluye EN.
* Condiciones ES.
* Condiciones EN.
* Tipo de precio visible:

  * `desde`.
  * `consultar`.
* Precio desde MXN opcional.
* Precio desde USD opcional.
* Vigencia opcional.
* Cupos opcionales.
* Disponibilidad:

  * `por_confirmar`.
  * `cupos_limitados`.
  * `fechas_especificas`.
* Estado.
* Visibilidad.
* Mensaje WhatsApp personalizado opcional.

### Reglas de precio

Si el tipo de precio es `desde`, mostrar:

```text
Desde $X MXN
From $X USD
```

Si el tipo de precio es `consultar`, mostrar:

```text
Consultar disponibilidad
Check availability
```

No implementar conversión automática en MVP. Guardar precios MXN y USD manualmente cuando aplique.

---

## 14. Formulario de cotización

### Campos obligatorios

* Nombre del titular.
* WhatsApp.
* Email opcional pero recomendado.
* Idioma preferido: ES / EN.
* Moneda preferida: MXN / USD.
* Origen.
* Destino principal.
* Destinos adicionales opcionales.
* Fecha tentativa de salida.
* Fecha tentativa de regreso.
* Adultos.
* Menores.
* Tipo de servicio de interés.
* Presupuesto aproximado.
* Canal de origen.
* Consentimiento de contacto.

### Campos opcionales

* Edad de menores.
* Flexibilidad de fechas.
* Tipo de viaje:

  * Familiar.
  * Pareja.
  * Grupo.
  * Luna de miel.
  * Descanso.
  * Aventura.
  * Otro.
* Categoría de hotel deseada.
* Actividades de interés.
* Sugerencias vistas.
* Comentarios adicionales.

### Al enviar el formulario

El sistema debe:

1. Validar datos con Zod.
2. Crear o actualizar contacto en Supabase.
3. Crear lead.
4. Crear solicitud de cotización.
5. Registrar evento en `lead_events`.
6. Enviar notificación por email al admin.
7. Enviar confirmación por email al cliente si proporcionó email.
8. Sincronizar el lead automáticamente a Google Sheets.
9. Mostrar página o bloque de confirmación.
10. Ofrecer botón para continuar por WhatsApp con mensaje prellenado.

---

## 15. WhatsApp Business MVP

### Número oficial

```text
+52 998 845 3455
```

Para links usar formato internacional sin símbolos:

```text
529988453455
```

### MVP

Usar links prellenados tipo:

```text
https://wa.me/529988453455?text=MENSAJE_ENCODED
```

### Tracking

No enviar directo a WhatsApp desde las cards. Crear una ruta o acción intermedia que registre el clic y luego redirija a WhatsApp.

Ejemplo conceptual:

```text
/api/whatsapp-click?source=promotion&promotionId=...&locale=es&currency=MXN
```

La acción debe registrar:

* Fecha/hora.
* Fuente.
* Página origen.
* Promoción si aplica.
* Destino si aplica.
* Idioma.
* Moneda.
* UTM source.
* UTM medium.
* UTM campaign.
* User agent.
* IP si se decide guardar, cuidando privacidad.

### Mensajes prellenados

#### Desde promoción

```text
Hola AC Travel Mx, me interesa esta promoción: [NOMBRE_PROMOCION]. Viajaríamos [ADULTOS] adultos y [MENORES] menores. Me gustaría cotizar en [MXN/USD]. ¿Me pueden compartir disponibilidad y detalles?
```

#### Desde destino

```text
Hola AC Travel Mx, me interesa viajar a [DESTINO]. Quisiera recibir opciones de paquetes vacacionales completos. ¿Me pueden ayudar a cotizar?
```

#### Desde formulario enviado

```text
Hola AC Travel Mx, acabo de enviar una solicitud de cotización desde la página web. Mi nombre es [NOMBRE] y me interesa viajar a [DESTINO]. Quedo atento/a a sus opciones.
```

#### Inglés desde promoción

```text
Hi AC Travel Mx, I’m interested in this deal: [DEAL_NAME]. We would be [ADULTS] adults and [CHILDREN] children. I’d like to quote in [MXN/USD]. Could you please share availability and details?
```

---

## 16. CRM interno MVP

### Estados iniciales del lead

Crear catálogo inicial:

```text
nuevo
contactado
calificando_viaje
cotizacion_en_proceso
cotizacion_enviada
seguimiento
anticipo_pendiente
pago_parcial_recibido
pago_completo_recibido
reserva_confirmada
documentacion_enviada
ganado
perdido
cancelado
```

### Detalle de lead

Debe mostrar:

* Datos del titular.
* WhatsApp.
* Email.
* Idioma preferido.
* Moneda preferida.
* Origen.
* Destino(s).
* Fechas.
* Adultos.
* Menores.
* Presupuesto.
* Servicios solicitados.
* Canal de origen.
* Promoción asociada.
* Asesor asignado.
* Estado.
* Notas internas.
* Historial de eventos.
* Pagos.
* Reservas.
* Documentos.

### Acciones del admin/asesor

* Cambiar estado.
* Agregar nota.
* Asignar asesor.
* Crear cotización básica.
* Registrar pago manual.
* Crear reserva.
* Adjuntar documento.
* Copiar plantilla de WhatsApp.
* Ver historial.

---

## 17. Roles internos

Aunque inicialmente solo existe un admin, crear roles desde el inicio.

### Roles

```text
admin
asesor
operaciones
finanzas
marketing
```

### Permisos conceptuales

#### Admin

* Acceso total.
* Gestión de usuarios.
* Gestión de roles.
* Gestión de promociones.
* Gestión de leads.
* Gestión de pagos.
* Gestión de reservas.
* Gestión de documentos.
* Configuración.

#### Asesor

* Ver leads asignados.
* Actualizar estados.
* Agregar notas.
* Crear cotizaciones.
* Registrar seguimiento.

#### Operaciones

* Ver reservas.
* Gestionar documentos.
* Gestionar vouchers.
* Ver proveedores si se implementan.

#### Finanzas

* Ver y validar pagos.
* Registrar comprobantes.
* Ver saldos.

#### Marketing

* Crear y editar promociones.
* Gestionar destinos.
* Ver métricas de campañas.

### MVP real

El primer usuario será:

```text
admin + asesor principal
```

---

## 18. Panel interno MVP

### Rutas admin sugeridas

```text
/admin/login
/admin/dashboard
/admin/leads
/admin/leads/[id]
/admin/promociones
/admin/promociones/new
/admin/promociones/[id]/edit
/admin/destinos
/admin/servicios
/admin/pagos
/admin/reservas
/admin/documentos
/admin/plantillas
/admin/usuarios
/admin/configuracion
```

### Dashboard

Mostrar cards con:

* Leads nuevos.
* Leads pendientes de contacto.
* Cotizaciones en proceso.
* Cotizaciones enviadas.
* Pagos pendientes de validar.
* Reservas próximas.
* Promociones activas.
* Clics a WhatsApp.
* Leads por canal.

### Leads

Tabla con:

* Fecha.
* Nombre.
* WhatsApp.
* Destino.
* Fechas.
* Presupuesto.
* Estado.
* Canal.
* Asesor.
* Última actualización.

Filtros:

* Estado.
* Destino.
* Canal.
* Fecha.
* Asesor.
* Moneda.

---

## 19. Pagos MVP

Los pagos en MVP serán manuales, pero estructurados.

### Métodos iniciales

```text
transferencia_directa
deposito_efectivo
otro_manual
```

### Métodos futuros preparados

```text
mercado_pago
stripe
oxxo
tarjeta
spei
```

### Tipos de pago

```text
anticipo
parcial
total
saldo
```

### Estados de pago

```text
pendiente
comprobante_recibido
en_revision
confirmado
rechazado
reembolsado
cancelado
```

### Campos de pago

* Lead.
* Cliente.
* Reserva opcional.
* Monto.
* Moneda.
* Método.
* Tipo.
* Estado.
* Fecha límite.
* Fecha de recepción.
* Comprobante.
* Validado por.
* Notas internas.

---

## 20. Reservas MVP

Las reservas serán registros internos, no motor de reserva público.

### Estados de reserva

```text
pendiente
solicitada
confirmada
cancelada
completada
```

### Campos mínimos

* Lead.
* Cliente.
* Destino.
* Fechas.
* Servicios incluidos.
* Proveedor opcional.
* Monto total.
* Moneda.
* Estado.
* Notas internas.
* Documentos relacionados.

---

## 21. Documentos MVP

Tipos de documentos:

```text
cotizacion
confirmacion_reserva
recibo
voucher
otro
```

### MVP

Permitir registrar y adjuntar archivos manualmente.

### Campos

* Tipo.
* Cliente.
* Lead.
* Reserva opcional.
* Archivo.
* Estado.
* Fecha de creación.
* Fecha de envío.
* Notas.

### Futuro

Generar PDFs automáticamente desde plantillas.

---

## 22. Plantillas MVP

Crear módulo simple de plantillas copiables.

### Tipos

```text
whatsapp
email
documento
```

### Plantillas iniciales

* Primer contacto WhatsApp.
* Solicitud de datos faltantes.
* Envío de cotización.
* Seguimiento de cotización.
* Confirmación de anticipo.
* Confirmación de pago completo.
* Solicitud de comprobante.
* Confirmación de reserva.
* Envío de voucher.
* Recordatorio de viaje.
* Postventa.

### Variables soportadas

```text
{{cliente_nombre}}
{{asesor_nombre}}
{{destino}}
{{origen}}
{{fecha_salida}}
{{fecha_regreso}}
{{adultos}}
{{menores}}
{{moneda}}
{{presupuesto}}
{{promocion}}
{{monto_anticipo}}
{{saldo_pendiente}}
{{fecha_limite_pago}}
{{link_pago}}
{{link_sesion}}
```

---

## 23. Google Sheets MVP

### Regla principal

Supabase es la fuente de verdad. Google Sheets recibe copia automática de leads.

### Dirección de sincronización MVP

```text
Supabase → Google Sheets
```

No implementar edición bidireccional en MVP.

### Columnas sugeridas

```text
Fecha
Nombre
WhatsApp
Email
Idioma
Moneda
Origen
Destino
Adultos
Menores
Fechas
Presupuesto
Servicio
Canal
Promoción
Estado
Asesor
Última nota
Lead ID
```

### Logs

Crear `sheet_sync_logs` para registrar:

* Lead ID.
* Fecha.
* Estado: éxito/error.
* Mensaje de error si aplica.
* Row ID o referencia si está disponible.

Si falla Google Sheets, el lead debe permanecer correctamente guardado en Supabase.

---

## 24. Notificaciones MVP

### Al admin

Enviar por correo:

* Nuevo lead.
* Nueva solicitud de cotización.
* Comprobante recibido.
* Reserva creada.

Preparar futuro aviso por WhatsApp, pero no automatizar en MVP si requiere Cloud API.

### Al cliente

Enviar por correo si dejó email:

* Confirmación de solicitud recibida.
* Confirmación de cotización enviada.
* Confirmación de pago recibido.
* Confirmación de reserva.

### Logs

Registrar en `notification_logs`:

* Tipo.
* Canal.
* Destinatario.
* Estado.
* Error si aplica.
* Fecha.
* Lead relacionado.

---

## 25. Calendario MVP

Las sesiones privadas son gratuitas y solo para clientes con conversación iniciada por WhatsApp.

### MVP

No crear calendario público abierto.

Usar link externo privado de Calendly, Cal.com o Google Calendar Appointment Schedule.

### Registro interno

Permitir registrar sesión asociada a un lead:

* Lead.
* Cliente.
* Asesor.
* Fecha.
* Hora.
* Link de reunión.
* Estado:

  * agendada.
  * completada.
  * cancelada.
  * no_asistio.
* Notas.

---

## 26. Modelo conceptual de base de datos

Codex debe crear migraciones Supabase ordenadas. La estructura exacta puede ajustarse durante implementación, pero debe respetar este modelo conceptual.

### Tablas MVP

```text
profiles
roles
profile_roles
contacts
leads
lead_statuses
lead_notes
lead_events
quote_requests
destinations
services
promotions
promotion_media
payments
payment_methods
bookings
documents
message_templates
whatsapp_clicks
notification_logs
sheet_sync_logs
```

### Tablas futuras, no obligatorias en MVP

```text
conversations
conversation_messages
payment_links
payment_webhook_events
calendar_sessions
drive_files
audit_logs
providers
internal_services
service_costs
public_prices
```

---

## 27. Reglas de seguridad

### Supabase Auth

Usar Supabase Auth para usuarios internos.

### RLS

Activar RLS en todas las tablas sensibles.

### Políticas mínimas

* Público puede leer solo promociones/destinos/servicios publicados.
* Público puede crear solicitudes de cotización mediante endpoint seguro.
* Usuarios internos autenticados pueden acceder al panel según rol.
* Solo admin puede gestionar usuarios y roles.
* Finanzas puede ver pagos.
* Marketing puede gestionar promociones.
* Asesor puede ver y editar leads asignados.

### Datos personales

Proteger:

* Teléfonos.
* Emails.
* Nombres.
* Presupuestos.
* Datos de viaje.
* Comprobantes.

No exponer datos de leads en páginas públicas.

---

## 28. Variables de entorno

Crear `.env.example` con nombres como:

> Nota del proyecto (2026-05-26): por decisión explícita del usuario, AC Travel usa el modelo moderno de llaves Supabase y no el naming legacy del prompt original.

```env
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

NEXT_PUBLIC_WHATSAPP_PHONE=529988453455

RESEND_API_KEY=
SENDGRID_API_KEY=
EMAIL_FROM=
EMAIL_ADMIN=

GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_LEADS_TAB=

NEXT_PUBLIC_DEFAULT_LOCALE=es
NEXT_PUBLIC_DEFAULT_CURRENCY=MXN
```

No subir `.env.local` al repositorio.

---

## 29. Contenido legal MVP

Crear páginas base, aunque el texto final sea pendiente de revisión legal.

Páginas:

* Aviso de privacidad.
* Términos y condiciones.
* Política de pagos, cancelaciones y reembolsos.

Marcar el contenido legal como provisional si no está validado.

No inventar condiciones legales específicas sin confirmación.

---

## 30. Criterios de UX/UI

### Estilo

* Elegante pero accesible.
* Familiar y comercial.
* Mobile-first.
* Botones claros.
* Buen contraste.
* Pocas decisiones por pantalla.
* CTA visible a WhatsApp.
* Evitar saturación de texto.
* Usar cards limpias para promociones.
* Usar imágenes cálidas de vacaciones.

### Componentes principales

* Navbar bilingüe.
* Switch de idioma.
* Switch de moneda.
* Botón WhatsApp.
* Hero.
* PromotionCard.
* DestinationCard.
* ServiceCard.
* QuoteForm.
* AdminSidebar.
* AdminHeader.
* DataTable.
* StatusBadge.
* PaymentStatusBadge.
* DocumentCard.

---

## 31. SEO básico

Implementar:

* Metadata por página.
* Open Graph.
* Titles bilingües.
* Descriptions bilingües.
* Slugs limpios.
* Sitemap.
* Robots.txt.
* Imágenes con alt text.

Palabras clave iniciales:

Español:

```text
agencia de viajes en México
paquetes vacacionales Cancún
viajes Riviera Maya
paquetes Playa del Carmen
cotizar viaje por WhatsApp
```

Inglés:

```text
travel agency Mexico
Cancun vacation packages
Riviera Maya travel packages
Playa del Carmen vacation deals
quote travel by WhatsApp
```

---

## 32. Orden de implementación

### Bloque 1 — Setup base

* Crear proyecto Next.js.
* Configurar TypeScript.
* Configurar Tailwind.
* Instalar shadcn/ui.
* Configurar estructura `/es` y `/en`.
* Configurar layout público.
* Configurar layout admin.
* Crear `.env.example`.
* Conectar Supabase.
* Configurar Supabase Auth.

### Bloque 2 — Identidad visual

* Crear tokens de color.
* Configurar tema Tailwind.
* Crear componentes base.
* Crear Navbar.
* Crear Footer.
* Crear WhatsApp CTA.
* Crear LanguageSwitch.
* Crear CurrencySwitch.

### Bloque 3 — Sitio público

* Home.
* Servicios.
* Paquetes.
* Promociones.
* Detalle promoción.
* Destinos.
* Cotizar.
* Nosotros.
* Contacto.
* Páginas legales.

### Bloque 4 — Supabase

* Crear migraciones.
* Crear tablas principales.
* Crear catálogos iniciales.
* Crear roles.
* Crear usuario admin inicial.
* Activar RLS.
* Crear políticas.
* Crear seed básico.

### Bloque 5 — Formulario y leads

* Crear QuoteForm.
* Validar con Zod.
* Crear endpoint/server action.
* Crear contacto.
* Crear lead.
* Crear quote_request.
* Crear lead_event.
* Enviar email admin.
* Enviar email cliente si aplica.
* Sincronizar Google Sheets.
* Mostrar confirmación.
* Generar CTA WhatsApp contextual.

### Bloque 6 — Panel interno

* Login.
* Dashboard.
* Leads.
* Detalle de lead.
* Notas.
* Cambio de estado.
* Promociones CRUD.
* Destinos CRUD.
* Servicios CRUD.
* Pagos manuales.
* Reservas.
* Documentos básicos.
* Plantillas.

### Bloque 7 — WhatsApp tracking

* Crear endpoint de tracking.
* Registrar clicks.
* Redirigir a WhatsApp.
* Mostrar métricas básicas.

### Bloque 8 — Notificaciones

* Configurar email provider.
* Crear templates email.
* Registrar notification_logs.
* Manejar errores.

### Bloque 9 — Google Sheets

* Configurar integración.
* Crear función appendLeadToSheet.
* Crear logs.
* Manejar errores sin romper registro principal.

### Bloque 10 — QA y lanzamiento

* Probar mobile.
* Probar bilingüe.
* Probar moneda.
* Probar formulario.
* Probar WhatsApp.
* Probar panel admin.
* Probar RLS.
* Probar carga de promociones.
* Probar Google Sheets.
* Ejecutar lint.
* Ejecutar build.
* Preparar deploy en Vercel.

---

## 33. Archivos de documentación obligatorios

Crear y mantener:

### `/docs/PROGRESS.md`

Debe tener:

```markdown
# Progreso AC Travel Mx MVP

## Estado general

## Completado

## En proceso

## Pendiente

## Bloqueos

## Última actualización
```

### `/docs/DECISIONS.md`

Debe registrar decisiones importantes:

```markdown
# Decisiones técnicas y de producto

## Fecha

## Decisión

## Contexto

## Alternativas consideradas

## Motivo

## Impacto
```

### `/docs/ROADMAP.md`

Debe separar:

* MVP v1.
* Fase 2.
* Fase 3.

### `/docs/ENVIRONMENT.md`

Debe explicar variables de entorno y cómo configurarlas sin incluir secretos reales.

---

## 34. Criterios de aceptación del MVP

El MVP se considera listo cuando:

1. El sitio público funciona en español e inglés.
2. El usuario puede cambiar moneda MXN/USD.
3. Existen páginas de home, servicios, promociones, destinos, cotizar, nosotros y contacto.
4. Las promociones pueden cargarse desde panel interno.
5. Las promociones publicadas aparecen en la web.
6. El CTA de WhatsApp abre conversación con mensaje contextual.
7. Se registran clicks a WhatsApp.
8. El formulario de cotización crea contacto, lead y solicitud.
9. El admin recibe notificación de nuevo lead.
10. El cliente recibe confirmación si dejó email.
11. El lead se sincroniza automáticamente a Google Sheets.
12. El admin puede entrar al panel.
13. El admin puede ver y gestionar leads.
14. El admin puede cambiar estado y agregar notas.
15. El admin puede registrar pagos manuales.
16. El admin puede crear reservas básicas.
17. El admin puede adjuntar o registrar documentos.
18. RLS está activado en tablas sensibles.
19. No hay secretos expuestos en el repositorio.
20. El proyecto compila sin errores.

---

## 35. Roadmap futuro

### Fase 2

* WhatsApp Cloud API.
* Webhooks de mensajes.
* Plantillas oficiales de WhatsApp.
* Bandeja de conversaciones.
* Mercado Pago.
* Stripe.
* Webhooks de pagos.
* Google Drive API.
* Generación de PDFs.
* Reportes avanzados.
* Calendario integrado.

### Fase 3

* Bot de calificación inicial.
* Portal de cliente.
* Motor de agenda propio.
* Automatizaciones comerciales.
* Scoring de leads.
* IA para cotizaciones y respuestas.
* APIs de sugerencias de viaje.
* Dashboard financiero.
* Gestión avanzada de proveedores.

---

## 36. Instrucción final para Codex

Construye este MVP por bloques. No intentes completar todo en un solo paso.

Después de cada bloque:

1. Actualiza `/docs/PROGRESS.md`.
2. Registra decisiones importantes en `/docs/DECISIONS.md`.
3. Ejecuta validaciones básicas.
4. Deja claro qué está completo y qué falta.
5. Evita deuda técnica innecesaria.

Prioridad absoluta:

```text
Conversión a WhatsApp + registro de leads + gestión básica interna.
```

Todo lo demás debe apoyar esa prioridad.
