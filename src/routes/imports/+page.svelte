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

<div class="page-shell">
	<section class="hero-panel stack">
		<div class="split">
			<div class="section-intro">
				<span class="kicker">Imports</span>
				<h1>Bring leads in, keep traceability, and surface what got rejected.</h1>
				<p>
					MailSense stores each accepted row, links duplicates to existing leads, and keeps
					rejection reasons visible so imports stay understandable.
				</p>
			</div>
		</div>

		<form class="form-grid" onsubmit={submitUpload}>
			<div class="field">
				<label for="lead-file">Lead file</label>
				<input class="input" id="lead-file" name="file" type="file" accept=".csv,.xlsx" required />
			</div>
			<div class="field">
				<label for="email-column">Email column override</label>
				<input
					class="input"
					id="email-column"
					name="emailColumn"
					placeholder="Optional header name"
				/>
			</div>
			<div class="form-actions">
				<button class="button" type="submit" disabled={isUploading}>
					{isUploading ? 'Importing...' : 'Import leads'}
				</button>
			</div>
		</form>

		{#if uploadMessage}
			<div class={`message ${uploadMessage.type === 'error' ? 'error' : ''}`}>
				{uploadMessage.text}
			</div>
		{/if}
	</section>

	<section class="two-column">
		<div class="panel stack">
			<div class="split">
				<div>
					<h2>Selected upload</h2>
					<p class="muted">Inspect imported rows, rejection reasons, and linked duplicates.</p>
				</div>
			</div>

			{#if data.selectedUpload}
				<div class="metric-strip">
					<span class="capsule">{data.selectedUpload.totalRows} total rows</span>
					<span class="capsule">{data.selectedUpload.acceptedRows} accepted</span>
					<span class="capsule">{data.selectedUpload.rejectedRows} rejected</span>
					<span class="capsule"
						>{data.selectedUpload.importSummary?.linkedExistingRows ?? 0} linked duplicates</span
					>
				</div>

				{#if data.selectedUpload.importSummary?.availableHeaders?.length}
					<div class="metric-strip">
						{#each data.selectedUpload.importSummary.availableHeaders as header (header)}
							<span class="capsule mono">{header}</span>
						{/each}
					</div>
				{/if}

				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th>Row</th>
								<th>Email</th>
								<th>Status</th>
								<th>Reason</th>
							</tr>
						</thead>
						<tbody>
							{#each previewRows as row (row.id)}
								<tr>
									<td class="mono">{row.rowIndex}</td>
									<td>{row.normalizedEmail ?? row.originalEmail ?? 'Missing email'}</td>
									<td>
										<StatusBadge
											label={formatStatusLabel(row.status)}
											tone={toneForUploadStatus(row.status)}
											compact
										/>
									</td>
									<td>{row.rejectionReason ?? 'Accepted and linked to a lead record.'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if data.selectedUpload.rows.length > previewRows.length}
					<p class="table-note">Showing the first {previewRows.length} rows for readability.</p>
				{/if}

				{#if rejectionPreview.length > 0}
					<div class="stack">
						<h3>Rejection preview</h3>
						{#each rejectionPreview as rejection (`${rejection.rowNumber}-${rejection.reason}`)}
							<div class="list-row">
								<strong>Row {rejection.rowNumber}</strong>
								<p class="muted">{rejection.email ?? 'No email captured'} · {rejection.reason}</p>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="empty-state">
					No uploads yet. The first imported file will appear here automatically.
				</div>
			{/if}
		</div>

		<div class="panel stack">
			<div>
				<h2>Recent uploads</h2>
				<p class="muted">Select an upload to inspect its rows and audit trail.</p>
			</div>

			{#if data.uploads.length > 0}
				<div class="stack">
					{#each data.uploads as upload (upload.id)}
						<a
							class={`list-row ${data.selectedUpload?.id === upload.id ? 'active' : ''}`}
							href={resolve(`/imports?uploadId=${upload.id}`)}
						>
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
							<p class="muted">{upload.acceptedRows} accepted · {upload.rejectedRows} rejected</p>
						</a>
					{/each}
				</div>
			{:else}
				<div class="empty-state">Uploads will appear here after the first import.</div>
			{/if}
		</div>
	</section>
</div>
