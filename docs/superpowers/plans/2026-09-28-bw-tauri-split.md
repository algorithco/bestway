# Plan: Split desktop app (`bestway-tauri/`) into `bestwayec/bw-tauri`

Date: 2026-09-28 · Status: revised after review, not started · Approach: **A — flag-day cutover**

## 1. Goal

Move the Tauri 2 kiosk exam client out of the `bestwayec/bestway` monorepo into its own
repository `bestwayec/bw-tauri`, with its own release train. The monorepo keeps
backend + frontend only. No behavior changes to the app itself.

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| D1 | New home | `bestwayec/bw-tauri` (fresh repo, does not exist yet — verified 2026-09-28) |
| D2 | Git history | Clean export — single import commit, no `filter-repo`/subtree history |
| D3 | Monorepo leftover | Delete `bestway-tauri/` entirely, README points to the new repo |
| D4 | Cutover style | Flag-day + hand-made `latest.json` migration (see §4.2) |
| D5 | Signing keys | Keep existing minisign keypair, no rotation — **conditional on finding the original key file** (see §4.2 preconditions). Pubkey is baked into installed clients. |
| D6 | License | Keep `Copyright (C) 2026 algorithco` in the copied `LICENSE`; add missing `license = "GPL-3.0-only"` to `src-tauri/Cargo.toml` to match `package.json`. |

Rejected: transitional `0.2.3` release (B) and gradual freeze (C). Correction to v1 of this
plan: the old updater URL is **not** dead — `algorithco/bestway/.../latest.json` 301-redirects
(repo was transferred) and resolves to the monorepo's `bestway-app-v0.2.2` release, which
returns 404 because that release has no `latest.json`. So installed `0.2.x` clients follow
a working redirect to a missing file, and a hand-made `latest.json` on `v0.2.2` migrates
them with no transitional release — but only while `v0.2.2` stays the monorepo's latest
desktop release (freeze rule, §4.2).

## 3. Coupling inventory (verified 2026-09-28)

- **Code:** `bestway-tauri/src` is self-contained. `src/pages/Settings.tsx` imports
  `../../package.json` — resolves to the app's own `package.json` today **and** after the
  move to repo root (`resolveJsonModule` is on). No fix needed.
- **Runtime (not code):** app talks directly to backend `/v1` via `VITE_API_URL`; browser
  login flow opens the web frontend `{VITE_WEB_URL}/oauth/desktop` (see
  `frontend/src/components/auth/desktop-authorize.tsx`) and exchanges codes at
  `POST /auth/desktop/exchange`. Documented as external dependencies, no code moves.
- **Frozen cross-repo contract (do not touch):** deep-link scheme `bestway-exam://auth/callback`
  is hard-coded in backend (`DEFAULT_DESKTOP_CALLBACK`, `DESKTOP_REDIRECT_URIS`), frontend
  (`desktop-authorize.tsx`, allowlist in `utils.ts`) and the app; Tauri identifier
  `uz.bestway.exam` stays. The new README states this and links the backend contract with
  an absolute URL (`bestwayec/bestway/blob/main/backend/api-contract.md`), never `../backend`.
- **Updater forensic (root cause found):** `bestway-app-v0.2.2` ships exactly 4 assets
  (`.dmg`, `.AppImage`, `.deb`, `-setup.exe`) — no `.sig` files, no `latest.json`. Release
  run `34052092469` (conclusion: success) logs `Signature not found for the updater JSON.
  Skipping upload...` on all three OS jobs, and `gh secret list` on the monorepo returns
  **zero secrets** — `TAURI_SIGNING_PRIVATE_KEY` was never configured. The updater has
  likely never worked end to end. **Do not cut `0.3.0` until signing is proven (§4.2).**
- **Release:** `.github/workflows/release-desktop.yml` (paths prefixed `bestway-tauri/`),
  updater `endpoints` + `pubkey` in `src-tauri/tauri.conf.json`, `bestway-app-v*` tag convention.
  Monorepo `ci.yml` covers backend + frontend only — it proves nothing about Tauri, so the
  new repo gets its own `ci.yml` (§4.1).
