import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// PostgreSQL connection string from environment variables
const connectionString = env.DATABASE_URL;

// Create postgres client
export const client = connectionString ? postgres(connectionString) : null;

// Create drizzle instance if we have a client
export const db = client ? drizzle(client, { schema }) : null;

// Function to check if database is available
export async function isDatabaseAvailable(): Promise<boolean> {
	if (!db || !client) {
		return false;
	}
	
	try {
		// Try a simple query to check database connectivity
		await client`SELECT 1`;
		return true;
	} catch (error) {
		console.error('Database connection error:', error);
		return false;
	}
}