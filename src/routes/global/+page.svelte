<script lang="ts">
	import { BarX, BarY, Plot, RectY, RuleY, binX, groupX, HTMLTooltip } from 'svelteplot';
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
	let hovered = $state();

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

	onMount(() => {
		fetchGlobalData();
	});

	function handleLimitChange() {
		fetchGlobalData();
	}
</script>

<svelte:head>
	<title>Global Tailwind Classes - Tallywind</title>
	<meta
		name="description"
		content="Global statistics and most popular Tailwind CSS classes across all analyzed repositories"
	/>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="mb-4 text-4xl font-bold">Global Tailwind Classes</h1>
		<p class="text-lg opacity-80">
			Statistics and most popular Tailwind CSS classes across all analyzed repositories
		</p>
	</div>

	{#if error}
		<div class="alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 shrink-0 stroke-current"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
		</div>
	{:else if globalData}
		<!-- Global Statistics -->

		<Plot x={{ tickRotate: -90 }} y={{ grid: true }}>
			{#snippet overlay()}
				<HTMLTooltip
					class="bg-base-200 rounded-box transition-transform"
					data={globalData?.topClasses}
					x="classname"
					y="count"
				>
					{#snippet children({ datum })}
						<div class="bg-base-200">
							<div>Classname: {datum.classname}</div>
							<div>Count: {datum.count}</div>
						</div>
					{/snippet}
				</HTMLTooltip>
			{/snippet}

			<BarY sort="descending" data={globalData?.topClasses} x="classname" y="count" />

			<RuleY data={[0]} />
		</Plot>

		<div class="flex items-center justify-between gap-4">
			<div class="stat bg-base-200 rounded-lg">
				<div class="stat-title">Total Repositories</div>
				<div
					class="stat-value
					text-primary-content"
				>
					{globalData.stats.eligibleRepos}
				</div>
			</div>
			<div class="stat bg-base-200 rounded-lg">
				<div class="stat-title">Total Classes</div>
				<div class="stat-value text-primary-content">
					{globalData.stats.totalClasses.toLocaleString()}
				</div>
			</div>
			<div class="stat bg-base-200 rounded-lg">
				<div class="stat-title">Unique Classes</div>
				<div class="stat-value text-primary-content">
					{globalData.stats.uniqueClasses.toLocaleString()}
				</div>
			</div>
		</div>

		<!-- Controls -->
		<div class="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
			<h2 class="w-max text-2xl font-semibold">Most Popular Classes</h2>
			<div class="flex items-center gap-2">
				<label for="limit" class="label w-max text-sm font-medium">Show top:</label>
				<select
					id="limit"
					bind:value={limit}
					onchange={handleLimitChange}
					class="select select-bordered select-sm"
				>
					<option value={25}>25</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
					<option value={200}>200</option>
				</select>
			</div>
		</div>

		<!-- Top Classes Table -->
		{#if globalData.topClasses.length > 0}
			<div class="overflow-x-auto">
				<table class="table-zebra table w-full">
					<thead>
						<tr>
							<th class="text-left">Rank</th>
							<th class="text-left">Class Name</th>
							<th class="text-right">Usage Count</th>
							<th class="text-right">Percentage</th>
						</tr>
					</thead>
					<tbody>
						{#each globalData.topClasses as classData, index}
							{@const percentage = (
								(classData.count / globalData.stats.totalClasses) *
								100
							).toFixed(2)}
							<tr>
								<td class="font-mono text-sm">#{index + 1}</td>
								<td>
									<code class="bg-base-200 px-2 py-1 font-mono">
										{classData.classname}
									</code>
								</td>
								<td class="text-right font-mono">{classData.count.toLocaleString()}</td>
								<td class="text-right font-mono text-sm opacity-70">{percentage}%</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="h-6 w-6 shrink-0 stroke-current"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
				<span>No class data available yet. Try analyzing some repositories first!</span>
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(div.tooltip) {
		background: var(--color-base-100) !important;
		border-radius: 1em !important;
	}
</style>
