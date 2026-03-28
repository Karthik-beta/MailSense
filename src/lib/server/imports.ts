import { desc, eq, inArray } from 'drizzle-orm';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { appConfig } from '$lib/server/config';
import type { ImportRejection, ImportSummary } from '$lib/types';
import { db } from '$lib/server/db';
import { leads, uploadRows, uploads } from '$lib/server/db/schema';
import {
	detectEmailColumn,
	extractDomain,
	isValidEmailSyntax,
	normalizeEmail,
	toFlatRecord
} from './email';

type ParsedUploadFile = {
	fileType: 'csv' | 'xlsx';
	headers: string[];
	rows: Record<string, string | null>[];
};

const inferFileType = (fileName: string) => {
	const lowered = fileName.toLowerCase();

	if (lowered.endsWith('.csv')) {
		return 'csv' as const;
	}

	if (lowered.endsWith('.xlsx')) {
		return 'xlsx' as const;
	}

	throw new Error('Unsupported file type. Upload a .csv or .xlsx file.');
};

const parseCsvFile = async (file: File): Promise<ParsedUploadFile> => {
	const text = await file.text();
	const result = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (header: string) => header.trim()
	});

	if (result.errors.length > 0) {
		throw new Error(result.errors[0]?.message || 'Unable to parse CSV file.');
	}

	const headers = (result.meta.fields ?? []).map((field: string) => field.trim()).filter(Boolean);
	const rows = result.data.map((row: Record<string, string>) => toFlatRecord(row));

	return { fileType: 'csv', headers, rows };
};

const parseXlsxFile = async (file: File): Promise<ParsedUploadFile> => {
	const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
	const firstSheetName = workbook.SheetNames[0];

	if (!firstSheetName) {
		throw new Error('The workbook does not contain any sheets.');
	}

	const worksheet = workbook.Sheets[firstSheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
		defval: '',
		raw: false
	});
	const headers =
		rows.length > 0
			? Object.keys(rows[0] ?? {})
					.map((header) => header.trim())
					.filter(Boolean)
			: [];

	return {
		fileType: 'xlsx',
		headers,
		rows: rows.map((row) => toFlatRecord(row))
	};
};

const parseImportFile = async (file: File) => {
	const fileType = inferFileType(file.name);
	return fileType === 'csv' ? parseCsvFile(file) : parseXlsxFile(file);
};

const buildFailureSummary = (
	uploadId: string,
	fileName: string,
	fileType: string,
	reason: string,
	availableHeaders: string[] = [],
	totalRows = 0
): ImportSummary => ({
	uploadId,
	fileName,
	fileType,
	totalRows,
	acceptedRows: 0,
	linkedExistingRows: 0,
	rejectedRows: totalRows,
	rejections: [{ rowNumber: 0, reason }],
	availableHeaders
});

