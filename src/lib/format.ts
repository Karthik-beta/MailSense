const compactFormatter = new Intl.NumberFormat('en', {
	notation: 'compact',
	maximumFractionDigits: 1
});
const dateTimeFormatter = new Intl.DateTimeFormat('en', {
	dateStyle: 'medium',
	timeStyle: 'short'
});
const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export const formatCompactNumber = (value: number) => compactFormatter.format(value);

export const formatDateTime = (value: string | number | Date | null | undefined) => {
	if (!value) {
		return 'Not available';
	}

	return dateTimeFormatter.format(new Date(value));
};

export const formatDate = (value: string | number | Date | null | undefined) => {
	if (!value) {
		return 'Not available';
	}

	return dateFormatter.format(new Date(value));
};

export const truncateId = (value: string | null | undefined) => {
	if (!value) {
		return 'N/A';
	}

	return value.length <= 10 ? value : `${value.slice(0, 8)}...`;
};
