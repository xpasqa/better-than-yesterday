-- feature #32 docs/feature/32.outline-task-decoupling/spec.md §3 — add
-- kind='note' for plain Outline rows, and linked_task_id for the task a
-- note optionally links to via #project. No cascade: deletion on either
-- side is independent (spec §7).
ALTER TABLE "node" DROP CONSTRAINT "node_kind_check";
ALTER TABLE "node" ADD CONSTRAINT "node_kind_check" CHECK (kind in ('area','project','section','item','note'));
ALTER TABLE "node" ADD COLUMN "linked_task_id" text REFERENCES "node"("id");
