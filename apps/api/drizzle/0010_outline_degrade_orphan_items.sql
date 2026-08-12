-- feature #32 docs/feature/32.outline-task-decoupling/spec.md §8 — one-shot
-- data migration: every kind='item' whose ancestor chain never reaches a
-- 'project' or 'area' node is a stray Outline row from before kind='note'
-- existed. Degrade it. Inbox is kind='project', so its contents are safe
-- without any extra rule.
--
-- updated_at and seq MUST both advance, or clients never pull the change
-- and Dexie keeps serving the stale kind='item' row — Anytime stays dirty
-- in the browser even though the database is clean.
WITH RECURSIVE anchored AS (
  SELECT id FROM node WHERE kind IN ('project', 'area')
  UNION ALL
  SELECT n.id FROM node n JOIN anchored a ON n.parent_id = a.id
)
UPDATE node
SET kind = 'note', updated_at = now(), seq = nextval('sync_seq')
WHERE kind = 'item' AND id NOT IN (SELECT id FROM anchored);
