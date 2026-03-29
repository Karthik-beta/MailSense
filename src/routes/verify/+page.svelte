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
	let autoAdvance = $state(true);
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
		bulkMessage = {
			type: result.totalLeads > 0 ? (autoAdvance ? 'success' : 'warning') : 'warning',
			text:
				result.totalLeads > 0
					? autoAdvance
						? `Run created for ${result.totalLeads} leads. Processing will advance automatically.`
						: `Run created for ${result.totalLeads} leads. Process the first chunk when ready.`
					: 'No matching leads were queued for verification.'
		};
		isRunBusy = false;

		await invalidateAll();

		if (result.totalLeads > 0 && autoAdvance) {
			await processCurrentRun();
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
		bulkMessage = {
			type: 'warning',
			text: autoAdvance
				? 'Resuming the selected run.'
				: 'Run selected. Use Process next chunk when ready.'
		};

		if (autoAdvance) {
			await processCurrentRun();
		}
	};
</script>

<div class="stagger mx-auto max-w-6xl space-y-8 px-8 py-10">
	<!-- Page header -->
	<header class="border-b border-border pb-8">
		<p class="mb-1 font-mono text-xs font-medium uppercase tracking-widest text-signal">Verify</p>
		<h1 class="font-display text-4xl font-light tracking-tight text-ink">
			Email verification
		</h1>
		<p class="mt-2 max-w-xl text-sm text-ink-soft">
			Run manual checks immediately, then push bulk verification at a safe pace. Runs advance through
			explicit API calls — scale-to-zero friendly.
		</p>
		<div class="mt-4 flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
			<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.unverifiedTotal}</strong> unverified</span>
			{#if activeRun}
				<span class="rounded-md bg-signal-soft px-2.5 py-1 text-signal"><strong>{currentProgress}%</strong> active run</span>
			{/if}
			<span class="rounded-md bg-surface-muted px-2.5 py-1">Embedded verifier</span>
		</div>
	</header>

	<!-- Two-column: manual check + bulk run -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Manual check -->
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
			<div class="mb-5">
				<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Manual check</p>
				<h2 class="text-lg font-semibold tracking-tight text-ink">Single-email verification</h2>
				<p class="mt-1 text-sm text-ink-soft">Spot check before or after a larger import.</p>
			</div>

			<form class="space-y-4" onsubmit={verifySingle}>
				<div>
					<label for="manual-email" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Email address</label>
					<input
						class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10"
						id="manual-email"
						type="email"
						bind:value={manualEmail}
						placeholder="contact@company.com"
						required
					/>
				</div>
				<button
					type="submit"
					disabled={isManualBusy}
					class="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 disabled:cursor-wait disabled:opacity-50 active:scale-[0.98]"
				>
					{isManualBusy ? 'Verifying…' : 'Verify email'}
				</button>
			</form>

			{#if manualMessage}
				<div class="mt-4 rounded-lg border px-4 py-3 text-sm font-medium {manualMessage.type === 'error' ? 'border-danger/20 bg-danger-soft text-danger' : 'border-success/20 bg-success-soft text-success'}">
					{manualMessage.text}
				</div>
			{/if}

			{#if manualResult}
				<div class="mt-4 rounded-lg border border-border/60 p-4">
					<div class="flex items-start justify-between gap-3">
						<p class="text-sm font-medium text-ink">{manualResult.email}</p>
						<p class="text-xs text-ink-faint">{formatDateTime(manualResult.verifiedAt)}</p>
					</div>
					<div class="mt-2 flex flex-wrap gap-2">
						<StatusBadge label={formatStatusLabel(manualResult.verificationStatus)} tone={toneForVerificationStatus(manualResult.verificationStatus)} compact />
						<StatusBadge label={formatStatusLabel(manualResult.riskLevel)} tone={toneForRisk(manualResult.riskLevel)} compact />
					</div>
					<p class="mt-2 text-xs text-ink-soft">{manualResult.reason}</p>
				</div>
			{/if}
		</section>

		<!-- Bulk run -->
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
			<div class="mb-5">
				<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Bulk run</p>
				<h2 class="text-lg font-semibold tracking-tight text-ink">Queue a verification run</h2>
				<p class="mt-1 text-sm text-ink-soft">All unverified leads or a specific upload.</p>
			</div>

			<div class="space-y-4">
				<div>
					<label for="bulk-upload" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Limit to upload</label>
					<select class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10" id="bulk-upload" bind:value={selectedUploadId}>
						<option value="">All unverified leads</option>
						{#each data.uploads as upload (upload.id)}
							<option value={upload.id}>{upload.fileName}</option>
						{/each}
					</select>
				</div>

				<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-paper-warm px-4 py-3">
					<input type="checkbox" bind:checked={autoAdvance} class="h-4 w-4 rounded accent-signal" />
					<span class="text-sm text-ink-soft">Continue automatically until completion or pause</span>
				</label>

				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						onclick={createRun}
						disabled={isRunBusy}
						class="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 disabled:cursor-wait disabled:opacity-50 active:scale-[0.98]"
					>
						{isRunBusy ? 'Working…' : 'Start bulk run'}
					</button>
					{#if activeRun && activeRun.status !== 'completed'}
						<button
							type="button"
							onclick={() => void processCurrentRun()}
							disabled={isRunBusy}
							class="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-xs transition-all duration-150 hover:bg-surface-muted disabled:opacity-50"
						>
							Process next chunk
						</button>
					{/if}
				</div>
			</div>

			{#if bulkMessage}
				<div class="mt-4 rounded-lg border px-4 py-3 text-sm font-medium
					{bulkMessage.type === 'error' ? 'border-danger/20 bg-danger-soft text-danger' : bulkMessage.type === 'warning' ? 'border-warning/20 bg-warning-soft text-warning' : 'border-success/20 bg-success-soft text-success'}">
					{bulkMessage.text}
				</div>
			{/if}
		</section>
	</div>

	<!-- Active run progress -->
	{#if activeRun}
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
			<div class="mb-4 flex flex-wrap items-start justify-between gap-4">
				<div>
					<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Current run</p>
					<h2 class="text-lg font-semibold tracking-tight text-ink">Progress</h2>
					<p class="mt-0.5 text-xs text-ink-faint">Created {formatDateTime(activeRun.createdAt)}</p>
				</div>
				<StatusBadge label={formatStatusLabel(activeRun.status)} tone={toneForRunStatus(activeRun.status)} />
			</div>

			<div class="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
				<div
					class="h-full rounded-full bg-gradient-to-r from-signal to-warning transition-all duration-300"
					style="width: {currentProgress}%"
				></div>
			</div>
			<div class="mb-4 flex items-center justify-between font-mono text-xs text-ink-soft">
				<span>{activeRun.processedCount} of {activeRun.totalLeads} processed</span>
				<span class="font-semibold text-ink">{currentProgress}%</span>
			</div>

			<div class="flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
				<span class="rounded-md bg-success-soft px-2.5 py-1 text-success">{activeRun.validCount} valid</span>
				<span class="rounded-md bg-warning-soft px-2.5 py-1 text-warning">{activeRun.riskyCount} risky</span>
				<span class="rounded-md bg-danger-soft px-2.5 py-1 text-danger">{activeRun.invalidCount} invalid</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1">{activeRun.unknownCount} unknown</span>
			</div>

			{#if activeRun.errorMessage}
				<div class="mt-4 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
					{activeRun.errorMessage}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Run history -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">History</p>
			<h2 class="text-sm font-semibold text-ink">Recent runs</h2>
		</div>

		{#if data.runs.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[700px] border-collapse text-sm">
					<thead>
						<tr class="border-b border-border bg-surface-muted/50">
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Status</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Started</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Progress</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Breakdown</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Action</th>
						</tr>
					</thead>
					<tbody>
						{#each data.runs as run (run.id)}
							<tr class="border-b border-border/60 transition-colors hover:bg-surface-muted/30">
								<td class="px-4 py-3">
									<StatusBadge label={formatStatusLabel(run.status)} tone={toneForRunStatus(run.status)} compact />
								</td>
								<td class="px-4 py-3 text-ink-soft">{formatDateTime(run.startedAt ?? run.createdAt)}</td>
								<td class="px-4 py-3 font-mono text-xs">
									{run.processedCount} / {run.totalLeads}
									<span class="text-ink-faint">({progressPercent(run.processedCount, run.totalLeads)}%)</span>
								</td>
								<td class="px-4 py-3 font-mono text-xs text-ink-soft">
									{run.validCount}v · {run.riskyCount}r · {run.invalidCount}i · {run.unknownCount}u
								</td>
								<td class="px-4 py-3">
									{#if run.status !== 'completed'}
										<button
											type="button"
											onclick={() => void resumeRun(run)}
											disabled={isRunBusy}
											class="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-50"
										>
											Resume
										</button>
									{:else}
										<span class="text-xs text-ink-faint">Done</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="p-8 text-center text-sm text-ink-faint">
				No runs recorded yet.
			</div>
		{/if}
	</section>
</div>