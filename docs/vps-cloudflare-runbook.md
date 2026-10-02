# VPS + Cloudflare runbook — BESTWAY (Docker on Ubuntu 24.04, Cloudflare Free HTTPS)

> New file, no overlap with other workstreams. Original deploy doc
> (`BESTWAY-production-deploy-EN.md`, git-ignored) remains the long reference;
> this is the Cloudflare-corrected checklist incorporating Oct-2026 limit research:
> Free/Pro proxied upload cap **100MB**, proxy **read 125s / write 30s → 524**,
> Origin CA **15-yr PEM, Full (strict)**, grey-cloud bypass for 500MB videos.
> Sources: https://developers.cloudflare.com/fundamentals/reference/connection-limits/,
> https://developers.cloudflare.com/cache/concepts/default-cache-behavior/,
> https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/,
> https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/

## 0. One-time Cloudflare dashboard

- [ ] Site `bestwayec.uz` on Cloudflare (NS pointed).
- [ ] DNS: `A @ → VPS_IP` orange, `A www → VPS_IP` orange, `A api → VPS_IP` orange,
  `A direct-api → VPS_IP` **grey (DNS only)**.
- [ ] SSL/TLS → Overview → **Full (strict)**. Edge: Always Use HTTPS ON, TLS 1.2+, HSTS ON (after green).
- [ ] SSL/TLS → Origin Server → Create Certificate (`bestwayec.uz, *.bestwayec.uz`, 15 yr, PEM)
  → `/etc/nginx/ssl/cf-origin.pem` + `-key.pem` (600). Record expiry (no CF email).
- [ ] Caching → Cache Rules → Bypass cache for `Hostname equals api.bestwayec.uz` and
  `URI Path starts with /api/` (expect `cf-cache-status: DYNAMIC`).

## 1. VPS hardening (shell)

```bash
adduser deploy && usermod -aG docker,sudo deploy
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from $ip to any port 80,443 proto tcp; done
# repeat with ips-v6 via ip6tables/ufw v6
ufw enable
apt install -y fail2ban unattended-upgrades
# SSH: PasswordAuthentication no, PermitRootLogin no, key-only for deploy
```

## 2. First boot (shell, /opt/bestway)

```bash
git clone <repo> /opt/bestway && cd /opt/bestway
openssl rand -hex 32  # → POSTGRES_PASSWORD (root .env, chmod 600, never commit)
cp backend/.env.example backend/.env  # then edit: JWT_SECRET(≥32)/STREAM_TOKEN_SECRET/DATABASE_URL(@postgres:5432)/CORS/PUBLIC_URL/NODE_ENV=production/TELEGRAM webhook
sudo cp nginx/bestwayec.uz.cf-origin.conf /etc/nginx/sites-available/bestwayec.uz
sudo cp nginx/api.bestwayec.uz.cf-origin.conf /etc/nginx/sites-available/api.bestwayec.uz
sudo cp nginx/direct-api.bestwayec.uz.conf /etc/nginx/sites-available/direct-api.bestwayec.uz
sudo cp nginx/cloudflare-ips.conf /etc/nginx/conf.d/cloudflare-ips.conf
sudo ln -s /etc/nginx/sites-available/bestwayec.uz /etc/nginx/sites-enabled/  # + api + direct-api
sudo certbot --nginx -d direct-api.bestwayec.uz  # ONLY grey host needs public cert
sudo nginx -t && sudo systemctl reload nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait --wait-timeout 90
docker exec education-backend npm run seed:init  # ONCE (super-admin)
curl -f http://127.0.0.1:3001/v1/health && curl -f http://127.0.0.1:3005/ >/dev/null
curl -f https://bestwayec.uz/ && curl -f https://api.bestwayec.uz/v1/health
```

## 3. Backups + monitoring

- [ ] Cron: `0 2 * * * /opt/bestway/backend/scripts/backup-full.sh >>/var/log/bestway-backup.log 2>&1`
- [ ] Quarterly `pg_restore` drill to staging. `KEEP_DAYS=14` covers 2 weeks.
- [ ] Uptime (UptimeRobot/Kuma): `https://bestwayec.uz/` + `https://api.bestwayec.uz/v1/health` 60s → Telegram.
- [ ] Disk alert >75% (`docker system df`, `du -sh /var/lib/docker/volumes/*`).

## 4. CI deploy

- [ ] GitHub secrets `VPS_HOST/VPS_USER/VPS_SSH_KEY(/VPS_PATH)` set → push to `main` triggers
  `.github/workflows/deploy.yml` (pull → compose prod → local + public health gates → prune).
- [ ] Rollback: `git revert + push`.

## 5. Known limits / follow-ups (do NOT re-tune Nginx timeouts past CF wall)

