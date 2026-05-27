# Agent Notes

- This repo now contains the AC Travel MVP Next.js application at the repository root with App Router, TypeScript, Tailwind, Supabase integration, admin routes, tests, and launch docs.
- Root `opencode.json` is the active OpenCode config (`OPENCODE_CONFIG` in `scripts/ai-env.sh`); it sets `permission: "allow"`, enables `openai` and `github-copilot`, and loads instructions from `AGENTS.md` then `README.md`.
- Use `scripts/opencode` to run repo-local OpenCode: it sources `scripts/ai-env.sh`, prepends `.opencode-bin`/`.gentle-ai-bin` to `PATH`, sets `XDG_*` under `.opencode-runtime`, and execs `.opencode-bin/opencode`.
- Use `scripts/gentle-ai-portfolio` for Gentle-AI with the same `.opencode-runtime` XDG dirs; `scripts/portfolio-gentle-ai` instead isolates `HOME` to `.gentle-home`, copies root `opencode.json` into that home because Gentle-AI rejects symlinked config, then mirrors changed config back to `.opencode-runtime/config/opencode/opencode.json` and root `opencode.json`.
- Wrapper scripts hardcode `REPO="$HOME/srv/projects/actravel"`; run them from an environment where that path is valid or update the scripts deliberately.
- `.gitignore` intentionally ignores all repo-local OpenCode/Gentle-AI state (`.opencode/`, `.opencode-runtime/`, `.gentle-ai-runtime/`, `.gentle-home/`, `.opencode-bin/`, `.gentle-ai-bin/`) plus env files, build caches, `data/`, `tmp/`, and coverage output.
- `.opencode/package.json` still only installs `@opencode-ai/plugin@1.15.0`; the actual application manifest and lockfile now live at the repo root in `package.json` and `package-lock.json`.
