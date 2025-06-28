<script>
	const { repoStats } = $props();
	$inspect(repoStats);
</script>

<div class="border-border flex h-full flex-col overflow-scroll border-t-2">
	<!-- Results Header -->
	<div class="border-border border-b-2 p-6">
		<h2 class="text-xl font-bold">
			RESULTS: {repoStats.repo.owner}/{repoStats.repo.name}
		</h2>
	</div>

	<!-- Stats Grid -->
	<div class="flex h-full grow overflow-scroll">
		<div class="join-vertical flex h-full w-1/2 flex-col p-6">
			<h3 class="mb-4 font-bold uppercase">Repo Stats</h3>
			<div class="border-border join-item border">
				<div class="border-border p-4 text-center">
					<div class="mb-2 font-mono text-sm uppercase">TOTAL CLASSES</div>
					<div class="text-3xl font-bold">{repoStats.total}</div>
				</div>
			</div>

			<div class="border-border join-item border p-4 text-center">
				<div class="mb-2 font-mono text-sm uppercase">UNIQUE CLASSES</div>
				<div class="text-3xl font-bold">{Object.keys(repoStats.classCounts).length}</div>
			</div>

			<div class="border-border join-item border p-4 text-center">
				<div class="mb-2 font-mono text-sm uppercase">Files analyzed</div>
				<div class="text-3xl font-bold">{repoStats.repo.files}</div>
			</div>
		</div>

		<!-- Top Classes -->
		<div class="border-border mb-10 flex h-full w-1/2 flex-col p-6">
			<h3 class="sticky mb-4 font-bold uppercase">TOP 20 CLASSES</h3>
			<div class="border-border overflow-y-scroll">
				<div class="join-vertical grid h-1/3 grid-cols-1 gap-0">
					{#each repoStats.topClasses as { className, count }, index}
						{@const percentage = (count / repoStats.topClasses[0].count) * 100}
						<div
							class="join-item border-primary-content/20 relative flex
							items-center justify-between border"
						>
							<progress
								class="progress progress-primary absolute
								-z-10 h-full"
								max={100}
								value={percentage}
							></progress>
							<div class="text-primary-content pl-3 font-mono">{className}</div>
							<div class="text-primary-content px-2 py-1 font-mono text-sm">{count}</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<!-- All Classes Toggle -->
	<div class="border-border border-t-2">
		<details class="group">
			<summary
				class="border-border hover:bg-primary hover:text-primary-content cursor-pointer border-b-2 p-6 font-bold uppercase transition-colors"
			>
				SHOW ALL CLASSES
			</summary>
			<div class="p-6">
				<div class="grid max-h-96 grid-cols-1 gap-0 overflow-y-auto">
					{#each Object.entries(repoStats.classCounts).sort(([, countA], [, countB]) => countB - countA) as [className, count], index}
						<div
							class="border-2 {index > 0
								? 'border-t-0'
								: ''} border-border flex items-center justify-between p-2"
						>
							<div class="font-mono text-sm">{className}</div>
							<div class="border-border border px-2 py-1 font-mono text-xs">{count}</div>
						</div>
					{/each}
				</div>
			</div>
		</details>
	</div>
</div>
