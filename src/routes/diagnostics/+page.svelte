<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateTime } from '$lib/format';

	let { data } = $props<{ data: PageData }>();

	let isRefreshing = $state(false);
	let liveData = $state<PageData['diagnostics'] | null>(null);

	const diag = $derived(liveData ?? data.diagnostics);

	const refresh = async () => {
		isRefreshing = true;
		try {
			const response = await fetch('/api/diagnostics');
			if (response.ok) {
				liveData = await response.json();
			}
		} finally {
			isRefreshing = false;
		}
	};

	const statusIcon = (ok: boolean | null) => {
		if (ok === null) return '—';
		return ok ? '✓' : '✗';
	};

	const statusColor = (ok: boolean | null) => {
		if (ok === null) return 'text-ink-faint';
		return ok ? 'text-success' : 'text-danger';
	};

	const healthBg = (healthy: boolean | null) => {
		if (healthy === null) return 'bg-surface-muted border-border';
		return healthy ? 'bg-success-soft border-success/20' : 'bg-danger-soft border-danger/20';
	};

	const healthText = (healthy: boolean | null) => {
		if (healthy === null) return 'text-ink-faint';
		return healthy ? 'text-success' : 'text-danger';
	};
</script>

<div class="stagger mx-auto max-w-5xl space-y-8 px-8 py-10">
	<!-- Header -->
	<header class="border-b border-border pb-8">
		<p class="mb-1 font-mono text-xs font-medium uppercase tracking-widest text-signal">Diagnostics</p>
		<h1 class="font-display text-4xl font-light tracking-tight text-ink">
			System diagnostics
		</h1>
		<p class="mt-2 max-w-xl text-sm text-ink-soft">
			Determine whether verification failures are caused by application code, configuration,
			DNS, network, or remote provider behavior.
		</p>
		<div class="mt-4 flex items-center gap-4">
			<button
				onclick={refresh}
				disabled={isRefreshing}
				class="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 disabled:cursor-wait disabled:opacity-50 active:scale-[0.98]"
			>
				{isRefreshing ? 'Running…' : 'Run diagnostics'}
			</button>
			<span class="text-xs text-ink-faint">Last run: {diag.timestamp ? formatDateTime(diag.timestamp) : 'never'}</span>
		</div>
	</header>

	<!-- Health summary cards -->
	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border p-6 shadow-xs {healthBg(diag.appIntegrationHealthy)}">
			<div class="flex items-center gap-3">
				<span class="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold {diag.appIntegrationHealthy ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}">
					{diag.appIntegrationHealthy ? '✓' : '!'}
				</span>
				<div>
					<p class="text-sm font-semibold {healthText(diag.appIntegrationHealthy)}">
						App integration {diag.appIntegrationHealthy ? 'healthy' : 'unhealthy'}
					</p>
					<p class="text-xs text-ink-faint">Binary installed, executable, config valid</p>
				</div>
			</div>
		</div>
		<div class="rounded-xl border p-6 shadow-xs {healthBg(diag.infrastructureLikelyHealthy)}">
			<div class="flex items-center gap-3">
				<span class="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold
					{diag.infrastructureLikelyHealthy === null ? 'bg-surface-muted text-ink-faint' : diag.infrastructureLikelyHealthy ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}">
					{diag.infrastructureLikelyHealthy === null ? '?' : diag.infrastructureLikelyHealthy ? '✓' : '!'}
				</span>
				<div>
					<p class="text-sm font-semibold {healthText(diag.infrastructureLikelyHealthy)}">
						Infrastructure {diag.infrastructureLikelyHealthy === null ? 'unknown' : diag.infrastructureLikelyHealthy ? 'likely healthy' : 'likely unhealthy'}
					</p>
					<p class="text-xs text-ink-faint">DNS resolution, SMTP port reachability</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Binary health -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Binary</p>
			<h2 class="text-sm font-semibold text-ink">Reacher CLI health</h2>
		</div>
		<div class="overflow-hidden">
			<table class="w-full text-sm">
				<tbody>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Installed</td>
						<td class="px-5 py-3.5">
							<span class={statusColor(diag.binary.installed)}>
								{statusIcon(diag.binary.installed)} {diag.binary.installed ? 'Yes' : 'No'}
							</span>
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Executable</td>
						<td class="px-5 py-3.5">
							<span class={statusColor(diag.binary.executable)}>
								{statusIcon(diag.binary.executable)} {diag.binary.executable ? 'Yes' : 'No'}
							</span>
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Version</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-soft">{diag.binary.version ?? 'Unknown'}</td>
					</tr>
					<tr>
						<td class="px-5 py-3.5 font-medium text-ink">Path</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-faint">{diag.binary.path}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Configuration health -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Configuration</p>
			<h2 class="text-sm font-semibold text-ink">Identity and tuning</h2>
		</div>
		<div class="overflow-hidden">
			<table class="w-full text-sm">
				<tbody>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">
							<code class="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">REACHER_FROM_EMAIL</code>
						</td>
						<td class="px-5 py-3.5">
							{#if diag.config.fromEmail.configured}
								<span class="font-mono text-xs text-ink">{diag.config.fromEmail.value}</span>
								<span class="ml-2 {statusColor(diag.config.fromEmail.valid)}">{statusIcon(diag.config.fromEmail.valid)}</span>
							{:else}
								<span class="text-xs text-ink-faint">Not set — default: <code class="font-mono">{diag.config.fromEmail.effectiveValue}</code></span>
							{/if}
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">
							<code class="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">REACHER_HELLO_NAME</code>
						</td>
						<td class="px-5 py-3.5">
							{#if diag.config.helloName.configured}
								<span class="font-mono text-xs text-ink">{diag.config.helloName.value}</span>
								<span class="ml-2 {statusColor(diag.config.helloName.valid)}">{statusIcon(diag.config.helloName.valid)}</span>
							{:else}
								<span class="text-xs text-ink-faint">Not set — default: <code class="font-mono">{diag.config.helloName.effectiveValue}</code></span>
							{/if}
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Subdomain configured</td>
						<td class="px-5 py-3.5">
							<span class={diag.config.subdomainConfigured ? 'text-success' : 'text-ink-faint'}>
								{diag.config.subdomainConfigured ? '✓ Yes' : '— No'}
							</span>
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Identity aligned</td>
						<td class="px-5 py-3.5">
							{#if diag.config.identityAligned === null}
								<span class="text-xs text-ink-faint">— N/A</span>
							{:else}
								<span class={diag.config.identityAligned ? 'text-success' : 'text-warning'}>
									{diag.config.identityAligned ? '✓ From-email domain matches hello-name' : '⚠ Domain mismatch'}
								</span>
							{/if}
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">SMTP port</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-soft">{diag.config.smtpPort}</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Timeout</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-soft">{diag.config.timeoutMs}ms</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Pacing</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-soft">{diag.config.pacingMs}ms</td>
					</tr>
					<tr>
						<td class="px-5 py-3.5 font-medium text-ink">Batch size</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-soft">{diag.config.batchSize}</td>
					</tr>
				</tbody>
			</table>
		</div>
		{#if diag.config.issues.length > 0}
			<div class="border-t border-border px-6 py-4">
				<p class="mb-2 text-xs font-semibold uppercase tracking-widest text-danger">Issues</p>
				<ul class="space-y-1">
					{#each diag.config.issues as issue}
						<li class="flex items-start gap-2 text-xs text-danger">
							<span class="mt-0.5 shrink-0">✗</span>
							<span>{issue}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<!-- Network health -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Network</p>
			<h2 class="text-sm font-semibold text-ink">DNS and SMTP readiness</h2>
		</div>
		<div class="overflow-hidden">
			<table class="w-full text-sm">
				<tbody>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">Hello-name DNS</td>
						<td class="px-5 py-3.5">
							{#if diag.network.dns.helloNameResolves === null}
								<span class="text-xs text-ink-faint">— Not tested (hello-name not configured or invalid)</span>
							{:else if diag.network.dns.helloNameResolves}
								<span class="text-success">✓ Resolves to {diag.network.dns.helloNameAddresses.join(', ')}</span>
							{:else}
								<span class="text-danger">✗ Does not resolve. {diag.network.dns.helloNameError ?? ''}</span>
							{/if}
						</td>
					</tr>
					<tr class="border-b border-border/60">
						<td class="px-5 py-3.5 font-medium text-ink">MX lookup</td>
						<td class="px-5 py-3.5">
							{#if !diag.network.mxLookup.tested}
								<span class="text-xs text-ink-faint">— Not tested</span>
							{:else if diag.network.mxLookup.records.length > 0}
								<span class="text-success text-xs">✓ {diag.network.mxLookup.records.map((r: { exchange: string; priority: number }) => `${r.exchange} (pri ${r.priority})`).join(', ')}</span>
							{:else}
								<span class="text-warning text-xs">No MX records for {diag.network.mxLookup.domain}. {diag.network.mxLookup.error ?? ''}</span>
							{/if}
						</td>
					</tr>
					<tr>
						<td class="px-5 py-3.5 font-medium text-ink">SMTP port reachability</td>
						<td class="px-5 py-3.5">
							{#if !diag.network.smtpReachability.tested}
								<span class="text-xs text-ink-faint">— Not tested (hello-name DNS must resolve first)</span>
							{:else if diag.network.smtpReachability.reachable}
								<span class="text-success">✓ Port {diag.network.smtpReachability.targetPort} on {diag.network.smtpReachability.targetHost} reachable ({diag.network.smtpReachability.latencyMs}ms)</span>
							{:else}
								<span class="text-danger">✗ Port {diag.network.smtpReachability.targetPort} on {diag.network.smtpReachability.targetHost} unreachable. {diag.network.smtpReachability.error ?? ''}</span>
							{/if}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Effective CLI args -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">CLI</p>
			<h2 class="text-sm font-semibold text-ink">Effective CLI arguments</h2>
		</div>
		<div class="px-6 py-4">
			<code class="block rounded-lg bg-surface-muted px-4 py-3 font-mono text-xs text-ink-soft break-all">
				check_if_email_exists {diag.effectiveCliArgs.join(' ')}
			</code>
			<p class="mt-2 text-xs text-ink-faint">
				This is the exact argument list that would be passed to Reacher for a verification (shown with a placeholder email).
			</p>
		</div>
	</section>

	<!-- Last failure -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Last failure</p>
			<h2 class="text-sm font-semibold text-ink">Most recent technical failure</h2>
		</div>
		<div class="px-6 py-4">
			{#if diag.lastFailure}
				<div class="space-y-3">
					<div class="flex flex-wrap gap-3">
						{#if diag.lastFailure.failureClass}
							<span class="rounded-md bg-danger-soft px-2.5 py-1 font-mono text-[11px] font-medium text-danger">
								{diag.lastFailure.failureClass}
							</span>
						{/if}
						{#if diag.lastFailure.isAppSide}
							<span class="rounded-md bg-warning-soft px-2.5 py-1 font-mono text-[11px] font-medium text-warning">
								app-side
							</span>
						{/if}
						{#if diag.lastFailure.isInfrastructureSide}
							<span class="rounded-md bg-signal-soft px-2.5 py-1 font-mono text-[11px] font-medium text-signal">
								infrastructure-side
							</span>
						{/if}
					</div>
					<p class="text-sm text-ink">{diag.lastFailure.reason}</p>
					{#if diag.lastFailure.failureSummary}
						<p class="text-xs text-ink-soft">{diag.lastFailure.failureSummary}</p>
					{/if}
					{#if diag.lastFailure.verifiedAt}
						<p class="text-xs text-ink-faint">At: {formatDateTime(diag.lastFailure.verifiedAt)}</p>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-ink-faint">No technical failures recorded.</p>
			{/if}
		</div>
	</section>

	<!-- Summary log -->
	<section class="rounded-xl border border-border bg-surface shadow-xs">
		<div class="border-b border-border px-6 py-4">
			<p class="mb-0.5 font-mono text-[11px] font-medium uppercase tracking-widest text-ink-faint">Summary</p>
			<h2 class="text-sm font-semibold text-ink">Diagnostic notes</h2>
		</div>
		<div class="px-6 py-4">
			<ul class="space-y-1.5">
				{#each diag.summary as note}
					<li class="flex items-start gap-2 text-xs text-ink-soft">
						<span class="mt-0.5 shrink-0 text-ink-faint">›</span>
						<span>{note}</span>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- Operator guidance -->
	<section class="rounded-xl border border-border bg-surface-muted p-6">
		<h3 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">What to do next</h3>
		<div class="space-y-3 text-xs leading-relaxed text-ink-soft">
			<div>
				<p class="font-semibold text-ink">If app integration is unhealthy:</p>
				<ul class="mt-1 ml-4 list-disc space-y-0.5">
					<li>Run <code class="font-mono">bun run reacher:install</code> to ensure the binary is present.</li>
					<li>Check file permissions on the Reacher binary.</li>
					<li>Fix any invalid environment variables shown above.</li>
				</ul>
			</div>
			<div>
				<p class="font-semibold text-ink">If infrastructure is unhealthy:</p>
				<ul class="mt-1 ml-4 list-disc space-y-0.5">
					<li>Verify DNS records for your REACHER_HELLO_NAME subdomain.</li>
					<li>Check if outbound port 25 is open on your hosting provider.</li>
					<li>Railway requires Pro plan or above for outbound SMTP.</li>
					<li>Increase VERIFICATION_TIMEOUT_MS if you see frequent timeouts.</li>
					<li>Consider testing from a different network or IP to rule out reputation issues.</li>
				</ul>
			</div>
			<div>
				<p class="font-semibold text-ink">If both are healthy but results are unknown:</p>
				<ul class="mt-1 ml-4 list-disc space-y-0.5">
					<li>The remote provider may be greylisting, rate-limiting, or giving ambiguous responses.</li>
					<li>This is expected behavior — Reacher reports what the remote server tells it.</li>
					<li>Check the failure class on the last technical failure for specific details.</li>
				</ul>
			</div>
		</div>
	</section>
</div>
