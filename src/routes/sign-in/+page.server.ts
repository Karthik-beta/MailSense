import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}

	return {};
};

export const actions: Actions = {
	signInGoogle: async () => {
		const result = await auth.api.signInSocial({
			body: {
				provider: 'google',
				callbackURL: '/dashboard'
			}
		});

		if (result.url) {
			throw redirect(303, result.url);
		}

		return fail(400, { message: 'Google sign-in could not be started.' });
	}
};
