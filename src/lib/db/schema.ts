import {
	pgTable,
	serial,
	text,
	integer,
	timestamp,
	primaryKey,
	varchar,
	boolean
} from 'drizzle-orm/pg-core';

// Table for storing repository information
export const repositories = pgTable('repositories', {
	id: serial('id').primaryKey(),
	url: text('url').notNull().unique(),
	owner: varchar('owner', { length: 255 }).notNull(),
	name: varchar('name', { length: 255 }).notNull(),
	default_branch: varchar('default_branch', { length: 255 }),
	analyzed_at: timestamp('analyzed_at').notNull().defaultNow(),
	status: varchar('status', { length: 50 }).notNull().default('pending'),
	is_eligible: boolean('is_eligible'),
	has_tailwind: boolean('has_tailwind'),
	has_package_json: boolean('has_package_json'),
	eligibility_reason: text('eligibility_reason'),
	total_files: integer('total_files'),
	processed_files: integer('processed_files'),
	total_classes: integer('total_classes')
}).enableRLS();

// Table for storing Tailwind class counts per repository
export const tailwindClasses = pgTable('tailwind_classes', {
	id: serial('id').primaryKey(),
	repo_id: integer('repo_id')
		.notNull()
		.references(() => repositories.id, { onDelete: 'cascade' }),
	class_name: varchar('class_name', { length: 255 }).notNull(),
	count: integer('count').notNull().default(0)
}).enableRLS();

// Table for rate limiting and tracking API usage
export const apiRequests = pgTable('api_requests', {
	id: serial('id').primaryKey(),
	ip_address: varchar('ip_address', { length: 50 }).notNull(),
	endpoint: varchar('endpoint', { length: 255 }).notNull(),
	requested_at: timestamp('requested_at').notNull().defaultNow()
}).enableRLS();

// Types based on the schema
export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;

export type TailwindClass = typeof tailwindClasses.$inferSelect;
export type NewTailwindClass = typeof tailwindClasses.$inferInsert;

export type ApiRequest = typeof apiRequests.$inferSelect;
export type NewApiRequest = typeof apiRequests.$inferInsert;
