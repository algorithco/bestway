# bw-tauri Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `bestway-tauri/` out of `bestwayec/bestway` into a standalone `bestwayec/bw-tauri` repo with a working signed release train, then remove it from the monorepo.

**Architecture:** Flag-day cutover. Clean-export the folder to repo root, fix endpoints/paths, prove signing on a `0.3.0` release, migrate installed clients with a hand-made `latest.json`, then delete the folder from the monorepo in one PR.

**Tech Stack:** Tauri 2 + Rust (stable) + React 19 + Vite 8 + Node 24.13.0 / npm 11.6.2, GitHub Actions, minisign updater.

**Spec:** `docs/superpowers/plans/2026-09-28-bw-tauri-split.md` — the plan argues from the spec, so the spec travels with it; executors read both.

## Global Constraints

- License is GPL-3.0-only; `LICENSE` holder stays `Copyright (C) 2026 algorithco`.
- Never commit secrets (`.env`, `*.key`, `TAURI_SIGNING_PRIVATE_KEY` value). Secret-scan before every push.
- GitHub Actions stay SHA-pinned; `contents: read` default, `write` only on the release build job.
- Release tags keep the `bestway-app-v*` pattern; GitHub Release name `bestway-app vX.Y.Z`.
- Version sync is five files: `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.
- Freeze rule: after migration, never publish a newer desktop release in the monorepo — `bestway-app-v0.2.2` stays "latest" there forever.
- No behavior changes to the app. Frozen contract: `bestway-exam://` deep-link scheme + `uz.bestway.exam` identifier.

---

## File Structure (new repo `bestwayec/bw-tauri`, root = old `bestway-tauri/`)

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html` — unchanged (moved as-is).
- `src/`, `src-tauri/`, `public/` — unchanged, except `tauri.conf.json` endpoint + `Cargo.toml` license.
- Create: `LICENSE`, `.gitignore`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.github/workflows/release-desktop.yml`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`.
- Modify: `README.md` (rewrite), `src-tauri/tauri.conf.json` (1 line), `src-tauri/Cargo.toml` (1 line), `SECURITY_AUDIT.md` + `SECURITY_FIXES_FINAL.md` (dead paths/endpoint quotes).
- Never create: `node_modules/`, `dist/`, `*.log`, `.env`.

## Task 1: Precondition — signing key check (gates Tasks 10–12)

**Files:** none (read-only verification).

- [ ] **Step 1: Confirm the key file exists and back it up**

```bash
Test-Path -LiteralPath "$HOME\.tauri\bestway.key"
```

Expected: `True`. If `False`: STOP the release track (Tasks 10–12) and follow the spec's rotation path instead. Back up the key + password offline before anything else.

- [ ] **Step 2: Confirm monorepo has no signing secret (documents the root cause)**

```bash
gh secret list
```

Expected: empty output. This corroborates run `34052092469`'s `Signature not found for the updater JSON. Skipping upload...` on all three OS jobs.

## Task 2: Create the new repo

**Files:** remote repo only. **Produces:** empty `bestwayec/bw-tauri` for Task 3 to fill.

- [ ] **Step 1: Create the repo**

```bash
gh repo create bestwayec/bw-tauri --public --description "Bestway Exam — Tauri 2 kiosk desktop client for supervised exams (IELTS/mock)"
```

Expected: `https://github.com/bestwayec/bw-tauri` created.

- [ ] **Step 2: Enable private vulnerability reporting**

```bash
gh api --method PATCH repos/bestwayec/bw-tauri -F "security_and_analysis[secret_scanning][status]=enabled" --jq "{ok: true}"
```

Then enable private reporting in Settings → Security → Advisories (no API switch; do it in the web UI) — required because the new `SECURITY.md` promises it.

## Task 3: Clean-export the tree

**Files:** copy `bestway-tauri/` → new clone root. **Produces:** working tree for Tasks 4–8.

