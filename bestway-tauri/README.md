# Bestway Exam — Tauri Desktop (students only)

Secure desktop app for education-center students to take exams. Admin locks everyone into the app — no cheating, no other apps.

> Scope: `bestway-tauri/` only. Web frontend (`../frontend`) and API (`../backend`) are separate. This app talks directly to `backend /v1`.

## Features

- Student login via **web browser (OAuth-style)** + password fallback (`role=student`)
- Black pro UI: `ClickSpark` click bursts + `CursorTrail` cursor glow/sparks
- Tests + Mock exams (IELTS / multilevel, speaking audio)
- Live remote control: admin Lock / Unlock / Force-submit, roster with online + cheat count
- Strong app-level lockdown: fullscreen kiosk, always-on-top, no taskbar, shortcut + clipboard block, focus-loss auto-report (`flag-cheat`), 15s heartbeat, timer auto-submit
- **Battery % bottom-right**: `BatteryIndicator` in the status bar shows the laptop/PC battery (`get_battery` → `navigator.getBattery()` → `—%`), red <20%, amber <40%, plug icon when charging, click to refresh, `uz/ru/en`
- Online-only v1 (auto banner + queued submit on disconnect)

## Tech

- Tauri v2 + Rust (OS WebView, ~10MB binary) — `uz.bestway.exam`
- Vite 6 + React 19 + TS + Tailwind v4 + TanStack Query + zod
- Rust crates: `single-instance`, `global-shortcut`, `clipboard-manager`, `autostart`, `starship-battery`

## Structure

```
bestway-tauri/
  src/
    App.tsx                 # login/exams/runner/locked/result + StatusBar
    pages/                  # Login, Exams, Runner, Locked, Result
    components/StatusBar.tsx + BatteryIndicator.tsx + ClickSpark.tsx + CursorTrail.tsx
    hooks/useBattery.ts     # Tauri → browser → unknown fallback, 30s poll
    hooks/useLockdown.ts    # fullscreen, shortcut/clipboard block, cheat callback
    lib/api.ts              # direct /v1 client (no Next proxy)
    lib/oauth.ts            # browser login: authorize URL, deep-link, code exchange
    lib/exam-sessions.ts    # lock/unlock/roster contract
    lib/heartbeat.ts        # 15s POST /exam-desktop/heartbeat
    lib/cheat.ts            # POST .../flag-cheat (tests|mock)
    lib/session.ts          # student gate, deviceId
  src-tauri/
    src/main.rs             # get_battery, set_locked, clear_clipboard, block close
    src/battery.rs          # starship-battery, never panics
    src/lockdown.rs         # set_kiosk + per-OS stubs
    tauri.conf.json         # fullscreen, no decorations, alwaysOnTop, nsis+dmg+appimage/deb
    capabilities/default.json
```

## Quick start

```bash
cd bestway-tauri
npm install
# web-only preview (battery uses browser API fallback):
npm run dev
# full desktop shell:
npm run tauri dev
```

Env (`bestway-tauri/.env`, never commit):

```bash
VITE_API_URL=http://localhost:3001/v1
VITE_WEB_URL=http://localhost:3000
```

| Var | Default | Purpose |
| --- | ------- | ------- |
| `VITE_WEB_URL` | `http://localhost:3000` | System-browser login page origin (`/oauth/desktop`) |

## Browser login

`Login → Continue in web browser` opens the OS browser to
`{WEB_URL}/oauth/desktop?device=…&state=…&redirect=bestway-exam://auth/callback`.
After web login the backend redirects to `bestway-exam://…` (deep-link plugin
catches it) or shows a code the student pastes back. Code is exchanged at
`POST /auth/desktop/exchange`. Backend still needs `GET /oauth/desktop` +
`POST /auth/desktop/exchange` — until then, password sign-in works.

| Var | Default | Purpose |
| --- | ------- | ------- |
| `VITE_API_URL` | `http://localhost:3001/v1` | Backend base URL (`/v1` included) |

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Vite web preview (`:1420`) |
| `npm run build` | `tsc && vite build` → `dist/` |
| `npm run tauri dev` | Desktop shell + HMR |
| `npm run tauri build` | OS installers (`nsis`, `dmg`, `appimage`, `deb`) |
| `cargo check` (in `src-tauri/`) | Rust check (needs MSVC Build Tools on Windows) |

## Backend contract (planned, `../backend/api-contract.md` first)

- `GET /exam-sessions/active?groupId=` → active locked session (404 = none)
- `GET /exam-sessions/:id/roster` → `{userId,name,online,locked,cheatCount,heartbeatAt}`
- `POST /exam-sessions/:id/lock-all|unlock-all|force-submit`
- `POST /exam-desktop/heartbeat {attemptId, locked}` every 15s
- `POST /tests/attempts/:id/flag-cheat` / `POST /mock/attempts/:id/flag-cheat` (`tab_switch|blur|paste|shortcut`)
- Existing `POST /tests/:id/start|.../answer|.../submit`, `POST /mock/exams/:id/start|...` reused as-is

## Lockdown limits (honest)

App layer **cannot** block `Ctrl+Alt+Del`, power button, USB boot, Task Manager kill by admin-rights user, or all macOS/Wayland gestures. Mitigation: non-admin student accounts + physical proctor + heartbeat-loss red flag in roster. True kiosk = Windows Assigned Access / MDM (Phase 2).

## Troubleshooting

- `link.exe not found` on `cargo check` → install MSVC Build Tools (Desktop C++ workload)
- Battery shows `—%` → no OS battery (desktop PC) or Tauri IPC not running in `vite dev` — expected fallback
- Blank screen in `tauri dev` → check `VITE_API_URL` reachable + `devUrl http://localhost:1420`
