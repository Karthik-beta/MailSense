import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ImportSummary, VerificationRunSnapshot } from '$lib/types';
import { user } from './auth.schema';

const nowSql = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;
const timestampMs = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const uploads = sqliteTable(
	'uploads',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		fileName: text('file_name').notNull(),
		fileType: text('file_type').notNull(),
		status: text('status').notNull().default('completed'),
		emailColumn: text('email_column'),
		totalRows: integer('total_rows').notNull().default(0),
		acceptedRows: integer('accepted_rows').notNull().default(0),
		rejectedRows: integer('rejected_rows').notNull().default(0),
		importSummary: text('import_summary', { mode: 'json' }).$type<ImportSummary | null>(),
		createdAt: timestampMs('created_at').default(nowSql).notNull(),
		updatedAt: timestampMs('updated_at')
			.default(nowSql)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('uploads_created_by_user_id_idx').on(table.createdByUserId),
		index('uploads_created_at_idx').on(table.createdAt)
	]
);

export const leads = sqliteTable(
	'leads',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		firstUploadId: text('first_upload_id').references(() => uploads.id, { onDelete: 'set null' }),
		originalEmail: text('original_email').notNull(),
		normalizedEmail: text('normalized_email').notNull(),
		domain: text('domain').notNull(),
		mappedFields: text('mapped_fields', { mode: 'json' }).$type<Record<
			string,
			string | null
		> | null>(),
		latestVerificationStatus: text('latest_verification_status'),
		latestRiskLevel: text('latest_risk_level'),
		latestReason: text('latest_reason'),
		latestVerifiedAt: timestampMs('latest_verified_at'),
		createdAt: timestampMs('created_at').default(nowSql).notNull(),
		updatedAt: timestampMs('updated_at')
			.default(nowSql)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('leads_normalized_email_idx').on(table.normalizedEmail),
		index('leads_domain_idx').on(table.domain),
		index('leads_status_idx').on(table.latestVerificationStatus),
		index('leads_risk_idx').on(table.latestRiskLevel)
	]
);

export const uploadRows = sqliteTable(
	'upload_rows',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		uploadId: text('upload_id')
			.notNull()
			.references(() => uploads.id, { onDelete: 'cascade' }),
		rowIndex: integer('row_index').notNull(),
		originalEmail: text('original_email'),
		normalizedEmail: text('normalized_email'),
		payload: text('payload', { mode: 'json' }).$type<Record<string, string | null>>(),
		status: text('status').notNull(),
		rejectionReason: text('rejection_reason'),
		leadId: text('lead_id').references(() => leads.id, { onDelete: 'set null' }),
		createdAt: timestampMs('created_at').default(nowSql).notNull()
	},
	(table) => [
		uniqueIndex('upload_rows_upload_row_idx').on(table.uploadId, table.rowIndex),
		index('upload_rows_upload_id_idx').on(table.uploadId),
		index('upload_rows_lead_id_idx').on(table.leadId)
	]
);

export const verificationRuns = sqliteTable(
	'verification_runs',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('pending'),
		source: text('source').notNull().default('filter'),
		filterSnapshot: text('filter_snapshot', {
			mode: 'json'
		}).$type<VerificationRunSnapshot | null>(),
		totalLeads: integer('total_leads').notNull().default(0),
		processedCount: integer('processed_count').notNull().default(0),
		validCount: integer('valid_count').notNull().default(0),
		riskyCount: integer('risky_count').notNull().default(0),
		invalidCount: integer('invalid_count').notNull().default(0),
		unknownCount: integer('unknown_count').notNull().default(0),
		failedCount: integer('failed_count').notNull().default(0),
		startedAt: timestampMs('started_at'),
		completedAt: timestampMs('completed_at'),
		heartbeatAt: timestampMs('heartbeat_at'),
		errorMessage: text('error_message'),
		createdAt: timestampMs('created_at').default(nowSql).notNull(),
		updatedAt: timestampMs('updated_at')
			.default(nowSql)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('verification_runs_created_by_user_id_idx').on(table.createdByUserId),
		index('verification_runs_status_idx').on(table.status),
		index('verification_runs_created_at_idx').on(table.createdAt)
	]
);

export const leadVerifications = sqliteTable(
	'lead_verifications',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		leadId: text('lead_id')
			.notNull()
			.references(() => leads.id, { onDelete: 'cascade' }),
		runId: text('run_id').references(() => verificationRuns.id, { onDelete: 'set null' }),
		engine: text('engine').notNull().default('reacher'),
		verificationStatus: text('verification_status').notNull(),
		riskLevel: text('risk_level').notNull(),
		reason: text('reason').notNull(),
		technicalFailure: integer('technical_failure', { mode: 'boolean' }).notNull().default(false),
		details: text('details', { mode: 'json' }).$type<Record<string, unknown> | null>(),
		verifiedAt: timestampMs('verified_at').notNull(),
		createdAt: timestampMs('created_at').default(nowSql).notNull()
	},
	(table) => [
		index('lead_verifications_lead_id_idx').on(table.leadId),
		index('lead_verifications_run_id_idx').on(table.runId),
		index('lead_verifications_verified_at_idx').on(table.verifiedAt)
	]
);

export * from './auth.schema';
