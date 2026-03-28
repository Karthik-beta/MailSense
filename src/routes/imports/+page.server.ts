import type { PageServerLoad } from './$types';
import { getUploadDetails, listUploads } from '$lib/server/imports';

export const load: PageServerLoad = async ({ url }) => {
	const uploads = listUploads(20);
	const selectedUploadId = url.searchParams.get('uploadId') ?? uploads[0]?.id ?? null;

	return {
		uploads,
		selectedUpload: selectedUploadId ? getUploadDetails(selectedUploadId) : null
	};
};
