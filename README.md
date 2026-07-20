# actravel

MVP Next.js para AC Travel Mx con sitio público bilingüe, formulario de cotización, panel interno, tracking de WhatsApp, emails Resend y sincronización server-side a Google Sheets.

## Estado

**Ready for MVP launch**: la verificación local final pasa y una cotización real confirmó persistencia en Supabase y sincronización live exitosa a Google Sheets.

## Setup mínimo

```bash
cp .env.example .env.local
npm install
npm run dev
```

Para validar:

```bash
npm run lint
npm run build
npm run test:quote-notifications
npm run test:google-sheets
```

## E2E critical flow

```bash
npm run test:e2e:install
npm run db:bootstrap-admin
npm run test:e2e
```

Playwright forces `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` in its local web server so the browser still exercises rendering, quote persistence, WhatsApp redirect behavior, and admin visibility without sending real Resend, Google Sheets, or Meta Conversions traffic. It reads `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` first, then falls back to `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.

Ver `docs/ENVIRONMENT.md` para variables y `docs/PROGRESS.md` para estado de lanzamiento.
