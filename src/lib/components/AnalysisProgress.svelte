<script>
	const { progress } = $props();
</script>

<div class="border-border border-t-2">
	<div class="border-border join-vertical border-b-2 p-6">
		<h2 class="mb-4 text-xl font-bold uppercase">ANALYSIS PROGRESS</h2>

		<div
			class="join-vertical md:join-horizontal grid grid-cols-1 gap-0
					md:grid-cols-2"
		>
			<div
				class="border-border join-item bg-primary text-primary-content border
						p-4"
			>
				<div class="mb-2 font-mono text-sm uppercase">STATUS</div>
				<div class="font-bold uppercase">{progress.status}</div>
			</div>

			{#if progress.totalFiles && progress.filesProcessed !== undefined}
				<div class="border-border join-item border p-4">
					<div class="mb-2 font-mono text-sm uppercase">FILES PROCESSED</div>
					<div class="font-bold">{progress.filesProcessed} / {progress.totalFiles}</div>
				</div>
			{/if}
		</div>

		{#if progress.totalFiles}
			<div class="border-border join-item border">
				<div
					class="bg-accent h-4 transition-all duration-300"
					style="width: {((progress.filesProcessed || 0) / progress.totalFiles) * 100}%"
				></div>
			</div>
		{/if}

		{#if progress.currentFile}
			<div class="border-border join-item border p-3">
				<div class="mb-1 font-mono text-xs uppercase">CURRENTLY PROCESSING</div>
				<div class="font-mono text-sm break-all">{progress.currentFile}</div>
			</div>
		{/if}
	</div>
</div>
