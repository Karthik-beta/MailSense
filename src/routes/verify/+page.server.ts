import type { PageServerLoad } from './$types';
import { isReacherConfigured } from '$lib/server/config';
import { listUploads } from '$lib/server/imports';
import { listLeads } from '$lib/server/leads';
import { listVerificationRuns } from '$lib/server/verification';

export const load: PageServerLoad = async () => ({
	uploads: listUploads(20),
	runs: listVerificationRuns(12),
	unverifiedTotal: listLeads({ status: 'unverified', page: 1, pageSize: 1 }).total,
	isReacherConfigured: isReacherConfigured()
});
