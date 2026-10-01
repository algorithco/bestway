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
