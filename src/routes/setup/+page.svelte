<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let isChecking = $state(false);
	let checkResult = $state<PageData['setup'] | null>(null);

	const liveResult = $derived(checkResult ?? data.setup);

	const runCheck = async () => {
		isChecking = true;
		try {
			const response = await fetch('/api/setup/reacher');
			if (response.ok) {
				checkResult = await response.json();
			}
		} finally {
			isChecking = false;
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	const statusIcon = (ok: boolean | null) => {
		if (ok === null) return '—';
		return ok ? '✓' : '✗';
	};

	const statusColor = (ok: boolean | null) => {
		if (ok === null) return 'text-ink-faint';
		return ok ? 'text-success' : 'text-danger';
	};
</script>

<div class="mx-auto max-w-3xl px-8 py-10">
	<!-- Header -->
	<header class="mb-10">
		<h1 class="font-display text-2xl font-semibold tracking-tight text-ink">
			Verification Setup
		</h1>
		<p class="mt-2 text-sm leading-relaxed text-ink-soft">
			Configure a dedicated verification identity so Reacher uses your own subdomain when
			probing mail servers. This page shows effective configuration, highlights issues, and
			checks infrastructure readiness.
		</p>
	</header>

	<!-- Readiness summary -->
	<section class="mb-8 rounded-lg border border-border bg-surface p-6 shadow-xs">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
						{liveResult.readyToRun ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}"
				>
					{liveResult.readyToRun ? '✓' : '!'}
				</span>
				<div>
					<p class="text-sm font-semibold text-ink">
						{liveResult.readyToRun ? 'Ready to run' : 'Not ready'}
					</p>
					<p class="text-xs text-ink-faint">
						{liveResult.issues.length === 0
							? 'No issues detected.'
							: `${liveResult.issues.length} issue${liveResult.issues.length > 1 ? 's' : ''} found.`}
					</p>
				</div>
			</div>
			<button
				onclick={runCheck}
				disabled={isChecking}
				class="rounded-md border border-border bg-surface px-4 py-2 text-xs font-medium text-ink-soft
					transition-colors hover:bg-surface-muted disabled:opacity-50"
			>
				{isChecking ? 'Checking…' : 'Re-check'}
			</button>
		</div>

		{#if liveResult.issues.length > 0}
			<ul class="mt-4 space-y-1.5 border-t border-border pt-4">
				{#each liveResult.issues as issue}
					<li class="flex items-start gap-2 text-xs text-danger">
						<span class="mt-0.5 shrink-0">✗</span>
						<span>{issue}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Effective configuration -->
	<section class="mb-8">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-widest text-ink-faint">
			Effective Configuration
		</h2>
		<div class="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
			<table class="w-full text-sm">
				<tbody>
					<tr class="border-b border-border">
						<td class="px-5 py-3.5 font-medium text-ink">Reacher Binary</td>
						<td class="px-5 py-3.5">
							<span class={statusColor(liveResult.binaryAvailable)}>
								{statusIcon(liveResult.binaryAvailable)}
								{liveResult.binaryAvailable ? 'Installed' : 'Not found'}
							</span>
						</td>
					</tr>
					<tr class="border-b border-border">
						<td class="px-5 py-3.5 font-medium text-ink">SMTP Port</td>
						<td class="px-5 py-3.5 font-mono text-xs text-ink-soft">
							{liveResult.identity.smtpPort}
						</td>
					</tr>
					<tr class="border-b border-border">
						<td class="px-5 py-3.5 font-medium text-ink">
							<code class="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">REACHER_FROM_EMAIL</code>
						</td>
						<td class="px-5 py-3.5">
							{#if liveResult.identity.fromEmail.configured}
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs text-ink">
										{liveResult.identity.fromEmail.value}
									</span>
									<span class={statusColor(liveResult.identity.fromEmail.valid)}>
										{statusIcon(liveResult.identity.fromEmail.valid)}
									</span>
								</div>
							{:else}
								<span class="text-xs text-ink-faint">
									Not set — Reacher default: <code class="font-mono">{liveResult.identity.fromEmail.effectiveValue}</code>
								</span>
							{/if}
						</td>
					</tr>
					<tr>
						<td class="px-5 py-3.5 font-medium text-ink">
							<code class="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">REACHER_HELLO_NAME</code>
						</td>
						<td class="px-5 py-3.5">
							{#if liveResult.identity.helloName.configured}
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs text-ink">
										{liveResult.identity.helloName.value}
									</span>
									<span class={statusColor(liveResult.identity.helloName.valid)}>
										{statusIcon(liveResult.identity.helloName.valid)}
									</span>
									{#if liveResult.identity.helloName.resolves !== null}
										<span class="text-xs {liveResult.identity.helloName.resolves ? 'text-success' : 'text-warning'}">
											{liveResult.identity.helloName.resolves ? 'resolves' : 'no DNS'}
										</span>
									{/if}
								</div>
							{:else}
								<span class="text-xs text-ink-faint">
									Not set — Reacher default: <code class="font-mono">{liveResult.identity.helloName.effectiveValue}</code>
								</span>
							{/if}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Subdomain identity status -->
	<section class="mb-8">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-widest text-ink-faint">
			Subdomain Identity
		</h2>
		<div class="rounded-lg border border-border bg-surface p-5 shadow-xs">
			{#if liveResult.identity.subdomainConfigured}
				<p class="text-sm text-success">
					A dedicated verification identity is configured. Reacher will identify as
					<code class="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{liveResult.identity.fromEmail.value}</code>
					with EHLO name
					<code class="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{liveResult.identity.helloName.value}</code>.
				</p>
			{:else}
				<p class="text-sm text-ink-soft">
					No dedicated subdomain identity is configured. Reacher will use its built-in
					defaults. To configure a dedicated identity, set both environment variables below.
				</p>
			{/if}
		</div>
	</section>

	<!-- Setup guide -->
	<section class="mb-8">
		<h2 class="mb-4 text-sm font-semibold uppercase tracking-widest text-ink-faint">
			Setup Guide
		</h2>
		<div class="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-xs">
			<div>
				<h3 class="text-sm font-semibold text-ink">1. Choose a verification subdomain</h3>
				<p class="mt-1 text-xs leading-relaxed text-ink-soft">
					Pick a subdomain dedicated to verification, for example <code class="font-mono">verify.yourdomain.com</code>.
					This keeps verification SMTP activity separate from your primary domain.
				</p>
			</div>

			<div>
				<h3 class="text-sm font-semibold text-ink">2. Create a DNS A record</h3>
				<p class="mt-1 text-xs leading-relaxed text-ink-soft">
					Point the subdomain to your server's public IP. This lets remote mail servers
					verify the identity during SMTP conversations.
				</p>
				{#if liveResult.identity.helloName.configured && liveResult.identity.helloName.value}
					<div class="mt-2 flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2">
						<code class="flex-1 font-mono text-xs text-ink">{liveResult.identity.helloName.value}  A  &lt;your-server-ip&gt;</code>
						<button
							onclick={() => copyToClipboard(`${liveResult.identity.helloName.value}  A  <your-server-ip>`)}
							class="shrink-0 rounded border border-border px-2 py-1 text-[10px] font-medium text-ink-faint hover:text-ink"
						>
							Copy
						</button>
					</div>
				{/if}
			</div>

			<div>
				<h3 class="text-sm font-semibold text-ink">3. Set environment variables</h3>
				<p class="mt-1 text-xs leading-relaxed text-ink-soft">
					Configure the verification identity in your environment or Railway variables.
				</p>
				<div class="mt-2 space-y-1.5">
					<div class="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2">
						<code class="flex-1 font-mono text-xs text-ink">REACHER_FROM_EMAIL=check@verify.yourdomain.com</code>
						<button
							onclick={() => copyToClipboard('REACHER_FROM_EMAIL=check@verify.yourdomain.com')}
							class="shrink-0 rounded border border-border px-2 py-1 text-[10px] font-medium text-ink-faint hover:text-ink"
						>
							Copy
						</button>
					</div>
					<div class="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2">
						<code class="flex-1 font-mono text-xs text-ink">REACHER_HELLO_NAME=verify.yourdomain.com</code>
						<button
							onclick={() => copyToClipboard('REACHER_HELLO_NAME=verify.yourdomain.com')}
							class="shrink-0 rounded border border-border px-2 py-1 text-[10px] font-medium text-ink-faint hover:text-ink"
						>
							Copy
						</button>
					</div>
				</div>
			</div>

			<div>
				<h3 class="text-sm font-semibold text-ink">4. Run the setup check</h3>
				<p class="mt-1 text-xs leading-relaxed text-ink-soft">
					After setting the variables and restarting the app, click <strong>Re-check</strong> above
					to confirm that values are valid and the hostname resolves publicly.
				</p>
			</div>
		</div>
	</section>

	<!-- What this check does NOT prove -->
	<section>
		<div class="rounded-lg border border-border bg-surface-muted p-5">
			<h3 class="text-xs font-semibold uppercase tracking-widest text-ink-faint">
				What the readiness check does not prove
			</h3>
			<ul class="mt-3 space-y-1 text-xs leading-relaxed text-ink-soft">
				<li>• It does not verify that email addresses are deliverable.</li>
				<li>• It does not test SMTP reputation or sender trust.</li>
				<li>• It does not guarantee remote mail servers will accept connections.</li>
				<li>• It does not replace running an actual Reacher verification.</li>
				<li>• DNS resolution confirms the hostname exists, not that SMTP will succeed.</li>
			</ul>
		</div>
	</section>
</div>