- [ ] **Step 1: Clone and copy with exclusions**

```bash
gh repo clone bestwayec/bw-tauri C:\Users\hamro\AppData\Local\Temp\opencode\bw-tauri
Copy-Item -Path "D:\repos\bestway\bestway-tauri\*" -Destination "C:\Users\hamro\AppData\Local\Temp\opencode\bw-tauri" -Recurse -Force -Exclude "node_modules","dist","target","*.log" (leaf-name `target` covers `src-tauri/target/`; use `-Path`, not `-LiteralPath`, with a `\*` wildcard)
```

- [ ] **Step 2: Verify exclusions landed**

```bash
Test-Path "C:\Users\hamro\AppData\Local\Temp\opencode\bw-tauri\node_modules"; Test-Path "C:\Users\hamro\AppData\Local\Temp\opencode\bw-tauri\dist"; Get-ChildItem "C:\Users\hamro\AppData\Local\Temp\opencode\bw-tauri\*.log"
```

Expected: `False`, `False`, no output. If anything exists, delete it before continuing.

## Task 4: Root legal + config files

**Files (all in new repo root):**
- Create: `LICENSE` (copy of monorepo GPL-3.0 text, keep algorithco header).
- Create: `.gitignore` with exactly: `node_modules/`, `dist/`, `src-tauri/target/`, `.env`, `.env.*`, `*.key`, `*.pem`, `*.log`, `.vercel/`.
- Modify: `src-tauri/Cargo.toml:7` — insert `license = "GPL-3.0-only"` after the `description` line.

**Interfaces:** Produces legal/config baseline consumed by Tasks 9 (build) and 14 (license check).

- [ ] **Step 1: Copy LICENSE and write .gitignore, add Cargo license**

Expected: `cargo check` still parses the manifest (verified in Task 9).

- [ ] **Step 2: Commit**

```bash
git add LICENSE .gitignore src-tauri/Cargo.toml
git commit -m "chore: add license, gitignore, cargo license field"
```

## Task 5: Docs for the new repo

**Files:**
- Modify: `README.md` — full rewrite: no `../frontend`/`../backend` paths; backend as external dependency (`VITE_API_URL` default `http://localhost:3001/v1`, absolute link `https://github.com/bestwayec/bestway/blob/main/backend/api-contract.md`); frozen deep-link + identifier contract note; keep Features / Lockdown limits / Troubleshooting / Release sections with `bestwayec/bw-tauri` URLs.
- Modify: `SECURITY_AUDIT.md`, `SECURITY_FIXES_FINAL.md` — replace dead `../backend` commands with `https://github.com/bestwayec/bestway` links; replace old `algorithco/bestway` endpoint quote with the new `bestwayec/bw-tauri` URL.
- Create: `SECURITY.md` (Tauri scope: `enc:v2` secure-storage, pubkey custody, lockdown matrix; report via private Advisory or `otashdev1@gmail.com`), `CODE_OF_CONDUCT.md` (Covenant 2.1, same contact), `CONTRIBUTING.md` (Node 24.13.0 + Rust stable + MSVC Build Tools note, five-file version-sync rule, tag `bestway-app-vX.Y.Z`), `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml` (advisories link → `bestwayec/bw-tauri`), `.github/PULL_REQUEST_TEMPLATE.md`.
- Do NOT touch `src/pages/Settings.tsx` — its `../../package.json` import resolves to the app's own `package.json` today and still does at repo root (`resolveJsonModule` is on).

- [ ] **Step 1: Write all files, then grep for stale references**

```bash
Select-String -LiteralPath "README.md","SECURITY_AUDIT.md","SECURITY_FIXES_FINAL.md" -Pattern "\.\./(frontend|backend)|algorithco/bestway"
```

Expected: no output.

- [ ] **Step 2: Commit**

