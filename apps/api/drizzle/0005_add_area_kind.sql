-- epic #29: add kind='area' to node hierarchy (Area → Project → Task)
-- The `kind` column is text, so no type change needed — only the CHECK constraint.
ALTER TABLE "node" DROP CONSTRAINT "node_kind_check";
ALTER TABLE "node" ADD CONSTRAINT "node_kind_check" CHECK (kind in ('area','project','section','item'));
