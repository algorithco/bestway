# Task: Fully Remediate All Security & Code-Quality Issues in `algorithco/bestway`

You are working on the repository `algorithco/bestway` (NestJS backend + Next.js frontend + Tauri 2 desktop exam app `bestway-tauri`). A code review found several real issues. Fix **every single one** listed below, **one at a time, in the exact order given**. Do not skip, merge, or partially address any item. After each fix, run the relevant build/lint/test command and confirm it passes before moving to the next item. Do not change any user-facing UI/UX/behavior unless a fix explicitly requires it for security reasons — and if it does, call that out clearly in your summary.

For every item: read the affected file(s) first, make the minimal correct fix, verify it builds, then write a one-paragraph note describing exactly what changed and why. At the very end, produce a single consolidated changelog of everything you touched.

---

## TASK 1 (Critical — do this first): Replace fake encryption in `bestway-tauri` with real encryption

**File:** `bestway-tauri/src/lib/secure-storage.ts`

**Problem:** The file `bestway-tauri/SECURITY_AUDIT.md` and `SECURITY_FIXES_FINAL.md` both claim tokens are protected with "AES-GCM 256 via `crypto.subtle`, PBKDF2 100k, key derived from `deviceId`." This is **false**. The actual implementation (`deriveKeyBytes`, `getStableKey`, `xorBytes`) is a simple XOR cipher with a **hardcoded, device-independent, statically derivable key** (`"uz.bestway.exam::stable-v1"`). Anyone who reads this open-source file can trivially decrypt any stored `bestway.accessToken`, `bestway.refreshToken`, or `bestway.oauth` value. This provides effectively zero real protection against XSS or local disk inspection — it only defeats a naive `grep`.

**Fix requirements:**
1. Rewrite `secure-storage.ts` to use the **actual Web Crypto API** (`crypto.subtle`):
   - AES-GCM 256 for encryption/decryption.
   - Derive the encryption key via PBKDF2 (≥100,000 iterations, SHA-256) from a **per-device secret**, not a hardcoded string. Use the app's existing `deviceId` (check `src/lib/` for how `deviceId` is currently generated/stored) combined with a random per-install salt generated once via `crypto.getRandomValues` and persisted alongside the ciphertext (not derivable from source code alone).
   - Store ciphertext as `enc:v2:<salt_b64>:<iv_b64>:<ciphertext_b64>`.
   - Since `crypto.subtle` is async, refactor `secureGetItem`/`secureSetItem` callers (`api.ts`, `oauth.ts`, `App.tsx`, `Login.tsx`) to use the async versions properly. Keep an in-memory cache for any code path that currently assumes synchronous reads, but make the actual storage read/write async and correct — do not silently fall back to sync XOR "for compatibility."
   - Implement migration: on first read, detect legacy `enc:v1:` (XOR) or raw plaintext values, decrypt/read them with the old method, then immediately re-encrypt and persist using the new AES-GCM scheme. Do this once per key, silently, with no user-visible behavior change.
   - If `crypto.subtle` is unavailable in the runtime, fail safe: do NOT silently fall back to plaintext storage. Log a clear warning and keep the value in memory-only session storage instead.
2. Update `bestway-tauri/SECURITY_AUDIT.md` and `SECURITY_FIXES_FINAL.md` so their descriptions **match the actual implementation** after this fix (correct the "TA-01" entry to describe real AES-GCM, remove the misleading claims that already existed).
3. Verify: `cd bestway-tauri && npm run build` must pass. Manually confirm (via comment/test) that `localStorage.getItem('bestway.accessToken')` no longer starts with `enc:v1:` after login, and that a value encrypted on one run cannot be decrypted using only knowledge of the source code without also knowing the persisted per-install salt.

---

## TASK 2: Add code signing and enable the auto-updater for `bestway-tauri`

**Problem:** `bundle.targets` has no `updater.pubkey`, and updates rely on the user manually opening a browser link to download a new binary. This is a supply-chain risk (no way to verify binary authenticity) and bad UX for a kiosk exam app that needs to stay current.

**Fix requirements:**
1. Configure Tauri's built-in updater (`tauri-plugin-updater`) with a generated signing keypair. Add the public key to `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`, and document (in `README.md` or `SECURITY_AUDIT.md`) that the private key must be stored as a CI secret and never committed.
2. Wire up `UpdateNotifier.tsx` to use the updater plugin's `check()`/`downloadAndInstall()` flow instead of only opening `downloadUrl` in a browser, while keeping the existing `isSafeHttpUrl` validation as a defense-in-depth fallback for any remaining manual-open path.
3. Add a CI workflow step (or a documented manual step if CI config is out of scope) that signs release builds using the private key.
4. Update `SECURITY_AUDIT.md` §6 to remove "App binary not signed / updater disabled" from remaining risks, or downgrade it to "Info" with a note on what was implemented.

---

## TASK 3: Harden the CSP `object-src`/`style-src` situation properly

**Problem:** CSP still allows `style-src 'unsafe-inline'` because Tailwind v4 injects runtime `<style>` tags. This was "accepted" without exploring alternatives.

**Fix requirements:**
1. Investigate whether Tailwind v4's build output can be fully static (no runtime style injection) for this app's usage — check if `@tailwindcss/vite` or the build config can be set to pre-compile all styles into a single static stylesheet with no client-side injection.
2. If full removal of `'unsafe-inline'` is possible without visual regressions, do it and tighten the CSP.
3. If it is genuinely not possible without a major rewrite, keep `'unsafe-inline'` for `style-src` only, but add a hash-based or nonce-based CSP for any inline `<style>`/`<script>` that *can* be pinned, and clearly re-document the remaining exception with the specific technical reason (not just "Tailwind requires it").

