import { relations } from "drizzle-orm/relations";
import { repositories, tailwindClasses } from "./schema";

export const tailwindClassesRelations = relations(tailwindClasses, ({one}) => ({
	repository: one(repositories, {
		fields: [tailwindClasses.repoId],
		references: [repositories.id]
	}),
}));

export const repositoriesRelations = relations(repositories, ({many}) => ({
	tailwindClasses: many(tailwindClasses),
}));