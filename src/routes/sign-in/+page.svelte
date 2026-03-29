<script lang="ts">
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();
</script>

<div class="flex min-h-svh">
	<!-- Left: editorial hero -->
	<div class="hidden flex-1 flex-col justify-between bg-sidebar p-10 lg:flex">
		<div>
			<div class="flex items-center gap-3">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-signal text-sm font-bold text-white">M</div>
				<span class="text-[15px] font-semibold tracking-tight text-white">MailSense</span>
			</div>
		</div>

		<div class="max-w-lg">
			<h1 class="font-display text-5xl leading-[1.1] font-light tracking-tight text-white xl:text-6xl">
				Screen every lead<br />
				<span class="italic text-white/60">before the sender<br />ever sees it.</span>
			</h1>
			<p class="mt-6 max-w-sm text-[15px] leading-relaxed text-sidebar-muted">
				Import lists, verify at a safe pace, and export only the rows that are actually ready —
				all from one operational surface.
			</p>
		</div>

		<div class="flex gap-8 border-t border-white/[0.06] pt-6 font-mono text-xs text-sidebar-muted">
			<div>
				<p class="text-xl font-semibold text-white">01</p>
				<p class="mt-1">Import CSV & XLSX</p>
			</div>
			<div>
				<p class="text-xl font-semibold text-white">02</p>
				<p class="mt-1">Verify in bulk</p>
			</div>
			<div>
				<p class="text-xl font-semibold text-white">03</p>
				<p class="mt-1">Export safe rows</p>
			</div>
		</div>
	</div>

	<!-- Right: sign-in form -->
	<div class="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-[480px] lg:shrink-0">
		<div class="w-full max-w-sm">
			<!-- Mobile brand -->
			<div class="mb-10 flex items-center gap-3 lg:hidden">
				<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-signal text-sm font-bold text-white">M</div>
				<span class="text-[15px] font-semibold tracking-tight text-ink">MailSense</span>
			</div>

			<div class="mb-8">
				<p class="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-signal">Access</p>
				<h2 class="font-display text-3xl font-light tracking-tight text-ink">
					Sign in to continue
				</h2>
				<p class="mt-2 text-sm text-ink-soft">
					Use the Google account that should manage imports, verification, and exports.
				</p>
			</div>

			{#if form?.message}
				<div class="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
					{form.message}
				</div>
			{/if}

			<form method="POST" action="?/signInGoogle">
				<button
					type="submit"
					class="flex w-full items-center justify-center gap-3 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-ink/90 active:scale-[0.98]"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24">
						<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
						<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
						<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
						<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
					</svg>
					Continue with Google
				</button>
			</form>

			<div class="mt-6 flex flex-wrap gap-2">
				<span class="rounded-md bg-surface-muted px-2.5 py-1 font-mono text-[11px] text-ink-soft">Google-only</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1 font-mono text-[11px] text-ink-soft">CSV + XLSX</span>
				<span class="rounded-md bg-surface-muted px-2.5 py-1 font-mono text-[11px] text-ink-soft">Resumable runs</span>
			</div>

			<p class="mt-8 text-xs leading-relaxed text-ink-faint">
				Authentication gates the internal workspace only. Data stays in the same app service and
				database — nothing leaves the boundary.
			</p>
		</div>
	</div>
</div>