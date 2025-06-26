ALTER TABLE "api_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "repositories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tailwind_classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tailwind_classes_repo_class_idx" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tailwind_classes_repo_class_idx" CASCADE;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "is_eligible" boolean;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "has_tailwind" boolean;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "has_package_json" boolean;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "eligibility_reason" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "total_files" integer;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "processed_files" integer;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "total_classes" integer;