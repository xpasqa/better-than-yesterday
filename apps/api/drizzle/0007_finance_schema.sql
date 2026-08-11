CREATE TABLE "finance_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"pocket" text DEFAULT 'personal' NOT NULL,
	"is_spendable" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_account_kind_check" CHECK ("finance_account"."kind" IN ('cash','bank','receivable')),
	CONSTRAINT "finance_account_pocket_check" CHECK ("finance_account"."pocket" IN ('personal','business'))
);
--> statement-breakpoint
CREATE TABLE "finance_category" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"icon" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_category_type_check" CHECK ("finance_category"."type" IN ('income','expense'))
);
--> statement-breakpoint
CREATE TABLE "finance_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"category_id" text,
	"from_account_id" text,
	"from_pocket" text,
	"to_account_id" text,
	"to_pocket" text,
	"counterparty" text,
	"note" text,
	"idempotency_key" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_tx_type_check" CHECK ("finance_transaction"."type" IN ('income','expense','transfer')),
	CONSTRAINT "finance_tx_amount_check" CHECK ("finance_transaction"."amount" > 0),
	CONSTRAINT "finance_tx_from_pocket_check" CHECK ("finance_transaction"."from_pocket" IS NULL OR "finance_transaction"."from_pocket" IN ('personal','business')),
	CONSTRAINT "finance_tx_to_pocket_check" CHECK ("finance_transaction"."to_pocket" IS NULL OR "finance_transaction"."to_pocket" IN ('personal','business'))
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "finance_business_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "finance_savings_target_mode" text;
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "finance_savings_target_value" bigint;
--> statement-breakpoint
ALTER TABLE "finance_account" ADD CONSTRAINT "finance_account_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_category" ADD CONSTRAINT "finance_category_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_category_id_finance_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_from_account_id_finance_account_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."finance_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_to_account_id_finance_account_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."finance_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_account_user" ON "finance_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_account_receivable" ON "finance_account" USING btree ("user_id") WHERE "finance_account"."kind" = 'receivable';--> statement-breakpoint
CREATE INDEX "finance_category_user" ON "finance_category" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "finance_tx_user_date" ON "finance_transaction" USING btree ("user_id","date" DESC);--> statement-breakpoint
CREATE INDEX "finance_tx_from_account" ON "finance_transaction" USING btree ("user_id","from_account_id");--> statement-breakpoint
CREATE INDEX "finance_tx_to_account" ON "finance_transaction" USING btree ("user_id","to_account_id");--> statement-breakpoint
CREATE INDEX "finance_tx_counterparty" ON "finance_transaction" USING btree ("user_id","counterparty");--> statement-breakpoint
CREATE INDEX "finance_tx_pocket" ON "finance_transaction" USING btree ("user_id","date","from_pocket");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_tx_idempotency" ON "finance_transaction" USING btree ("user_id","idempotency_key");
