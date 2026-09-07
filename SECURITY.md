# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

Backend `1.0.0` (`backend/package.json`) va frontend `0.1.0` hozirda qo'llab-quvvatlanadi. Faqat `main` tarmog'i yangilanadi.

## Reporting a Vulnerability

Agar xavfsizlik kamchiligi topsangiz, iltimos to'g'ridan-to'g'ri GitHub Security Advisory orqali xabar bering yoki `otashdev1@gmail.com` ga yozing.

- 48 soat ichida javob beramiz.
- Tasdiqlangan kamchiliklar 7 kun ichida tuzatiladi va yangi reliz chiqariladi.
- Iltimos, kamchilik ommaga oshkor bo'lmasdan oldin tuzatishga vaqt bering.

## Scope

- `backend` — NestJS API, Prisma, JWT, file upload, Telegram bot
- `frontend` — Next.js proxy, auth cookies, RBAC
- `docker-compose.yml` / `Dockerfile` — infratuzilma

## Secrets

Hech qachon `backend/.env` ni commit qilmang. Barcha `JWT_SECRET`, `STREAM_TOKEN_SECRET`, `TELEGRAM_BOT_TOKEN` qiymatlari faqat `.env` da saqlanadi va `.gitignore` bilan himoyalangan.

## Supply chain

- `.github/workflows` dagi action'lar full commit SHA ga pinned; `GITHUB_TOKEN` default `contents: read`, faqat release job'da `contents: write`.
- Container base image'lar pinned (`postgres:17.11-alpine`, Dockerfile'larda explicit Node patch taglari); image'lar non-root user'da ishlaydi.
- `POSTGRES_PASSWORD` faqat environment/`.env` dan keladi — compose o'rnatilmagan bo'lsa fail-fast (`:-postgres` default olib tashlangan). `*.log` va `.env` git'ga commit qilinmaydi.
