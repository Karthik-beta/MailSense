import type { PageServerLoad } from './$types';
import { listUploads } from '$lib/server/imports';
import { listLeads, parseLeadFilters } from '$lib/server/leads';

export const load: PageServerLoad = async ({ url }) => {
	const filters = parseLeadFilters(url.searchParams);
	const result = listLeads(filters);

	return {
		...result,
		uploads: listUploads(20)
	};
};
