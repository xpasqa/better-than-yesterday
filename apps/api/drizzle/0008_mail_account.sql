CREATE TABLE "mail_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" text NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" text NOT NULL,
	"password_enc" text NOT NULL,
	"folder_inbox" text,
	"folder_sent" text,
	"folder_drafts" text,
	"folder_junk" text,
	"folder_trash" text,
	"folder_role_source" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_account_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
