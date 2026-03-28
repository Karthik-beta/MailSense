<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onDestroy } from 'svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatDateTime } from '$lib/format';
	import {
		formatStatusLabel,
		progressPercent,
		toneForRisk,
		toneForRunStatus,
		toneForVerificationStatus
	} from '$lib/presenters';

	let { data } = $props<{ data: PageData }>();

	let manualEmail = $state('');
	let manualResult = $state<{
		verificationStatus: string;
		riskLevel: string;
		reason: string;
		verifiedAt: string;
		email: string;
	} | null>(null);
	let manualMessage = $state<{ type: 'error' | 'success'; text: string } | null>(null);
	let isManualBusy = $state(false);

	let selectedUploadId = $state('');
	let currentRun = $state<PageData['runs'][number] | null>(null);
	let bulkMessage = $state<{ type: 'error' | 'success' | 'warning'; text: string } | null>(null);
	let isRunBusy = $state(false);
	let autoAdvance = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	let activeRun = $derived(
		currentRun ??
			data.runs.find((run: PageData['runs'][number]) => run.status !== 'completed') ??
			null
	);

	const currentProgress = $derived(
		activeRun ? progressPercent(activeRun.processedCount, activeRun.totalLeads) : 0
	);

	onDestroy(() => {
		if (timer) {
			clearTimeout(timer);
		}
	});

	const queueNextStep = () => {
		if (timer) {
			clearTimeout(timer);
		}

		if (
			autoAdvance &&
			activeRun &&
			activeRun.totalLeads > activeRun.processedCount &&
			activeRun.status !== 'completed'
		) {
			timer = setTimeout(() => {
				void processCurrentRun();
			}, 900);
		}
	};

	const verifySingle = async (event: SubmitEvent) => {
		event.preventDefault();
		isManualBusy = true;
		manualMessage = null;

		const response = await fetch('/api/verify/single', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: manualEmail })
		});
		const result = await response.json();

		if (!response.ok) {
			manualResult = null;
			manualMessage = { type: 'error', text: result.error || 'Verification failed.' };
			isManualBusy = false;
			return;
		}

		manualResult = {
			verificationStatus: result.verificationStatus,
			riskLevel: result.riskLevel,
			reason: result.reason,
			verifiedAt: result.verifiedAt,
			email: result.email
		};
		manualMessage = { type: 'success', text: `Verification finished for ${result.email}.` };
		isManualBusy = false;
	};

	const createRun = async () => {
		isRunBusy = true;
		bulkMessage = null;

		const response = await fetch('/api/runs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				filters: {
					status: 'unverified',
					uploadId: selectedUploadId || null
				}
			})
		});
		const result = await response.json();

		if (!response.ok) {
			bulkMessage = { type: 'error', text: result.error || 'Could not start the run.' };
			isRunBusy = false;
			return;
		}

		currentRun = result;
		autoAdvance = true;
		bulkMessage = {
			type: result.totalLeads > 0 ? 'success' : 'warning',
			text:
				result.totalLeads > 0
					? `Run created for ${result.totalLeads} leads. Processing will advance in small chunks.`
					: 'No matching leads were queued for verification.'
		};
		isRunBusy = false;

		if (result.totalLeads > 0) {
			await processCurrentRun();
		} else {
			await invalidateAll();
		}
	};

	const processCurrentRun = async () => {
		if (!activeRun || isRunBusy) {
			return;
		}

		isRunBusy = true;
		const response = await fetch(`/api/runs/${activeRun.id}/process`, { method: 'POST' });
		const result = await response.json();

		if (!response.ok) {
			bulkMessage = { type: 'error', text: result.error || 'Run processing failed.' };
			autoAdvance = false;
			isRunBusy = false;
			return;
		}

		currentRun = result;
		isRunBusy = false;

		if (result.status === 'completed') {
			autoAdvance = false;
			bulkMessage = { type: 'success', text: 'Verification run completed.' };
			await invalidateAll();
			return;
		}

		if (result.status === 'retryable') {
			autoAdvance = false;
			bulkMessage = {
				type: 'warning',
				text: result.errorMessage || 'Run paused and can be resumed.'
			};
			await invalidateAll();
			return;
		}

		queueNextStep();
	};

	const resumeRun = async (run: PageData['runs'][number]) => {
		currentRun = run;
		autoAdvance = true;
		bulkMessage = { type: 'warning', text: 'Resuming the selected run.' };
		await processCurrentRun();
	};
</script>

