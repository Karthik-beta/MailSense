<script lang="ts">
	import type { ActionData } from './$types';

	let { form } = $props<{ form: ActionData }>();
</script>

<div class="page-shell" style="width: min(980px, 100%);">
	<section class="hero-panel" style="padding: 1.6rem;">
		<div class="three-column">
			<div class="section-intro" style="grid-column: span 2;">
				<span class="kicker">Internal Lead Hygiene</span>
				<h1>Verify B2B leads before they touch the email pipeline.</h1>
				<p>
					MailSense keeps uploads, verification runs, and export-ready lists in one place so the
					separate sending system only receives cleaner data.
				</p>
				<div class="metric-strip">
					<span class="capsule">Google-only access</span>
					<span class="capsule">CSV and XLSX imports</span>
					<span class="capsule">Conservative Reacher pacing</span>
				</div>
			</div>

			<div class="panel stack" style="background: rgba(255, 253, 249, 0.84);">
				<div>
					<p class="kicker">Access</p>
					<h2 style="font-size: 1.55rem; letter-spacing: -0.05em;">Sign in with Google</h2>
				</div>

				{#if form?.message}
					<div class="message error">{form.message}</div>
				{/if}

				<form method="POST" action="?/signInGoogle" class="stack">
					<button class="button" type="submit">Continue with Google</button>
				</form>

				<p class="muted">
					Use the same Google account that should access the internal verification workflow.
				</p>
			</div>
		</div>
	</section>
</div>
