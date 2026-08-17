# Dependency Evidence

Inventory only; no install, update, lockfile rewrite, or dependency change was performed.

| Item | Observed value |
|---|---|
| Root package | `actravel@0.1.0` |
| Lockfile | `actravel@0.1.0`, lockfile v3 |
| `package.json` SHA-256 | `1a07eba3d75a55111bd06f279182427bd61895deb955bd6be7aaad96dc77e0d6` |
| `package-lock.json` SHA-256 | `3b175f0c194a4b8d9e8f0f6328ab15e3b305937ff3bcdee8d6ca67639ebb512f` |
| Node / npm | `v22.22.3` / `10.9.8` |
| Safe validation commands | `E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run lint`; same prefix with `npm run build`; same prefix with `npm run test:quote-notifications` |
| Reproducibility limitation | `latest` dependency ranges require the committed lockfile for deterministic resolution. |

**Review:** owner `unassigned`; authorizer `task-scoped read-only authorization`; review status `unreviewed`; evidence refs `identity.md`, `protected-snapshot.md`.
