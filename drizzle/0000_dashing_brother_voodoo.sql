CREATE TABLE "api_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar(50) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"owner" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"default_branch" varchar(255),
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	CONSTRAINT "repositories_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "tailwind_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"class_name" varchar(255) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tailwind_classes_repo_class_idx" (
	"repo_id" integer NOT NULL,
	"class_name" varchar(255) NOT NULL,
	CONSTRAINT "tailwind_classes_repo_class_idx_repo_id_class_name_pk" PRIMARY KEY("repo_id","class_name")
);
--> statement-breakpoint
ALTER TABLE "tailwind_classes" ADD CONSTRAINT "tailwind_classes_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailwind_classes_repo_class_idx" ADD CONSTRAINT "tailwind_classes_repo_class_idx_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;