```bash
git add README.md SECURITY.md CODE_OF_CONDUCT.md CONTRIBUTING.md SECURITY_AUDIT.md SECURITY_FIXES_FINAL.md .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs: standalone readme, security, contributing and templates"
```

## Task 6: Point the updater at the new repo

**Files:** Modify `src-tauri/tauri.conf.json:50` — `endpoints` → `["https://github.com/bestwayec/bw-tauri/releases/latest/download/latest.json"]`. `pubkey` untouched.

- [ ] **Step 1: Edit the one line, verify JSON parses**

```bash
node -e "const c=require('./src-tauri/tauri.conf.json'); console.log(c.plugins.updater.endpoints[0])"
```

Expected: the new URL.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "fix(updater): point endpoints at bestwayec/bw-tauri releases"
```

## Task 7: Workflows + Dependabot

**Files:**
- Create: `.github/workflows/release-desktop.yml` — copy of monorepo file with `bestway-tauri/` prefixes stripped (`projectPath: .`, `cache-dependency-path: package-lock.json`, `workspaces: src-tauri -> target`, no `working-directory`), same pinned SHAs, same tag trigger, same secrets env.
- Create: `.github/workflows/ci.yml` — `ci` job (ubuntu-latest): `npm ci`, `npx tsc --noEmit`, `npm run build`; `rust` job: `cargo check` in `src-tauri/` (Linux job installs the WebKit `apt-get` block from the release workflow). Runs on PRs + `main`.
- Create: `.github/dependabot.yml` — npm `directory: /` + github-actions, weekly.

- [ ] **Step 1: Write files, then confirm trigger paths**

```bash
Select-String -LiteralPath ".github\workflows\ci.yml" -Pattern "pull_request"; Select-String -LiteralPath ".github\workflows\release-desktop.yml" -Pattern 'bestway-app-v\*'
```

Expected: `pull_request` trigger present in ci.yml; tag pattern present in release workflow. (Full validation happens at Task 9 via `gh workflow list` after push.)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows .github/dependabot.yml
git commit -m "ci: port release workflow, add PR checks and dependabot"
```

## Task 8: Repo About page

**Files:** remote settings only.

- [ ] **Step 1: Set description, website, topics**

```bash
gh repo edit bestwayec/bw-tauri --description "Bestway Exam — Tauri 2 kiosk desktop client for supervised IELTS/mock exams" --homepage "https://bestwayec.uz" --add-topic "tauri" --add-topic "ielts" --add-topic "education" --add-topic "rust" --add-topic "react" --add-topic "typescript"
gh repo view bestwayec/bw-tauri --json description,homepageUrl,repositoryTopics
```

Expected: values echoed back.

## Task 9: Verify build + import commit + push

**Files:** consumes Tasks 3–7 output. **Produces:** pushed `main` for Task 10.

- [ ] **Step 1: Full clean-tree verification**

```bash
npm ci
npx tsc --noEmit
npm run build
```

Expected: all three PASS. Then Rust (needs MSVC Build Tools on Windows):

```bash
cargo check
```

in `src-tauri/`. Expected: PASS.

- [ ] **Step 2: Push (single import commit history from Tasks 4–7 stays as-is)**

```bash
git push origin main
gh workflow list
```

Expected: push succeeds; both workflows listed.

## Task 10: Secrets + 0.3.0 release (GATED on Task 1)

**Files:** Modify five version files `0.2.2` → `0.3.0`: `package.json`, `package-lock.json` (2 spots), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (regenerates via `cargo check`; hand-edit only if lockfile resists).

- [ ] **Step 1: Set secrets in the NEW repo (values from the backed-up key file, never echoed)**

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < $HOME\.tauri\bestway.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
gh secret list
```

Expected: both names listed. If the key was unrecoverable, STOP and follow the spec rotation path.

- [ ] **Step 2: Bump, tag, push**

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore(release): bump bestway-app to v0.3.0"
git tag bestway-app-v0.3.0
git push origin main bestway-app-v0.3.0
```

