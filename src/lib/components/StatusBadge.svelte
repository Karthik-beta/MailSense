<script lang="ts">
	let {
		label,
		tone = 'neutral',
		compact = false
	} = $props<{
		label: string;
		tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'accent';
		compact?: boolean;
	}>();

	const toneStyles: Record<string, string> = {
		success: 'bg-success-soft text-success border-success/15',
		warning: 'bg-warning-soft text-warning border-warning/15',
		danger: 'bg-danger-soft text-danger border-danger/15',
		accent: 'bg-signal-soft text-signal border-signal/15',
		neutral: 'bg-surface-muted text-ink-soft border-border'
	};

	const dotStyles: Record<string, string> = {
		success: 'bg-success',
		warning: 'bg-warning',
		danger: 'bg-danger',
		accent: 'bg-signal',
		neutral: 'bg-ink-faint'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-md border font-mono text-[11px] font-medium uppercase tracking-wider
		{toneStyles[tone]}
		{compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}"
>
	<span class="h-1.5 w-1.5 rounded-full {dotStyles[tone]}"></span>
	{label}
</span>