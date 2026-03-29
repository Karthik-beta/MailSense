<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import StatCard from '$lib/components/StatCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatCompactNumber, formatDateTime } from '$lib/format';
	import {
		formatStatusLabel,
		progressPercent,
		toneForRunStatus,
		toneForUploadStatus
	} from '$lib/presenters';

	let { data } = $props<{ data: PageData }>();

	let stats = $derived(data.dashboard.stats);
</script>

<div class="stagger mx-auto max-w-6xl space-y-8 px-8 py-10">
	<!-- Page header -->
	<header class="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
		<div>
			<p class="mb-1 font-mono text-xs font-medium uppercase tracking-widest text-signal">Dashboard</p>
			<h1 class="font-display text-4xl font-light tracking-tight text-ink">
				At a glance
			</h1>
			<p class="mt-2 max-w-xl text-sm text-ink-soft">
				Import health, verification coverage, and export readiness in one scan.
			</p>
		</div>
		<div class="flex gap-3">
			<a
				href={resolve('/imports')}
				class="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 active:scale-[0.98]"
			>
				Import leads
			</a>
			<a
				href={resolve('/verify')}
				class="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-xs transition-all duration-150 hover:bg-surface-muted"
			>
				Run verification
			</a>
		</div>
	</header>

	<!-- Quick metrics row -->
	<div class="flex flex-wrap gap-4">
		<div class="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 font-mono text-xs text-ink-soft">
			<span class="h-2 w-2 rounded-full bg-success"></span>
			<strong class="text-ink">{stats.verificationCoverage}%</strong> coverage
		</div>
		<div class="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 font-mono text-xs text-ink-soft">
			<strong class="text-ink">{formatCompactNumber(stats.exportReadyCount)}</strong> ready to export
		</div>
		<div class="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-1.5 font-mono text-xs text-ink-soft">
			<strong class="text-ink">{data.dashboard.recentRuns.length}</strong> recent runs
		</div>
	</div>

	<!-- Stat cards grid -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<StatCard
			title="Imported rows"
			value={formatCompactNumber(stats.totalImportedEmails)}
			footnote="Accepted rows across all uploads"
		/>
		<StatCard
			title="Unique leads"
			value={formatCompactNumber(stats.totalUniqueLeads)}
			footnote="Canonical normalized emails"
			accent="ink"
		/>
		<StatCard
			title="Verified"
			value={formatCompactNumber(stats.totalVerified)}
			footnote="{stats.verificationCoverage}% coverage so far"
		/>
		<StatCard
			title="Export-ready"
			value={formatCompactNumber(stats.exportReadyCount)}
			footnote="Currently marked valid"
			accent="gold"
		/>
		<StatCard
			title="Valid"
			value={formatCompactNumber(stats.validCount)}
			footnote="Safest segment for export"
		/>
		<StatCard
			title="Risky"
			value={formatCompactNumber(stats.riskyCount)}
			footnote="Review before sending"
			accent="gold"
		/>
		<StatCard
			title="Invalid"
			value={formatCompactNumber(stats.invalidCount)}
			footnote="Keep out of the sending app"
			accent="ink"
		/>
		<StatCard
			title="Unknown"
			value={formatCompactNumber(stats.unknownCount)}
			footnote="Conservative fallback bucket"
			accent="ink"
		/>
	</div>

	<!-- Two-column: uploads + runs -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Recent uploads -->
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
			<div class="mb-5 flex items-start justify-between gap-4">
				<div>
					<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Uploads</p>
					<h2 class="text-lg font-semibold tracking-tight text-ink">Recent uploads</h2>
				</div>
				<a
					href={resolve('/imports')}
					class="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted"
				>
					View all
				</a>
			</div>

			{#if data.dashboard.recentUploads.length > 0}
				<div class="space-y-3">
					{#each data.dashboard.recentUploads as upload (upload.id)}
						<a
							href={resolve(`/imports?uploadId=${upload.id}`)}
							class="block rounded-lg border border-border/60 p-4 transition-all duration-150 hover:border-border-strong hover:shadow-sm"
						>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-ink">{upload.fileName}</p>
									<p class="mt-0.5 text-xs text-ink-faint">{formatDateTime(upload.createdAt)}</p>
								</div>
								<StatusBadge
									label={formatStatusLabel(upload.status)}
									tone={toneForUploadStatus(upload.status)}
									compact
								/>
							</div>
							<div class="mt-3 flex gap-3 font-mono text-[11px] text-ink-soft">
								<span>{upload.acceptedRows} accepted</span>
								<span class="text-ink-faint">·</span>
								<span>{upload.rejectedRows} rejected</span>
								<span class="text-ink-faint">·</span>
								<span>{upload.importSummary?.linkedExistingRows ?? 0} linked</span>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-faint">
					No uploads yet. Start by importing a CSV or XLSX file.
				</div>
			{/if}
		</section>

		<!-- Recent runs -->
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
			<div class="mb-5 flex items-start justify-between gap-4">
				<div>
					<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Verification</p>
					<h2 class="text-lg font-semibold tracking-tight text-ink">Recent runs</h2>
				</div>
				<a
					href={resolve('/verify')}
					class="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted"
				>
					View all
				</a>
			</div>

			{#if data.dashboard.recentRuns.length > 0}
				<div class="space-y-3">
					{#each data.dashboard.recentRuns as run (run.id)}
						<div class="rounded-lg border border-border/60 p-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-sm font-medium text-ink">{run.totalLeads} leads in scope</p>
									<p class="mt-0.5 text-xs text-ink-faint">Started {formatDateTime(run.startedAt ?? run.createdAt)}</p>
								</div>
								<StatusBadge
									label={formatStatusLabel(run.status)}
									tone={toneForRunStatus(run.status)}
									compact
								/>
							</div>
							<div class="mt-3">
								<div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
									<div
										class="h-full rounded-full bg-gradient-to-r from-signal to-warning transition-all duration-300"
										style="width: {progressPercent(run.processedCount, run.totalLeads)}%"
									></div>
								</div>
								<div class="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ink-soft">
									<span>{run.processedCount} / {run.totalLeads}</span>
									<span>{progressPercent(run.processedCount, run.totalLeads)}%</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-faint">
					No verification runs yet.
				</div>
			{/if}
		</section>
	</div>
</div>