- [ ] **Step 3: Prove signing (the check v0.2.2 failed)**

```bash
gh release view bestway-app-v0.3.0 --json assets --jq "[.assets[] | .name]"
```

Expected: per-OS `.sig` files AND `latest.json` present. If the run log shows `Signature not found... Skipping upload` again: STOP, the secret is wrong — do not proceed to Task 11.

## Task 11: Migrate the installed base

**Files:** remote release asset only (no code).

- [ ] **Step 1: Hand-craft latest.json for 0.3.0**

Shape (Tauri v2 updater JSON): `{"version":"0.3.0","notes":"...","pubkey":"<same pubkey from tauri.conf.json>","platforms":{"windows-x86_64":{"signature":"<contents of the 0.3.0 .sig>","url":"<exact 0.3.0 asset URL>"}, ...}}`. Copy asset names/URLs verbatim from `gh release view bestway-app-v0.3.0` — never guess arch suffixes. One entry per platform in the 0.3.0 release.

- [ ] **Step 2: Attach to the MONOREPO's v0.2.2 release and freeze**

```bash
gh release upload bestway-app-v0.2.2 latest.json --repo bestwayec/bestway
```

Expected: `latest.json` appears on `v0.2.2`. Installed `0.2.x` clients follow the existing redirect and update. Freeze rule starts now: no newer desktop release in the monorepo, ever.

## Task 12: Real update test (first end-to-end signature check)

**Files:** none (device testing).

- [ ] **Step 1: 0.2.x → 0.3.0 via the hand-made file** — on a test machine with 0.2.x installed, launch and confirm it updates to 0.3.0.
- [ ] **Step 2: 0.3.0 → 0.3.1 natively** — publish `0.3.1` from the new repo (five-file bump + tag), confirm the client updates on its own. "Fresh install reports up to date" is NOT accepted as proof.

Expected: both hops succeed; signatures verify.

## Task 13: Monorepo cleanup PR (only after Task 12 is green)

**Files in `bestwayec/bestway`:**
- Delete: `bestway-tauri/` entirely; `.github/workflows/release-desktop.yml`.
- Modify: `.github/dependabot.yml` (drop `/bestway-tauri` entry); `README.md` (:100 desktop section, :149 structure tree, :190 release note → pointer to `bestwayec/bw-tauri`); `CONTRIBUTING.md` (:79–82 Tauri block, :101 release note); `SECURITY.md` (:8, :11, :25, :30–31 → backend+frontend scope, link new policy); `TESTS_AND_MOCKS.md` §7 (external repo); `.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml` (drop desktop options); `.github/ISSUE_TEMPLATE/config.yml` (advisories → `bestwayec/bestway`).
- Leave: untracked local-only files (`BESTWAY-production-deploy-EN.md`, `bestway-*-prompt.md`) — out of scope.

- [ ] **Step 1: Make the changes, run stale-reference grep**

```bash
git grep -n "bestway-tauri" -- . ":!docs/superpowers/plans/2026-09-28-bw-tauri-split.md" ":!docs/superpowers/plans/2026-09-28-bw-tauri-split-implementation.md"
```

Expected: no output (both plan files intentionally excluded — they document old paths).

- [ ] **Step 2: Open PR, require green CI, merge**

Expected: `ci.yml` (backend + frontend) green with the folder gone.

## Task 14: Success-criteria sweep

- [ ] **Step 1: Secret scan both repos**

```bash
git log -p --all | Select-String -Pattern "(TAURI_SIGNING_PRIVATE_KEY\s*=|BEGIN.*PRIVATE KEY|-----BEGIN)" | Select-Object -First 5; echo "scan done"
```

Expected: `scan done` with no hits (key values never committed).

- [ ] **Step 2: Confirm About pages + Advisory reporting on the new repo, README link in monorepo**

Expected: all set; split complete.
