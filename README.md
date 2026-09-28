# BESTWAY — Education Center System

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![CI](https://github.com/bestwayec/bestway/actions/workflows/ci.yml/badge.svg)](https://github.com/bestwayec/bestway/actions/workflows/ci.yml)
[![Code of Conduct](https://img.shields.io/badge/Code_of_Conduct-Contributor_Covenant-4baaaa.svg)](CODE_OF_CONDUCT.md)

> **BESTWAY EC** — English & International Exams (IELTS / Multilevel / General)
> Shofirkon, Bukhara · Since 2007 · Founder **Aziz Akhtamov**

One platform for the whole center — students, teachers, parents and admins — with transparent attendance, points, payments and exam results.

**Quick links:** [Quick Start](#️-quick-start-docker--recommended) · [Features](#-features) · [Desktop exam client](#️-desktop-exam-client) · [API](#-api-contract) · [Contributing](CONTRIBUTING.md)

**Live (local):** Frontend `http://localhost:3005` · API `http://localhost:3001/v1` · Swagger `http://localhost:3001/docs` · Admin `http://localhost:3001/admin`

---

## ⚡️ Quick Start (Docker — recommended)

Microservices at root: `postgres` + `backend` + `frontend` via `education-net`.

```bash
# 1. clone
git clone https://github.com/bestwayec/bestway.git
cd bestway

# 2. backend env
cp backend/.env.example backend/.env
# edit JWT_SECRET / STREAM_TOKEN_SECRET (openssl rand -hex 32)

# 3. run all
docker compose up -d --build
docker compose logs -f          # wait until backend healthy
# frontend -> http://localhost:3005
# backend  -> http://localhost:3001/v1/health -> {status:"ok"}
```

Seed (first run):

```bash
docker exec education-backend npx prisma migrate deploy
docker exec education-backend npm run seed:init   # prod: super_admin only (from .env)
# or demo data (dev only):
docker exec education-backend npm run seed
```

Stop: `docker compose down -v`

> **Ports:** `3005` frontend (not `8080` — reserved for escrow), `3001` backend, `5433:5432` postgres (host `5432` occupied). Change in `docker-compose.yml` if needed.

### Local Dev (without Docker)

```bash
# backend
cd backend && npm install && npx prisma migrate deploy && npm run seed:init && npm run start:dev
# frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:3000, API_URL=http://localhost:3001/v1
```

---

## 🏗 Microarchitecture

```
Browser --fetch /api/backend/*--> Next.js (3005) --Bearer--> NestJS (3001) --Prisma--> PostgreSQL (5433)
                                     | httpOnly bw_at/bw_rt          | helmet + throttler + ValidationPipe
                                     | proxy + refresh               | /v1 + Swagger /docs + /admin static
                                     | next-intl (uz/en)             | Telegram bot (polling/webhook)
```

**Global pipeline:** `ThrottlerGuard → JwtAuthGuard → RolesGuard → TransformInterceptor({success,data,meta}) → AllExceptionsFilter({success:false,error:{code}})` — `backend/src/app.module.ts:1`, `backend/src/main.ts:1`

---

## ✨ Features

| Module | Path | What it does |
|---|---|---|
| **Attendance** | `/attendance` | Excel-like grid, present/late/absent, stats, CSV |
| **Payments** | `/payments` | 12-month grid, partial/paid/unpaid, debtors + reminders |
| **Points & Game** | `/points`, `/game` | ± points with reason, leaderboard, monthly reset cron |
| **Groups/Users** | `/groups`, `/students` | CRUD, schedule, teacher assignment |
| **Tests** | `/tests` | IELTS/Multilevel, auto + manual grading, anti-cheat, PDF cert |
| **Mock Exams** | `/mock` | Real IELTS 15 types, band/CEFR, timed/practice, speaking audio, purchases |
| **Videos** | `/videos` | Upload, signed stream URLs, manual purchase confirm |
| **Articles/Gallery/Teachers** | `/news`, gallery | CMS for marketing site |
| **Notifications** | `/notifications` | In-app + Telegram broadcast (all/role/group/debtors) |
| **Stats/Audit/Settings** | `/dashboard`, `/audit` | Income chart, CSV exports, audit log (super_admin) |

---

## 🖥️ Desktop exam client

The Tauri 2 kiosk exam client now lives in [`bestwayec/bw-tauri`](https://github.com/bestwayec/bw-tauri): AES-GCM secure storage, signed auto-updater, per-platform lockdown and CSP/capability review. Desktop releases and installers ship from that repo.

---

## 🖼️ Screenshots

Screenshots live in `docs/screenshots/` — drop PNGs there and reference them here (dashboard, attendance grid, mock exam). No placeholders are linked until images exist, so the page never shows broken images.

---

## 🧰 Tech Stack

| Layer | Choice |
|---|---|
| Backend | **NestJS 10** · Prisma 5 · PostgreSQL 17 · JWT + bcryptjs · helmet · pdfkit |
| Frontend | **Next.js 16** (App Router, Turbopack, RSC) · React 19 · Tailwind v4 · next-intl · TanStack Query · Radix UI · Recharts |
| Desktop | **Tauri 2** (in [`bestwayec/bw-tauri`](https://github.com/bestwayec/bw-tauri)) · React 19 · signed updater · secure storage (AES-GCM) |
| DevOps | Docker multi-stage (`node:22-slim`/`24-alpine`), `education-net`, healthchecks |

---

## 🔐 Roles

| Role | Access |
|---|---|
| **super_admin** | all + audit/settings/delete |
| **admin** | students/groups/attendance/payments/tests/videos/articles |
| **teacher** | own groups: attendance, points ±limit, grading |
| **student** | take tests/mocks, own data, videos, leaderboard |
| **parent** | read-only children via `linkCode` |

See `frontend/src/lib/nav.ts:1` + `frontend/src/proxy.ts:1` + `backend/src/common/roles.guard.ts:1`

---

## 📁 Structure

```
.
├── docker-compose.yml      # 3 services (microservices)
├── backend/               # NestJS API
│   ├── prisma/schema.prisma (699 lines, 26 models)
│   ├── src/{auth,users,groups,attendance,payments,points,game,tests,mock,videos,articles,telegram,stats}
│   └── Dockerfile (22-slim, prisma migrate deploy)
├── frontend/              # Next.js
│   ├── src/app/[locale]/(marketing|auth|app)  # 37 pages
│   ├── src/components/{ui,app,marketing,data-grid,attendance,...}
│   ├── src/lib/{config,types,nav,api-client} + i18n
│   └── Dockerfile (24-alpine, 3005:3000)
└── docs/                  # specs, reviews, screenshots
```

---

## 🔧 Env & Scripts

**Backend `backend/.env.example:1`:** `DATABASE_URL`, `PORT=3001`, `JWT_SECRET>=32`, `STREAM_TOKEN_SECRET`, `CORS_ORIGIN`, `TELEGRAM_BOT_TOKEN`/`@bestway_xabarbot`, `CENTER_NAME`, `SEED_SUPER_ADMIN_*`
**Frontend:** no `.env` needed — `API_URL=http://backend:3001/v1` (server-only, via Docker network; host `http://localhost:3001/v1`)

```bash
# backend npm
npm run start:dev | build | prisma:generate | seed | seed:init | test:smoke
# frontend npm
npm run dev | build | start | lint   # + npx tsc --noEmit
```

---

## 📚 API Contract

All `success` → `{success:true,data,meta?}`, errors → `{success:false,error:{code,message}}`. Base `/v1` — see `backend/api-contract.md:1` + `http://localhost:3001/docs`.

### Demo accounts (after `npm run seed`)

| Role | Phone | Password |
|---|---|---|
| teacher | `+998900000003` | `Teacher123!` |
| student | `+998900000010` | `Student123!` |
| parent | `+998900000020` | `Parent123!` |

---

## CI/CD

- Every PR targeting `main` (and every push to `main`) runs `.github/workflows/ci.yml`:
  - `backend`: Postgres 16 service → `npm ci` → `prisma generate` → `prisma migrate deploy` → `nest build` → start built app, wait for `/v1/health`, run `npm run test:smoke`.
  - `frontend`: `npm ci` → `npm run lint` → `npm run build`. Lint or build failure fails the check.
- Desktop releases ship from [`bestwayec/bw-tauri`](https://github.com/bestwayec/bw-tauri) (tagged `bestway-app-vX.Y.Z` there); this repo's CI does not build installers.
- Run the same checks locally before pushing:

```bash
# backend (needs Postgres at localhost:5432 + JWT_SECRET>=32 chars)
cd backend && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
npm run start:prod &  # then wait for http://localhost:3001/v1/health -> 200
npm run test:smoke; kill %1
# frontend
cd frontend && npm ci && npm run lint && npm run build
```

---

## 🤝 Community

* [Contributing](CONTRIBUTING.md) — setup, checks, commit style, PR rules
* [Code of Conduct](CODE_OF_CONDUCT.md) — report to `otashdev1@gmail.com`
* [Security](SECURITY.md) — private reporting via Advisory or email
* [License](LICENSE) — GPL-3.0

---

*Built for a single center, modular for growth — StorageService & Notifications swappable to S3/CDN. Feedback: `otashdev1@gmail.com` · `SECURITY.md`*