- **Docs referencing `bestway-tauri/` (all tracked — verified via `git ls-files`):**
  `README.md` (:100 desktop section, :149 structure, :190 community-adjacent release note),
  `CONTRIBUTING.md` (:79–82 Tauri check block, :101 release-workflow note),
  `SECURITY.md` (:8 version table, :11 version line, :25 scope bullet, :30–31 key custody),
  `TESTS_AND_MOCKS.md` (§7), `.github/dependabot.yml` (`/bestway-tauri` entry),
  `.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml` (desktop options),
  `.github/ISSUE_TEMPLATE/config.yml` (advisories link points at `algorithco/bestway`).
  Inside the app folder, `SECURITY_AUDIT.md` / `SECURITY_FIXES_FINAL.md` contain dead
  `../backend` commands and quote the old endpoint — fix on export.
  `BESTWAY-production-deploy-EN.md` and `bestway-*-prompt.md` are **untracked local-only
  files, out of scope** (monorepo cleanup touches tracked files only).
- **Do NOT migrate:** `node_modules/`, `dist/`, `dev*.log` / `*.log` build junk currently
  sitting in the folder.

## 4. Execution

### 4.1 New repo `bestwayec/bw-tauri` — contents

1. Create empty repo `bestwayec/bw-tauri` (public, GPL-3.0).
2. Copy `bestway-tauri/` to repo root, excluding `node_modules/`, `dist/`, all `*.log`.
3. Add: root `LICENSE` (GPL-3.0 copy, algorithco holder kept per D6), merged `.gitignore`
   (tauri + root log/key patterns), own `SECURITY.md` (Tauri scope: secure-storage `enc:v2`,
   updater pubkey custody, lockdown matrix; private reporting via Advisory — **enable
   private vulnerability reporting** — or `otashdev1@gmail.com`), `CODE_OF_CONDUCT.md`,
   issue + PR templates, `CONTRIBUTING.md` (Node 24 + Rust stable + MSVC note,
   five-file version-sync rule).
4. Rewrite `README.md`: no `../frontend` / `../backend` paths; backend is an external
   dependency (`VITE_API_URL`, absolute link to monorepo API contract); state the frozen
   deep-link/identifier contract; keep Features / Lockdown limits / Troubleshooting.
5. `src-tauri/tauri.conf.json`: `endpoints` →
   `https://github.com/bestwayec/bw-tauri/releases/latest/download/latest.json`.
   `pubkey` unchanged. Version stays `0.2.2`.
6. `src-tauri/Cargo.toml`: add `license = "GPL-3.0-only"` (D6).
7. Fix re-exported references on move: `SECURITY_AUDIT.md` / `SECURITY_FIXES_FINAL.md`
   dead `../backend` commands + old endpoint quotes.
8. Port `release-desktop.yml`: strip `bestway-tauri/` prefixes (`projectPath: .`,
   `cache-dependency-path: package-lock.json`, `workspaces: src-tauri -> target`,
   `working-directory` removal). Keep tag pattern `bestway-app-v*`, pinned actions,
   `contents: read` default with `write` on the build job.
9. Add `ci.yml` (runs on PRs + `main`): `npm ci`, `npx tsc --noEmit`, `npm run build`,
   `cargo check` in `src-tauri/` (Linux job installs the WebKit deps block from the
   release workflow), Dependabot npm + github-actions entries — so Dependabot PRs are checked.
10. Set repo About (description, `tauri`/`ielts`/`education` topics, website).
11. Verify: `npm ci`, `npm run build`, `npx tsc --noEmit`, `cargo check`. Single import commit.

### 4.2 Secrets + first release (gated — nothing ships until every box is ticked)

Preconditions (GitHub secrets are **write-only**: nothing can be copied out of the monorepo):

