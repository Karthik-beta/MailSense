<script lang="ts">
	let {
		title,
		value,
		footnote = '',
		accent = 'accent'
	} = $props<{
		title: string;
		value: string;
		footnote?: string;
		accent?: 'accent' | 'gold' | 'ink';
	}>();
</script>

<article class="stat-card" data-accent={accent}>
	<p>{title}</p>
	<strong>{value}</strong>
	{#if footnote}
		<span>{footnote}</span>
	{/if}
</article>

<style>
	.stat-card {
		display: grid;
		gap: 0.55rem;
		padding: 1.1rem 1.15rem;
		border-radius: 1.25rem;
		background: rgba(255, 253, 249, 0.8);
		border: 1px solid rgba(30, 45, 42, 0.06);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
	}

	.stat-card p {
		font-size: 0.86rem;
		font-weight: 700;
		color: #5d6f6c;
	}

	.stat-card strong {
		font-size: clamp(1.5rem, 3vw, 2.2rem);
		letter-spacing: -0.06em;
		line-height: 1;
	}

	.stat-card span {
		font-size: 0.86rem;
		color: #6b7d79;
	}

	.stat-card[data-accent='accent'] strong {
		color: #0a5c55;
	}

	.stat-card[data-accent='gold'] strong {
		color: #9a6313;
	}

	.stat-card[data-accent='ink'] strong {
		color: #1e2d2a;
	}
</style>
