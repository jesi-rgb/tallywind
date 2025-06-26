import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db';
import { repositories } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async ({ params }: RequestEvent) => {
	try {
		const repoId = parseInt(params.repoId || '0');
		
		if (!repoId) {
			return json({ error: 'Invalid repository ID' }, { status: 400 });
		}

		if (!db) {
			return json({ error: 'Database not available' }, { status: 500 });
		}

		const [repo] = await db
			.select({
				id: repositories.id,
				status: repositories.status,
				total_files: repositories.total_files,
				processed_files: repositories.processed_files,
				total_classes: repositories.total_classes,
				is_eligible: repositories.is_eligible,
				eligibility_reason: repositories.eligibility_reason
			})
			.from(repositories)
			.where(eq(repositories.id, repoId));

		if (!repo) {
			return json({ error: 'Repository not found' }, { status: 404 });
		}

		return json({
			status: repo.status,
			progress: {
				totalFiles: repo.total_files || 0,
				processedFiles: repo.processed_files || 0,
				totalClasses: repo.total_classes || 0,
				percentage: repo.total_files ? Math.round((repo.processed_files || 0) / repo.total_files * 100) : 0
			},
			isEligible: repo.is_eligible,
			eligibilityReason: repo.eligibility_reason
		});
	} catch (error) {
		console.error('Error getting repository progress:', error);
		return json({ error: 'Failed to get repository progress' }, { status: 500 });
	}
};