export const importLeadFile = async ({
	file,
	requestedEmailColumn,
	userId
}: {
	file: File;
	requestedEmailColumn?: string | null;
	userId: string;
}) => {
	if (file.size > appConfig.maxUploadBytes) {
		throw new Error(
			`Upload is too large. The current limit is ${Math.round(appConfig.maxUploadBytes / 1024 / 1024)}MB.`
		);
	}

	const uploadId = crypto.randomUUID();
	const fallbackFileType = (() => {
		try {
			return inferFileType(file.name);
		} catch {
			return 'csv' as const;
		}
	})();

	let parsed: ParsedUploadFile;
	try {
		parsed = await parseImportFile(file);
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'Unable to parse the uploaded file.';
		const summary = buildFailureSummary(uploadId, file.name, fallbackFileType, reason);
		db.insert(uploads)
			.values({
				id: uploadId,
				createdByUserId: userId,
				fileName: file.name,
				fileType: fallbackFileType,
				status: 'failed',
				totalRows: 0,
				acceptedRows: 0,
				rejectedRows: 0,
				importSummary: summary
			})
			.run();

		return { uploadId, status: 'failed' as const, summary };
	}

	const emailColumn = requestedEmailColumn?.trim() || detectEmailColumn(parsed.headers);
	const requestedColumnMissing = Boolean(
		requestedEmailColumn?.trim() && !parsed.headers.includes(requestedEmailColumn.trim())
	);

	if (!emailColumn || requestedColumnMissing) {
		const summary = buildFailureSummary(
			uploadId,
			file.name,
			parsed.fileType,
			requestedColumnMissing
				? `The selected email column "${requestedEmailColumn?.trim()}" was not found in the uploaded file.`
				: 'No email column was detected. Provide a column mapping and try again.',
			parsed.headers,
			parsed.rows.length
		);

		db.insert(uploads)
			.values({
				id: uploadId,
				createdByUserId: userId,
				fileName: file.name,
				fileType: parsed.fileType,
				status: 'failed',
				totalRows: parsed.rows.length,
				acceptedRows: 0,
				rejectedRows: parsed.rows.length,
				importSummary: summary
			})
			.run();

		return { uploadId, status: 'failed' as const, summary };
	}

	const candidateEmails = Array.from(
		new Set(
			parsed.rows
				.map((row) => row[emailColumn])
				.filter((value): value is string => Boolean(value))
				.map((value) => normalizeEmail(value))
				.filter((value): value is string => Boolean(value))
		)
	);

	const existingLeads = candidateEmails.length
		? db
				.select({ id: leads.id, normalizedEmail: leads.normalizedEmail })
				.from(leads)
				.where(inArray(leads.normalizedEmail, candidateEmails))
				.all()
		: [];

	const existingLeadMap = new Map(existingLeads.map((lead) => [lead.normalizedEmail, lead.id]));
	const fileSeenEmails = new Set<string>();
	const createdLeadMap = new Map<string, string>();
	const rejections: ImportRejection[] = [];
	let acceptedRows = 0;
	let linkedExistingRows = 0;
	let rejectedRows = 0;

	db.transaction((tx) => {
		tx.insert(uploads)
			.values({
				id: uploadId,
				createdByUserId: userId,
				fileName: file.name,
				fileType: parsed.fileType,
				status: 'processing',
				emailColumn,
				totalRows: parsed.rows.length,
				acceptedRows: 0,
				rejectedRows: 0,
				importSummary: null
			})
			.run();

		parsed.rows.forEach((row, index) => {
			const rowNumber = index + 1;
			const rawEmail = row[emailColumn];

			const rejectRow = (reason: string) => {
				rejectedRows += 1;
				rejections.push({ rowNumber, email: rawEmail ?? undefined, reason });
				tx.insert(uploadRows)
					.values({
						uploadId,
						rowIndex: rowNumber,
						originalEmail: rawEmail ?? null,
						normalizedEmail: null,
						payload: row,
						status: 'rejected',
						rejectionReason: reason,
						leadId: null
					})
					.run();
			};

			if (!rawEmail) {
				rejectRow('Missing email value');
				return;
			}

			const normalizedEmailValue = normalizeEmail(rawEmail);
			if (!normalizedEmailValue || !isValidEmailSyntax(normalizedEmailValue)) {
				rejectRow('Malformed email address');
				return;
			}

			if (fileSeenEmails.has(normalizedEmailValue)) {
				rejectRow('Duplicate email in the current upload');
				return;
			}

			fileSeenEmails.add(normalizedEmailValue);

			let leadId =
				existingLeadMap.get(normalizedEmailValue) ??
				createdLeadMap.get(normalizedEmailValue) ??
				null;
			let rowStatus = 'accepted';

			if (!leadId) {
				leadId = crypto.randomUUID();
				createdLeadMap.set(normalizedEmailValue, leadId);
				tx.insert(leads)
					.values({
						id: leadId,
						firstUploadId: uploadId,
						originalEmail: rawEmail.trim(),
						normalizedEmail: normalizedEmailValue,
						domain: extractDomain(normalizedEmailValue),
						mappedFields: row
					})
					.run();
			} else if (existingLeadMap.has(normalizedEmailValue)) {
				rowStatus = 'linked-existing';
				linkedExistingRows += 1;
			}

			acceptedRows += 1;
			tx.insert(uploadRows)
				.values({
					uploadId,
					rowIndex: rowNumber,
					originalEmail: rawEmail.trim(),
					normalizedEmail: normalizedEmailValue,
					payload: row,
					status: rowStatus,
					rejectionReason: null,
					leadId
				})
				.run();
		});

		const summary: ImportSummary = {
			uploadId,
			fileName: file.name,
			fileType: parsed.fileType,
			emailColumn,
			totalRows: parsed.rows.length,
			acceptedRows,
			linkedExistingRows,
			rejectedRows,
			rejections,
			availableHeaders: parsed.headers
		};

		tx.update(uploads)
			.set({
				status: 'completed',
				totalRows: parsed.rows.length,
				acceptedRows,
				rejectedRows,
				importSummary: summary,
				updatedAt: new Date()
			})
			.where(eq(uploads.id, uploadId))
			.run();
	});

	return {
		uploadId,
		status: 'completed' as const,
		summary: {
			uploadId,
			fileName: file.name,
			fileType: parsed.fileType,
			emailColumn,
			totalRows: parsed.rows.length,
			acceptedRows,
			linkedExistingRows,
			rejectedRows,
			rejections,
			availableHeaders: parsed.headers
		}
	};
};

export const listUploads = (limit = 12) =>
	db
		.select({
			id: uploads.id,
			fileName: uploads.fileName,
			fileType: uploads.fileType,
			status: uploads.status,
			emailColumn: uploads.emailColumn,
			totalRows: uploads.totalRows,
			acceptedRows: uploads.acceptedRows,
			rejectedRows: uploads.rejectedRows,
			importSummary: uploads.importSummary,
			createdAt: uploads.createdAt,
			updatedAt: uploads.updatedAt
		})
		.from(uploads)
		.orderBy(desc(uploads.createdAt))
		.limit(limit)
		.all();

export const getUploadDetails = (uploadId: string) => {
	const upload = db
		.select({
			id: uploads.id,
			fileName: uploads.fileName,
			fileType: uploads.fileType,
			status: uploads.status,
			emailColumn: uploads.emailColumn,
			totalRows: uploads.totalRows,
			acceptedRows: uploads.acceptedRows,
			rejectedRows: uploads.rejectedRows,
			importSummary: uploads.importSummary,
			createdAt: uploads.createdAt,
			updatedAt: uploads.updatedAt
		})
		.from(uploads)
		.where(eq(uploads.id, uploadId))
		.get();

	if (!upload) {
		return null;
	}

	const rows = db
		.select({
			id: uploadRows.id,
			rowIndex: uploadRows.rowIndex,
			originalEmail: uploadRows.originalEmail,
			normalizedEmail: uploadRows.normalizedEmail,
			status: uploadRows.status,
			rejectionReason: uploadRows.rejectionReason,
			payload: uploadRows.payload,
			leadId: uploadRows.leadId,
			createdAt: uploadRows.createdAt
		})
		.from(uploadRows)
		.where(eq(uploadRows.uploadId, uploadId))
		.orderBy(uploadRows.rowIndex)
		.all();

	return { ...upload, rows };
};
