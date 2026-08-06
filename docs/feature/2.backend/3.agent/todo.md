# Todo — Agent backend (Phase 3)

## Phase 1 — Dependencies and DB schema
- [x] Add `openai ^4.103.0` to `apps/api/package.json`
- [x] Create `src/db/schema/ai-settings.ts`
- [x] Create `src/db/schema/agent-project.ts`
- [x] Create `src/db/schema/agent-file.ts`
- [x] Create `src/db/schema/agent-session.ts`
- [x] Write migration SQL `drizzle/0001_agent_phase3.sql`
- [x] Register new schemas in `src/db/client.ts`
- [x] Make `APP_ENCRYPTION_KEY` required in `src/config.ts`

## Phase 2 — Encryption and settings service
- [x] `src/modules/agent/crypto.ts` — AES-256-GCM encrypt/decrypt API key
- [x] `src/modules/agent/settings-service.ts` — read/write ai_settings
- [x] `src/types/openai-shim.d.ts` — ambient types for openai package

## Phase 3 — File service
- [x] `src/modules/agent/file-service.ts`
  - [x] Global project CRUD
  - [x] Project memory CRUD
  - [x] Session CRUD (create, history, memory, close)
  - [x] File CRUD (list, read, write, append, delete)

## Phase 4 — Tools
- [x] `src/modules/agent/tools.ts` — 5 file + 5 task + compact_memory definitions
- [x] `src/modules/agent/tool-executor.ts` — tool name → service call dispatch

## Phase 5 — Agent runner
- [x] `src/modules/agent/runner.ts`
  - [x] Load settings + API key
  - [x] Assemble system prompt from three-tier memory
  - [x] Tool loop (max 6 steps)
  - [x] SSE streaming callbacks (onToken, onFileCreated, onDone, onError)
  - [x] Persist new messages to session history

## Phase 6 — Routes and wiring
- [x] `src/modules/agent/settings-routes.ts` — GET/PUT /api/agent/settings
- [x] `src/modules/agent/chat-routes.ts` — POST /api/agent/chat (SSE)
- [x] `src/modules/agent/routes.ts` — barrel
- [x] Mount agentRoutes in `src/app.ts`
- [x] Add agent tables to `resetDb` in `test/helpers.ts`

## Phase 7 — Frontend migration
- [x] `AgentView.tsx` — replace mock with real SSE fetch
- [x] `AgentChat.tsx` — add `isStreaming` prop

## Phase 8 — Verification
- [x] `npx tsc --noEmit` (api) — clean
- [x] `npx tsc --noEmit` (web) — clean
- [x] `npx oxlint -c oxlint.json .` — clean
- [ ] `npm install` (blocked: node_modules owned by root in this environment)
- [ ] `npm run db:migrate` (blocked: needs live DB + npm install)
- [ ] `npm run test -w @better/api` (blocked: needs live DB + npm install)
- [ ] Browser round-trip: send message → SSE tokens → file panel → "New task" reset