---

## TASK 4: Implement real OS-level kiosk lockdown (or clearly scope it down)

**File:** `bestway-tauri/src-tauri/src/lockdown.rs`

**Problem:** `set_kiosk` only toggles fullscreen + always-on-top. Comments admit Ctrl+Alt+Del and other OS-level shortcuts are not blocked, which undermines the exam-integrity purpose of the kiosk mode.

**Fix requirements:**
1. For Windows: implement a low-level keyboard hook (`WH_KEYBOARD_LL`) via the `windows` crate to intercept and block Alt+Tab, Win key, and Alt+F4 while `locked` is true (Ctrl+Alt+Del cannot be blocked from userspace on Windows — keep that documented limitation, do not attempt to claim otherwise).
2. For macOS: use `presentationOptions` (via existing `objc2`/`cocoa` bindings if present, or add the dependency) to suppress the Dock, menu bar, and Cmd+Tab switching while locked.
3. For Linux: document the current gap explicitly (Wayland compositor restrictions vary) and implement what's feasible under X11 (keyboard grab).
4. Gate all new OS-specific code behind `#[cfg(target_os = "...")]` and keep the existing safe fallback (fullscreen + always-on-top) for platforms/configurations where the hook fails to install.
5. Update `lockdown.rs` comments and `SECURITY_AUDIT.md` to reflect exactly what is and isn't blocked per platform after this change — no overstatement.

---

## TASK 5: Upgrade stale dependencies

**Problem:** `vite 6→8`, `zod 3→4`, `@vitejs/plugin-react 4→6` are outdated in `bestway-tauri/package.json`; general dependency drift was also flagged across the repo.

**Fix requirements:**
1. In `bestway-tauri`, upgrade `vite`, `zod`, and `@vitejs/plugin-react` to their latest stable major versions, one dependency at a time. After each upgrade, run `npm run build` and fix any breaking changes (Zod v4 has API changes to schema definitions — check every `z.` usage in `src/`).
2. Run `npm audit` (or equivalent) across `backend/`, `frontend/`, and `bestway-tauri/` and patch any reported vulnerabilities that don't require breaking major-version bumps.
3. Do the same dependency-freshness check for `backend/package.json` and `frontend/package.json` — list any majors more than 1 version behind and upgrade what's safe to upgrade without breaking `npm run build`/`npx tsc --noEmit`.

---

## TASK 6: Clean up minor code-quality issues across `backend` and `frontend`

**Fix requirements, in this order:**
1. `frontend/src/components/theme-provider.tsx` — remove both `@ts-ignore` comments (around line 205–207). Fix the actual underlying type issue instead of suppressing it. If there truly is no clean typing solution, replace `@ts-ignore` with a scoped, explicit type assertion and a comment explaining exactly why it's needed.
2. Find and remove/replace the 3 leftover `console.log` calls in `backend/src` (`grep -rn "console\.log" backend/src`) with the project's existing `Logger` service (NestJS `Logger` class), using appropriate log levels.
3. Review all 20 `eslint-disable` occurrences in `backend/src` and `frontend/src` (`grep -rn "eslint-disable" backend/src frontend/src`). For each one: either fix the underlying lint issue and remove the disable comment, or — if the disable is genuinely justified — add a one-line comment explaining why it's necessary. Do not leave any unexplained disable comment in place.

---

## TASK 7: Final consistency pass on security documentation

**Fix requirements:**
1. Re-read `bestway-tauri/SECURITY_AUDIT.md` and `SECURITY_FIXES_FINAL.md` end to end after Tasks 1–6 are complete.
2. Update every table entry (TA-01 through TA-13) so severity, description, and "fix applied" columns accurately reflect the current state of the code — no entry should describe a fix that isn't actually implemented as described.
3. Update `SECURITY.md` at the repo root if any scope or contact information needs to change as a result of this work.
4. Produce a final summary table of: Issue ID → Original Severity → Status (Fixed / Partially Mitigated / Accepted Risk with reason) → File(s) changed.

---

## Acceptance Criteria (must all be true before you consider this done)

- [ ] `bestway-tauri/src/lib/secure-storage.ts` uses real `crypto.subtle` AES-GCM with PBKDF2, no hardcoded/static key material.
- [ ] `npm run build` passes in `backend/`, `frontend/`, and `bestway-tauri/`.
- [ ] `npx tsc --noEmit` passes in `frontend/` and `bestway-tauri/`.
- [ ] Updater is configured with a real signing key reference (even if the private key itself is a placeholder for CI secrets).
- [ ] No remaining `@ts-ignore` in `theme-provider.tsx`.
- [ ] No remaining bare `console.log` in `backend/src`.
- [ ] Every `eslint-disable` in the codebase has either been removed (issue fixed) or has an inline justification comment.
- [ ] `SECURITY_AUDIT.md` and `SECURITY_FIXES_FINAL.md` accurately describe the real state of the code — no discrepancies between docs and implementation.
- [ ] A final changelog listing every file changed and why is provided at the end.

Work through the tasks strictly in order (1 → 7). Do not declare the job finished until every checkbox above is genuinely satisfied.
