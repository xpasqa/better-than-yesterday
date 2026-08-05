CREATE SEQUENCE "public"."sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "completion" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"occurred_on" date,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "label" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'grey' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"rank" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	CONSTRAINT "label_user_name" UNIQUE("user_id","name"),
	CONSTRAINT "label_name_shape" CHECK (length(trim("label"."name")) between 1 and 60 and "label"."name" !~ '\s')
);
--> statement-breakpoint
CREATE TABLE "node" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"kind" text DEFAULT 'item' NOT NULL,
	"rank" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"note" text,
	"due_date" date,
	"due_time" time,
	"duration_min" integer,
	"recurrence" text,
	"priority" smallint,
	"label_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"color" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_inbox" boolean DEFAULT false NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	CONSTRAINT "node_kind_check" CHECK ("node"."kind" in ('project','section','item')),
	CONSTRAINT "node_priority_check" CHECK ("node"."priority" is null or "node"."priority" between 1 and 3),
	CONSTRAINT "node_content_length" CHECK (length("node"."content") <= 2000),
	CONSTRAINT "node_time_needs_date" CHECK ("node"."due_time" is null or "node"."due_date" is not null),
	CONSTRAINT "node_recur_needs_date" CHECK ("node"."recurrence" is null or "node"."due_date" is not null)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"node_id" text,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_at" timestamp with time zone,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reminder" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text NOT NULL,
	"kind" text NOT NULL,
	"remind_at" timestamp with time zone,
	"offset_min" integer,
	"fire_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	CONSTRAINT "reminder_shape" CHECK (("reminder"."kind" = 'absolute' and "reminder"."remind_at" is not null) or ("reminder"."kind" = 'relative' and "reminder"."offset_min" is not null))
);
--> statement-breakpoint
CREATE TABLE "saved_filter" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"color" text DEFAULT 'grey' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"rank" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	CONSTRAINT "saved_filter_name_shape" CHECK (length(trim("saved_filter"."name")) between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"week_start" smallint DEFAULT 1 NOT NULL,
	"default_remind_time" time DEFAULT '09:00' NOT NULL,
	"digest_time" time,
	"language" text DEFAULT 'id' NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completion" ADD CONSTRAINT "completion_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node" ADD CONSTRAINT "node_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node" ADD CONSTRAINT "node_parent_id_node_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_filter" ADD CONSTRAINT "saved_filter_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_user_seq" ON "label" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "node_user_parent" ON "node" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "node_user_seq" ON "node" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "node_due_open" ON "node" USING btree ("user_id","due_date") WHERE "node"."completed_at" is null and "node"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "node_one_inbox_per_user" ON "node" USING btree ("user_id") WHERE "node"."is_inbox";--> statement-breakpoint
CREATE INDEX "reminder_due" ON "reminder" USING btree ("fire_at") WHERE "reminder"."delivered_at" is null and "reminder"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "saved_filter_user_seq" ON "saved_filter" USING btree ("user_id","seq");