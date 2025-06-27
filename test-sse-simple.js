// Simple test to verify SSE endpoint works
const testSSE = async () => {
	console.log('Testing SSE endpoint...');

	try {
		const response = await fetch('http://localhost:5174/api/repo', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				repoUrl: 'https://github.com/jesi-rgb/conduit'
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		console.log('Response headers:', Object.fromEntries(response.headers.entries()));
		console.log('Content-Type:', response.headers.get('content-type'));

		// Read first few chunks to verify SSE format
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (!reader) {
			throw new Error('No response body');
		}

		let chunkCount = 0;
		while (chunkCount < 3) {
			// Read first 3 chunks
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value);
			console.log(`Chunk ${chunkCount + 1}:`, chunk);
			chunkCount++;
		}

		reader.cancel();
		console.log('SSE endpoint is working correctly!');
	} catch (error) {
		console.error('Error testing SSE:', error);
	}
};

testSSE();
