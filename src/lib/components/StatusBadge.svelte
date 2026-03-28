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

	const toneClass = $derived(`tone-${tone}`);
</script>

<span class={`badge ${toneClass} ${compact ? 'compact' : ''}`}>{label}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.45rem 0.72rem;
		border-radius: 999px;
		font-size: 0.84rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.badge.compact {
		padding: 0.34rem 0.6rem;
		font-size: 0.78rem;
	}

	.badge.tone-success {
		background: rgba(15, 118, 110, 0.14);
		color: #0a5c55;
	}

	.badge.tone-warning {
		background: rgba(185, 131, 34, 0.16);
		color: #86560f;
	}

	.badge.tone-danger {
		background: rgba(181, 70, 51, 0.14);
		color: #8c3020;
	}

	.badge.tone-accent {
		background: rgba(41, 98, 255, 0.12);
		color: #2747a5;
	}

	.badge.tone-neutral {
		background: rgba(30, 45, 42, 0.09);
		color: #4e615d;
	}
</style>