- Orange hosts: 100MB + 125s/30s hard wall. `direct-api` grey host: 520m/600s allowed.
- Frontend `UPLOAD_API_HOST` wiring (>90MB → direct-api) still needs a small client change.
- Proper fix later: chunked tus or R2/S3 presigned multipart (each request <100MB).
- Never `Flexible` SSL; never expose 3001/3005/5433 publicly; never `migrate dev` in prod.

## 6. Shared VPS (Option B: cloudflared tunnel — grandec co-host, 194.163.150.178)

Supersedes sections 1-2 on any VPS where host ports 80/443 already belong to
another stack. Grandec (`lms-platform-prod`, `/opt/lms`) is NEVER touched:
no shared nginx, no container restarts, no config edits.

### Architecture

```
Cloudflare edge (orange cloud, Full strict)
  bestwayec.uz, www.bestwayec.uz ─┐
  api.bestwayec.uz ───────────────┤
                                  ▼
              cloudflared (outbound-only tunnel, education-cloudflared)
                                  ▼
              education-net (docker, no published web ports)
              ├── education-frontend :3000
              ├── education-backend  :3001
              └── education-postgres :5432 (loopback 127.0.0.1:5433 for host backups)
```

- Compose project: `bestway-prod` (`name:` in docker-compose.prod.yml).
  Deploy path on this VPS: `/home/deploy/bestway` (`VPS_PATH` secret;
  `/opt` is root-owned and the deploy user has no sudo).
- `docker-compose.prod.yml` adds the `cloudflared:2026.9.3` service
  (`tunnel --no-autoupdate run`, `TUNNEL_TOKEN` from root `.env`, fail-fast
  if unset) and resets web-service host ports to `[]`.
- Repo is public: `git pull` on the VPS needs no credential.

### Resource limits (8GB VPS)

| Stack | Caps | Typical use |
|---|---|---|
| bestway postgres | 768m | ~50MB |
| bestway backend | 1g | ~90MB |
| bestway frontend | 768m | ~100MB |
| bestway cloudflared | 256m | ~20MB |
| grandec (7 containers, uncapped) | — | ~630MB |

Worst-case bestway footprint ≈ 2.8GB; measured total ≈ 1.3GB used of 8GB.
Alert if `free` available drops below 1GB. Never raise bestway caps without
re-checking grandec headroom first.

### First deploy (all as `deploy`, never root, never grandec files)

```bash
git clone --branch main https://github.com/bestwayec/bestway.git /home/deploy/bestway
cd /home/deploy/bestway
# root .env (chmod 600): POSTGRES_PASSWORD=$(openssl rand -hex 16),
# TUNNEL_TOKEN=<Zero Trust tunnel token>
# backend/.env (chmod 600): copy from backend/.env.example, set JWT_SECRET /
# STREAM_TOKEN_SECRET ($(openssl rand -hex 32)), SEED_SUPER_ADMIN_* (strong).
# First boot WITHOUT the tunnel (token comes later):
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --wait postgres backend frontend
# seed:init needs ts-node (devDep, absent from prod image) — run it via npx
# with an in-container tsconfig (see runbook history / deploy log Oct 2026).
# NEVER run seed / seed:mock in prod.
# Attach the tunnel once TUNNEL_TOKEN is in root .env:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait cloudflared
docker logs education-cloudflared  # expect "Registered tunnel connection"
```

### Deploy / rollback (CI: `.github/workflows/deploy.yml` on push to main)

- Deploy: push to `main` → Actions SSH (`VPS_HOST/USER/KEY/PATH` secrets) →
  `git pull --ff-only` → `up -d --build --wait` → exec health gates (fatal) +
  public URL gates (warn-only pre-cutover) → image prune.
- Rollback: `git revert + push` (re-deploys previous code). Grandec rollback
  (`.last_good_tag`) is a separate system — never mix the two.
- FORBIDDEN on shared VPS: `docker compose down` (drops nothing but kills
  uptime; use `up -d`), `docker system prune -a` (would delete grandec
  images/containers' layers — prune DANGLING only, and even that is scoped
  per-invocation), any `docker`/`nginx`/`/opt/lms` command targeting grandec.

### Grandec safety check (before AND after every bestway change)

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'   # 7/7 healthy, uptimes unchanged
curl -k -s -o /dev/null -w '%{http_code} %{time_total}\n' --resolve grandec.uz:443:127.0.0.1 https://grandec.uz/
curl -s -o /dev/null -w '%{http_code} %{time_total}\n' https://grandec.uz/   # ~0.9s edge baseline
```

### 100MB upload limitation (Option B has NO grey-cloud bypass)

The tunnel only works proxied (orange cloud), so Cloudflare Free's 100MB
request-body cap applies to ALL bestway traffic. The app allows up to
`MAX_UPLOAD_MB=500` (videos, mock storage) — uploads >100MB will fail
(413/524) until the app chunks them. Do NOT work around this with a grey-cloud
host: it would need host :443, which grandec owns. Proper fixes (app-level):
client-side chunking (tus) or R2/S3 presigned multipart, each request <100MB.