<div class="page-shell">
	<section class="hero-panel stack">
		<div class="split">
			<div class="section-intro">
				<span class="kicker">Verify</span>
				<h1>Run manual checks immediately, then push bulk verification at a safe pace.</h1>
				<p>
					Bulk runs advance through explicit API calls instead of an always-on worker, which keeps
					the app scale-to-zero friendly on Railway while still preserving progress.
				</p>
			</div>
			<div class="metric-strip">
				<span class="capsule">{data.unverifiedTotal} unverified leads</span>
				<span class="capsule">Chunked runs, conservative pacing</span>
			</div>
		</div>

		{#if !data.isReacherConfigured}
			<div class="message warning">
				Reacher is not configured yet. Set the Reacher environment variables before running
				verification.
			</div>
		{/if}
	</section>

	<section class="two-column">
		<div class="panel stack">
			<div>
				<h2>Manual single-email verification</h2>
				<p class="muted">Useful for spot checks before or after a larger import.</p>
			</div>

			<form class="stack" onsubmit={verifySingle}>
				<div class="field">
					<label for="manual-email">Email address</label>
					<input
						class="input"
						id="manual-email"
						type="email"
						bind:value={manualEmail}
						placeholder="contact@company.com"
						required
					/>
				</div>
				<div class="form-actions">
					<button class="button" type="submit" disabled={isManualBusy || !data.isReacherConfigured}>
						{isManualBusy ? 'Verifying...' : 'Verify email'}
					</button>
				</div>
			</form>

			{#if manualMessage}
				<div class={`message ${manualMessage.type === 'error' ? 'error' : ''}`}>
					{manualMessage.text}
				</div>
			{/if}

			{#if manualResult}
				<div class="list-row">
					<div class="split">
						<strong>{manualResult.email}</strong>
						<p class="muted">{formatDateTime(manualResult.verifiedAt)}</p>
					</div>
					<div class="metric-strip">
						<StatusBadge
							label={formatStatusLabel(manualResult.verificationStatus)}
							tone={toneForVerificationStatus(manualResult.verificationStatus)}
							compact
						/>
						<StatusBadge
							label={formatStatusLabel(manualResult.riskLevel)}
							tone={toneForRisk(manualResult.riskLevel)}
							compact
						/>
					</div>
					<p class="muted">{manualResult.reason}</p>
				</div>
			{/if}
		</div>

		<div class="panel stack">
			<div>
				<h2>Bulk verification</h2>
				<p class="muted">
					Queue either all unverified leads or limit the run to a specific upload.
				</p>
			</div>

			<div class="field">
				<label for="bulk-upload">Limit to one upload</label>
				<select class="select" id="bulk-upload" bind:value={selectedUploadId}>
					<option value="">All unverified leads</option>
					{#each data.uploads as upload (upload.id)}
						<option value={upload.id}>{upload.fileName}</option>
					{/each}
				</select>
			</div>

			<div class="form-actions">
				<button
					class="button"
					type="button"
					onclick={createRun}
					disabled={isRunBusy || !data.isReacherConfigured}
				>
					{isRunBusy ? 'Working...' : 'Start safe bulk run'}
				</button>
				{#if activeRun && activeRun.status !== 'completed'}
					<button
						class="button secondary"
						type="button"
						onclick={() => void processCurrentRun()}
						disabled={isRunBusy || !data.isReacherConfigured}
					>
						Process next chunk
					</button>
				{/if}
			</div>

			{#if bulkMessage}
				<div
					class={`message ${bulkMessage.type === 'error' ? 'error' : bulkMessage.type === 'warning' ? 'warning' : ''}`}
				>
					{bulkMessage.text}
				</div>
			{/if}

			{#if activeRun}
				<div class="list-row">
					<div class="split">
						<div>
							<strong>Current run</strong>
							<p class="muted">Created {formatDateTime(activeRun.createdAt)}</p>
						</div>
						<StatusBadge
							label={formatStatusLabel(activeRun.status)}
							tone={toneForRunStatus(activeRun.status)}
							compact
						/>
					</div>
					<div class="progress-track">
						<div class="progress-fill" style={`width: ${currentProgress}%`}></div>
					</div>
					<div class="split">
						<p class="muted">{activeRun.processedCount} of {activeRun.totalLeads} processed</p>
						<p class="mono">{currentProgress}%</p>
					</div>
					<div class="metric-strip">
						<span class="capsule">{activeRun.validCount} valid</span>
						<span class="capsule">{activeRun.riskyCount} risky</span>
						<span class="capsule">{activeRun.invalidCount} invalid</span>
						<span class="capsule">{activeRun.unknownCount} unknown</span>
					</div>
					{#if activeRun.errorMessage}
						<p class="muted">{activeRun.errorMessage}</p>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<section class="panel stack">
		<div class="split">
			<div>
				<h2>Recent runs</h2>
				<p class="muted">Completed runs stay visible, and paused runs can be resumed from here.</p>
			</div>
		</div>

		{#if data.runs.length > 0}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Status</th>
							<th>Started</th>
							<th>Progress</th>
							<th>Breakdown</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{#each data.runs as run (run.id)}
							<tr>
								<td>
									<StatusBadge
										label={formatStatusLabel(run.status)}
										tone={toneForRunStatus(run.status)}
										compact
									/>
								</td>
								<td>{formatDateTime(run.startedAt ?? run.createdAt)}</td>
								<td
									>{run.processedCount} / {run.totalLeads} ({progressPercent(
										run.processedCount,
										run.totalLeads
									)}%)</td
								>
								<td
									>{run.validCount} valid · {run.riskyCount} risky · {run.invalidCount} invalid · {run.unknownCount}
									unknown</td
								>
								<td>
									{#if run.status !== 'completed'}
										<button
											class="button ghost"
											type="button"
											onclick={() => void resumeRun(run)}
											disabled={isRunBusy || !data.isReacherConfigured}
										>
											Resume
										</button>
									{:else}
										<span class="muted">Done</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="empty-state">No runs recorded yet.</div>
		{/if}
	</section>
</div>
