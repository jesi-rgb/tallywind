<script lang="ts">
	interface Props {
		href?: string;
		text: string;
		classes?: string;
	}

	const { href, classes, text, ...restProps }: Props = $props();
</script>

{#if href}
	<a
		{href}
		{...restProps}
		class="global border-border group hover:bg-base-content
		hover:text-base-100 relative border-2 px-4 py-2 font-mono uppercase
		transition-colors {classes}"
	>
		<div
			class="group-hover:border-base-content absolute top-0 left-0 size-3
		border-t-2
		border-l-2 border-transparent transition-all group-hover:-top-1 group-hover:-left-1"
		></div>
		<div
			class="group-hover:border-base-content absolute right-0 bottom-0
		size-3 border-r-2 border-b-2 border-transparent transition-all group-hover:-right-1 group-hover:-bottom-1"
		></div>
		<div
			class="group-hover:border-base-content absolute top-0 right-0 size-3
		border-t-2 border-r-2 border-transparent transition-all group-hover:-top-1 group-hover:-right-1"
		></div>
		<div
			class="group-hover:border-base-content absolute bottom-0 left-0 size-3
		border-b-2
		border-l-2 border-transparent transition-all group-hover:-bottom-1 group-hover:-left-1"
		></div>
		<span class="font-semibold">
			{text}
		</span>
	</a>
{:else}
	<button
		class="global border-border group hover:bg-base-content
		hover:text-base-100 relative border-2 px-4 py-2 font-mono uppercase
		transition-colors {classes}"
		{...restProps}
	>
		<div
			class="group-hover:border-base-content absolute top-0 left-0 size-3
		border-t-2
		border-l-2 border-transparent transition-all group-hover:-top-1 group-hover:-left-1"
		></div>
		<div
			class="group-hover:border-base-content absolute right-0 bottom-0
		size-3 border-r-2 border-b-2 border-transparent transition-all group-hover:-right-1 group-hover:-bottom-1"
		></div>
		<div
			class="group-hover:border-base-content absolute top-0 right-0 size-3
		border-t-2 border-r-2 border-transparent transition-all group-hover:-top-1 group-hover:-right-1"
		></div>
		<div
			class="group-hover:border-base-content absolute bottom-0 left-0 size-3
		border-b-2
		border-l-2 border-transparent transition-all group-hover:-bottom-1 group-hover:-left-1"
		></div>
		<span class="font-semibold">
			{text}
		</span>
	</button>
{/if}
