import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	await auth.api.signOut({ headers: event.request.headers });
	throw redirect(303, '/sign-in');
};

export const GET: RequestHandler = async () => {
	throw redirect(303, '/sign-in');
};
