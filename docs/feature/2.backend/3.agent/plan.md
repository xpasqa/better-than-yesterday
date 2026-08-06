# Agent Backend — Implementation Plan

> Phase 3 of the backend feature track. Implements a real AI assistant powered
> by openagentic.id (AIMurah), replacing the mock AgentView with live SSE
> streaming, tool execution, and a three-tier memory system.

**Goal:** Wire the Agent view to a real OpenAI-compatible provider, adding
file tools (read/write markdown artefacts), task tools (CRUD on the node
table), and a three-level memory system (AGENT.md / PROJECT.md / SESSION.md).

**Architecture:** New module `src/modules/agent/` in the api app, following
the same Hono + Drizzle + Zod pattern as `modules/auth/` and `modules/sync/`.
State stays local to each user; nothing is shared between users.

**Dependencies:** `openai` package (OpenAI-compatible SDK) added to
`apps/api/package.json`. Frontend needs no new dependencies — the existing
`AgentView` SSE parsing uses the native `fetch` + `ReadableStream` API.

---

## Phase 1 — Dependencies and DB schema

**Files:**
- Modify: `apps/api/package.json` (add `openai ^4.103.0`)
- Create: `src/db/schema/ai-settings.ts`
- Create: `src/db/schema/agent-project.ts`
- Create: `src/db/schema/agent-file.ts`
- Create: `src/db/schema/agent-session.ts`
- Create: `drizzle/0001_agent_phase3.sql`
- Modify: `src/db/client.ts` (import + register new schemas)
- Modify: `src/config.ts` (make `APP_ENCRYPTION_KEY` required)

## Phase 2 — Encryption and settings service

**Files:**
- Create: `src/modules/agent/crypto.ts` (AES-256-GCM encrypt/decrypt)
- Create: `src/modules/agent/settings-service.ts` (read/write ai_settings)
- Create: `src/types/openai-shim.d.ts` (ambient types until npm install)

## Phase 3 — File service

**Files:**
- Create: `src/modules/agent/file-service.ts`
  - `getOrCreateGlobalProject`, `getOrCreateProjectMemory`
  - `getOrCreateSession`, `updateSessionMemory`, `appendSessionHistory`, `getSessionHistory`, `closeSession`
  - `listFiles`, `readFile`, `writeFile`, `appendFile`, `deleteFile`

## Phase 4 — Tools

**Files:**
- Create: `src/modules/agent/tools.ts` (5 file tools + 5 task tools + compact_memory)
- Create: `src/modules/agent/tool-executor.ts` (maps tool names → service calls)

## Phase 5 — Agent runner

**Files:**
- Create: `src/modules/agent/runner.ts`
  - Context assembly (global + project + session memory)
  - Tool loop (max 6 steps)
  - SSE streaming via callbacks

## Phase 6 — Routes and wiring

**Files:**
- Create: `src/modules/agent/settings-routes.ts` (GET/PUT /api/agent/settings)
- Create: `src/modules/agent/chat-routes.ts` (POST /api/agent/chat → SSE)
- Create: `src/modules/agent/routes.ts` (barrel)
- Modify: `src/app.ts` (mount agentRoutes)
- Modify: `test/helpers.ts` (add agent tables to resetDb)

## Phase 7 — Frontend migration

**Files:**
- Modify: `apps/web/src/components/AgentView.tsx`
  - Remove mock imports (`FILE_CREATION_SCHEDULE`, `MOCK_FILES`, hardcoded replies)
  - Add real SSE fetch to `/api/agent/chat`
  - Handle `token`, `file`, `done`, `error` SSE events
- Modify: `apps/web/src/components/AgentChat.tsx`
  - Add `isStreaming` prop (disables send during stream)

## Phase 8 — Verification

- `npx tsc --noEmit` (both api and web) — clean
- `npx oxlint -c oxlint.json .` — clean
- Browser test: send message, observe SSE tokens, file panel, "New task" reset
- (Tests require live DB + npm install — deferred until environment allows)
