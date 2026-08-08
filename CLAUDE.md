# Project conventions

## Workflow: brainstorm → docs → issues → board

**This is the base rule. It is strict — no shortcuts, no exceptions.**

Nothing reaches the GitHub Project board without passing through every
stage below, in order. The board is the output of this pipeline, never an
inbox for stray thoughts.

```
brainstorm  →  spec.md  →  plan.md + todo.md + issues  →  work  →  verified
   Inbox        Backlog              Ready              Ongoing   Review → Done
   ╰── plain issue ──╯               ╰────────── [EPIC] ──────────────────╯
```

**One feature = one card, always.** It starts as a plain issue, becomes an
`[EPIC]` on entering Ready, and from then on its detailed issues are
tracked inside it — never as separate cards.

### The six Status categories

Each column has an **entry gate** (all conditions must hold to move in) and
an **exit gate** (what must be produced to move on). A card that fails its
own entry gate does not belong in that column — move it back.

#### 1. Inbox — raw idea

- **Enter:** an idea worth keeping. Nothing written yet.
- **Exit:** `spec.md` written → Backlog.
- Ideas may sit here indefinitely. This is the only column with no pressure.

#### 2. Backlog — specced, not planned

- **Enter:** `docs/feature/<n>.<slug>/spec.md` exists and states the *what*
  and the *why*, with a reason for every decision and an explicit
  out-of-scope list.
- **Exit:** `plan.md` + `todo.md` written, the detailed issues created, and
  the card **promoted to an epic** that lists them → Ready.
- The card is still a plain issue here. It has a spec, but nothing has
  decided what its pieces are yet.
- A spec that only says what to build, without why, is not done. The
  "why" is what stops the next person relitigating it.

#### 3. Ready — fully specced, unstarted

- **Enter:** all four must be true —
  1. `spec.md` complete
  2. `plan.md` complete (step-by-step, per block)
  3. `todo.md` complete
  4. The card is now an **`[EPIC]`** and lists every detailed issue as a
     checklist
- **Exit:** someone actually starts → Ongoing.
- Anything here must be pickable **without asking a single question**. If a
  question comes up while starting, that is a Backlog card wearing a Ready
  label — send it back and fix the spec.

#### 4. Ongoing — being worked on

- **Enter:** work has genuinely started (branch/worktree exists, first
  commit made).
- **Exit:** implementation complete, tests green, pushed → Review.
- **WIP limit: one feature at a time.** Within that feature, respect the
  epic's stated dependency order. Parallel half-finished features are how
  context gets lost.

#### 5. Review — built, not yet trusted

- **Enter:** implementation complete and pushed; `npm run verify` green.
- **Exit:** review passed **and** verification actually run → Done.
- **Self-review and AI review both clear this gate.** No second human is
  required.
- For anything risky, prefer a **fresh-context** review — an agent that has
  not seen the implementation conversation — over re-reading your own diff.
  In this repo that difference is measurable: the recurring-tasks
  whole-branch review caught two serious bugs (a sync deadlock, and a
  quick-add "fix" that had silently broken 6 of 8 recurrence patterns) that
  nine consecutive per-task reviews had all missed.

#### 6. Done — finished and verified

- **Enter:** all of —
  1. Merged to `master`
  2. Issue closed
  3. `npm run verify` green **on the merged result**, not just on the branch
  4. Verification for the feature's actual claims **actually run**
- Nothing leaves Done.

> **Unrun verification keeps a card in Review — it does not qualify for
> Done.** Writing the gap up as its own issue is how you *track* it, not how
> you *skip* it. Recurring tasks is the live example: merged to production,
> `verify` green, every sub-issue closed — but browser verification was
> never run even once (issue #24). That card sits in **Review**, not Done,
> because "merged" and "known to work" are different claims.

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

### What a card is, by column

**A card is a plain issue until Ready, then it becomes an epic.**

| Column | Card is | Why |
|---|---|---|
| Inbox | plain issue | Still an idea. Nothing is clear enough to split yet. |
| Backlog | plain issue | Specced, but not yet broken into pieces — there is no list to be the index of. |
| Ready → Done | **epic** | Planning decided what the pieces are, so the card can now index them. |

**Anything still unclear stays a plain issue.** You cannot write an epic's
checklist before knowing what the issues are — that is exactly what
planning produces. Promoting a vague card to `[EPIC]` early just creates an
index of nothing.

The **Backlog → Ready** move is therefore where the promotion happens:
retitle to `[EPIC] <feature>`, and add the checklist of the detailed issues
that planning just produced.

### Only the epic goes on the board — never its issues

Once a card is an epic, its detailed issues live on GitHub and are linked
from the epic's checklist, but are **not** added as board items. A board
showing every sub-issue is a dirty board: the columns stop showing "which
features are in flight" and start showing "which files someone is editing".

```
Board  →  #31 [EPIC] Search       ← the only card
              ├── #32  Block A     ← real issues, tracked in the epic's
              ├── #33  Block B        checklist, NOT on the board
              └── #34  Block C
```

The epic's column is **derived from its issues, never set by hand**:

| Epic moves to | When |
|---|---|
| Ready | all its issues are written and unstarted |
| Ongoing | **any** issue is started |
| Review | **every** issue is implemented and pushed |
| Done | **every** issue is merged and closed |

The epic is therefore always at the *least advanced* state among its
issues. It cannot be Done while one issue is still open.

### Moving backward

Demotion is normal, not failure. It is what keeps the columns honest.

| Trigger | Action |
|---|---|
| A question comes up that the spec doesn't answer | Ready/Ongoing → **Backlog**, fix the spec first |
| Review finds a design flaw, not just a bug | Review → **Backlog** (spec was wrong), not → Ongoing |
| Review finds an ordinary bug | Review → **Ongoing** |
| Work abandoned mid-way | Ongoing → **Ready**, and say so in the issue |
| Scope grew past what the spec covers | Split: the new part becomes a **fresh Inbox card** — never widen an in-flight card |

### Hard rules

1. **Every brainstorm ends as issues.** A brainstorming session is not
   finished until it has produced `spec.md`, `plan.md`, `todo.md`, and the
   GitHub epic + its detailed issues. Only then does it enter **Ready**.
2. **An epic's detailed issues never go on the board.** They live on GitHub
   and are tracked by the epic's checklist. (Inbox and Backlog cards are
   plain issues — that is the one and only case where a non-epic is a card.)
3. **One board, one card per feature.** Do not spin up a separate board per
   feature, and do not let a feature occupy more than one card.
4. **Nothing enters Ready half-specced.** Spec without plan means
   **Backlog**, not Ready. This distinction is the entire point of having
   both columns.
5. **One feature in Ongoing at a time.** Finish or explicitly park before
   starting the next.
6. **No column skipping.** Inbox → Backlog → Ready → Ongoing → Review →
   Done, in order. A trivial fix that seems to deserve a shortcut is
   evidence it should be an Inbox idea, not a fast-tracked card.
7. **Done requires verification actually run.** A card whose verification
   never ran stays in **Review**, however green the tests are. Write the gap
   up as its own issue to track it — that is not a substitute for running it.

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
