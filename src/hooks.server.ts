import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = undefined;
	event.locals.user = undefined;

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const pathname = event.url.pathname;
	const isAuthPath = pathname.startsWith('/api/auth');
	const isHealthPath = pathname === '/api/health';
	const isPublicPage = pathname === '/sign-in';
	const isKnownRoute = Boolean(event.route.id);

	if (event.locals.user && pathname === '/sign-in') {
		throw redirect(303, '/dashboard');
	}

	if (!event.locals.user && pathname.startsWith('/api/') && !isAuthPath && !isHealthPath) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'content-type': 'application/json' }
		});
	}

	if (!event.locals.user && isKnownRoute && !isPublicPage && !isAuthPath && !isHealthPath) {
		throw redirect(303, '/sign-in');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
