-- Migration 0002: Agent two-rooms schema update
-- docs/feature/35.agent-orchestrator/spec.md §13 (Blok B)
--
-- Changes:
--   ai_settings      : ADD max_steps (was promised in spec §3.1, never landed)
--   agent_file       : ADD session_id, scope; replace unique index; ADD path check constraint
--   agent_session    : ADD title; backfill from history; close all open sessions
--   Backfill memory  : agent_project.memory(global) → agent_file(scope=global)
--                      agent_session.memory → agent_file(scope=session)
--   Archive project  : agent_project.memory(project) → agent_file(scope=doc, arsip/<slug>.md)
--   Drop             : agent_project table; agent_session.project_id FK
--
-- NOTE: agent_session.memory column is NOT dropped here — dropped in next
-- release after backfill is confirmed.
--
-- NOTE: no explicit BEGIN/COMMIT. Drizzle's migrator already runs each
-- migration inside a transaction; an explicit COMMIT here would close that
-- outer transaction early and leave the __drizzle_migrations insert outside
-- it. Every other migration in this folder follows the same convention.

-- ── 1. ai_settings: add max_steps ────────────────────────────────────────────

ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS max_steps SMALLINT NOT NULL DEFAULT 6
    CHECK (max_steps BETWEEN 1 AND 12);

-- ── 2. agent_file: add session_id and scope columns ──────────────────────────

ALTER TABLE agent_file
  ADD COLUMN IF NOT EXISTS session_id TEXT
    REFERENCES agent_session(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'doc'
    CHECK (scope IN ('global', 'session', 'doc'));

-- ── 3. agent_file: clean up paths that would violate the new check constraint ─
-- Soft-delete rows with invalid paths before the constraint is added.
UPDATE agent_file
  SET deleted_at = now()
  WHERE deleted_at IS NULL
    AND (
      path !~ '^[A-Za-z0-9._/\-]+\.md$'
      OR path ~ '(^|/)\.\.(\/|$)'
    );

-- ── 4. agent_file: add path check constraint ─────────────────────────────────

ALTER TABLE agent_file
  ADD CONSTRAINT agent_file_path_safe
    CHECK (
      path ~ '^[A-Za-z0-9._/\-]+\.md$'
      AND path !~ '(^|/)\.\.(\/|$)'
    );

-- ── 5. agent_file: drop old unique index, add scope-aware unique indexes ─────

DROP INDEX IF EXISTS agent_file_project_path;

-- doc-scoped: unique path per user
CREATE UNIQUE INDEX IF NOT EXISTS agent_file_user_path_doc
  ON agent_file (user_id, path)
  WHERE scope = 'doc' AND deleted_at IS NULL;

-- session-scoped: unique path per session
CREATE UNIQUE INDEX IF NOT EXISTS agent_file_session_path
  ON agent_file (session_id, path)
  WHERE scope = 'session' AND deleted_at IS NULL;

-- global-scoped: one AGENT.md per user
CREATE UNIQUE INDEX IF NOT EXISTS agent_file_user_global
  ON agent_file (user_id, path)
  WHERE scope = 'global' AND deleted_at IS NULL;

-- ── 6. agent_session: add title column ───────────────────────────────────────

ALTER TABLE agent_session
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill title from first user message in history (best-effort)
UPDATE agent_session
  SET title = left(
    trim(
      substring(
        history
        FROM '"role":"user","content":"([^"]{1,80})'
      )
    ),
    60
  )
  WHERE title IS NULL
    AND history != '[]'
    AND history IS NOT NULL;

-- ── 7. Backfill agent_project.memory(global) → agent_file(scope=global) ──────

INSERT INTO agent_file (id, user_id, project_id, session_id, scope, path, content, created_at, updated_at)
SELECT
  -- deterministic id: reuse project id with suffix to avoid collisions
  concat(ap.id, '-global') AS id,
  ap.user_id,
  ap.id AS project_id,
  NULL AS session_id,
  'global' AS scope,
  'AGENT.md' AS path,
  ap.memory AS content,
  ap.created_at,
  ap.updated_at
FROM agent_project ap
WHERE ap.kind = 'global'
  AND ap.memory IS NOT NULL
  AND ap.memory != ''
ON CONFLICT DO NOTHING;

-- ── 8. Backfill agent_session.memory → agent_file(scope=session) ─────────────

INSERT INTO agent_file (id, user_id, project_id, session_id, scope, path, content, created_at, updated_at)
SELECT
  concat(s.id, '-session') AS id,
  s.user_id,
  s.project_id,
  s.id AS session_id,
  'session' AS scope,
  'SESSION.md' AS path,
  s.memory AS content,
  s.created_at,
  s.updated_at
FROM agent_session s
WHERE s.memory IS NOT NULL
  AND s.memory != ''
ON CONFLICT DO NOTHING;

-- ── 9. Archive project-level memory → doc files ──────────────────────────────
-- These are written as doc-scoped files under arsip/ so content is not lost.

INSERT INTO agent_file (id, user_id, project_id, session_id, scope, path, content, created_at, updated_at)
SELECT
  concat(ap.id, '-archive') AS id,
  ap.user_id,
  ap.id AS project_id,
  NULL AS session_id,
  'doc' AS scope,
  concat('arsip/', lower(regexp_replace(coalesce(ap.id, 'project'), '[^a-z0-9]', '-', 'g')), '.md') AS path,
  ap.memory AS content,
  ap.created_at,
  ap.updated_at
FROM agent_project ap
WHERE ap.kind = 'project'
  AND ap.memory IS NOT NULL
  AND ap.memory != ''
ON CONFLICT DO NOTHING;

-- ── 10. Close all open sessions ───────────────────────────────────────────────
-- Prevents context_length_exceeded on first turn after deploy (bug #5).

UPDATE agent_session
  SET closed_at = now()
  WHERE closed_at IS NULL;

-- ── 11. Drop agent_project FK from agent_session ─────────────────────────────
-- Sessions now belong to users, not projects.
-- We keep the column (nullable) for now for rollback safety; drop in 0003.

ALTER TABLE agent_session
  ALTER COLUMN project_id DROP NOT NULL;

-- ── 12. Drop agent_project table ─────────────────────────────────────────────
-- All data has been backfilled to agent_file. FK from agent_session is now
-- nullable. FK from agent_file.project_id still points here — we keep the
-- table structure but it is no longer written to by the application.
-- Full drop deferred to next migration once backfill is confirmed in prod.
