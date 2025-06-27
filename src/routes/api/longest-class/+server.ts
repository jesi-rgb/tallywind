import { getLongestClassName } from '$lib/services/repository';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({}: RequestEvent) => {
	try {
		const longestClass = await getLongestClassName();

		if (!longestClass) {
			return json({ error: 'No class data found' }, { status: 404 });
		}

		return json(longestClass);
	} catch (error) {
		console.error('Error fetching longest class:', error);
		return json({ error: 'Failed to fetch longest class' }, { status: 500 });
	}
};
