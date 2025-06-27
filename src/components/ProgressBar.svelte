<script lang="ts">
	import { analysisProgress } from '$lib/stores/progress';
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { AnalysisProgress } from '$lib/stores/progress';

	// Local variable to hold the progress
	let progress: AnalysisProgress | null = null;

	// Subscribe to the progress store
	const unsubscribe = analysisProgress.subscribe((value) => {
		progress = value;
	});

	// Clean up subscription on component destroy
	onDestroy(unsubscribe);

	// Helper function to get status text
	function getStatusText(): string {
		if (!progress) return '';

		switch (progress.status) {
			case 'fetching':
				return `Fetching ${progress.currentFile || 'repository data'}...`;
			case 'parsing':
				return `Parsing files (${progress.filesProcessed || 0}/${progress.totalFiles || '?'})`;
			case 'analyzing':
				return `Analyzing Tailwind classes...`;
			case 'saving':
				return `Saving results to database...`;
			case 'completed':
				return 'Analysis complete!';
			default:
				return 'Processing...';
		}
	}

	// Helper function to get progress percentage
	function getProgressPercentage(): number {
		if (!progress) return 0;

		switch (progress.status) {
			case 'fetching':
				return 10;
			case 'parsing':
				if (progress.totalFiles && progress.filesProcessed) {
					return 10 + (progress.filesProcessed / progress.totalFiles) * 60;
				}
				return 20;
			case 'analyzing':
				return 75;
			case 'saving':
				return 90;
			case 'completed':
				return 100;
			default:
				return 0;
		}
	}
</script>

{#if progress}
	<div class="mb-4 w-full" transition:fade>
		<div class="mb-1 flex justify-between">
			<span class="text-sm font-medium">{getStatusText()}</span>
			<span class="text-sm font-medium">{Math.round(getProgressPercentage())}%</span>
		</div>
		<div class="h-2.5 w-full rounded-full bg-gray-200">
			<div
				class="bg-primary h-2.5 rounded-full transition-all duration-300"
				style="width: {getProgressPercentage()}%"
			></div>
		</div>
		{#if progress.currentFile && progress.status === 'parsing'}
			<div class="mt-1 truncate text-xs text-gray-500">
				Current file: {progress.currentFile}
			</div>
		{/if}
		{#if progress.error}
			<div class="text-error mt-2 text-sm">
				Error: {progress.error}
			</div>
		{/if}
	</div>
{/if}
