# actravel

Next.js platform for AC Travel Mx with a bilingual public site, quote intake, internal operations, WhatsApp tracking, Resend email, and Supabase as the operational source of truth.

## Current repository state

The MVP foundation is operational and has evolved into a contact-centric CRM with standalone commercial quote management. Google Sheets is no longer on the active production path.

## Minimal setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Baseline validation:

```bash
npm run lint
npm run build
npm run test:quote-notifications
```

Critical E2E:

```bash
npm run test:e2e:install
npm run db:bootstrap-admin
npm run test:e2e
```

Playwright uses `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` for its local web server so browser flows do not send real Resend or Meta Conversions traffic.

See `docs/ENVIRONMENT.md` for environment variables and `docs/PROGRESS.md` for verified implementation history.

## AC Travel Business OS — active implementation context

The post-MVP evolution is routed through:

- `docs/implementation/ACTIVE.md` — minimal current-cycle context and next action.
- `docs/implementation/README.md` — execution rules, authority order, and 12-week roadmap.
- `docs/blueprints/INDEX.md` — fast access to Business, Product, and Technical Blueprint context.

Agents must start from `ACTIVE.md` and load additional context only on demand. Do not read all Blueprint material by default.
