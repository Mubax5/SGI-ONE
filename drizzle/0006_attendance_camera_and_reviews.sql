CREATE TABLE "attendance_camera_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "work_mode" text DEFAULT 'onsite' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "review_status" text DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "attendance_camera_tokens" ADD CONSTRAINT "attendance_camera_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_mode_review_valid" CHECK ("attendance"."work_mode" IN ('onsite','wfh','visit') AND "attendance"."review_status" IN ('unreviewed','validated','pending','approved','rejected'));