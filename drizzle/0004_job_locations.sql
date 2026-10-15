CREATE TABLE "job_locations" (
	"job_id" text PRIMARY KEY NOT NULL,
	"origin_lat" double precision NOT NULL,
	"origin_lng" double precision NOT NULL,
	"destination_lat" double precision NOT NULL,
	"destination_lng" double precision NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_locations_bounds" CHECK ("job_locations"."origin_lat" BETWEEN -90 AND 90 AND "job_locations"."destination_lat" BETWEEN -90 AND 90 AND "job_locations"."origin_lng" BETWEEN -180 AND 180 AND "job_locations"."destination_lng" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_locations" ADD CONSTRAINT "job_locations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;