# AC Travel Blueprint Context Index

This directory is the durable context library for the AC Travel Business OS program.

**Progressive-context rule:** start from `docs/implementation/ACTIVE.md`, then the active week/change. Open Blueprint sections only when a concrete question requires them.

## Volumes

| Source | Use it for |
| --- | --- |
| [Volume I — Business](./VOLUME_I_BUSINESS.md) | Business rules, actors, lifecycle, ownership, handoffs, SLA, policy, non-negotiable rules |
| [Volume II — Product](./VOLUME_II_PRODUCT.md) | Public site, `Mis viajes`, staff panel, navigation, workspaces, role UX, screen boundaries |
| [Volume III — Technical](./VOLUME_III_TECHNICAL.md) | Repository evolution, target modules/data, RLS, migrations, tests, CI/CD, 12-week roadmap |

These Markdown files are **agent-optimized canonical mirrors** of the approved Blueprints: concise enough to search/read selectively while preserving the decisions that implementation must honor.

## Fast topic router

| Topic | Read |
| --- | --- |
| Contact / Opportunity / Quote / Trip / Booking / Traveler / Task / Incident vocabulary | Volume I: `Core business vocabulary` |
| What counts as won / handoff rules | Volume I: `Commercial and operations transition rules` |
| Roles / ownership / approvals | Volume I: `Actors and ownership`; Volume III: `Roles and capabilities` |
| SLA / follow-up policy | Volume I: `SLA`; Volume III: `Tasks, SLA and automation` |
| Public website and quote funnel | Volume II: `Public website`; Volume III: `Public web and CMS` |
| Customer portal / `Mis viajes` | Volume II: `Customer portal`; Volume III: `Customer identity and portal` |
| CRM / Contact 360 / Opportunity | Volume II: `Staff CRM`; Volume III: `CRM evolution` |
| Quote workflow / versions / acceptance | Volume II: `Quotes`; Volume III: `Quotes and verified acceptance` |
| Trips / reservations / travelers / documents | Volume II: `Operations`; Volume III: `Trip aggregate` |
| Payments / balances / payment plan | Volume II: `Finance`; Volume III: `Finance model` |
| CMS / public catalog | Volume II: `CMS`; Volume III: `Public web and CMS` |
| Marketing Studio / attribution | Volume II: `Marketing Studio`; Volume III: `Marketing and attribution` |
| Suppliers | Volume II: `Suppliers`; Volume III: `Suppliers` |
| Customer requests / travel incidents | Volume II: `Requests and support`; Volume III: `Travel support incidents` |
| Activity vs audit vs technical logs | Volume II: `Analytics and governance`; Volume III: `Event/log separation` |
| Target data architecture | Volume III: `Data architecture` |
| Migration compatibility | Volume III: `Migration strategy` |
| Security / RLS / privacy | Volume I: `Privacy and governance`; Volume III: `Security and RLS` |
| Testing / CI / rollback | Volume III: `Testing and release` |
| 12-week roadmap | Volume III: `Initial 12-week roadmap` |
| Codex / SDD working method | Volume III: `Agent execution contract` |

## Search before bulk-reading

Examples:

```bash
rg -n "customer_accounts|portal|Mis viajes" docs/blueprints
rg -n "handoff|accepted quote|operations" docs/blueprints
rg -n "payment_obligations|allocation|balance" docs/blueprints
rg -n "RLS|customer access|traveler" docs/blueprints
```

## Compatibility vocabulary

- Physical table `leads` remains in the initial evolution; in target business/product language it represents **Opportunity / Oportunidad**. Do not rename it merely to match vocabulary.
- Physical table `bookings` remains and evolves into an individual reservation/service under the future **Trip** aggregate.
- `quote_requests` remains an inbound request; it is not the same entity as a commercial `quote`.

## Historical planning

`docs/ROADMAP.md`, `docs/NEXT_STEPS_ROADMAP.md`, and `docs/AC_TRAVEL_MVP_MASTER_PROMPT.md` are historical MVP planning/provenance. Current Business OS execution is governed by `docs/implementation/*` and the active change.
