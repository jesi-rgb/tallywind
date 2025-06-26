
import { analyzeRepositoryWithSSE } from '$lib/services/repository';
import { createSSEResponse } from '$lib/sse';
import type { RequestEvent } from '@sveltejs/kit';

export const POST = async ({ request }: RequestEvent) => {
	try {
		const { repoUrl } = await request.json();
		
		// Create SSE response
		const { response, emitter } = createSSEResponse();
		
		// Start analysis in background
		analyzeRepositoryWithSSE(repoUrl, emitter).catch(error => {
			console.error('Error in SSE analysis:', error);
			emitter.emit({
				type: 'error',
				data: { message: `Analysis failed: ${error.message || error}` }
			});
			emitter.close();
		});
		
		return response;
	} catch (error) {
		console.error('Error setting up SSE:', error);
		const { response, emitter } = createSSEResponse();
		emitter.emit({
			type: 'error',
			data: { message: 'Failed to start analysis' }
		});
		emitter.close();
		return response;
	}
}
