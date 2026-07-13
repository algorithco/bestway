# BESTWAY EC — Frontend

Web platform for an English‑language education center (IELTS / Multilevel / General English).
This repository is the **frontend only**. It talks to an existing **NestJS + PostgreSQL** backend
over HTTP and never modifies it.

The app is **trilingual** (Uzbek / Russian / English), **role‑based** (5 roles),
**dark‑mode aware**, and fully responsive (desktop sidebar + mobile bottom navigation).

> **Two‑repo project.** This is the frontend. The API it talks to lives in a separate repo:
> **[bestway-backend](https://github.com/Hamroqulovv/bestway-backend)** (NestJS + PostgreSQL + Prisma).
> Start the backend first — this app is useless without it.
>
> 🚀 **New here? Read [`SETUP.md`](./SETUP.md)** — a zero‑to‑running, step‑by‑step guide (in Uzbek).

---

## Table of contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Environment variables](#environment-variables)
5. [NPM scripts](#npm-scripts)
6. [How it connects to the backend (important)](#how-it-connects-to-the-backend-important)
7. [Authentication & security model](#authentication--security-model)
8. [Internationalization (i18n)](#internationalization-i18n)
9. [Roles & permissions](#roles--permissions)
10. [Route map](#route-map)
11. [Project structure](#project-structure)
12. [Design system](#design-system)
13. [Test / seed accounts](#test--seed-accounts)
14. [Production build & deployment](#production-build--deployment)
15. [Troubleshooting](#troubleshooting)

---

## What it does

A single platform used by everyone in the center:

| Role          | What they do                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------- |
| `super_admin` | Everything + system settings, audit log, staff (incl. admins) management                      |
| `admin`       | Attendance, payments, students, groups, staff, articles, broadcasts, tests & videos           |
| `teacher`     | Attendance for own groups, give points (with limit), grade Writing/Speaking, view leaderboard |
| `student`     | Take tests, view results, browse/buy videos, see own points/attendance/payments, leaderboard  |
| `parent`      | Read‑only view of their children (points, attendance, payments), link a child by code         |

Guests (not logged in) see a **marketing site** with a hero, courses, features, news, and a contact footer.

---

## Tech stack

| Area           | Choice                                                              |
| -------------- | ------------------------------------------------------------------ |
| Framework      | **Next.js 16** (App Router, Turbopack, React Server Components)     |
| UI runtime     | **React 19**                                                       |
| Language       | **TypeScript** (strict)                                             |
| Styling        | **Tailwind CSS v4** (CSS‑first `@theme`, design tokens)             |
| i18n           | **next-intl v4** (`uz` / `ru` / `en`)                              |
| Server state   | **TanStack Query v5** (React Query)                                 |
| Forms          | **react-hook-form** + **zod v4**                                    |
| Primitives     | **Radix UI** (dialog, dropdown, select, tabs, …)                   |
| Charts         | **Recharts** (income chart)                                         |
| Icons          | **lucide-react**                                                    |
| Toasts         | **sonner**                                                          |
| Theme          | **next-themes** (light / dark / system)                            |

> ⚠️ This is **Next.js 16**, which has breaking changes vs. older versions
> (`params`/`searchParams` are Promises, `middleware.ts` was renamed to **`proxy.ts`**).
> The bundled docs live in `node_modules/next/dist/docs/` — read them before changing routing code.

---

## Quick start

**Prerequisites**

- Node.js **18.18+** (Next 16 requirement)
- The **backend running** at `http://localhost:3001` (Swagger at `http://localhost:3001/docs`)

```bash
# 1. install dependencies
npm install

# 2. (optional) configure the backend URL — see below
#    default already points at http://localhost:3001/v1

# 3. run the dev server
npm run dev
```

Open **http://localhost:3000**.

- `/` — public marketing site
- `/login`, `/register` — authentication
- After login you land on `/dashboard` (role‑aware).

---

## Environment variables

Create a `.env.local` in the project root (all optional — sensible defaults are built in):

| Variable                 | Default                      | Scope       | Description                                                                 |
| ------------------------ | ---------------------------- | ----------- | --------------------------------------------------------------------------- |
| `API_URL`                | `http://localhost:3001/v1`   | **server**  | Backend base URL. Used **only** by server code (the proxy), never the browser. |
| `NEXT_PUBLIC_MEDIA_HOST` | _(none)_                     | client      | Extra allowed host for `next/image` (e.g. a CDN serving thumbnails).        |
| `NODE_ENV`               | set by Next                  | server      | `secure` cookies are enabled automatically when `production`.               |

Because `API_URL` is **not** prefixed with `NEXT_PUBLIC_`, it is invisible to the browser bundle —
the browser never learns the backend address. All traffic goes through the Next.js proxy (below).

Example `.env.local`:

```env
API_URL=http://localhost:3001/v1
```

---

## NPM scripts

| Script          | What it does                                        |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Start the dev server (Turbopack) on port 3000      |
| `npm run build` | Production build (`next build`)                    |
| `npm run start` | Serve the production build                         |
| `npm run lint`  | Run ESLint                                         |

Type‑check without emitting: `npx tsc --noEmit`.

---

## How it connects to the backend (important)

The browser **never calls the backend directly**. Every request is proxied through Next.js so that
the JWT can live in a **secure, httpOnly cookie** (unreadable by JavaScript, so it survives XSS).

```
┌──────────┐   fetch('/api/backend/...')   ┌────────────────────────┐   Bearer <access>   ┌─────────────┐
│  Browser │ ────────────────────────────▶ │  Next.js proxy route   │ ──────────────────▶ │   Backend   │
│  (React  │   (cookie sent automatically) │ /api/backend/[...path] │                     │ :3001/v1    │
│  Query)  │ ◀──────────────────────────── │  reads httpOnly cookie │ ◀────────────────── │  (NestJS)   │
└──────────┘        JSON response          │  injects Authorization │    JSON / CSV / PDF │             │
                                           │  refreshes on 401      │                     └─────────────┘
                                           └────────────────────────┘
```

- **`src/app/api/backend/[...path]/route.ts`** — the catch‑all proxy. It reads the access token from the
  httpOnly cookie, adds `Authorization: Bearer …`, forwards the request, and streams the response back
  (works for JSON **and** binary downloads like CSV export and certificate PDFs). If the backend answers
  `401`, it silently calls `/auth/refresh` with the refresh token, retries once, and sets a fresh cookie.
  If refresh also fails, it clears the session cookies and the client redirects to `/login`.

- **`src/app/api/auth/{login,register,logout}/route.ts`** — thin auth handlers that call the backend,
  store the returned tokens in httpOnly cookies, and return **only** the public user object to the browser.

- **`src/lib/api-client.ts`** — the browser‑side client (`api.get/post/put/patch/delete`) that always hits
  `/api/backend/...`. Used by all React Query hooks.

- **`src/lib/public-api.ts`** — server‑side fetch for **public** endpoints (marketing news). It is resilient:
  if the backend is down it returns empty data so the marketing site still builds and renders.

> The backend is treated as **read‑only** from this repo. The frontend adapts to the backend contract; it
> does not change it. Contract source: the backend repo's [`api-contract.md`](https://github.com/Hamroqulovv/bestway-backend/blob/main/api-contract.md)
> and its own controllers/services.

---

## Authentication & security model

- Tokens are stored in three httpOnly cookies: `bw_at` (access), `bw_rt` (refresh), `bw_role` (role, for UX).
- The **access token** is short‑lived; the proxy refreshes it transparently, so users are not logged out mid‑session.
- **`src/proxy.ts`** (Next 16's renamed middleware) runs on every navigation and does two UX‑level things:
  1. Redirects unauthenticated users away from protected pages to `/login?next=…`.
  2. Redirects users to `/dashboard` if their role isn't allowed on a route (mirrors the backend's `@Roles`).
- **This is only for UX.** Real authorization is always enforced by the backend on every endpoint —
  a tampered cookie gets you a nicer redirect, not access to data.

---

## Internationalization (i18n)

- Locales: **`uz`** (default), **`ru`**, **`en`**. Configured in `src/i18n/routing.ts`.
- URL strategy is **`as-needed`**: the default locale has **no prefix** (`/dashboard`), others do
  (`/ru/dashboard`, `/en/dashboard`).
- Every app route lives under `src/app/[locale]/…`. There is intentionally **no** `src/app/layout.tsx` —
  `src/app/[locale]/layout.tsx` is the root layout (this is the standard next-intl pattern and works in Next 16).
- Translations are plain JSON in **`messages/{uz,ru,en}.json`**, one namespace per feature
  (`common`, `nav`, `auth`, `attendance`, `payments`, `groups`, `tests`, `videos`, …).
- Use the locale‑aware `Link` / `useRouter` from **`@/i18n/navigation`**, not `next/link` directly, so the
  active locale prefix is preserved.

To add a language: add the code to `routing.ts`, create `messages/<code>.json`, done.

---

## Roles & permissions

Navigation is generated per role from **`src/lib/nav.ts`**; route access is enforced in **`src/proxy.ts`**
(and, authoritatively, by the backend).

| Route          | super_admin | admin | teacher | student | parent |
| -------------- | :---------: | :---: | :-----: | :-----: | :----: |
| `/dashboard`   |     ✅      |  ✅   |   ✅    |   ✅    |   ✅   |
| `/attendance`  |     ✅      |  ✅   |   ✅    |         |        |
| `/payments`    |     ✅      |  ✅   |         |         |        |
| `/students`    |     ✅      |  ✅   |         |         |        |
| `/staff`       |     ✅      |  ✅   |         |         |        |
| `/groups`      |     ✅      |  ✅   |   ✅    |         |        |
| `/tests`       |     ✅      |  ✅   |   ✅    |   ✅    |        |
| `/videos`      |     ✅      |  ✅   |   ✅    |   ✅    |   ✅   |
| `/articles`    |     ✅      |  ✅   |         |         |        |
| `/leaderboard` |             |       |   ✅    |   ✅    |        |
| `/children`    |             |       |         |         |   ✅   |
| `/notifications`|    ✅      |  ✅   |   ✅    |   ✅    |   ✅   |
| `/settings`    |     ✅      |       |         |         |        |
| `/audit`       |     ✅      |       |         |         |        |
| `/profile`     |     ✅      |  ✅   |   ✅    |   ✅    |   ✅   |

---

## Route map

**Public (marketing):**

- `/` — landing page (hero, courses, features, latest news, contact)
- `/news`, `/news/[id]` — public articles
- `/login`, `/register` — auth (register is student/parent only; staff are created by admins)

**App (authenticated, under the sidebar/bottom‑nav shell):**

- `/dashboard` — role‑aware (admin sees KPIs + income chart; teacher sees their groups; student & parent see their overview)
- `/attendance` — Excel‑like monthly grid, click a cell to cycle Present → Absent → Late, `K/N/S` keyboard shortcuts, optimistic save, CSV export
- `/payments` — 12‑month grid per group, click to cycle Paid/Partial/Unpaid, right‑click for amount + note, debtors panel + reminders, CSV export
- `/students`, `/students/[id]` — roster, search, approve, edit, and a full student profile (points history + adjust, attendance, payments)
- `/staff` — teachers / admins / parents management (create, edit, deactivate)
- `/groups`, `/groups/[id]` — group CRUD, schedule editor, add/remove students, quick point‑giving
- `/tests` — students take tests; staff manage tests & grade
  - `/tests/[id]` — manage a test's questions (admin)
  - `/tests/attempt/[attemptId]` — the test runner (timer, autosave, anti‑cheat) or the result review (with teacher grading)
- `/videos` — browse/watch/buy video lessons; admins confirm purchases, upload, delete
- `/leaderboard` — points ranking
- `/children` — parent's read‑only view of each child + link‑a‑child form
- `/notifications` — inbox; admins can broadcast announcements
- `/articles` — news CRUD (admin)
- `/settings` — point limits, initial points, monthly fee (super_admin)
- `/audit` — full audit log (super_admin)
- `/profile` — account info + Telegram linking

---

## Project structure

```
frontend/
├─ messages/                     # i18n translations (uz.json, ru.json, en.json)
├─ src/
│  ├─ app/
│  │  ├─ [locale]/               # all pages live here (root layout with <html>/<body>)
│  │  │  ├─ (marketing)/         # public site: /, /news, /news/[id]
│  │  │  ├─ (auth)/              # /login, /register
│  │  │  └─ (app)/               # authenticated shell + all app pages
│  │  └─ api/
│  │     ├─ backend/[...path]/   # the proxy to the NestJS backend
│  │     └─ auth/{login,…}/      # cookie‑setting auth handlers
│  ├─ components/
│  │  ├─ ui/                     # design‑system primitives (button, card, dialog, input, …)
│  │  ├─ app/                    # shell (sidebar, topbar, mobile‑nav, user menu, page header)
│  │  ├─ data-grid/              # reusable Excel‑like grid + StateCell (attendance & payments)
│  │  ├─ marketing/              # site header/footer
│  │  ├─ dashboard/ attendance/ payments/ groups/ students/ staff/
│  │  ├─ tests/ videos/ articles/ notifications/ settings/ audit/ profile/ children/ …
│  ├─ hooks/                     # React Query hooks (use-me, use-groups, use-tests, …)
│  ├─ i18n/                      # routing.ts, navigation.ts, request.ts
│  ├─ lib/
│  │  ├─ api-client.ts           # browser API client (→ /api/backend)
│  │  ├─ public-api.ts           # server fetch for public endpoints
│  │  ├─ auth.ts                 # server‑only cookie/session helpers
│  │  ├─ config.ts               # CENTER branding, API_URL, cookie names
│  │  ├─ nav.ts                  # role‑based navigation config
│  │  ├─ types.ts                # all backend‑matching TypeScript types
│  │  └─ utils.ts                # cn(), money/phone/date formatting, initials, …
│  └─ proxy.ts                   # Next 16 "middleware": auth + RBAC redirects
├─ next.config.ts
└─ AGENTS.md                     # notes for AI assistants working in this repo
```

**Where to change branding:** `src/lib/config.ts` (center name, phone, email, address).

---

## Design system

- **Tokens** live in `src/app/globals.css` as CSS variables for light and `.dark` themes:
  surfaces, text, borders, `--brand` (green), and state colors (success / danger / warning / info).
- The **brand green is intentionally darker** than the "success" green so a "Save" button never reads as "Paid".
- Dark mode uses `next-themes` with the `class` strategy; toggle in the top bar (light / dark / system).
- Reusable primitives in `src/components/ui/` (`Button`, `Card`, `Dialog`, `Input`, `Badge`, `Select`,
  `Tabs`, `DropdownMenu`, feedback states, etc.). Prefer these over ad‑hoc markup.
- Tables use `tabular-nums`; the data grid supports sticky header + sticky first column and keyboard navigation.

---

## Test / seed accounts

If the backend database was seeded with the default script, these accounts exist
(password shown after `/`):

| Role        | Phone           | Password      |
| ----------- | --------------- | ------------- |
| super_admin | `+998900000001` | `Super123!`   |
| admin       | `+998900000002` | `Admin123!`   |
| teacher     | `+998900000003` | `Teacher123!` |
| student     | `+998900000010` | `Student123!` |
| parent      | `+998900000020` | `Parent123!`  |

> If your database already has **your own** data (not the seed), use your real credentials instead —
> the seed passwords only exist in a freshly seeded database.

New **student** and **parent** accounts can self‑register at `/register`.
**Teachers and admins are created by an admin** from `/staff`.

---

## Production build & deployment

```bash
npm run build     # compiles + type‑checks + prerenders static pages
npm run start     # serves the production build on port 3000
```

- Marketing pages (`/`, `/news`, `/login`, `/register`) are **statically generated** (SSG + ISR, 5‑min revalidate).
- All authenticated pages are **dynamic** (they read the session cookie), so they render on demand.
- Set `API_URL` to your real backend URL in the deployment environment.
- The app runs anywhere Node.js runs (Vercel, a Node server, a container). The `/api/*` routes require a
  Node runtime (they use cookies and streaming), so a fully static export is **not** supported.

---

## Troubleshooting

| Symptom                                            | Cause / fix                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Login fails with `INVALID_CREDENTIALS`             | The DB doesn't have that user, or wrong password. Seed passwords only apply to a freshly seeded DB.  |
| Marketing news section is empty                    | Backend is unreachable — this is intentionally non‑fatal; news simply doesn't render.                |
| A page redirects you to `/dashboard`               | Your role isn't allowed on that route (RBAC). Log in with a role that has access.                    |
| A page redirects you to `/login`                   | No session cookie — you're logged out or the session expired.                                        |
| `Port 3000 is in use`                              | A previous dev server is still running. Stop it, or Next will pick another port.                     |
| Type errors mentioning `.next/types`               | Stale generated types. Delete `.next` and re‑run `npm run build` (or `npx next typegen`).            |
| Requests fail with `BACKEND_UNREACHABLE` (502)     | The backend at `API_URL` isn't running. Start it on port 3001.                                       |

---

Built with the existing NestJS backend in mind — every field name, enum, and endpoint matches the backend
contract exactly. See the backend repo's [`api-contract.md`](https://github.com/Hamroqulovv/bestway-backend/blob/main/api-contract.md)
and this repo's `AGENTS.md` for deeper details.
