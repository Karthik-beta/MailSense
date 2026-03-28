<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatDateTime, truncateId } from '$lib/format';
	import { formatStatusLabel, toneForRisk, toneForVerificationStatus } from '$lib/presenters';

	let { data } = $props<{ data: PageData }>();

	const createQueryString = (
		overrides: Record<string, string | number | null | undefined>,
		omitPagination = false
	) => {
		const entries: string[] = [];
		const values = {
			query: data.filters.query,
			status: data.filters.status,
			risk: data.filters.risk,
			uploadId: data.filters.uploadId,
			sort: data.filters.sort,
			page: omitPagination ? undefined : data.page,
			pageSize: omitPagination ? undefined : data.pageSize,
			...overrides
		};

		for (const [key, value] of Object.entries(values)) {
			if (value === null || value === undefined || value === '' || value === 'all') {
				continue;
			}

			if ((key === 'page' || key === 'pageSize') && Number(value) <= 1) {
				continue;
			}

			entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
		}

		return entries.join('&');
	};
</script>

<div class="page-shell">
	<section class="hero-panel stack">
		<div class="split">
			<div class="section-intro">
				<span class="kicker">Leads</span>
				<h1>Search, filter, and export the rows that are actually ready for the next system.</h1>
				<p>
					The table stays focused on verification status, risk, reason, and source upload so you can
					make quick operational calls without turning MailSense into a CRM.
				</p>
			</div>

			<div class="inline-actions">
				<a
					class="button secondary"
					href={resolve(`/api/export?${createQueryString({}, true)}&format=csv`)}>Export CSV</a
				>
				<a class="button" href={resolve(`/api/export?${createQueryString({}, true)}&format=xlsx`)}
					>Export XLSX</a
				>
			</div>
		</div>

		<form class="form-grid" method="GET" action={resolve('/leads')}>
			<div class="field">
				<label for="query">Search</label>
				<input
					class="input"
					id="query"
					name="query"
					value={data.filters.query}
					placeholder="Email or domain"
				/>
			</div>
			<div class="field">
				<label for="status">Status</label>
				<select class="select" id="status" name="status" value={data.filters.status}>
					<option value="all">All statuses</option>
					<option value="unverified">Unverified</option>
					<option value="safe">Safe</option>
					<option value="risky">Risky</option>
					<option value="invalid">Invalid</option>
					<option value="unknown">Unknown</option>
				</select>
			</div>
			<div class="field">
				<label for="risk">Risk</label>
				<select class="select" id="risk" name="risk" value={data.filters.risk}>
					<option value="all">All risk levels</option>
					<option value="valid">Valid</option>
					<option value="risky">Risky</option>
					<option value="invalid">Invalid</option>
					<option value="unknown">Unknown</option>
				</select>
			</div>
			<div class="field">
				<label for="uploadId">Source upload</label>
				<select class="select" id="uploadId" name="uploadId" value={data.filters.uploadId ?? ''}>
					<option value="">All uploads</option>
					{#each data.uploads as upload (upload.id)}
						<option value={upload.id}>{upload.fileName}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="sort">Sort</label>
				<select class="select" id="sort" name="sort" value={data.filters.sort}>
					<option value="newest">Newest first</option>
					<option value="oldest">Oldest first</option>
					<option value="email">Email</option>
					<option value="status">Status</option>
					<option value="risk">Risk</option>
					<option value="verified">Latest verified</option>
				</select>
			</div>
			<div class="form-actions">
				<button class="button" type="submit">Apply filters</button>
				<a class="button ghost" href={resolve('/leads')}>Reset</a>
			</div>
		</form>
	</section>

	<section class="panel stack">
		<div class="split">
			<div>
				<h2>{data.total} matching leads</h2>
				<p class="muted">Page {data.page} of {Math.max(1, data.totalPages)}</p>
			</div>
			<div class="metric-strip">
				<span class="capsule">{data.pageSize} rows per page</span>
				<span class="capsule">Filtered export stays aligned with the current query</span>
			</div>
		</div>

		{#if data.items.length > 0}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Email</th>
							<th>Source</th>
							<th>Status</th>
							<th>Risk</th>
							<th>Reason</th>
							<th>Verified</th>
						</tr>
					</thead>
					<tbody>
						{#each data.items as lead (lead.id)}
							<tr>
								<td>
									<strong>{lead.normalizedEmail}</strong>
									<p class="muted">{lead.domain}</p>
								</td>
								<td>
									{#if lead.firstUploadId}
										<a class="mono" href={resolve(`/imports?uploadId=${lead.firstUploadId}`)}
											>{truncateId(lead.firstUploadId)}</a
										>
									{:else}
										<span class="muted">Manual only</span>
									{/if}
								</td>
								<td>
									<StatusBadge
										label={formatStatusLabel(lead.latestVerificationStatus, 'Unverified')}
										tone={toneForVerificationStatus(lead.latestVerificationStatus)}
										compact
									/>
								</td>
								<td>
									<StatusBadge
										label={formatStatusLabel(lead.latestRiskLevel, 'Unscored')}
										tone={toneForRisk(lead.latestRiskLevel)}
										compact
									/>
								</td>
								<td>{lead.latestReason ?? 'Not verified yet'}</td>
								<td
									>{lead.latestVerifiedAt
										? formatDateTime(lead.latestVerifiedAt)
										: 'Not verified yet'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="empty-state">No leads matched the current filters.</div>
		{/if}

		{#if data.totalPages > 1}
			<div class="split">
				{#if data.page > 1}
					<a
						class="button ghost"
						href={resolve(`/leads?${createQueryString({ page: data.page - 1 })}`)}>Previous page</a
					>
				{:else}
					<span class="muted">Beginning of results</span>
				{/if}

				{#if data.page < data.totalPages}
					<a
						class="button ghost"
						href={resolve(`/leads?${createQueryString({ page: data.page + 1 })}`)}>Next page</a
					>
				{:else}
					<span class="muted">End of results</span>
				{/if}
			</div>
		{/if}
	</section>
</div>
