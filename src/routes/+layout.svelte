<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import '../app.css';
	import '@fontsource-variable/fraunces';
	import '@fontsource-variable/dm-sans';
	import '@fontsource-variable/jetbrains-mono';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props<{ data: LayoutData; children: Snippet }>();

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: '◈' },
		{ href: '/imports', label: 'Imports', icon: '↑' },
		{ href: '/leads', label: 'Leads', icon: '◉' },
		{ href: '/verify', label: 'Verify', icon: '✓' },
		{ href: '/setup', label: 'Setup', icon: '⚙' }
	] as const;

	const isActive = (href: string) =>
		href === '/dashboard' ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MailSense</title>
</svelte:head>

{#if data.user}
	<div class="flex min-h-svh">
		<!-- Sidebar -->
		<aside class="sticky top-0 flex h-svh w-64 shrink-0 flex-col border-r border-white/[0.06] bg-sidebar text-sidebar-text">
			<!-- Brand -->
			<a href={resolve('/dashboard')} class="block border-b border-white/[0.06] px-6 py-6">
				<div class="flex items-center gap-3">
					<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-signal text-sm font-bold text-white">
						M
					</div>
					<div>
						<p class="text-[15px] font-semibold tracking-tight">MailSense</p>
						<p class="text-xs text-sidebar-muted">Lead hygiene</p>
					</div>
				</div>
			</a>

			<!-- Navigation -->
			<nav class="flex flex-col gap-1 px-3 py-4" aria-label="Primary">
				{#each navItems as item (item.href)}
					<a
						href={resolve(item.href)}
						class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150
							{isActive(item.href)
								? 'bg-white/[0.08] font-semibold text-white'
								: 'text-sidebar-muted hover:bg-white/[0.04] hover:text-sidebar-text'}"
					>
						<span class="flex h-5 w-5 items-center justify-center font-mono text-xs opacity-60">{item.icon}</span>
						{item.label}
						{#if isActive(item.href)}
							<span class="ml-auto h-1.5 w-1.5 rounded-full bg-signal"></span>
						{/if}
					</a>
				{/each}
			</nav>

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- User block -->
			<div class="border-t border-white/[0.06] px-4 py-4">
				<div class="mb-3">
					<p class="text-sm font-medium text-sidebar-text">{data.user.name}</p>
					<p class="truncate font-mono text-xs text-sidebar-muted">{data.user.email}</p>
				</div>
				<form method="POST" action={resolve('/sign-out')}>
					<button
						type="submit"
						class="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-sidebar-muted transition-colors hover:bg-white/[0.08] hover:text-sidebar-text"
					>
						Sign out
					</button>
				</form>
			</div>
		</aside>

		<!-- Main content -->
		<main class="min-w-0 flex-1">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}