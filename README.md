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

Ver `docs/ENVIRONMENT.md` para variables y `docs/PROGRESS.md` para estado de lanzamiento.
