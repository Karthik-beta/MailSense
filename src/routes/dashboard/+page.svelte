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

<div class="page-shell">
	<section class="hero-panel stack">
		<div class="split">
			<div class="section-intro">
				<span class="kicker">Dashboard</span>
				<h1>See import health, verification coverage, and what is ready to export.</h1>
				<p>
					The dashboard stays intentionally lean: upload volume, verification outcomes, and the
					latest runs that still need attention.
				</p>
			</div>

			<div class="inline-actions">
				<a class="button" href={resolve('/imports')}>Import new leads</a>
				<a class="button secondary" href={resolve('/verify')}>Run verification</a>
			</div>
		</div>

		<div class="stat-grid">
			<StatCard
				title="Imported rows"
				value={formatCompactNumber(stats.totalImportedEmails)}
				footnote="Accepted rows across all uploads"
			/>
			<StatCard
				title="Unique leads"
				value={formatCompactNumber(stats.totalUniqueLeads)}
				footnote="Canonical normalized emails in SQLite"
				accent="ink"
			/>
			<StatCard
				title="Verified"
				value={formatCompactNumber(stats.totalVerified)}
				footnote={`${stats.verificationCoverage}% coverage so far`}
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
				footnote="Should stay out of the sending app"
				accent="ink"
			/>
			<StatCard
				title="Unknown"
				value={formatCompactNumber(stats.unknownCount)}
				footnote="Conservative fallback bucket"
				accent="ink"
			/>
		</div>
	</section>

	<section class="two-column">
		<div class="panel stack">
			<div class="split">
				<div>
					<h2>Recent uploads</h2>
					<p class="muted">
						Import outcomes, duplicates linked to existing leads, and file-level summaries.
					</p>
				</div>
				<a class="button secondary" href={resolve('/imports')}>Open imports</a>
			</div>

			{#if data.dashboard.recentUploads.length > 0}
				<div class="stack">
					{#each data.dashboard.recentUploads as upload (upload.id)}
						<a class="list-row" href={resolve(`/imports?uploadId=${upload.id}`)}>
							<div class="split">
								<div>
									<strong>{upload.fileName}</strong>
									<p class="muted">{formatDateTime(upload.createdAt)}</p>
								</div>
								<StatusBadge
									label={formatStatusLabel(upload.status)}
									tone={toneForUploadStatus(upload.status)}
									compact
								/>
							</div>
							<div class="metric-strip">
								<span class="capsule">{upload.acceptedRows} accepted</span>
								<span class="capsule">{upload.rejectedRows} rejected</span>
								<span class="capsule"
									>{upload.importSummary?.linkedExistingRows ?? 0} linked duplicates</span
								>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="empty-state">No uploads yet. Start by importing a CSV or XLSX file.</div>
			{/if}
		</div>

		<div class="panel stack">
			<div class="split">
				<div>
					<h2>Recent verification runs</h2>
					<p class="muted">
						Progress is persisted per run so you can resume safely if a run stalls.
					</p>
				</div>
				<a class="button secondary" href={resolve('/verify')}>Open verify</a>
			</div>

			{#if data.dashboard.recentRuns.length > 0}
				<div class="stack">
					{#each data.dashboard.recentRuns as run (run.id)}
						<div class="list-row">
							<div class="split">
								<div>
									<strong>{run.totalLeads} leads in scope</strong>
									<p class="muted">Started {formatDateTime(run.startedAt ?? run.createdAt)}</p>
								</div>
								<StatusBadge
									label={formatStatusLabel(run.status)}
									tone={toneForRunStatus(run.status)}
									compact
								/>
							</div>
							<div class="progress-track" aria-label="Run progress">
								<div
									class="progress-fill"
									style={`width: ${progressPercent(run.processedCount, run.totalLeads)}%`}
								></div>
							</div>
							<div class="split">
								<p class="muted">{run.processedCount} / {run.totalLeads} processed</p>
								<p class="mono">{progressPercent(run.processedCount, run.totalLeads)}%</p>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty-state">
					No verification runs yet. The verify page can start and resume them.
				</div>
			{/if}
		</div>
	</section>
</div>
