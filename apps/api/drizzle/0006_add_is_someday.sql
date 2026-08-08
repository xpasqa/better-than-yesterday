-- epic #50: add is_someday flag to node (Anytime & Someday views)
ALTER TABLE "node" ADD COLUMN "is_someday" boolean NOT NULL DEFAULT false;
