<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import '../app.css';
	import '@fontsource-variable/manrope';
	import '@fontsource/ibm-plex-mono';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props<{ data: LayoutData; children: Snippet }>();

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/imports', label: 'Imports' },
		{ href: '/leads', label: 'Leads' },
		{ href: '/verify', label: 'Verify' }
	] as const;

	const isActive = (href: string) =>
		href === '/dashboard'
			? String(page.url.pathname) === href
			: String(page.url.pathname).startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MailSense</title>
</svelte:head>

{#if data.user}
	<div class="app-shell">
		<aside class="sidebar">
			<div class="brand">
				<div class="brand-mark">MS</div>
				<div>
					<h1>MailSense</h1>
					<p class="muted">Lead verification before anything reaches the sending stack.</p>
				</div>
			</div>

			<nav class="nav-links" aria-label="Primary">
				{#each navItems as item (item.href)}
					<a class={`nav-link ${isActive(item.href) ? 'active' : ''}`} href={resolve(item.href)}>
						<span>{item.label}</span>
						<span class="mono">0{navItems.indexOf(item) + 1}</span>
					</a>
				{/each}
			</nav>

			<div class="user-block">
				<div>
					<strong>{data.user.name}</strong>
					<p class="muted mono">{data.user.email}</p>
				</div>
				<form method="POST" action={resolve('/sign-out')}>
					<button class="button secondary" type="submit">Sign out</button>
				</form>
			</div>
		</aside>

		<div class="content-area">
			{@render children()}
		</div>
	</div>
{:else}
	<div class="public-shell">
		{@render children()}
	</div>
{/if}
