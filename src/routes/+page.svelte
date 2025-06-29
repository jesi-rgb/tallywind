<script lang="ts">
	import { onMount } from 'svelte';
	import type { TailwindStats } from '$lib/services/repository';
	import AnalysisProgress from '$lib/components/AnalysisProgress.svelte';
	import RepoStats from '$lib/components/RepoStats.svelte';
	import Button from '$lib/components/Button.svelte';
	import { normalizeGitHubUrl } from '$lib/utils/github';

	let repoUrl = $state('');
	let error = $state<string | null>(null);
	let repoStats = $state<TailwindStats | null>(null);
	let globalStats = $state<Array<{ className: string; count: number }>>([]);

	// Progress state for SSE
	let isAnalyzing = $state(false);
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

		repoUrl = normalizeGitHubUrl(repoUrl);

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
				body: JSON.stringify({ repoUrl: repoUrl.trim() })
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
									repo: {
										id: data.repo,
										owner: data.repo.owner,
										name: data.repo.name,
										files: data.repo.total_files
									} as any,
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

<main class="flex h-screen flex-col overflow-hidden">
	<!-- Header -->
	<div class="border-border flex flex-shrink-0 items-center justify-between border-b-2 p-6">
		<div>
			<h1 class="text-4xl font-bold tracking-wider uppercase">TALLYWIND</h1>
			<p class="mt-2 font-mono text-lg">TAILWIND CLASS COUNTER & ANALYZER</p>
		</div>
		<Button href="/global" text="GLOBAL STATS" />
	</div>

	<!-- Main Content -->
	{#if !repoStats}
		<div class="flex flex-1 flex-col items-center justify-center p-6">
			<form class="w-full max-w-md space-y-4">
				<div>
					<label class="mb-2 block font-mono text-sm uppercase" for="repo-url">
						GITHUB REPOSITORY URL
					</label>
					<input
						bind:value={repoUrl}
						type="text"
						id="repo-url"
						placeholder="https://github.com/username/repo"
						class="border-border focus:bg-base-200 w-full border-2 bg-transparent p-3 font-mono transition-colors"
					/>
				</div>

				<Button
					text={isAnalyzing ? 'ANALYZING...' : 'ANALYZE REPOSITORY'}
					onclick={handleAnalyze}
					disabled={isAnalyzing}
					classes="w-full"
				/>

				{#if error}
					<div class="border-error bg-error/10 border-2 p-3 font-mono text-sm">
						ERROR: {error}
					</div>
				{/if}
			</form>
		</div>
	{/if}

	<!-- Progress Display -->
	{#if progress && isAnalyzing}
		<AnalysisProgress {progress} />
	{/if}

	{#if repoStats}
		<RepoStats {repoStats} />
	{/if}
</main>

<style>
	input {
		outline: none;
	}
</style>
