<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { onMount } from 'svelte';

	interface GlobalClass {
		classname: string;
		count: number;
	}

	interface GlobalStats {
		totalRepos: number;
		totalClasses: number;
		uniqueClasses: number;
		eligibleRepos: number;
		reposWithTailwind: number;
	}

	interface GlobalData {
		topClasses: GlobalClass[];
		stats: GlobalStats;
	}

	let globalData: GlobalData | null = $state(null);
	let loading = $state(false);
	let error = $state('');
	let limit = $state(50);
	let selectedView = $state<'grid' | 'list' | 'chart'>('grid');
	let longestClassName = $state<{
		className: string;
		length: number;
		repo: {
			owner: string;
			name: string;
		};
	}>({
		className: '',
		length: 0,
		repo: {
			owner: '',
			name: ''
		}
	});

	async function fetchGlobalData() {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/global?limit=${limit}`);
			if (!response.ok) {
				throw new Error('Failed to fetch global data');
			}
			const json = await response.json();
			globalData = json;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			console.error('Error fetching global data:', err);
		} finally {
			loading = false;
		}
	}

	async function fetchLongestClass() {
		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/longest-class`);
			if (!response.ok) {
				throw new Error('Failed to fetch global data');
			}
			const json = await response.json();
			longestClassName = json;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			console.error('Error fetching global data:', err);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchGlobalData();
		fetchLongestClass();
	});

	function handleLimitChange() {
		fetchGlobalData();
	}

	function getBarWidth(count: number, maxCount: number): number {
		return Math.max((count / maxCount) * 100, 2);
	}
</script>

<svelte:head>
	<title>Global Dashboard - Tallywind</title>
	<meta
		name="description"
		content="Global statistics and most popular Tailwind CSS classes across all analyzed repositories"
	/>
</svelte:head>

