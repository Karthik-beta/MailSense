import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { LeadFilters } from '$lib/types';
import { listAllLeadRows } from './leads';

const toExportRows = (filters: LeadFilters) =>
	listAllLeadRows(filters).map((lead) => ({
		originalEmail: lead.originalEmail,
		normalizedEmail: lead.normalizedEmail,
		domain: lead.domain,
		verificationStatus: lead.latestVerificationStatus ?? 'unverified',
		riskLevel: lead.latestRiskLevel ?? 'unverified',
		reason: lead.latestReason ?? '',
		verificationTimestamp: lead.latestVerifiedAt
			? new Date(lead.latestVerifiedAt).toISOString()
			: '',
		uploadId: lead.firstUploadId ?? '',
		...Object.fromEntries(
			Object.entries(lead.mappedFields ?? {}).map(([key, value]) => [key, value ?? ''])
		)
	}));

export const exportLeadRows = (filters: LeadFilters, format: 'csv' | 'xlsx') => {
	const rows = toExportRows(filters);
	const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

	if (format === 'xlsx') {
		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.json_to_sheet(rows);
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
		const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
		return {
			fileName: `mailsense-export-${timestamp}.xlsx`,
			contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			body: buffer
		};
	}

	const csv = Papa.unparse(rows);
	return {
		fileName: `mailsense-export-${timestamp}.csv`,
		contentType: 'text/csv; charset=utf-8',
		body: Buffer.from(csv, 'utf8')
	};
};
