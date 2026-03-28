const emailHeaderCandidates = [
	'email',
	'emailaddress',
	'emailid',
	'emailaddress1',
	'workemail',
	'businessemail',
	'contactemail',
	'primaryemail',
	'e-mail',
	'e-mailaddress'
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeHeader = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');

export const detectEmailColumn = (headers: string[]) => {
	const normalizedHeaders = headers.map((header) => ({
		header,
		normalized: normalizeHeader(header)
	}));

	for (const candidate of emailHeaderCandidates) {
		const match = normalizedHeaders.find(
			(header) => header.normalized === normalizeHeader(candidate)
		);
		if (match) {
			return match.header;
		}
	}

	const fallback = normalizedHeaders.find((header) => header.normalized.includes('email'));
	return fallback?.header ?? null;
};

export const normalizeEmail = (value: string) => {
	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
};

export const isValidEmailSyntax = (value: string) => emailPattern.test(value);

export const extractDomain = (value: string) => value.split('@')[1] ?? '';

export const toFlatRecord = (row: Record<string, unknown>) => {
	const output: Record<string, string | null> = {};

	for (const [key, rawValue] of Object.entries(row)) {
		const normalizedKey = key.trim();
		if (!normalizedKey) {
			continue;
		}

		if (rawValue === null || rawValue === undefined) {
			output[normalizedKey] = null;
			continue;
		}

		const stringValue = typeof rawValue === 'string' ? rawValue : String(rawValue);
		output[normalizedKey] = stringValue.trim() || null;
	}

	return output;
};
