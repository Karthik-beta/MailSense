import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { LeadFilters, LeadSortOption, RiskFilter } from '$lib/types';
import { db } from '$lib/server/db';
import { leads, uploadRows } from '$lib/server/db/schema';

const defaultPageSize = 25;
const maxPageSize = 100;

const normalizeFilters = (filters: LeadFilters = {}): Required<LeadFilters> => ({
	query: filters.query?.trim() ?? '',
	status: filters.status ?? 'all',
	risk: filters.risk ?? 'all',
	uploadId: filters.uploadId ?? null,
	sort: filters.sort ?? 'newest',
	page: Math.max(1, filters.page ?? 1),
	pageSize: Math.min(maxPageSize, Math.max(1, filters.pageSize ?? defaultPageSize))
});

const createStatusOrder = () =>
	sql`case
		when ${leads.latestVerificationStatus} = 'safe' then 1
		when ${leads.latestVerificationStatus} = 'risky' then 2
		when ${leads.latestVerificationStatus} = 'unknown' then 3
		when ${leads.latestVerificationStatus} = 'invalid' then 4
		else 5
	end`;

const createRiskOrder = () =>
	sql`case
		when ${leads.latestRiskLevel} = 'valid' then 1
		when ${leads.latestRiskLevel} = 'risky' then 2
		when ${leads.latestRiskLevel} = 'unknown' then 3
		when ${leads.latestRiskLevel} = 'invalid' then 4
		else 5
	end`;

const getOrderBy = (sort: LeadSortOption) => {
	switch (sort) {
		case 'oldest':
			return [asc(leads.createdAt)];
		case 'email':
			return [asc(leads.normalizedEmail)];
		case 'status':
			return [createStatusOrder(), asc(leads.normalizedEmail)];
		case 'risk':
			return [createRiskOrder(), asc(leads.normalizedEmail)];
		case 'verified':
			return [desc(leads.latestVerifiedAt), desc(leads.createdAt)];
		case 'newest':
		default:
			return [desc(leads.createdAt)];
	}
};

const resolveUploadLeadIds = (uploadId: string) => {
	const rows = db
		.select({ leadId: uploadRows.leadId })
		.from(uploadRows)
		.where(and(eq(uploadRows.uploadId, uploadId), isNotNull(uploadRows.leadId)))
		.all();

	return Array.from(
		new Set(rows.map((row) => row.leadId).filter((leadId): leadId is string => Boolean(leadId)))
	);
};

const buildLeadConditions = (filters: Required<LeadFilters>) => {
	const conditions = [];

	if (filters.query) {
		const pattern = `%${filters.query.toLowerCase()}%`;
		conditions.push(
			sql`(
				lower(${leads.originalEmail}) like ${pattern}
				or lower(${leads.normalizedEmail}) like ${pattern}
				or lower(${leads.domain}) like ${pattern}
			)`
		);
	}

	if (filters.status === 'unverified') {
		conditions.push(isNull(leads.latestVerificationStatus));
	} else if (filters.status !== 'all') {
		conditions.push(eq(leads.latestVerificationStatus, filters.status));
	}

	if (filters.risk !== 'all') {
		conditions.push(eq(leads.latestRiskLevel, filters.risk as Exclude<RiskFilter, 'all'>));
	}

	if (filters.uploadId) {
		const leadIds = resolveUploadLeadIds(filters.uploadId);
		if (leadIds.length === 0) {
			return { empty: true as const, whereClause: undefined };
		}

		conditions.push(inArray(leads.id, leadIds));
	}

	return {
		empty: false as const,
		whereClause: conditions.length > 0 ? and(...conditions) : undefined
	};
};

export const parseLeadFilters = (
	input: URLSearchParams | Record<string, string | null | undefined>
): LeadFilters => {
	const params =
		input instanceof URLSearchParams
			? input
			: new URLSearchParams(
					Object.entries(input).flatMap(([key, value]) =>
						value === null || value === undefined ? [] : [[key, value]]
					)
				);

	return {
		query: params.get('query') ?? '',
		status: (params.get('status') as LeadFilters['status']) ?? 'all',
		risk: (params.get('risk') as LeadFilters['risk']) ?? 'all',
		uploadId: params.get('uploadId'),
		sort: (params.get('sort') as LeadFilters['sort']) ?? 'newest',
		page: Number.parseInt(params.get('page') ?? '1', 10) || 1,
		pageSize:
			Number.parseInt(params.get('pageSize') ?? String(defaultPageSize), 10) || defaultPageSize
	};
};

