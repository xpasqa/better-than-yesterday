-- epic #43: rename label → tag
-- Rename table (Postgres automatically moves all indexes/constraints to the new name
-- for non-uniquely-named objects; uniquely-named ones must be renamed explicitly)
ALTER TABLE "label" RENAME TO "tag";

-- Rename primary key constraint
ALTER TABLE "tag" RENAME CONSTRAINT "label_pkey" TO "tag_pkey";

-- Rename unique constraint and regular index
ALTER INDEX "label_user_name" RENAME TO "tag_user_name";
ALTER INDEX "label_user_seq" RENAME TO "tag_user_seq";

-- Rename check constraint
ALTER TABLE "tag" RENAME CONSTRAINT "label_name_shape" TO "tag_name_shape";

-- Rename foreign key constraint
ALTER TABLE "tag" RENAME CONSTRAINT "label_user_id_app_user_id_fk" TO "tag_user_id_app_user_id_fk";

-- Rename column on node table
ALTER TABLE "node" RENAME COLUMN "label_ids" TO "tag_ids";
