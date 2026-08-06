CREATE TABLE "storage_area" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"owner_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_area_kind_check" CHECK ("storage_area"."kind" IN ('personal','todo-attachment','outline','agent'))
);
--> statement-breakpoint
CREATE TABLE "storage_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"area_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_folder_name_check" CHECK (length(trim("storage_folder"."name")) BETWEEN 1 AND 255)
);
--> statement-breakpoint
CREATE TABLE "storage_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"area_id" text NOT NULL,
	"folder_id" text,
	"name" text NOT NULL,
	"s3_key" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_file_s3_key_unique" UNIQUE("s3_key"),
	CONSTRAINT "storage_file_size_check" CHECK ("storage_file"."size_bytes" > 0),
	CONSTRAINT "storage_file_status_check" CHECK ("storage_file"."status" IN ('pending','ready')),
	CONSTRAINT "storage_file_name_check" CHECK (length(trim("storage_file"."name")) BETWEEN 1 AND 255)
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "storage_quota_bytes" bigint DEFAULT 10737418240 NOT NULL;
--> statement-breakpoint
ALTER TABLE "storage_area" ADD CONSTRAINT "storage_area_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_folder" ADD CONSTRAINT "storage_folder_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_folder" ADD CONSTRAINT "storage_folder_area_id_storage_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."storage_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_folder" ADD CONSTRAINT "storage_folder_parent_id_storage_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."storage_folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_file" ADD CONSTRAINT "storage_file_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_file" ADD CONSTRAINT "storage_file_area_id_storage_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."storage_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_file" ADD CONSTRAINT "storage_file_folder_id_storage_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."storage_folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storage_area_personal" ON "storage_area" USING btree ("user_id") WHERE "storage_area"."kind" = 'personal';--> statement-breakpoint
CREATE UNIQUE INDEX "storage_area_owner" ON "storage_area" USING btree ("user_id","owner_id") WHERE "storage_area"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "storage_folder_area_parent" ON "storage_folder" USING btree ("area_id","parent_id");--> statement-breakpoint
CREATE INDEX "storage_folder_user" ON "storage_folder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "storage_file_area_folder" ON "storage_file" USING btree ("area_id","folder_id");--> statement-breakpoint
CREATE INDEX "storage_file_user_ready" ON "storage_file" USING btree ("user_id") WHERE "storage_file"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "storage_file_pending" ON "storage_file" USING btree ("created_at") WHERE "storage_file"."status" = 'pending';
