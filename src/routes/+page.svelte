<script lang="ts">
	import { onMount } from 'svelte';
	import type { TailwindStats } from '$lib/services/repository';

	let repoUrl = $state('https://github.com/jesi-rgb/conduit');
	let isAnalyzing = $state(false);
	let error = $state<string | null>(null);
	let repoStats = $state<TailwindStats | null>(null);
	let globalStats = $state<Array<{ className: string; count: number }>>([]);
	let showGlobalStats = $state(false);

	// Progress state for SSE
	let progress = $state<{
		repoUrl: string;
		status: 'fetching' | 'parsing' | 'analyzing' | 'saving' | 'completed';
		filesProcessed?: number;
		totalFiles?: number;
		currentFile?: string;
	} | null>(null);

	onMount(async () => {
		try {
			const response = await fetch('/api/global');
			if (response.ok) {
				globalStats = await response.json();
			} else {
				console.error('Error fetching global stats:', response.status);
			}
		} catch (e) {
			console.error('Error fetching global stats:', e);
		}
	});

	async function handleAnalyze() {
		if (!repoUrl) {
			error = 'Please enter a GitHub repository URL';
			return;
		}

		// Simple validation for GitHub URL
		if (!repoUrl.includes('github.com/')) {
			error = 'Please enter a valid GitHub repository URL';
			return;
		}

		error = null;
		isAnalyzing = true;
		repoStats = null;
		progress = null;

		try {
			// Start the analysis via POST request which returns SSE stream
			const response = await fetch('/api/repo', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ repoUrl })
			});

			if (!response.ok) {
				throw new Error('Failed to start analysis');
			}

			// Read the SSE stream
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('No response body');
			}

			let currentEventType = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('event: ')) {
						currentEventType = line.substring(7);
						continue;
					}

					if (line.startsWith('data: ') && line.length > 6) {
						try {
							const data = JSON.parse(line.substring(6));

							// Handle different event types
							if (currentEventType === 'progress') {
								progress = {
									repoUrl,
									status: data.status,
									filesProcessed: data.filesProcessed,
									totalFiles: data.totalFiles,
									currentFile: data.currentFile
								};
							} else if (currentEventType === 'file-processed') {
								if (progress) {
									progress = {
										repoUrl: progress.repoUrl,
										status: progress.status,
										totalFiles: progress.totalFiles,
										filesProcessed: data.filesProcessed,
										currentFile: data.filePath
									};
								}
							} else if (currentEventType === 'completed') {
								repoStats = {
									repo: { id: data.repoId, owner: '', name: '' } as any,
									classCounts: data.classCounts,
									total: data.totalClasses,
									topClasses: data.topClasses,
									lastUpdated: new Date()
								};
								isAnalyzing = false;
								return;
							} else if (currentEventType === 'error') {
								error = data.message;
								isAnalyzing = false;
								return;
							}
						} catch (parseError) {
							console.error('Error parsing SSE data:', parseError);
						}
					}
				}
			}
		} catch (e) {
			console.error('Error analyzing repository:', e);
			error = 'An error occurred while analyzing the repository.';
			isAnalyzing = false;
		}
	}
</script>