<main class="flex h-screen flex-col overflow-hidden">
	<!-- Header -->
	<div class="border-border flex-shrink-0 border-b-2 p-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-4xl font-bold uppercase">GLOBAL DASHBOARD</h1>
				<p class="mt-2 font-mono text-lg">TAILWIND CLASS USAGE STATISTICS</p>
			</div>

			<Button href="/" text="← BACK TO ANALYZER" />
		</div>
	</div>

	{#if error}
		<div class="flex flex-1 items-center justify-center">
			<div class="border-error bg-error/10 max-w-md border-2 p-8 text-center">
				<div class="mb-4 font-mono text-xl uppercase">ERROR</div>
				<div class="font-mono text-sm">{error}</div>
				<button
					class="border-border hover:bg-base-content hover:text-base-100 mt-4 border-2 px-4 py-2 font-mono uppercase transition-colors"
					onclick={fetchGlobalData}
				>
					RETRY
				</button>
			</div>
		</div>
	{:else if globalData}
		<!-- Dashboard Content -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Stats Grid -->
			<div class="border-border flex-shrink-0 border-b-2">
				<div class="grid grid-cols-1 md:grid-cols-4">
					<div class="border-border border-r-2 p-4 text-center">
						<div class="mb-2 font-mono text-sm uppercase">TOTAL REPOSITORIES</div>
						<div class="text-3xl font-bold">
							{globalData.stats.totalRepos.toLocaleString()}
						</div>
					</div>
					<div class="border-border border-r-2 p-4 text-center">
						<div class="mb-2 font-mono text-sm uppercase">TOTAL CLASSES</div>
						<div class="text-3xl font-bold">{globalData.stats.totalClasses.toLocaleString()}</div>
					</div>
					<div class="border-border border-r-2 p-4 text-center">
						<div class="mb-2 font-mono text-sm uppercase">UNIQUE CLASSES</div>
						<div class="text-3xl font-bold">{globalData.stats.uniqueClasses.toLocaleString()}</div>
					</div>
					<div class="p-4 text-center">
						<div class="mb-2 font-mono text-sm uppercase">FILES ANALYZED</div>
						<div
							class="text-3xl
							font-bold"
						>
							{globalData.stats.totalFiles.toLocaleString()}
						</div>
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="border-border flex-shrink-0 border-b-2 p-6">
				<div class="mb-6 flex w-1/3 items-center gap-3">
					<div class="shrink-0">
						Longest class name so far in <a
							href="https://github.com/{longestClassName.repo.owner}/{longestClassName.repo.name}"
							target="_blank"
							class="hover:text-accent font-bold underline"
							>{longestClassName.repo.owner}/{longestClassName.repo.name}</a
						>, {longestClassName.length} chars:
					</div>

					<div class="scroller relative h-full">
						<div
							class="w-[400px] overflow-auto pr-5 text-left
							font-mono whitespace-nowrap"
						>
							{longestClassName.className}
						</div>
					</div>
				</div>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="font-mono text-sm uppercase">VIEW:</div>
						<div class="grid grid-cols-3 gap-0">
							<button
								class="border-border border-2 px-3 py-1 font-mono text-xs uppercase transition-colors {selectedView ===
								'grid'
									? 'btn btn-primary border-primary-content'
									: 'hover:bg-base-200'}"
								onclick={() => (selectedView = 'grid')}
							>
								GRID
							</button>
							<button
								class="border-border border-2 border-l-0 px-3 py-1 font-mono text-xs uppercase transition-colors {selectedView ===
								'chart'
									? 'btn btn-primary border-primary-content'
									: 'hover:bg-base-200'}"
								onclick={() => (selectedView = 'chart')}
							>
								CHART
							</button>
						</div>
					</div>

					<div class="flex items-center gap-4">
						<label class="font-mono text-sm uppercase" for="limit">SHOW TOP:</label>
						<select
							id="limit"
							bind:value={limit}
							onchange={handleLimitChange}
							class="border-border border-2 bg-transparent p-2 font-mono text-sm"
						>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
							<option value={200}>200</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Data Display -->
			<div class="flex-1 overflow-hidden">
				{#if selectedView === 'grid'}
					<!-- Grid View -->
					<div class="h-full overflow-y-auto p-6">
						<div
							class="border-border grid grid-cols-1 gap-0 border
						md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
						>
							{#each globalData.topClasses as classData, index}
								{@const percentage = (
									(classData.count / globalData.stats.totalClasses) *
									100
								).toFixed(2)}
								<a href="https://tailwindcss.com/docs/{classData.classname}" target="_blank">
									<div
										class="border-border hover:bg-primary
									hover:text-primary-content border
									p-4"
									>
										<div class="mb-1 font-mono text-xs uppercase">#{index + 1}</div>
										<div class="mb-2 font-mono font-bold break-all">
											{classData.classname}
										</div>
										<div class="mb-1 font-mono">{classData.count.toLocaleString()} USES</div>
										<div class="font-mono text-xs opacity-70">{percentage}%</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
				{:else if selectedView === 'chart'}
					{@const maxCount = globalData.topClasses[0]?.count || 1}
					<!-- Chart View -->
					<div class="h-full overflow-y-auto p-3">
						<div class="">
							{#each globalData.topClasses as classData, index}
								{@const percentage = (
									(classData.count / globalData.stats.totalClasses) *
									100
								).toFixed(2)}
								<div class="border-primary border">
									<div
										class="border-primary border-0.5 relative
									h-9"
									>
										<!-- Base text (normal color, visible outside bar) -->
										<div
											class="text-base-content absolute
										top-1/2 left-0 flex w-full translate-y-[-50%]
										items-center
										gap-5 px-2"
										>
											<div class="mr-4 tabular-nums opacity-50">
												#{(index + 1).toString().padStart(2, '0')}
											</div>
											<span
												class="font-mono
												font-extrabold">{classData.classname}</span
											>
											<span class="">
												{classData.count.toLocaleString()}
												({percentage}%)
											</span>
										</div>

										<!-- Masked text (white color, visible only inside bar) -->
										<div
											class="text-primary-content absolute top-1/2
										left-0 flex w-full translate-y-[-50%] items-center gap-5 px-2"
											style="clip-path: inset(0 {100 -
												getBarWidth(classData.count, maxCount)}% 0 0)"
										>
											<div class="mr-4 tabular-nums opacity-50">
												#{(index + 1).toString().padStart(2, '0')}
											</div>
											<span class="font-mono font-extrabold">{classData.classname}</span>
											<span class="justify-self-end">
												{classData.count.toLocaleString()}
												({percentage}%)
											</span>
										</div>

										<div
											id="rect"
											class="bg-primary h-full transition-all duration-500"
											style="width: {getBarWidth(classData.count, maxCount)}%"
										></div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</main>

<style>
	.scroller::after {
		content: '';
		position: absolute;
		right: 0;
		top: 0;
		width: 3em;
		height: 100%;
		background: linear-gradient(90deg, transparent, var(--color-base-100));
		pointer-events: none;
	}
</style>
