const titleCase = (value: string) =>
	value
		.replace(/[-_]/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase() + part.slice(1))
		.join(' ');

export const formatStatusLabel = (value: string | null | undefined, fallback = 'Not verified') =>
	value ? titleCase(value) : fallback;

export const toneForVerificationStatus = (value: string | null | undefined) => {
	switch (value) {
		case 'safe':
			return 'success';
		case 'risky':
			return 'warning';
		case 'invalid':
			return 'danger';
		case 'unknown':
			return 'neutral';
		default:
			return 'neutral';
	}
};

export const toneForRisk = (value: string | null | undefined) => {
	switch (value) {
		case 'valid':
			return 'success';
		case 'risky':
			return 'warning';
		case 'invalid':
			return 'danger';
		case 'unknown':
			return 'neutral';
		default:
			return 'neutral';
	}
};

export const toneForUploadStatus = (value: string | null | undefined) => {
	switch (value) {
		case 'completed':
			return 'success';
		case 'processing':
			return 'warning';
		case 'failed':
			return 'danger';
		default:
			return 'neutral';
	}
};

export const toneForRunStatus = (value: string | null | undefined) => {
	switch (value) {
		case 'completed':
			return 'success';
		case 'processing':
			return 'accent';
		case 'pending':
			return 'warning';
		case 'retryable':
			return 'warning';
		case 'failed':
			return 'danger';
		default:
			return 'neutral';
	}
};

export const progressPercent = (processed: number, total: number) => {
	if (total <= 0) {
		return 100;
	}

	return Math.min(100, Math.round((processed / total) * 100));
};
