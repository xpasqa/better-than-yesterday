# Project conventions

## Feature documentation

Every new feature's spec, plan, and todo checklist go in:

```
docs/feature/<number>.<name-spec>/spec.md
docs/feature/<number>.<name-spec>/plan.md
docs/feature/<number>.<name-spec>/todo.md
```

- `<number>` increments per feature (check existing folders under
  `docs/feature/` for the next number).
- `<name-spec>` is a short kebab-case slug for the feature.
- Do not write feature specs to the project root (e.g. `SPEC.md`) or to
  `docs/<name>/` without the `feature/<number>.` prefix — this is the
  one location for all feature docs going forward.

## Server & deployment

Production URL: https://bty.xvntr.my.id

**Stack:**
- Web server: nginx (port 80/443) — serves static files from `/var/www/bty.xvntr.my.id/`
- API: Docker container `app-api-1` — Node 22, Hono, port 3101 (mapped from 3001 inside container)
- Database: Docker container `app-postgres-1` — Postgres 16, port 5432
- TLS: Let's Encrypt via Certbot, config at `/etc/nginx/conf.d/bty.xvntr.my.id.conf`

**Deploy web frontend:**
```bash
# 1. Build
cd /home/ubuntu/bty/app/apps/web
sudo chown -R ubuntu:ubuntu node_modules/.vite-temp node_modules/.tmp dist 2>/dev/null || true
/home/ubuntu/bty/app/node_modules/.bin/vite build

# 2. Copy to nginx web root
sudo cp -r /home/ubuntu/bty/app/apps/web/dist/. /var/www/bty.xvntr.my.id/

# 3. Reload nginx
sudo nginx -s reload
```

**Deploy API:**
```bash
cd /home/ubuntu/bty/app
docker compose build api
docker compose up -d api
```

**Useful commands:**
```bash
docker compose ps                        # check running containers
docker compose logs api --tail=50        # API logs
sudo nginx -t                            # test nginx config
sudo nginx -s reload                     # reload nginx without downtime
```

**Notes:**
- nginx handles TLS and static file serving directly (not Caddy)
- `docker-compose.override.yml` maps api port to 3101 on host (not 3001)
- vite binary is at `/home/ubuntu/bty/app/node_modules/.bin/vite` (not in workspace node_modules)
- `dist/` and `node_modules/.vite-temp` may be owned by root; use `sudo chown` before building
