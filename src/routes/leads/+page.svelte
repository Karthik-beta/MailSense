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

<div class="stagger mx-auto max-w-6xl space-y-8 px-8 py-10">
	<!-- Page header -->
	<header class="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
		<div>
			<p class="mb-1 font-mono text-xs font-medium uppercase tracking-widest text-signal">Leads</p>
			<h1 class="font-display text-4xl font-light tracking-tight text-ink">
				Search & export
			</h1>
			<p class="mt-2 max-w-xl text-sm text-ink-soft">
				Filter by verification state, risk, and source — then export only the rows you trust.
			</p>
		</div>
		<div class="flex gap-3">
			<a
				href={resolve(`/api/export?${createQueryString({}, true)}&format=csv`)}
				class="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-xs transition-all duration-150 hover:bg-surface-muted"
			>
				Export CSV
			</a>
			<a
				href={resolve(`/api/export?${createQueryString({}, true)}&format=xlsx`)}
				class="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 active:scale-[0.98]"
			>
				Export XLSX
			</a>
		</div>
	</header>

	<!-- Quick metrics -->
	<div class="flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
		<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.total}</strong> matching leads</span>
		<span class="rounded-md bg-surface-muted px-2.5 py-1"><strong class="text-ink">{data.pageSize}</strong> per page</span>
		<span class="rounded-md bg-surface-muted px-2.5 py-1">Export mirrors current query</span>
	</div>

	<!-- Filters -->
	<section class="rounded-xl border border-border bg-surface p-6 shadow-xs">
		<form class="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" method="GET" action={resolve('/leads')}>
			<div>
				<label for="query" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Search</label>
				<input
					class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10"
					id="query"
					name="query"
					value={data.filters.query}
					placeholder="Email or domain"
				/>
			</div>
			<div>
				<label for="status" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Status</label>
				<select class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10" id="status" name="status" value={data.filters.status}>
					<option value="all">All statuses</option>
					<option value="unverified">Unverified</option>
					<option value="safe">Safe</option>
					<option value="risky">Risky</option>
					<option value="invalid">Invalid</option>
					<option value="unknown">Unknown</option>
				</select>
			</div>
			<div>
				<label for="risk" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Risk</label>
				<select class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10" id="risk" name="risk" value={data.filters.risk}>
					<option value="all">All levels</option>
					<option value="valid">Valid</option>
					<option value="risky">Risky</option>
					<option value="invalid">Invalid</option>
					<option value="unknown">Unknown</option>
				</select>
			</div>
			<div>
				<label for="uploadId" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Source upload</label>
				<select class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10" id="uploadId" name="uploadId" value={data.filters.uploadId ?? ''}>
					<option value="">All uploads</option>
					{#each data.uploads as upload (upload.id)}
						<option value={upload.id}>{upload.fileName}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="sort" class="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Sort</label>
				<select class="w-full rounded-lg border border-border bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-signal/40 focus:ring-2 focus:ring-signal/10" id="sort" name="sort" value={data.filters.sort}>
					<option value="newest">Newest first</option>
					<option value="oldest">Oldest first</option>
					<option value="email">Email</option>
					<option value="status">Status</option>
					<option value="risk">Risk</option>
					<option value="verified">Latest verified</option>
				</select>
			</div>
			<div class="flex items-end gap-2">
				<button
					type="submit"
					class="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 active:scale-[0.98]"
				>
					Apply
				</button>
				<a
					href={resolve('/leads')}
					class="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted"
				>
					Reset
				</a>
			</div>
		</form>
	</section>

	<!-- Results -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="flex items-center justify-between border-b border-border px-6 py-4">
			<div>
				<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Results</p>
				<h2 class="text-sm font-semibold text-ink">Page {data.page} of {Math.max(1, data.totalPages)}</h2>
			</div>
			<span class="font-mono text-xs text-ink-soft">{data.items.length} rows shown</span>
		</div>

		{#if data.items.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full min-w-[800px] border-collapse text-sm">
					<thead>
						<tr class="border-b border-border bg-surface-muted/50">
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Email</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Source</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Status</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Risk</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Reason</th>
							<th class="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-widest text-ink-soft">Verified</th>
						</tr>
					</thead>
					<tbody>
						{#each data.items as lead (lead.id)}
							<tr class="border-b border-border/60 transition-colors hover:bg-surface-muted/30">
								<td class="px-4 py-3">
									<p class="font-medium text-ink">{lead.normalizedEmail}</p>
									<p class="mt-0.5 text-xs text-ink-faint">{lead.domain}</p>
								</td>
								<td class="px-4 py-3">
									{#if lead.firstUploadId}
										<a class="font-mono text-xs text-signal hover:underline" href={resolve(`/imports?uploadId=${lead.firstUploadId}`)}>{truncateId(lead.firstUploadId)}</a>
									{:else}
										<span class="text-xs text-ink-faint">Manual</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<StatusBadge label={formatStatusLabel(lead.latestVerificationStatus, 'Unverified')} tone={toneForVerificationStatus(lead.latestVerificationStatus)} compact />
								</td>
								<td class="px-4 py-3">
									<StatusBadge label={formatStatusLabel(lead.latestRiskLevel, 'Unscored')} tone={toneForRisk(lead.latestRiskLevel)} compact />
								</td>
								<td class="max-w-[200px] truncate px-4 py-3 text-ink-soft">{lead.latestReason ?? 'Not verified yet'}</td>
								<td class="px-4 py-3 text-xs text-ink-soft">{lead.latestVerifiedAt ? formatDateTime(lead.latestVerifiedAt) : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="p-8 text-center text-sm text-ink-faint">
				No leads matched the current filters.
			</div>
		{/if}

		{#if data.totalPages > 1}
			<div class="flex items-center justify-between border-t border-border px-6 py-4">
				{#if data.page > 1}
					<a
						href={resolve(`/leads?${createQueryString({ page: data.page - 1 })}`)}
						class="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted"
					>
						← Previous
					</a>
				{:else}
					<span class="text-xs text-ink-faint">Beginning</span>
				{/if}

				{#if data.page < data.totalPages}
					<a
						href={resolve(`/leads?${createQueryString({ page: data.page + 1 })}`)}
						class="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted"
					>
						Next →
					</a>
				{:else}
					<span class="text-xs text-ink-faint">End</span>
				{/if}
			</div>
		{/if}
	</section>
</div>