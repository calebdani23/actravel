# Agent Notes

- This repo now contains the AC Travel MVP Next.js application at the repository root with App Router, TypeScript, Tailwind, Supabase integration, admin routes, tests, and launch docs.
- Root `opencode.json` is the active OpenCode config; it sets `permission: "allow"`, enables `openai` and `github-copilot`, and loads instructions from `AGENTS.md` then `README.md`.
- Use plain `opencode` from inside the repo to hit the shared installation at `~/.opencode/bin/opencode`; the global wrapper at `~/.local/bin/opencode` auto-detects the nearest repo `opencode.json`, sets `OPENCODE_CONFIG` / `OPENCODE_CONFIG_DIR`, and keeps XDG runtime state under `.opencode-runtime/`.
- Use `./scripts/gentle-ai` as the standard per-repo Gentle-AI command; it isolates `HOME` to `.gentle-home`, copies root `opencode.json` into that home, runs the shared global Gentle-AI binary, and syncs config changes back only to repo-root `opencode.json`.
- `.gitignore` intentionally ignores repo-local OpenCode/Gentle-AI state such as `.opencode/`, `.opencode-runtime/`, `.gentle-home/`, and legacy runtime/cache directories, plus env files, build caches, `data/`, `tmp/`, and coverage output.
- `.opencode/package.json` still only installs `@opencode-ai/plugin@1.15.0`; the actual application manifest and lockfile now live at the repo root in `package.json` and `package-lock.json`.
