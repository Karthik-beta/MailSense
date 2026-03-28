export const verificationStatuses = ['safe', 'risky', 'invalid', 'unknown'] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const leadStatusFilters = [...verificationStatuses, 'unverified', 'all'] as const;
export type LeadStatusFilter = (typeof leadStatusFilters)[number];

export const riskLevels = ['valid', 'risky', 'invalid', 'unknown'] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const riskFilters = [...riskLevels, 'all'] as const;
export type RiskFilter = (typeof riskFilters)[number];

export const uploadStatuses = ['processing', 'completed', 'failed'] as const;
export type UploadStatus = (typeof uploadStatuses)[number];

export const runStatuses = ['pending', 'processing', 'completed', 'failed', 'retryable'] as const;
export type RunStatus = (typeof runStatuses)[number];

export const leadSortOptions = ['newest', 'oldest', 'email', 'status', 'risk', 'verified'] as const;
export type LeadSortOption = (typeof leadSortOptions)[number];

export type LeadFilters = {
	query?: string;
	status?: LeadStatusFilter;
	risk?: RiskFilter;
	uploadId?: string | null;
	sort?: LeadSortOption;
	page?: number;
	pageSize?: number;
};

export type VerificationRunSnapshot = {
	leadIds: string[];
	filters: LeadFilters;
	uploadId?: string | null;
};

export type ImportRejection = {
	rowNumber: number;
	email?: string;
	reason: string;
};

export type ImportSummary = {
	uploadId: string;
	fileName: string;
	fileType: string;
	emailColumn?: string | null;
	totalRows: number;
	acceptedRows: number;
	linkedExistingRows: number;
	rejectedRows: number;
	rejections: ImportRejection[];
	availableHeaders?: string[];
};

export type VerificationView = {
	verificationStatus: VerificationStatus;
	riskLevel: RiskLevel;
	reason: string;
	verifiedAt: string;
	details?: Record<string, unknown> | null;
};