export const listLeads = (filters: LeadFilters = {}) => {
	const normalizedFilters = normalizeFilters(filters);
	const { empty, whereClause } = buildLeadConditions(normalizedFilters);

	if (empty) {
		return {
			items: [],
			total: 0,
			page: normalizedFilters.page,
			pageSize: normalizedFilters.pageSize,
			totalPages: 0,
			filters: normalizedFilters
		};
	}

	const countQuery = whereClause
		? db.select({ total: count() }).from(leads).where(whereClause)
		: db.select({ total: count() }).from(leads);

	const total = countQuery.get()?.total ?? 0;
	const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedFilters.pageSize);
	const offset = (normalizedFilters.page - 1) * normalizedFilters.pageSize;

	const selectQuery = whereClause
		? db
				.select({
					id: leads.id,
					firstUploadId: leads.firstUploadId,
					originalEmail: leads.originalEmail,
					normalizedEmail: leads.normalizedEmail,
					domain: leads.domain,
					mappedFields: leads.mappedFields,
					latestVerificationStatus: leads.latestVerificationStatus,
					latestRiskLevel: leads.latestRiskLevel,
					latestReason: leads.latestReason,
					latestVerifiedAt: leads.latestVerifiedAt,
					createdAt: leads.createdAt,
					updatedAt: leads.updatedAt
				})
				.from(leads)
				.where(whereClause)
		: db
				.select({
					id: leads.id,
					firstUploadId: leads.firstUploadId,
					originalEmail: leads.originalEmail,
					normalizedEmail: leads.normalizedEmail,
					domain: leads.domain,
					mappedFields: leads.mappedFields,
					latestVerificationStatus: leads.latestVerificationStatus,
					latestRiskLevel: leads.latestRiskLevel,
					latestReason: leads.latestReason,
					latestVerifiedAt: leads.latestVerifiedAt,
					createdAt: leads.createdAt,
					updatedAt: leads.updatedAt
				})
				.from(leads);

	const items = selectQuery
		.orderBy(...getOrderBy(normalizedFilters.sort))
		.limit(normalizedFilters.pageSize)
		.offset(offset)
		.all();

	return {
		items,
		total,
		page: normalizedFilters.page,
		pageSize: normalizedFilters.pageSize,
		totalPages,
		filters: normalizedFilters
	};
};

export const listAllLeadRows = (filters: LeadFilters = {}) => {
	const normalizedFilters = normalizeFilters({ ...filters, page: 1, pageSize: maxPageSize });
	const { empty, whereClause } = buildLeadConditions(normalizedFilters);

	if (empty) {
		return [];
	}

	const query = whereClause
		? db
				.select({
					id: leads.id,
					originalEmail: leads.originalEmail,
					normalizedEmail: leads.normalizedEmail,
					domain: leads.domain,
					latestVerificationStatus: leads.latestVerificationStatus,
					latestRiskLevel: leads.latestRiskLevel,
					latestReason: leads.latestReason,
					latestVerifiedAt: leads.latestVerifiedAt,
					mappedFields: leads.mappedFields,
					firstUploadId: leads.firstUploadId
				})
				.from(leads)
				.where(whereClause)
		: db
				.select({
					id: leads.id,
					originalEmail: leads.originalEmail,
					normalizedEmail: leads.normalizedEmail,
					domain: leads.domain,
					latestVerificationStatus: leads.latestVerificationStatus,
					latestRiskLevel: leads.latestRiskLevel,
					latestReason: leads.latestReason,
					latestVerifiedAt: leads.latestVerifiedAt,
					mappedFields: leads.mappedFields,
					firstUploadId: leads.firstUploadId
				})
				.from(leads);

	return query.orderBy(...getOrderBy(normalizedFilters.sort)).all();
};

export const listLeadIds = (filters: LeadFilters = {}) =>
	listAllLeadRows(filters).map((lead) => lead.id);

export const findLeadByNormalizedEmail = (normalizedEmail: string) =>
	db
		.select({
			id: leads.id,
			originalEmail: leads.originalEmail,
			normalizedEmail: leads.normalizedEmail,
			domain: leads.domain,
			mappedFields: leads.mappedFields,
			latestVerificationStatus: leads.latestVerificationStatus,
			latestRiskLevel: leads.latestRiskLevel,
			latestReason: leads.latestReason,
			latestVerifiedAt: leads.latestVerifiedAt,
			firstUploadId: leads.firstUploadId,
			createdAt: leads.createdAt,
			updatedAt: leads.updatedAt
		})
		.from(leads)
		.where(eq(leads.normalizedEmail, normalizedEmail))
		.get();
