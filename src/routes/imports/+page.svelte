<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatDateTime } from '$lib/format';
	import { formatStatusLabel, toneForUploadStatus } from '$lib/presenters';

	let { data } = $props<{ data: PageData }>();

	let isUploading = $state(false);
	let uploadMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	const previewRows = $derived((data.selectedUpload?.rows ?? []).slice(0, 40));
	const rejectionPreview = $derived(
		(data.selectedUpload?.importSummary?.rejections ?? []).slice(0, 8)
	);

	const submitUpload = async (event: SubmitEvent) => {
		event.preventDefault();

		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement)) {
			return;
		}

		isUploading = true;
		uploadMessage = null;

		const response = await fetch('/api/uploads', {
			method: 'POST',
			body: new FormData(form)
		});
		const result = await response.json();

		if (!response.ok) {
			uploadMessage = {
				type: 'error',
				text:
					result.error ||
					result.summary?.rejections?.[0]?.reason ||
					'The upload could not be imported.'
			};
			isUploading = false;
			return;
		}

		uploadMessage = {
			type: 'success',
			text: `Imported ${result.summary.acceptedRows} rows from ${result.summary.fileName}.`
		};
		isUploading = false;

		await goto(resolve(`/imports?uploadId=${result.uploadId}`));
	};
</script>

