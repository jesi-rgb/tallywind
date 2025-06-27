// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/db/schema.ts', // Adjust path to your schema file
	out: './drizzle',
	dialect: 'postgresql', // Note: 'dialect' instead of 'driver'
	dbCredentials: {
		url: process.env.DATABASE_URL! // Note: 'url' instead of 'connectionString'
	}
});
