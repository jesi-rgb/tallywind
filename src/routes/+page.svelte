<script lang="ts">
	import { onMount } from 'svelte';
	import type { TailwindStats } from '$lib/services/repository';
	import AnalysisProgress from '$lib/components/AnalysisProgress.svelte';
	import RepoStats from '$lib/components/RepoStats.svelte';

	let repoUrl = $state('https://github.com/jesi-rgb/conduit');
	let error = $state<string | null>(null);
	let repoStats = $state<TailwindStats | null>(null);
	// let repoStats = $state<TailwindStats | null>({
	// 	repo: {
	// 		id: 25,
	// 		owner: 'jesi-rgb',
	// 		name: 'conduit'
	// 	},
	// 	classCounts: {
	// 		'selection:bg-primary': 2,
	// 		'selection:text-primary-content': 2,
	// 		'h-[100vh]': 2,
	// 		'subpixel-antialiased': 1,
	// 		'highlight-link': 1,
	// 		'text-selection-highlight': 1,
	// 		prose: 9,
	// 		'mx-auto': 27,
	// 		'my-10': 2,
	// 		'h-[90vh]': 1,
	// 		'w-fit': 4,
	// 		'overflow-y-scroll': 4,
	// 		'text-primary': 29,
	// 		'h-full': 15,
	// 		'hover:bg-primary': 2,
	// 		'z-10': 3,
	// 		'-mx-1.5': 2,
	// 		'w-3': 2,
	// 		'transition-colors': 5,
	// 		flex: 57,
	// 		'w-[90%]': 1,
	// 		'max-w-[70%]': 2,
	// 		'flex-col': 21,
	// 		'justify-end': 1,
	// 		'gap-10': 3,
	// 		'pointer-events-none': 1,
	// 		'mb-auto': 1,
	// 		'max-w-[80%]': 1,
	// 		'[mask-image:radial-gradient(ellipse,black,transparent)]': 2,
	// 		'pt-10': 1,
	// 		'opacity-20': 1,
	// 		invert: 1,
	// 		'dark:invert-0': 1,
	// 		shrink: 3,
	// 		'items-center': 28,
	// 		'gap-3': 3,
	// 		'justify-self-start': 1,
	// 		'px-3': 8,
	// 		'text-xl': 22,
	// 		'font-semibold': 14,
	// 		'text-2xl': 14,
	// 		'h-fit': 1,
	// 		'flex-wrap': 2,
	// 		'justify-start': 2,
	// 		'gap-2': 7,
	// 		btn: 29,
	// 		'btn-sm': 3,
	// 		'btn-ghost': 9,
	// 		'data-[topic=science]:btn-primary': 1,
	// 		'data-[topic=art]:btn-secondary': 1,
	// 		'data-[topic=coding]:btn-info': 1,
	// 		'data-[topic=history]:btn-accent': 1,
	// 		'my-20': 1,
	// 		'max-w-2xl': 1,
	// 		'mb-10': 1,
	// 		'text-3xl': 6,
	// 		'font-bold': 21,
	// 		keys: 1,
	// 		'border-subtle': 17,
	// 		'gap-4': 7,
	// 		'mb-2': 4,
	// 		'gap-1': 7,
	// 		'text-muted': 8,
	// 		'py-20': 3,
	// 		'bg-base-100': 12,
	// 		container: 3,
	// 		'max-w-6xl': 3,
	// 		'px-4': 8,
	// 		'text-center': 16,
	// 		'mb-16': 5,
	// 		'text-4xl': 4,
	// 		'text-base-content': 17,
	// 		'mb-6': 9,
	// 		'text-base-content/80': 10,
	// 		'max-w-3xl': 3,
	// 		grid: 5,
	// 		'grid-cols-1': 4,
	// 		'md:grid-cols-2': 1,
	// 		'lg:grid-cols-3': 1,
	// 		'gap-8': 3,
	// 		card: 5,
	// 		'bg-base-200': 8,
	// 		border: 24,
	// 		'border-primary/10': 6,
	// 		'shadow-xl': 4,
	// 		'hover:shadow-2xl': 2,
	// 		'hover:border-primary/30': 1,
	// 		'transition-all': 5,
	// 		'duration-300': 8,
	// 		'card-body': 5,
	// 		'p-6': 6,
	// 		'w-12': 6,
	// 		'h-12': 6,
	// 		'rounded-full': 16,
	// 		'bg-primary/10': 7,
	// 		'justify-center': 13,
	// 		'mb-4': 12,
	// 		'mb-3': 5,
	// 		'leading-relaxed': 5,
	// 		'mt-16': 1,
	// 		stats: 1,
	// 		'stats-horizontal': 1,
	// 		'w-full': 30,
	// 		stat: 4,
	// 		'stat-title': 4,
	// 		'stat-value': 4,
	// 		'stat-desc': 4,
	// 		'bg-primary': 4,
	// 		'text-primary-content': 4,
	// 		relative: 7,
	// 		'overflow-hidden': 2,
	// 		'py-10': 1,
	// 		'max-w-4xl': 3,
	// 		'gap-6': 4,
	// 		'sm:flex-row': 2,
	// 		'btn-lg': 8,
	// 		'btn-neutral': 3,
	// 		loading: 4,
	// 		'loading-spinner': 2,
	// 		'loading-sm': 2,
	// 		'mr-2': 7,
	// 		'btn-outline': 4,
	// 		'border-primary-content/30': 1,
	// 		'md:text-5xl': 1,
	// 		'mb-8': 3,
	// 		'lg:grid-cols-2': 1,
	// 		'lg:col-span-2': 1,
	// 		'border-primary/20': 3,
	// 		'p-8': 2,
	// 		'items-start': 1,
	// 		'flex-shrink-0': 1,
	// 		'h-16': 1,
	// 		'w-16': 1,
	// 		'flex-1': 2,
	// 		'text-lg': 10,
	// 		'mockup-code': 1,
	// 		'text-sm': 11,
	// 		'text-accent': 2,
	// 		'text-balance': 9,
	// 		badge: 4,
	// 		'badge-primary': 3,
	// 		'badge-outline': 3,
	// 		'badge-neutral': 1,
	// 		'text-base-content/70': 7,
	// 		'mr-1': 2,
	// 		'md:grid-cols-3': 2,
	// 		'rounded-xl': 7,
	// 		footer: 1,
	// 		'sm:footer-horizontal': 1,
	// 		'text-neutral-content': 1,
	// 		'p-10': 1,
	// 		'fill-current': 4,
	// 		'footer-title': 1,
	// 		'grid-flow-col': 1,
	// 		hero: 1,
	// 		'min-h-screen': 1,
	// 		absolute: 9,
	// 		'inset-0': 2,
	// 		'object-cover': 1,
	// 		'opacity-80': 1,
	// 		'mix-blend-overlay': 1,
	// 		'blur-[2px]': 1,
	// 		'opacity-30': 1,
	// 		'dots-pattern': 1,
	// 		'hero-content': 1,
	// 		'max-w-5xl': 2,
	// 		'inline-flex': 1,
	// 		'px-6': 1,
	// 		'py-3': 1,
	// 		'font-medium': 2,
	// 		'text-subtle': 2,
	// 		'mx-2': 1,
	// 		'space-y-8': 1,
	// 		'text-7xl': 1,
	// 		'mb-12': 1,
	// 		'btn-primary': 11,
	// 		group: 8,
	// 		'h-20': 5,
	// 		'w-20': 3,
	// 		'transition-transform': 3,
	// 		'group-hover:scale-110': 3,
	// 		'shadow-2xl': 1,
	// 		'w-1/2': 2,
	// 		chat: 8,
	// 		'chat-end': 4,
	// 		'bg-primary/15': 4,
	// 		'border-primary/30': 4,
	// 		'prose-sm': 6,
	// 		'max-w-3/4': 3,
	// 		'self-end': 4,
	// 		'rounded-2xl': 5,
	// 		'rounded-br-xs': 4,
	// 		'py-2': 9,
	// 		'chat-start': 4,
	// 		'bg-base-200/50': 2,
	// 		'rounded-3xl': 1,
	// 		'py-5': 1,
	// 		'pl-5': 1,
	// 		'mb-5': 2,
	// 		divider: 2,
	// 		'my-1': 3,
	// 		'mt-6': 1,
	// 		'max-w-xl': 1,
	// 		'border-base-content/10': 3,
	// 		'overflow-x-clip': 1,
	// 		'border-l': 2,
	// 		'p-3': 7,
	// 		'shadow-lg': 6,
	// 		'cursor-pointer': 3,
	// 		user: 2,
	// 		'text-secondary': 1,
	// 		'-my-[1px]': 1,
	// 		'ml-2': 1,
	// 		'py-1': 4,
	// 		'top-0': 2,
	// 		'left-[3.4px]': 2,
	// 		'h-[13px]': 1,
	// 		'w-0': 2,
	// 		'self-center': 2,
	// 		'shrink-0': 3,
	// 		'group-hover:text-accent': 1,
	// 		'group-hover:rotate-6': 1,
	// 		truncate: 4,
	// 		'text-xs': 9,
	// 		italic: 1,
	// 		'code-lang-badge': 2,
	// 		'code-block-wrapper': 3,
	// 		'border-base-300': 2,
	// 		'h-10': 3,
	// 		'border-b': 3,
	// 		'p-2': 4,
	// 		'pl-6': 2,
	// 		grow: 4,
	// 		'justify-between': 10,
	// 		'pt-1': 4,
	// 		'pt-2': 2,
	// 		'chat-footer': 2,
	// 		'font-mono': 4,
	// 		'opacity-0': 5,
	// 		'transition-opacity': 4,
	// 		'duration-100': 4,
	// 		'group-hover:opacity-50': 2,
	// 		'loading-dots': 2,
	// 		'prose-code:px-0': 2,
	// 		'mt-3': 3,
	// 		'h-max': 2,
	// 		'place-self-start': 2,
	// 		'group-hover:opacity-100': 3,
	// 		'opacity-50': 2,
	// 		'btn-xs': 12,
	// 		'btn-circle': 6,
	// 		'size-7': 5,
	// 		'opacity-100': 4,
	// 		'top-1/2': 3,
	// 		'left-1/2': 4,
	// 		'-translate-x-1/2': 4,
	// 		'-translate-y-1/2': 5,
	// 		'to-primary-content': 3,
	// 		'rounded-box': 4,
	// 		'max-w-sm': 3,
	// 		input: 3,
	// 		'input-border': 2,
	// 		'focus:border-primary': 3,
	// 		'min-w-60': 4,
	// 		'focus:outline-none': 3,
	// 		'backdrop-blur-xl': 1,
	// 		underline: 4,
	// 		'btn-error': 2,
	// 		'from-base-100': 3,
	// 		'to-base-200': 3,
	// 		'shadow-base-content/20': 1,
	// 		'pointer-events-auto': 2,
	// 		fixed: 1,
	// 		'right-0': 1,
	// 		'bottom-0': 1,
	// 		'z-30': 1,
	// 		'w-1/3': 1,
	// 		'min-w-[600px]': 1,
	// 		'bg-gradient-to-l': 1,
	// 		'data-[vaul-drawer-direction=right]:inset-y-0': 1,
	// 		'data-[vaul-drawer-direction=right]:right-0': 1,
	// 		'px-2': 2,
	// 		'py-[7.4px]': 1,
	// 		'overflow-auto': 1,
	// 		'select-text': 1,
	// 		fieldset: 1,
	// 		'join-item': 1,
	// 		'input-error': 1,
	// 		'input-dashed': 1,
	// 		label: 3,
	// 		'text-error': 2,
	// 		'text-base': 4,
	// 		'z-50': 2,
	// 		'hover:text-primary-content': 1,
	// 		'backdrop-blur-2xl': 1,
	// 		message: 1,
	// 		'space-y-3': 1,
	// 		'min-h-[40px]': 1,
	// 		'right-2': 1,
	// 		'shadow-popover': 1,
	// 		'data-[state=open]:animate-in': 1,
	// 		'h-96': 1,
	// 		'w-100': 1,
	// 		'bg-gradient-to-b': 3,
	// 		'px-1': 1,
	// 		'outline-hidden': 2,
	// 		'select-none': 2,
	// 		'data-[side=bottom]:translate-y-1': 1,
	// 		'data-[side=left]:-translate-x-1': 1,
	// 		'data-[side=right]:translate-x-1': 1,
	// 		'data-[side=top]:-translate-y-1': 1,
	// 		'p-1': 2,
	// 		'text-muted-foreground': 2,
	// 		'mb-1': 1,
	// 		uppercase: 1,
	// 		'data-highlighted:bg-base-300/30': 1,
	// 		'ring-subtle': 1,
	// 		capitalize: 1,
	// 		'data-highlighted:shadow-sm': 1,
	// 		'data-highlighted:ring': 1,
	// 		'dark:data-highlighted:shadow-xl': 1,
	// 		'w-11/12': 1,
	// 		'ml-auto': 1,
	// 		'shadow-sm': 1,
	// 		'shadow-base-300': 1,
	// 		'border-dashed': 1,
	// 		'rounded-lg': 1,
	// 		'px-5': 1,
	// 		'border-r': 1,
	// 		'bg-gradient-to-r': 1,
	// 		'py-4': 1,
	// 		'min-h-0': 1,
	// 		'gap-5': 1,
	// 		headline: 1,
	// 		'w-min': 1,
	// 		'from-primary/5': 1,
	// 		'to-primary/30': 1,
	// 		'hover:to-primary-content/30': 1,
	// 		'from-20%': 1,
	// 		'to-150%': 1,
	// 		'hover:bg-gradient-to-t': 1,
	// 		'hover:to-90%': 1,
	// 		'dark:to-280%': 1,
	// 		'group-hover:text-primary-content': 1,
	// 		'conversation-list': 1,
	// 		'flex-grow': 1,
	// 		'overflow-y-auto': 1,
	// 		'opacity-40': 1,
	// 		'bg-base-100/50': 1,
	// 		convo: 1,
	// 		'pr-1': 1,
	// 		'font-[500]': 1,
	// 		'hover:btn-error': 1,
	// 		'text-base-content/20': 3,
	// 		'hover:text-info': 1,
	// 		'hover:text-error': 1,
	// 		'hover:ring-subtle': 1,
	// 		'shadow-base-200': 1,
	// 		'focus:ring-primary': 1,
	// 		'min-h-40': 1,
	// 		'rounded-br-none': 2,
	// 		'rounded-bl-none': 2,
	// 		'hover:ring': 1,
	// 		textarea: 1,
	// 		'textarea-ghost': 1,
	// 		'focus:ring-none': 1,
	// 		'h-30': 1,
	// 		'border-b-0': 1,
	// 		'align-baseline': 1,
	// 		'focus:bg-transparent': 1,
	// 		'disabled:bg-transparent': 1,
	// 		'z-20': 1,
	// 		swap: 1,
	// 		'swap-rotate': 1,
	// 		'hover:text-primary': 1,
	// 		'swap-off': 1,
	// 		'swap-on': 1
	// 	},
	// 	total: 1359,
	// 	topClasses: [
	// 		{
	// 			className: 'flex',
	// 			count: 57
	// 		},
	// 		{
	// 			className: 'w-full',
	// 			count: 30
	// 		},
	// 		{
	// 			className: 'text-primary',
	// 			count: 29
	// 		},
	// 		{
	// 			className: 'btn',
	// 			count: 29
	// 		},
	// 		{
	// 			className: 'items-center',
	// 			count: 28
	// 		},
	// 		{
	// 			className: 'mx-auto',
	// 			count: 27
	// 		},
	// 		{
	// 			className: 'border',
	// 			count: 24
	// 		},
	// 		{
	// 			className: 'text-xl',
	// 			count: 22
	// 		},
	// 		{
	// 			className: 'flex-col',
	// 			count: 21
	// 		},
	// 		{
	// 			className: 'font-bold',
	// 			count: 21
	// 		},
	// 		{
	// 			className: 'border-subtle',
	// 			count: 17
	// 		},
	// 		{
	// 			className: 'text-base-content',
	// 			count: 17
	// 		},
	// 		{
	// 			className: 'text-center',
	// 			count: 16
	// 		},
	// 		{
	// 			className: 'rounded-full',
	// 			count: 16
	// 		},
	// 		{
	// 			className: 'h-full',
	// 			count: 15
	// 		},
	// 		{
	// 			className: 'font-semibold',
	// 			count: 14
	// 		},
	// 		{
	// 			className: 'text-2xl',
	// 			count: 14
	// 		},
	// 		{
	// 			className: 'justify-center',
	// 			count: 13
	// 		},
	// 		{
	// 			className: 'bg-base-100',
	// 			count: 12
	// 		},
	// 		{
	// 			className: 'mb-4',
	// 			count: 12
	// 		}
	// 	],
	// 	lastUpdated: new Date('2025-06-28T08:19:53.936Z')
	// });
	let globalStats = $state<Array<{ className: string; count: number }>>([]);
	let showGlobalStats = $state(false);

	$inspect(repoStats);

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
		<a
			href="/global"
			class="border-border hover:bg-base-content hover:text-base-100 border-2 px-4 py-2 font-mono uppercase transition-colors"
		>
			GLOBAL STATS
		</a>
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

				<button
					class="border-border hover:bg-base-content hover:text-base-100 w-full border-2 p-3 font-mono font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleAnalyze}
					disabled={isAnalyzing}
				>
					{isAnalyzing ? 'ANALYZING...' : 'ANALYZE REPOSITORY'}
				</button>

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
