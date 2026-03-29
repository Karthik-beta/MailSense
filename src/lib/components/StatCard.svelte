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

	const accentColor: Record<string, string> = {
		accent: 'border-t-signal',
		gold: 'border-t-warning',
		ink: 'border-t-ink-soft'
	};
</script>

<article class="rounded-xl border border-border bg-surface p-5 shadow-xs transition-shadow duration-200 hover:shadow-sm {accentColor[accent]} border-t-2">
	<p class="mb-1 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">{title}</p>
	<p class="font-display text-3xl font-light tracking-tight text-ink">{value}</p>
	{#if footnote}
		<p class="mt-2 text-xs text-ink-faint">{footnote}</p>
	{/if}
</article>