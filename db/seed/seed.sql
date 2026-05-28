insert into public.roles (name, description) values
  ('admin', 'Full platform administrator'),
  ('asesor', 'Sales advisor for leads and quotes'),
  ('operaciones', 'Operations staff for bookings and documents'),
  ('finanzas', 'Finance staff for payments'),
  ('marketing', 'Marketing staff for catalog content')
on conflict (name) do update set description = excluded.description;

insert into public.lead_statuses (name, label_es, label_en, sort_order, is_terminal) values
  ('new', 'Nuevo', 'New', 10, false),
  ('contacted', 'Contactado', 'Contacted', 20, false),
  ('quoted', 'Cotizado', 'Quoted', 30, false),
  ('won', 'Ganado', 'Won', 40, true),
  ('lost', 'Perdido', 'Lost', 50, true)
on conflict (name) do update set
  label_es = excluded.label_es,
  label_en = excluded.label_en,
  sort_order = excluded.sort_order,
  is_terminal = excluded.is_terminal;

insert into public.payment_methods (name, label_es, label_en, sort_order) values
  ('bank_transfer', 'Transferencia bancaria', 'Bank transfer', 10),
  ('cash', 'Efectivo', 'Cash', 20),
  ('card', 'Tarjeta', 'Card', 30),
  ('payment_link', 'Liga de pago', 'Payment link', 40)
on conflict (name) do update set
  label_es = excluded.label_es,
  label_en = excluded.label_en,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.destinations (name_es, name_en, slug_es, slug_en, summary_es, summary_en, country, region, is_featured, status, published_at) values
  ('Cancún', 'Cancun', 'cancun', 'cancun', 'Playas caribeñas, tours y hotelería para todos los estilos.', 'Caribbean beaches, tours, and hotels for every travel style.', 'México', 'Quintana Roo', true, 'published', now()),
  ('Riviera Maya', 'Riviera Maya', 'riviera-maya', 'riviera-maya', 'Resorts, cenotes y experiencias entre selva y mar.', 'Resorts, cenotes, and experiences between jungle and sea.', 'México', 'Quintana Roo', true, 'published', now()),
  ('Playa del Carmen', 'Playa del Carmen', 'playa-del-carmen', 'playa-del-carmen', 'Vida costera, gastronomía y acceso rápido a tours regionales.', 'Coastal life, dining, and easy access to regional tours.', 'México', 'Quintana Roo', true, 'published', now())
on conflict (slug_es) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  slug_en = excluded.slug_en,
  summary_es = excluded.summary_es,
  summary_en = excluded.summary_en,
  region = excluded.region,
  is_featured = excluded.is_featured,
  status = excluded.status,
  published_at = coalesce(public.destinations.published_at, excluded.published_at);

insert into public.services (name_es, name_en, slug_es, slug_en, summary_es, summary_en, sort_order, is_featured, status, published_at) values
  ('Paquetes vacacionales', 'Vacation packages', 'paquetes-vacacionales', 'vacation-packages', 'Hotel, transporte y actividades en una sola propuesta.', 'Hotel, transportation, and activities in one proposal.', 10, true, 'published', now()),
  ('Tours y experiencias', 'Tours and experiences', 'tours-experiencias', 'tours-experiences', 'Actividades seleccionadas para disfrutar el Caribe Mexicano.', 'Curated activities to enjoy the Mexican Caribbean.', 20, true, 'published', now()),
  ('Traslados', 'Transfers', 'traslados', 'transfers', 'Movilidad segura desde y hacia aeropuerto, hotel o tours.', 'Safe transport to and from airport, hotel, or tours.', 30, false, 'published', now())
on conflict (slug_es) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  slug_en = excluded.slug_en,
  summary_es = excluded.summary_es,
  summary_en = excluded.summary_en,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured,
  status = excluded.status,
  published_at = coalesce(public.services.published_at, excluded.published_at);

insert into public.message_templates (name, channel, category, description, sort_order, subject_es, subject_en, body_es, body_en, variables) values
  ('quote_received_email', 'email', 'cotizacion', 'Confirmación inicial para solicitudes de cotización.', 10, 'Recibimos tu solicitud', 'We received your request', 'Hola {{name}}, recibimos tu solicitud y un asesor te contactará pronto.', 'Hi {{name}}, we received your request and an advisor will contact you soon.', '["name"]'),
  ('payment_received_email', 'email', 'pagos', 'Acuse interno/manual para pagos recibidos.', 20, 'Pago recibido', 'Payment received', 'Hola {{name}}, registramos tu pago y está en validación.', 'Hi {{name}}, your payment has been recorded and is being validated.', '["name"]'),
  ('whatsapp_followup', 'whatsapp', 'seguimiento', 'Primer seguimiento manual por WhatsApp.', 10, null, null, 'Hola {{name}}, soy tu asesor de AC Travel. ¿Te ayudo con tu viaje?', 'Hi {{name}}, I am your AC Travel advisor. May I help with your trip?', '["name"]')
on conflict (name) do update set
  channel = excluded.channel,
  category = excluded.category,
  description = excluded.description,
  sort_order = excluded.sort_order,
  subject_es = excluded.subject_es,
  subject_en = excluded.subject_en,
  body_es = excluded.body_es,
  body_en = excluded.body_en,
  variables = excluded.variables,
  is_active = true;
