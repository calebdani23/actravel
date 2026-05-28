import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LeadTemplateActions } from "@/components/admin/leads/whatsapp-template-actions";
import { leadTemplateVariables } from "@/lib/admin/template-renderer";

test("lead template actions render grouped channel actions and disabled states", () => {
  const variables = leadTemplateVariables({
    contactName: "Ada",
    destination: "Riviera Maya",
    travelersCount: 3,
    advisorName: "Caleb",
  });

  const html = renderToStaticMarkup(
    <LeadTemplateActions
      templates={[
        {
          id: "w1",
          name: "Seguimiento WhatsApp",
          channel: "whatsapp",
          category: "seguimiento",
          description: "Mensaje de seguimiento",
          subject_es: null,
          subject_en: null,
          body_es: "Hola {{name}}, seguimos con {{destination}}",
          body_en: "Hi {{name}}, following up on {{destination}}",
        },
        {
          id: "e1",
          name: "Resumen por correo",
          channel: "email",
          category: "resumen",
          description: "Resumen comercial",
          subject_es: "Cotización para {{destination}}",
          subject_en: "Quote for {{destination}}",
          body_es: "Hola {{name}}",
          body_en: "Hello {{name}}",
        },
      ]}
      variables={variables}
      phone={null}
      email="ada@example.com"
      locale="es"
      leadId="lead-1"
      contactId="contact-1"
    />,
  );

  assert.match(html, /<optgroup label="seguimiento">/);
  assert.match(html, /<optgroup label="resumen">/);
  assert.match(html, /Este lead no tiene WhatsApp usable\./);
  assert.match(html, /mailto:ada%40example.com/);
  assert.match(html, /Cotización para Riviera Maya/);
  assert.match(html, /Abrir Email/);
  assert.match(html, /Copiar asunto/);
  assert.match(html, /Copiar cuerpo/);
});

test("lead template actions render tracked WhatsApp href and disable email when missing", () => {
  const variables = leadTemplateVariables({
    contactName: "Ada",
    destination: "Cancun",
    travelersCount: 2,
    advisorName: null,
  });

  const html = renderToStaticMarkup(
    <LeadTemplateActions
      templates={[
        {
          id: "w1",
          name: "Seguimiento WhatsApp",
          channel: "whatsapp",
          category: "seguimiento",
          description: null,
          subject_es: null,
          subject_en: null,
          body_es: "Hola {{name}}, seguimos con {{destination}}",
          body_en: "Hi {{name}}, following up on {{destination}}",
        },
        {
          id: "e1",
          name: "Resumen por correo",
          channel: "email",
          category: "resumen",
          description: null,
          subject_es: "Cotización para {{destination}}",
          subject_en: "Quote for {{destination}}",
          body_es: "Hola {{name}}",
          body_en: "Hello {{name}}",
        },
      ]}
      variables={variables}
      phone="+52 998 845 3455"
      email={null}
      locale="es"
      leadId="11111111-1111-4111-8111-111111111111"
      contactId="22222222-2222-4222-8222-222222222222"
    />,
  );

  assert.match(html, /Este lead no tiene email usable\./);
  assert.match(html, /Abrir WhatsApp/);
  assert.match(html, /api\/whatsapp-click\?/);
  assert.match(html, /message=Hola\+Ada%2C\+seguimos\+con\+Cancun/);
  assert.match(html, /phone=529988453455/);
  assert.match(html, /leadId=11111111-1111-4111-8111-111111111111/);
  assert.match(html, /contactId=22222222-2222-4222-8222-222222222222/);
  assert.match(html, /Abrir Email/);
  assert.match(html, /disabled="" type="button">Abrir Email/);
});
