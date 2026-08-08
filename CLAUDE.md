# Project conventions

## Workflow: brainstorm → docs → issues → board

**This is the base rule. It is strict — no shortcuts, no exceptions.**

Nothing reaches the GitHub Project board without passing through every
stage below, in order. The board is the output of this pipeline, never an
inbox for stray thoughts.

```
brainstorm  →  spec.md  →  plan.md + todo.md  →  epic + issues  →  board
   Inbox        Backlog            Ready                          Ongoing → Review → Done
```

### The six Status categories

| Status | Means | Entry requirement |
|---|---|---|
| **Inbox** | Raw idea. Nothing written yet. | An idea worth keeping. |
| **Backlog** | `spec.md` exists. | Spec written: the what and the why, with reasons for each decision. |
| **Ready** | Fully specced, ready to pick up. | `spec.md` **and** `plan.md` **and** `todo.md` all complete, and the epic + issues exist on GitHub. |
| **Ongoing** | Being worked on right now. | Someone has actually started. |
| **Review** | Implementation done, awaiting review/verification. | Code merged or in review; verification not yet signed off. |
| **Done** | Finished. | Merged **and** the issue is closed. |

### Epic and issue structure

```
1 feature  =  1 epic  +  N detailed issues
                         ↓
        the task list on the board IS the epic
```

- **Detailed issues carry the work.** Each is independently implementable
  and reviewable, with its own interfaces, edge cases, and acceptance
  criteria spelled out. Split freely — more detail beats fewer issues.
- **The epic is the table of contents.** It lists every issue as a
  checklist (`- [ ] #32 — ...`), states their order and dependencies, and
  holds the shared design decisions plus what is deliberately out of scope.
  It does not duplicate the issues' technical detail — that would drift.
- **The board's task list is the epic, made visible.** A feature's epic and
  its issues sit together as items on the board and move through the Status
  columns as a group. There is **one board** — do not create a separate
  board per feature.

### Hard rules

1. **Every brainstorm ends as issues.** A brainstorming session is not
   finished until it has produced `spec.md`, `plan.md`, `todo.md`, and the
   GitHub epic + its detailed issues. Only then does it enter **Ready**.
2. **Never add an issue directly to the board.** An issue may only appear on
   the board as part of a feature that already went through the pipeline. A
   drive-by issue with no spec does not belong there — it goes to **Inbox**
   as an idea until it is specced.
3. **One board; the task list on it is the epic.** A feature's epic and its
   issues go on the board together and move through the columns as a group.
   Do not spin up a separate board per feature.
4. **Nothing enters Ready half-specced.** Spec without plan means
   **Backlog**, not Ready. This distinction is the entire point of having
   both columns.

### Board commands

```bash
gh project view 7 --owner xpasqa                  # inspect
gh project item-list 7 --owner xpasqa             # what's on the board
gh project item-add 7 --owner xpasqa --url <issue-url>
gh project field-list 7 --owner xpasqa            # field + option IDs
```

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
- These three files are what promote a feature from **Inbox → Backlog →
  Ready** on the board. See the workflow section above.

## Frontend types are the contract

Types defined in `apps/web/src/types/index.ts` are the **authoritative contract**
for the entire app. They must not be changed to match the backend.

When wiring a view to a real API:
- The backend API response **must be shaped to match** the existing frontend types.
- Map/transform backend DB fields to frontend field names in the API route or service
  (e.g. `folderId` → `parentId`, `mimeType` → `type`, `updatedAt` → `modifiedAt`).
- Never add backend-only fields (`areaId`, `s3Key`, `status`, `createdAt`) to
  frontend types unless the UI explicitly needs them.
- Never change frontend types to match DB column names.

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
