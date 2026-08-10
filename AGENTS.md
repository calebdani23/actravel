# Agent Notes

- This repo contains the AC Travel Next.js application at the repository root with App Router, TypeScript, Tailwind, Supabase integration, admin routes, tests, and launch docs.
- Root `opencode.json` is the active OpenCode config; it sets `permission: "allow"`, enables `openai` and `github-copilot`, and loads instructions from `AGENTS.md` then `README.md`.
- Use plain `opencode` from inside the repo to hit the shared installation at `~/.opencode/bin/opencode`; the global wrapper at `~/.local/bin/opencode` auto-detects the nearest repo `opencode.json`, sets `OPENCODE_CONFIG` / `OPENCODE_CONFIG_DIR`, and keeps XDG runtime state under `.opencode-runtime/`.
- Use `./scripts/gentle-ai` as the standard per-repo Gentle-AI command; it isolates `HOME` to `.gentle-home`, copies root `opencode.json` into that home, runs the shared global Gentle-AI binary, and syncs config changes back only to repo-root `opencode.json`.
- `.gitignore` intentionally ignores repo-local OpenCode/Gentle-AI state such as `.opencode/`, `.opencode-runtime/`, `.gentle-home/`, and legacy runtime/cache directories, plus env files, build caches, `data/`, `tmp/`, and coverage output.
- `.opencode/package.json` still only installs `@opencode-ai/plugin@1.15.0`; the actual application manifest and lockfile live at the repo root in `package.json` and `package-lock.json`.

## AC Travel Business OS context router

For substantial product or implementation work:

1. Read `docs/implementation/ACTIVE.md`.
2. Read only the active week/change documents referenced there.
3. Use `docs/blueprints/INDEX.md` to locate extra business, product, or architecture context on demand.
4. Do **not** bulk-read all Blueprint volumes or all repository docs by default.
5. Treat current code/schema/tests as executable reality and active change specs as the exact implementation scope.
6. Preserve existing migration, RLS, quote, CRM, and data-integrity invariants unless the active change explicitly defines a compatible migration/cutover.
7. Record durable implementation decisions in `docs/DECISIONS.md` and verified shipped state in `docs/PROGRESS.md`.
8. Historical MVP roadmaps are provenance, not the active Business OS roadmap.

### Progressive context rule

Default context should normally be: `AGENTS.md` + `ACTIVE.md` + one week brief + one active change + the smallest referenced code/migrations/tests set. Search before broad-reading. If understanding requires 4+ repository files, follow the repo's existing delegation/exploration rules instead of inflating the parent context.
