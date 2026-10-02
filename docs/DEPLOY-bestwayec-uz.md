# BESTWAY — Deploy to bestwayec.uz (VPS, Docker Compose + nginx + Let's Encrypt)

Architecture: `bestwayec.uz` → `127.0.0.1:3005` (frontend) ·
`api.bestwayec.uz` → `127.0.0.1:3001` (backend) ·
Postgres internal only (`127.0.0.1:5433` for admin).

## 0. DNS

A records → VPS IP (TTL 300): `@`, `www`, `api`.

Verify: `dig +short bestwayec.uz api.bestwayec.uz`

## 1. Server (Ubuntu 24.04)

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y nginx certbot python3-certbot-nginx
ufw allow OpenSSH; ufw allow 80,443/tcp; ufw enable
git clone https://github.com/bestwayec/bestway.git /opt/bestway
cd /opt/bestway
```

Base `docker-compose.yml` is already prod (CORS/PUBLIC_URL → bestwayec.uz).
`docker-compose.override.yml` is gitignored dev-only — never copy it to the VPS.

## 2. Env (chmod 600, never commit)

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
cp backend/.env.example backend/.env
# edit backend/.env:
#   JWT_SECRET=$(openssl rand -hex 32)            # >=32 chars, boot fails otherwise
#   STREAM_TOKEN_SECRET=$(openssl rand -hex 32)
#   SEED_SUPER_ADMIN_*=...                        # strong password, rotate after seed
#   TELEGRAM_MODE=webhook                        # prod (HTTPS required)
#   TELEGRAM_WEBHOOK_URL=https://api.bestwayec.uz/v1/telegram/webhook
#   TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)
chmod 600 .env backend/.env
```

Frontend needs no runtime `.env` — compose sets `API_URL=http://backend:3001/v1`
(build arg + server env). See `frontend/.env.example`.

## 3. Boot + migrate + seed once

```bash
docker compose up -d --build
docker compose logs -f backend   # wait healthy
docker exec education-backend npx prisma migrate deploy
docker exec education-backend npm run seed:init   # NEVER seed/seed:mock in prod
curl -sf http://127.0.0.1:3001/v1/health
curl -sI http://127.0.0.1:3005/ | head -3
```

## 4. nginx + TLS

```bash
sudo cp nginx/bestwayec.uz.conf /etc/nginx/sites-available/bestwayec.uz
sudo cp nginx/api.bestwayec.uz.conf /etc/nginx/sites-available/api.bestwayec.uz
sudo ln -s /etc/nginx/sites-available/bestwayec.uz /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.bestwayec.uz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bestwayec.uz -d www.bestwayec.uz -d api.bestwayec.uz
sudo certbot renew --dry-run
```

Nginx already forwards `X-Forwarded-Proto` (required for Secure cookies) and
`client_max_body_size 520m` + 600s timeouts for 500 MB uploads.

## 5. Smoke

- `https://bestwayec.uz` → 200, valid cert
- `https://api.bestwayec.uz/v1/health` → `{"success":true,"data":{"status":"ok"}}`
- login works (no CORS errors), images load, server actions work,
  video upload/playback works, `https://api.bestwayec.uz/admin` loads.

## 6. Backups (cron)

```bash
0 2 * * * deploy /opt/bestway/backend/scripts/backup.sh /var/backups/bestway >>/var/log/bestway-backup.log 2>&1
```

Retain 7 daily + 4 weekly, offsite copy, quarterly restore drill.

## 7. Updates / rollback

```bash
git pull --ff-only
docker tag education-backend:latest education-backend:prev   # keep N-1
docker compose up -d --build
curl -sf https://api.bestwayec.uz/v1/health && curl -sf https://bestwayec.uz/ >/dev/null
# rollback: git reset --hard <prev-sha> && docker compose up -d --build
# DB: backward-compatible migrations only; destructive ones need expand→migrate→contract
```

Branch note: deploy from `main` only — feature branches (e.g. `feat/*`) are not
production builds. Pre-deploy: `npm ci && npm run build` (backend + frontend),
`npm run lint` (frontend), `npm run test:smoke` with live server.
