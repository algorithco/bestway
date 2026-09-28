# Contributing to BESTWAY

Thanks for your interest in BESTWAY — Education Center System (NestJS API + Next.js frontend)!

## Code of Conduct

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to contribute

1. Fork the repo and create a branch from `main`:
   `git checkout -b feat/short-name` or `fix/short-name`
2. Make focused changes with tests where relevant.
3. Run the same checks as CI before pushing (see below).
4. Open a Pull Request against `main` using the PR template.
5. Link related issues (`Fixes #123`).

## Development setup

Requirements: Node 24, Docker + Docker Compose, Postgres (via compose).

```bash
# 1. clone
git clone https://github.com/bestwayec/bestway.git
cd bestway

# 2. backend env
cp backend/.env.example backend/.env
# edit JWT_SECRET / STREAM_TOKEN_SECRET (openssl rand -hex 32)

# 3. run all (postgres + backend + frontend)
docker compose up -d --build
docker compose logs -f

# frontend -> http://localhost:3005
# backend  -> http://localhost:3001/v1/health
```

Seed (first run):

```bash
docker exec education-backend npx prisma migrate deploy
docker exec education-backend npm run seed:init
```

Local dev without Docker:

```bash
# backend
cd backend && npm install && npx prisma migrate deploy && npm run seed:init && npm run start:dev
# frontend (new terminal)
cd frontend && npm install && npm run dev
```

## Checks (must pass)

Backend (needs Postgres + `JWT_SECRET` >= 32 chars):

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod &
# wait for http://localhost:3001/v1/health -> 200
npm run test:smoke; kill %1
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Desktop contributions happen in [`bestwayec/bw-tauri`](https://github.com/bestwayec/bw-tauri) — the Tauri kiosk exam client lives there, not in this repo.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

* `feat: add points leaderboard export`
* `fix(backend): hide correctAnswer until grading completes`
* `docs: update seed instructions`
* `chore: bump prisma`

Keep PRs small and focused. One feature/fix per PR.

## Pull Request rules

* Target `main`.
* Fill in the PR template: summary, what/why, how tested, screenshots for UI.
* Checklist: lint + build pass, Prisma migration included if schema changed, no secrets/`.env` committed.
* CI (`.github/workflows/ci.yml`) must be green. Tagged desktop releases (`bestway-app-vX.Y.Z`) ship from [`bestwayec/bw-tauri`](https://github.com/bestwayec/bw-tauri).

## Reporting bugs / requesting features

Use the issue templates (Bug report / Feature request). Include:

* backend `1.0.0` / frontend version, steps to reproduce, expected vs actual, logs (`docker compose logs backend`), screenshots for UI.

## Security

Do NOT open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md) — report via GitHub Security Advisory or `otashdev1@gmail.com`. Response within 48h.

## License

By contributing, you agree your contributions are licensed under [GPL-3.0](LICENSE).
