import type { PageServerLoad } from './$types';
import { checkSetupReadiness, type SetupCheckResult } from '$lib/server/setup';

export const load: PageServerLoad = async (): Promise<{ setup: SetupCheckResult }> => ({
	setup: await checkSetupReadiness()
});
