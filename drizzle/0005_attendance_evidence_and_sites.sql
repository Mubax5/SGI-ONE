CREATE TABLE "attendance_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"attendance_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_key" text NOT NULL,
	"target" jsonb NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy" double precision NOT NULL,
	"distance" double precision NOT NULL,
	"sampled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	CONSTRAINT "attendance_evidence_valid" CHECK ("attendance_evidence"."kind" IN ('in', 'out') AND "attendance_evidence"."lat" BETWEEN -90 AND 90 AND "attendance_evidence"."lng" BETWEEN -180 AND 180 AND "attendance_evidence"."accuracy" BETWEEN 0 AND 100 AND "attendance_evidence"."distance" >= 0 AND "attendance_evidence"."size" BETWEEN 1 AND 5242880 AND "attendance_evidence"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "attendance_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius" integer DEFAULT 200 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_site_bounds" CHECK ("attendance_sites"."lat" BETWEEN -90 AND 90 AND "attendance_sites"."lng" BETWEEN -180 AND 180 AND "attendance_sites"."radius" BETWEEN 50 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "job_locations" ADD COLUMN "origin_label" text;--> statement-breakpoint
ALTER TABLE "job_locations" ADD COLUMN "destination_label" text;--> statement-breakpoint
ALTER TABLE "attendance_evidence" ADD CONSTRAINT "attendance_evidence_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sites" ADD CONSTRAINT "attendance_sites_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_evidence_kind_unique" ON "attendance_evidence" USING btree ("attendance_id","kind");