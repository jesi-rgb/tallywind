<script lang="ts">
	import type { FileProgress } from '$lib/stores/progress';

	type Props = {
		files: FileProgress[];
	};

	let { files }: Props = $props();

	// Build tree structure from flat file list
	type TreeNode = {
		name: string;
		path: string;
		isDirectory: boolean;
		children: TreeNode[];
		file?: FileProgress;
		expanded: boolean;
	};

	function buildTree(files: FileProgress[]): TreeNode[] {
		const root: TreeNode[] = [];
		const nodeMap = new Map<string, TreeNode>();

		// Sort files by path for consistent ordering
		const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

		for (const file of sortedFiles) {
			const parts = file.path.split('/');
			let currentPath = '';
			let currentLevel = root;

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const isLast = i === parts.length - 1;
				currentPath = currentPath ? `${currentPath}/${part}` : part;

				let node = nodeMap.get(currentPath);
				if (!node) {
					node = {
						name: part,
						path: currentPath,
						isDirectory: !isLast,
						children: [],
						file: isLast ? file : undefined,
						expanded: true // Start expanded for better UX
					};
					nodeMap.set(currentPath, node);
					currentLevel.push(node);
				}

				if (!isLast) {
					currentLevel = node.children;
				}
			}
		}

		return root;
	}

	let tree = $derived(buildTree(files));

	function getStatusIcon(status: FileProgress['status']) {
		switch (status) {
			case 'pending':
				return '⏳';
			case 'processing':
				return '🔄';
			case 'completed':
				return '✅';
			case 'error':
				return '❌';
			default:
				return '📄';
		}
	}

	function getStatusColor(status: FileProgress['status']) {
		switch (status) {
			case 'pending':
				return 'text-base-content/60';
			case 'processing':
				return 'text-info animate-pulse';
			case 'completed':
				return 'text-success';
			case 'error':
				return 'text-error';
			default:
				return 'text-base-content';
		}
	}

	function toggleExpanded(node: TreeNode) {
		node.expanded = !node.expanded;
	}
</script>

<div class="file-tree text-sm">
	{#each tree as node}
		{@render TreeNode(node, 0)}
	{/each}
</div>

{#snippet TreeNode(node: TreeNode, level: number)}
	<div class="flex items-center py-1" style="padding-left: {level * 1.5}rem">
		{#if node.isDirectory}
			<button
				class="btn btn-ghost btn-xs mr-1 h-4 min-h-0 w-4 p-0"
				onclick={() => toggleExpanded(node)}
			>
				{node.expanded ? '📂' : '📁'}
			</button>
			<span class="text-base-content/80 font-medium">{node.name}</span>
		{:else if node.file}
			<span class="mr-2 text-xs">{getStatusIcon(node.file.status)}</span>
			<span class="font-mono text-xs {getStatusColor(node.file.status)}">
				{node.name}
			</span>
			{#if node.file.classesFound !== undefined}
				<span class="badge badge-primary badge-xs ml-auto">
					{node.file.classesFound} classes
				</span>
			{/if}
			{#if node.file.size !== undefined}
				<span class="text-base-content/50 ml-2 text-xs">
					{(node.file.size / 1024).toFixed(1)}KB
				</span>
			{/if}
		{/if}
	</div>

	{#if node.isDirectory && node.expanded}
		{#each node.children as child}
			{@render TreeNode(child, level + 1)}
		{/each}
	{/if}
{/snippet}

<style>
	.file-tree {
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
	}
</style>