1. Locate the original key file (`~/.tauri/bestway.key` per the workflow comment) **and**
   its password. Not on this machine (no `~/.tauri` here — verified). Back both up offline.
2. **If the key is unrecoverable: STOP.** Forced rotation — generate a new keypair, replace
   `pubkey` in `tauri.conf.json`, and accept manual reinstall for every installed client
   (old clients trust only the old pubkey). The rest of this section assumes recovery.
3. Set `TAURI_SIGNING_PRIVATE_KEY` (+ password) in `bestwayec/bw-tauri` secrets.

Release:

4. Bump `0.2.2` → `0.3.0` in **five** files: `package.json`, `package-lock.json`,
   `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.
   Tag `bestway-app-v0.3.0`, push tag.
5. Confirm the Release carries per-OS `.sig` files **and** `latest.json`. If the log again
   shows `Signature not found... Skipping upload`, stop — the secret is wrong, do not proceed.
6. Migrate the installed base: hand-craft a `latest.json` naming `0.3.0` with the new
   repo's asset URLs + signatures, and **upload it to the monorepo's `bestway-app-v0.2.2`
   release**. Installed `0.2.x` clients will follow the existing redirect and update.
   **Freeze rule: never publish a newer desktop release in the monorepo** — `v0.2.2` must
   stay "latest" or the redirect target changes.

Real update test (first ever end-to-end signature check):

7. On a test machine with `0.2.x` installed: confirm it updates to `0.3.0` via the
   hand-made `latest.json`. Then publish `0.3.1` from the new repo and confirm the client
   updates again natively. "Fresh install reports up to date" is **not** accepted as proof.

### 4.3 Monorepo cleanup (only after §4.2 is green)

Single PR against `bestwayec/bestway`:

1. Delete `bestway-tauri/` entirely.
2. Delete `.github/workflows/release-desktop.yml`; remove `/bestway-tauri` from
   `dependabot.yml`.
3. `README.md` (:100, :149, :190): desktop section + structure tree become a pointer to
   `bestwayec/bw-tauri`.
4. `CONTRIBUTING.md` (:79–82, :101): drop the Tauri check block / point at the new repo.
5. `SECURITY.md` (:8, :11, :25, :30–31): backend + frontend scope only; link new repo policy.
6. `TESTS_AND_MOCKS.md` §7: reword to reference the external repo.
7. Issue templates: drop the desktop options (desktop issues move to the new repo);
   `config.yml`: fix advisories link to `bestwayec/bestway`.
8. CI on the PR must stay green (backend + frontend unaffected).

### 4.4 Rollback

- If §4.2 fails: monorepo untouched → blast radius zero. Fix forward in the new repo.
- If the key is lost (§4.2 precondition 2): rotation path — new keypair, pubkey swap,
  manual reinstall for all; the hand-made `latest.json` migration is void (old clients
  can't verify new signatures).
- If §4.3 PR breaks CI: revert the single PR; desktop releases already ship from the
  new repo independently.

## 5. Success criteria

- [ ] Original signing key recovered, backed up, and configured in the new repo.
- [ ] `bestwayec/bw-tauri@main` builds from clean clone (`npm ci && npm run build`,
      `tsc --noEmit`, `cargo check`); PR CI green.
- [ ] `bestway-app-v0.3.0` Release carries 3 OS installers **plus `.sig` files and
      `latest.json`**.
- [ ] Hand-made `latest.json` on monorepo `v0.2.2`; `0.2.x` → `0.3.0` → `0.3.1` update
      chain proven on a real install.
- [ ] Monorepo `main` CI green with `bestway-tauri/` deleted; stale-reference grep clean
      for tracked files **excluding this plan file** (`docs/superpowers/plans/2026-09-28-bw-tauri-split.md`,
      which intentionally documents the old paths until the split lands).
- [ ] New repo About set; monorepo README links to it; secret-scan clean; Advisory
      reporting enabled on the new repo.