<div class="stagger mx-auto max-w-6xl space-y-8 px-8 py-10">
	<!-- Page header -->
	<header class="border-b border-border pb-8">
		<p class="mb-1 font-mono text-xs font-medium uppercase tracking-widest text-signal">Imports</p>
		<h1 class="font-display text-4xl font-light tracking-tight text-ink">
			File intake
		</h1>
		<p class="mt-2 max-w-xl text-sm text-ink-soft">
			Upload a list once, then inspect accepted rows, duplicates, headers, and rejection causes.
		</p>

		{#if data.selectedUpload}
			<div class="mt-4 flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
				<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.selectedUpload.fileName}</strong></span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.selectedUpload.acceptedRows}</strong> accepted</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.selectedUpload.rejectedRows}</strong> rejected</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.selectedUpload.importSummary?.linkedExistingRows ?? 0}</strong> linked</span>
			</div>
		{/if}
	</header>

	<!-- Upload form + history -->
	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Upload form (wider) -->
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs lg:col-span-3">
			<div class="mb-5">
				<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Upload intake</p>
				<h2 class="text-lg font-semibold tracking-tight text-ink">Import a new file</h2>
				<p class="mt-1 text-sm text-ink-soft">Choose a spreadsheet and optionally override the email column.</p>
			</div>

			<form class="space-y-4" onsubmit={submitUpload}>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="lead-file" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Lead file</label>
						<input
							class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10"
							id="lead-file"
							name="file"
							type="file"
							accept=".csv,.xlsx"
							required
						/>
					</div>
					<div>
						<label for="email-column" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Email column override</label>
						<input
							class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10"
							id="email-column"
							name="emailColumn"
							placeholder="Optional header name"
						/>
					</div>
				</div>
				<button
					type="submit"
					disabled={isUploading}
					class="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 disabled:cursor-wait disabled:opacity-50 active:scale-[0.98]"
				>
					{isUploading ? 'Importing…' : 'Import leads'}
				</button>
			</form>

			{#if uploadMessage}
				<div class="mt-4 rounded-lg border px-4 py-3 text-sm font-medium {uploadMessage.type === 'error' ? 'border-danger/20 bg-danger-soft text-danger' : 'border-success/20 bg-success-soft text-success'}">
					{uploadMessage.text}
				</div>
			{/if}
		</section>

		<!-- Recent uploads list -->
		<section class="rounded-xl border border-border bg-surface p-6 shadow-xs lg:col-span-2">
			<div class="mb-5">
				<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">History</p>
				<h2 class="text-lg font-semibold tracking-tight text-ink">Recent uploads</h2>
			</div>

			{#if data.uploads.length > 0}
				<div class="space-y-2">
					{#each data.uploads as upload (upload.id)}
						<a
							href={resolve(`/imports?uploadId=${upload.id}`)}
							class="block rounded-lg border p-3.5 transition-all duration-150 hover:border-border-strong hover:shadow-sm
								{data.selectedUpload?.id === upload.id ? 'border-signal/30 bg-signal-soft' : 'border-border/60'}"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="truncate text-sm font-medium text-ink">{upload.fileName}</p>
									<p class="mt-0.5 text-xs text-ink-faint">{formatDateTime(upload.createdAt)}</p>
								</div>
								<StatusBadge label={formatStatusLabel(upload.status)} tone={toneForUploadStatus(upload.status)} compact />
							</div>
							<p class="mt-2 font-mono text-[11px] text-ink-soft">{upload.acceptedRows} accepted · {upload.rejectedRows} rejected</p>
						</a>
					{/each}
				</div>
			{:else}
				<div class="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-faint">
					Uploads appear after the first import.
				</div>
			{/if}
		</section>
	</div>

	<!-- Inspection section -->
	<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
		<div class="mb-5 flex flex-wrap items-start justify-between gap-4">
			<div>
				<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Inspection</p>
				<h2 class="text-lg font-semibold tracking-tight text-ink">
					{data.selectedUpload ? data.selectedUpload.fileName : 'Selected upload'}
				</h2>
				<p class="mt-1 text-sm text-ink-soft">Preview rows, headers, and rejection detail.</p>
			</div>
			{#if data.selectedUpload}
				<StatusBadge label={formatStatusLabel(data.selectedUpload.status)} tone={toneForUploadStatus(data.selectedUpload.status)} />
			{/if}
		</div>

		{#if data.selectedUpload}
			<div class="mb-5 flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
				<span class="rounded-md bg-surface-muted px-2.5 py-1">{data.selectedUpload.totalRows} total rows</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1">{data.selectedUpload.acceptedRows} accepted</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1">{data.selectedUpload.rejectedRows} rejected</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1">{data.selectedUpload.importSummary?.linkedExistingRows ?? 0} linked</span>
			</div>

			<div class="grid gap-6 lg:grid-cols-5">
				<!-- Table -->
				<div class="lg:col-span-3">
					<div class="overflow-x-auto rounded-lg border border-border">
						<table class="w-full min-w-[640px] border-collapse text-sm">
							<thead>
								<tr class="border-b border-border bg-surface-muted">
									<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Row</th>
									<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Email</th>
									<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Status</th>
									<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Reason</th>
								</tr>
							</thead>
							<tbody>
								{#each previewRows as row (row.id)}
									<tr class="border-b border-border/60 transition-colors hover:bg-surface-muted/50">
										<td class="px-4 py-3 font-mono text-xs text-ink-soft">{row.rowIndex}</td>
										<td class="px-4 py-3 font-medium text-ink">{row.normalizedEmail ?? row.originalEmail ?? 'Missing email'}</td>
										<td class="px-4 py-3">
											<StatusBadge label={formatStatusLabel(row.status)} tone={toneForUploadStatus(row.status)} compact />
										</td>
										<td class="px-4 py-3 text-ink-soft">{row.rejectionReason ?? 'Accepted'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if data.selectedUpload.rows.length > previewRows.length}
						<p class="mt-2 text-xs text-ink-faint">Showing first {previewRows.length} of {data.selectedUpload.rows.length} rows.</p>
					{/if}
				</div>

				<!-- Headers + rejections -->
				<div class="space-y-6 lg:col-span-2">
					{#if data.selectedUpload.importSummary?.availableHeaders?.length}
						<div>
							<h3 class="mb-2 text-sm font-semibold text-ink">Detected headers</h3>
							<div class="flex flex-wrap gap-1.5">
								{#each data.selectedUpload.importSummary.availableHeaders as header (header)}
									<span class="rounded-md bg-surface-muted px-2.5 py-1 font-mono text-[11px] text-ink-soft">{header}</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if rejectionPreview.length > 0}
						<div>
							<h3 class="mb-2 text-sm font-semibold text-ink">Rejection preview</h3>
							<div class="space-y-2">
								{#each rejectionPreview as rejection (`${rejection.rowNumber}-${rejection.reason}`)}
									<div class="rounded-lg border border-border/60 p-3">
										<p class="text-sm font-medium text-ink">Row {rejection.rowNumber}</p>
										<p class="mt-0.5 text-xs text-ink-soft">{rejection.email ?? 'No email captured'} · {rejection.reason}</p>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="rounded-lg border border-dashed border-border p-4 text-center text-sm text-ink-faint">
							No rejections for this upload.
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="rounded-lg border border-dashed border-border p-8 text-center text-sm text-ink-faint">
				No upload selected. Import a file or select one from the history.
			</div>
		{/if}
	</section>
</div>