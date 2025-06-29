<script lang="ts">
	import '../app.css';
	import { MetaTags } from 'svelte-meta-tags';

	const { children } = $props();
</script>

<MetaTags
	title="Tallywind - Count Your Tailwind Classes"
	description="Track and tally your Tailwind CSS class usage. Join the global leaderboard and see how your Tailwind skills stack up against other developers."
	canonical="https://tallywind.vercel.app"
	openGraph={{
		type: 'website',
		url: 'https://tallywind.vercel.app',
		title: 'Tallywind - Count Your Tailwind Classes',
		description:
			'Track and tally your Tailwind CSS class usage. Join the global leaderboard and see how your Tailwind skills stack up against other developers.',
		siteName: 'Tallywind'
	}}
	twitter={{
		creator: '@jesi_rgb',
		site: 'https://jesirgb.com',
		cardType: 'summary_large_image',
		title: 'Tallywind - Count Your Tailwind Classes',
		description:
			'Track and tally your Tailwind CSS class usage. Join the global leaderboard and see how your Tailwind skills stack up against other developers.'
	}}
	additionalMetaTags={[
		{
			name: 'author',
			content: 'Jesús Rascón'
		},
		{
			name: 'keywords',
			content: 'tailwind, css, classes, counter, tally, leaderboard, developer tools'
		}
	]}
/>

<main class="selection:bg-primary selection:text-primary-content">
	{@render children()}
</main>