<main class="container mx-auto px-4 py-8">
	<!-- Hero Section -->
	<div
		class="hero from-primary/10 via-secondary/5 to-accent/10 mb-12 min-h-[60vh] rounded-3xl bg-gradient-to-br"
	>
		<div class="hero-content text-center">
			<div class="max-w-4xl">
				<div class="mb-8 flex w-full items-center justify-between">
					<div class="flex-1"></div>
					<h1
						class="from-primary-content to-secondary-content bg-gradient-to-r
						bg-clip-text text-6xl font-bold text-transparent"
					>
						Tallywind
					</h1>
					<div class="flex flex-1 justify-end">
						<a href="/global" class="btn btn-outline">Global Stats</a>
					</div>
				</div>

				<p class="text-base-content/80 mb-8 text-xl leading-relaxed">
					Discover the <span class="text-primary-content font-semibold">hidden patterns</span> in your
					codebase. Tallywind analyzes your GitHub repositories to count and categorize every Tailwind
					CSS class, revealing insights about your design system usage and helping you optimize your
					styling approach.
				</p>

				<div class="mb-8 flex flex-wrap justify-center gap-4">
					<div class="badge badge-lg badge-primary">📊 Class Analytics</div>
					<div class="badge badge-lg badge-secondary">🔍 Pattern Discovery</div>
					<div class="badge badge-lg badge-accent">⚡ Real-time Analysis</div>
				</div>
			</div>
		</div>
	</div>

	<div class="card bg-base-200 mb-8 p-6 shadow-xl">
		<h2 class="mb-4 text-xl font-semibold">Analyze GitHub Repository</h2>
		<div class="flex flex-col gap-4">
			<div class="form-control w-full">
				<label class="label" for="repo-url">
					<span class="label-text">GitHub Repository URL</span>
				</label>
				<div class="flex gap-2">
					<input
						bind:value={repoUrl}
						type="text"
						id="repo-url"
						placeholder="https://github.com/username/repo"
						class="input input-bordered flex-1"
					/>
					<button class="btn btn-primary" onclick={handleAnalyze} disabled={isAnalyzing}>
						{isAnalyzing ? 'Analyzing...' : 'Analyze'}
					</button>
				</div>
				{#if error}
					<div class="text-error mt-2">{error}</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Features Section -->
	<div class="mb-12 grid gap-6 md:grid-cols-3">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body text-center">
				<div class="mb-4 text-4xl">📈</div>
				<h3 class="card-title justify-center">Usage Statistics</h3>
				<p class="text-base-content/70">
					Get detailed breakdowns of class frequency and discover your most-used Tailwind utilities
				</p>
			</div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body text-center">
				<div class="mb-4 text-4xl">🎨</div>
				<h3 class="card-title justify-center">Design Patterns</h3>
				<p class="text-base-content/70">
					Identify common styling patterns and potential opportunities for component extraction
				</p>
			</div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body text-center">
				<div class="mb-4 text-4xl">⚡</div>
				<h3 class="card-title justify-center">Optimization Insights</h3>
				<p class="text-base-content/70">
					Spot unused classes and optimize your CSS bundle size for better performance
				</p>
			</div>
		</div>
	</div>

	<!-- Progress Display -->
	{#if progress && isAnalyzing}
		<div class="card bg-base-200 mb-8 p-6 shadow-xl">
			<h2 class="mb-4 text-xl font-semibold">Analysis Progress</h2>

			<!-- Status and Progress Bar -->
			<div class="mb-4">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm font-medium capitalize">{progress.status}</span>
					{#if progress.totalFiles && progress.filesProcessed !== undefined}
						<span class="text-base-content/70 text-sm">
							{progress.filesProcessed} / {progress.totalFiles} files
						</span>
					{/if}
				</div>

				{#if progress.totalFiles}
					<progress
						class="progress progress-primary w-full"
						value={progress.filesProcessed || 0}
						max={progress.totalFiles}
					></progress>
				{:else}
					<progress class="progress progress-primary w-full"></progress>
				{/if}
			</div>

			<!-- Current File -->
			{#if progress.currentFile}
				<div class="mb-4">
					<span class="text-base-content/70 text-sm">Currently processing:</span>
					<div class="bg-base-300 mt-1 rounded p-2 font-mono text-sm">
						{progress.currentFile}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if repoStats}
		<div class="card bg-base-200 mb-8 p-6 shadow-xl">
			<h2 class="mb-4 text-xl font-semibold">
				Results for {repoStats.repo.owner}/{repoStats.repo.name}
			</h2>

			<div class="stats mb-6 shadow">
				<div class="stat">
					<div class="stat-title">Total Tailwind Classes</div>
					<div class="stat-value">{repoStats.total}</div>
					<div class="stat-desc">Unique Classes: {Object.keys(repoStats.classCounts).length}</div>
				</div>

				<div class="stat">
					<div class="stat-title">Last Updated</div>
					<div class="stat-value text-lg">
						{new Date(repoStats.lastUpdated).toLocaleDateString()}
					</div>
					<div class="stat-desc">
						{new Date(repoStats.lastUpdated).toLocaleTimeString()}
					</div>
				</div>
			</div>

			<h3 class="mb-2 text-lg font-semibold">Top 20 Classes</h3>
			<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each repoStats.topClasses as { className, count }}
					<div class="bg-base-300 flex justify-between rounded-lg p-2">
						<div class="font-mono">{className}</div>
						<div class="badge badge-primary">{count}</div>
					</div>
				{/each}
			</div>

			<details>
				<summary class="cursor-pointer font-semibold">Show all classes</summary>
				<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each Object.entries(repoStats.classCounts).sort(([, countA], [, countB]) => countB - countA) as [className, count]}
						<div class="bg-base-300 flex justify-between rounded-lg p-2">
							<div class="font-mono">{className}</div>
							<div class="badge badge-primary">{count}</div>
						</div>
					{/each}
				</div>
			</details>
		</div>
	{/if}
</main>
