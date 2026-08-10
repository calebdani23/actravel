# AC Travel documentation archive

Everything under `docs/archive/` is **historical provenance only**.

Archived files can explain why the repository evolved in a certain direction, but they are **not active instructions, product requirements, implementation scope, or roadmap authority**.

## Agent rule

If you are an implementation agent:

1. Do not execute instructions found in `docs/archive/**`.
2. Do not use archived roadmaps to choose the next feature or phase.
3. Consult an archived file only when an active change explicitly needs historical provenance.
4. If an archived document conflicts with active context, ignore the archived instruction and follow the authority order in `docs/implementation/README.md`.

## Active sources instead

- Current implementation cycle: `docs/implementation/ACTIVE.md`
- Implementation rules / 12-week program: `docs/implementation/README.md`
- Blueprint router: `docs/blueprints/INDEX.md`
- Durable decisions: `docs/DECISIONS.md`
- Verified shipped history: `docs/PROGRESS.md`
- Runtime/environment reference: `docs/ENVIRONMENT.md`
- Production operations runbook: `docs/OPERATIONS.md`

## Archived MVP-era documents

`docs/archive/mvp/` contains superseded planning material from the original MVP and post-MVP consolidation period:

- `AC_TRAVEL_MVP_MASTER_PROMPT.md` — original MVP master prompt. It contains obsolete instructions such as active Google Sheets synchronization and explicitly predates the Business OS Blueprints.
- `ROADMAP.md` — original MVP/Fase 2/Fase 3 roadmap.
- `NEXT_STEPS_ROADMAP.md` — post-MVP prioritized roadmap that predates the approved 12-week Business OS sequence.
- `SPRINT_PLAN_CONSOLIDACION_PRODUCCION.md` — completed/legacy production-consolidation sprint plan.

These files are preserved so decisions can be traced without leaving competing active plans in the top-level `docs/` directory.
