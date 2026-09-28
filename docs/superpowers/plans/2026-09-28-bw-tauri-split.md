# Plan: Split desktop app (`bestway-tauri/`) into `bestwayec/bw-tauri`

Date: 2026-09-28 · Status: approved design, not started · Approach: **A — flag-day cutover**

## 1. Goal

Move the Tauri 2 kiosk exam client out of the `bestwayec/bestway` monorepo into its own
repository `bestwayec/bw-tauri`, with its own release train. The monorepo keeps
backend + frontend only. No behavior changes to the app itself.

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| D1 | New home | `bestwayec/bw-tauri` (fresh repo) |
| D2 | Git history | Clean export — single import commit, no `filter-repo`/subtree history |
| D3 | Monorepo leftover | Delete `bestway-tauri/` entirely, README points to the new repo |
| D4 | Cutover style | Flag-day: one move, first new-repo release is `0.3.0` |
| D5 | Signing keys | Keep existing minisign keypair, no rotation (pubkey is baked into installed clients) |

Rejected: transitional `0.2.3` release (B) and gradual freeze (C) — the current updater
endpoint (`https://github.com/algorithco/bestway/releases/...`) is already stale, so there
is no working update channel to preserve. YAGNI.

## 3. Coupling inventory (verified 2026-09-28)

- **Code:** `bestway-tauri/src` is self-contained. Single edge: `src/pages/Settings.tsx`
  imports `../../package.json` (i.e. `bestway-tauri/package.json`) — breaks when promoted to
  repo root, must be fixed (§4.1).
- **Runtime (not code):** app talks directly to backend `/v1` via `VITE_API_URL`; browser
  login flow opens the web frontend `{VITE_WEB_URL}/oauth/desktop` (see
  `frontend/src/components/auth/desktop-authorize.tsx`) and exchanges codes at
  `POST /auth/desktop/exchange`. Documented as external dependencies, no code moves.
- **Release:** `.github/workflows/release-desktop.yml` (paths prefixed `bestway-tauri/`),
  updater `endpoints` + `pubkey` in `src-tauri/tauri.conf.json`, `TAURI_SIGNING_PRIVATE_KEY`
  Actions secret, `bestway-app-v*` tag convention.
- **Docs referencing `bestway-tauri/`:** `README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `TESTS_AND_MOCKS.md` (§7), `BESTWAY-production-deploy-EN.md`, `.github/dependabot.yml`.
  Historical `bestway-*-prompt.md` files: left untouched.
- **Do NOT migrate:** `node_modules/`, `dist/`, `dev*.log` / `*.log` build junk currently
  sitting in the folder.

## 4. Execution

### 4.1 New repo `bestwayec/bw-tauri` — contents

1. Create empty repo `bestwayec/bw-tauri` (public, GPL-3.0).
2. Copy `bestway-tauri/` to repo root, excluding `node_modules/`, `dist/`, all `*.log`.
3. Add: root `LICENSE` (GPL-3.0 copy), merged `.gitignore` (tauri + root log/key patterns),
   own `SECURITY.md` (Tauri scope: secure-storage `enc:v2`, updater pubkey custody,
   lockdown matrix; private reporting via Advisory or `otashdev1@gmail.com`),
   `CONTRIBUTING.md` (Node 24 + Rust stable + MSVC note, version-sync rule).
4. Rewrite `README.md`: no `../frontend` / `../backend` paths; backend is an external
   dependency (`VITE_API_URL`, link to monorepo API contract); keep Features / Lockdown
   limits / Troubleshooting sections.
5. Fix `src/pages/Settings.tsx` `../../package.json` import — switch to a
   `__APP_VERSION__` Vite define sourced from the app `package.json`.
6. `src-tauri/tauri.conf.json`: `endpoints` →
   `https://github.com/bestwayec/bw-tauri/releases/latest/download/latest.json`.
   `pubkey` unchanged. Version stays `0.2.2`.
7. Port `release-desktop.yml`: strip `bestway-tauri/` prefixes (`projectPath: .`,
   `cache-dependency-path: package-lock.json`, `workspaces: src-tauri -> target`,
   `working-directory` removal). Keep tag pattern `bestway-app-v*`, pinned actions,
   `contents: read` default with `write` on the build job.
8. Port dependabot npm entry (`directory: /`) + `github-actions`; set repo About
   (description, `tauri`/`ielts`/`education` topics, website).
9. Verify: `npm ci`, `npm run build`, `npx tsc --noEmit`, local `tauri build`
   (or `cargo check` in `src-tauri/`). Single squashed import commit.

### 4.2 Secrets + first release

1. Copy `TAURI_SIGNING_PRIVATE_KEY` (+ password, if set) from monorepo secrets into
   `bestwayec/bw-tauri` Actions secrets. Never commit; verify with a secret-scan.
2. Bump `0.2.2` → `0.3.0` in `package.json` + `tauri.conf.json` + `Cargo.toml` (sync rule),
   tag `bestway-app-v0.3.0`, push tag.
3. Confirm: Windows/macOS/Linux installers + `latest.json` attached to the Release, and a
   fresh `0.3.0` install reports "up to date".
4. Known residual: installed `0.2.x` clients poll the stale `algorithco/bestway` URL and
   will never discover `0.3.0` — manual reinstall required. Accepted (channel is dead).

### 4.3 Monorepo cleanup (only after §4.2 is green)

Single PR against `bestwayec/bestway`:

1. Delete `bestway-tauri/` entirely.
2. Delete `.github/workflows/release-desktop.yml`; remove `/bestway-tauri` from
   `dependabot.yml`.
3. `README.md`: desktop section + structure tree become a pointer to `bestwayec/bw-tauri`.
4. `CONTRIBUTING.md`: drop the Tauri check block (or point it at the new repo).
5. `SECURITY.md`: backend + frontend scope only; link new repo policy for desktop.
6. `TESTS_AND_MOCKS.md` §7 + production-deploy guide: reword to reference external repo.
7. CI on the PR must stay green with the folder gone (proves nothing imports it).

### 4.4 Rollback

- If §4.2 fails: monorepo untouched → blast radius zero. Fix forward in the new repo.
- If §4.3 PR breaks CI: revert the single PR; desktop releases already ship from the
  new repo independently.

## 5. Success criteria

- [ ] `bestwayec/bw-tauri@main` builds from clean clone (`npm ci && npm run build`,
      `tsc --noEmit`, Rust check).
- [ ] `bestway-app-v0.3.0` Release carries 3 OS installers + valid `latest.json`.
- [ ] Monorepo `main` CI green with `bestway-tauri/` deleted; no stale references
      outside historical prompt files.
- [ ] New repo About set; monorepo README links to it; no secrets committed anywhere.
