import { getGlobalTopClasses, getGlobalStats } from '$lib/services/repository';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ url }: RequestEvent) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '50');

		const [topClasses, globalStats] = await Promise.all([
			getGlobalTopClasses(limit),
			getGlobalStats()
		]);

		return json({
			topClasses,
			stats: globalStats
		});
	} catch (error) {
		console.error('Error fetching global stats:', error);
		return json({ error: 'Failed to fetch global stats' }, { status: 500 });
	}
};
