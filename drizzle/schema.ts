import { pgTable, serial, varchar, timestamp, foreignKey, integer, unique, text, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const apiRequests = pgTable("api_requests", {
	id: serial().primaryKey().notNull(),
	ipAddress: varchar("ip_address", { length: 50 }).notNull(),
	endpoint: varchar({ length: 255 }).notNull(),
	requestedAt: timestamp("requested_at", { mode: 'string' }).defaultNow().notNull(),
});

export const tailwindClasses = pgTable("tailwind_classes", {
	id: serial().primaryKey().notNull(),
	repoId: integer("repo_id").notNull(),
	className: varchar("class_name", { length: 255 }).notNull(),
	count: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.repoId],
			foreignColumns: [repositories.id],
			name: "tailwind_classes_repo_id_repositories_id_fk"
		}).onDelete("cascade"),
]);

export const repositories = pgTable("repositories", {
	id: serial().primaryKey().notNull(),
	url: text().notNull(),
	owner: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	defaultBranch: varchar("default_branch", { length: 255 }),
	analyzedAt: timestamp("analyzed_at", { mode: 'string' }).defaultNow().notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	isEligible: boolean("is_eligible"),
	hasTailwind: boolean("has_tailwind"),
	hasPackageJson: boolean("has_package_json"),
	eligibilityReason: text("eligibility_reason"),
	totalFiles: integer("total_files"),
	processedFiles: integer("processed_files"),
	totalClasses: integer("total_classes"),
	processingStartedAt: timestamp("processing_started_at", { mode: 'string' }),
}, (table) => [
	unique("repositories_url_unique").on(table.url),
]);
