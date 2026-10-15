CREATE TABLE "work_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"progress_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"note" text NOT NULL,
	"storage_key" text,
	"filename" text,
	"mime_type" text,
	"size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_reports_progress_id_unique" UNIQUE("progress_id"),
	CONSTRAINT "work_reports_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "work_report_photo_metadata" CHECK (("work_reports"."storage_key" IS NULL AND "work_reports"."filename" IS NULL AND "work_reports"."mime_type" IS NULL AND "work_reports"."size" IS NULL) OR ("work_reports"."storage_key" IS NOT NULL AND "work_reports"."filename" IS NOT NULL AND "work_reports"."mime_type" IN ('image/jpeg','image/png','image/webp') AND "work_reports"."size" > 0 AND "work_reports"."size" <= 10485760))
);
--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_progress_id_job_progress_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."job_progress"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_reports" ADD CONSTRAINT "work_reports_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_report_job_idx" ON "work_reports" USING btree ("job_id","created_at");