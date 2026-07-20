# actravel

MVP Next.js para AC Travel Mx con sitio público bilingüe, formulario de cotización, panel interno, tracking de WhatsApp y emails Resend, con Supabase como fuente única de verdad operativa.

## Estado

**Ready for MVP launch**: la verificación local final pasa y la operación productiva queda consolidada sobre Supabase; Google Sheets fue retirado de la ruta activa de producción.

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
```

## E2E critical flow

```bash
npm run test:e2e:install
npm run db:bootstrap-admin
npm run test:e2e
```

Playwright forces `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` in its local web server so the browser still exercises rendering, quote persistence, WhatsApp redirect behavior, and admin visibility without sending real Resend or Meta Conversions traffic. It reads `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` first, then falls back to `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.

Ver `docs/ENVIRONMENT.md` para variables y `docs/PROGRESS.md` para estado de lanzamiento.
