import { count, desc, eq, sql } from 'drizzle-orm';
import { appConfig } from '$lib/server/config';
import {
	runEmbeddedReacher,
	type ReacherCliOutput,
	type ReacherCoreError,
	type ReacherMiscDetails,
	type ReacherOutputField,
	type ReacherSmtpDetails,
	type ReacherWrappedError
} from '$lib/server/reacher-cli';
import {
	classifyProcessError,
	classifyReacherFieldError,
	type ClassifiedFailure
} from '$lib/server/failure-classification';
import type {
	LeadFilters,
	RiskLevel,
	VerificationRunSnapshot,
	VerificationStatus
} from '$lib/types';
import { db } from '$lib/server/db';
import { leadVerifications, leads, verificationRuns } from '$lib/server/db/schema';
import { extractDomain, isValidEmailSyntax, normalizeEmail } from './email';
import { findLeadByNormalizedEmail, listLeadIds } from './leads';

type VerificationDecision = {
	verificationStatus: VerificationStatus;
	riskLevel: RiskLevel;
	reason: string;
	details: Record<string, unknown>;
	technicalFailure: boolean;
	failureClassification?: ClassifiedFailure | null;
};

const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

const maskEmail = (email: string) => {
	const [local, domain] = email.split('@');
	if (!local || !domain) return '***';
	return `${local[0]}***@${domain}`;
};

const logVerification = (
	phase: string,
	data: Record<string, unknown>
) => {
	console.log(JSON.stringify({ component: 'verification', phase, ts: new Date().toISOString(), ...data }));
};

const syncRunMetrics = (runId: string) => {
	const metrics = db
		.select({
			processedCount: count(),
			validCount: sql<number>`sum(case when ${leadVerifications.riskLevel} = 'valid' then 1 else 0 end)`,
			riskyCount: sql<number>`sum(case when ${leadVerifications.riskLevel} = 'risky' then 1 else 0 end)`,
			invalidCount: sql<number>`sum(case when ${leadVerifications.riskLevel} = 'invalid' then 1 else 0 end)`,
			unknownCount: sql<number>`sum(case when ${leadVerifications.riskLevel} = 'unknown' then 1 else 0 end)`,
			failedCount: sql<number>`sum(case when ${leadVerifications.technicalFailure} = 1 then 1 else 0 end)`
		})
		.from(leadVerifications)
		.where(eq(leadVerifications.runId, runId))
		.get();

	db.update(verificationRuns)
		.set({
			processedCount: metrics?.processedCount ?? 0,
			validCount: metrics?.validCount ?? 0,
			riskyCount: metrics?.riskyCount ?? 0,
			invalidCount: metrics?.invalidCount ?? 0,
			unknownCount: metrics?.unknownCount ?? 0,
			failedCount: metrics?.failedCount ?? 0,
			heartbeatAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(verificationRuns.id, runId))
		.run();
};

const isCoreError = (value: unknown): value is ReacherCoreError => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	return 'type' in value && 'message' in value;
};

const isWrappedCoreError = (value: unknown): value is ReacherWrappedError => {
	if (!value || typeof value !== 'object' || !('error' in value)) {
		return false;
	}

	return isCoreError(value.error);
};

const extractCoreError = (value: unknown) => {
	if (isCoreError(value)) {
		return value;
	}

	if (isWrappedCoreError(value)) {
		return value.error;
	}

	return null;
};

const extractCoreErrorDescription = (value: unknown) => {
	if (isWrappedCoreError(value) && typeof value.description === 'string') {
		return value.description;
	}

	return null;
};

const hasFieldError = <T>(
	value: ReacherOutputField<T>
): value is ReacherCoreError | ReacherWrappedError =>
	isCoreError(value) || isWrappedCoreError(value);

const mapVerificationResult = (result: ReacherCliOutput): VerificationDecision => {
	const misc: ReacherMiscDetails | null = hasFieldError(result.misc) ? null : result.misc;
	const smtp: ReacherSmtpDetails | null = hasFieldError(result.smtp) ? null : result.smtp;
	const coreErrors = [result.misc, result.mx, result.smtp]
		.map(extractCoreError)
		.filter((value): value is ReacherCoreError => Boolean(value));
	const coreErrorDescriptions = [result.misc, result.mx, result.smtp]
		.map(extractCoreErrorDescription)
		.filter((value): value is string => Boolean(value));
	const firstFailureReason = coreErrorDescriptions[0] ?? coreErrors[0]?.message;
	const details = {
		integration: 'embedded-reacher-cli',
		input: result.input,
		reachable: result.is_reachable,
		syntax: result.syntax,
		misc: result.misc,
		mx: result.mx,
		smtp: result.smtp,
		debug: result.debug ?? null
	};

	if (!result.syntax.is_valid_syntax) {
		return {
			verificationStatus: 'invalid',
			riskLevel: 'invalid',
			reason: 'Invalid email syntax',
			details,
			technicalFailure: false,
			failureClassification: null
		};
	}

	if (result.is_reachable === 'invalid') {
		const reason =
			firstFailureReason ||
			(smtp?.is_disabled ? 'Mailbox is disabled' : 'Mailbox is not reachable');
		return {
			verificationStatus: 'invalid',
			riskLevel: 'invalid',
			reason,
			details,
			technicalFailure: false,
			failureClassification: null
		};
	}

	const riskSignals: string[] = [];
	if (misc?.is_disposable) {
		riskSignals.push('Disposable mailbox');
	}
	if (misc?.is_role_account) {
		riskSignals.push('Role-based mailbox');
	}
	if (misc?.is_b2c) {
		riskSignals.push('Consumer mailbox');
	}
	if (smtp?.is_catch_all) {
		riskSignals.push('Catch-all mailbox');
	}
	if (smtp?.has_full_inbox) {
		riskSignals.push('Inbox reported as full');
	}

	if (result.is_reachable === 'safe') {
		return {
			verificationStatus: 'safe',
			riskLevel: riskSignals.length > 0 ? 'risky' : 'valid',
			reason: riskSignals[0] ?? 'Mailbox appears reachable',
			details,
			technicalFailure: false,
			failureClassification: null
		};
	}

	if (result.is_reachable === 'risky') {
		return {
			verificationStatus: 'risky',
			riskLevel: 'risky',
			reason: riskSignals[0] ?? firstFailureReason ?? 'Verification returned a risky result',
			details,
			technicalFailure: false,
			failureClassification: null
		};
	}

	return {
		verificationStatus: 'unknown',
		riskLevel: 'unknown',
		reason: firstFailureReason ?? 'Verification was inconclusive',
		details,
		technicalFailure: coreErrors.length > 0,
		failureClassification: coreErrors.length > 0
			? classifyReacherFieldError(
				coreErrors[0].type,
				coreErrors[0].message,
				coreErrorDescriptions[0] ?? null
			)
			: null
	};
};

const runReacherVerification = async (email: string) => {
	logVerification('attempt_start', {
		email: maskEmail(email),
		timeoutMs: appConfig.verificationTimeoutMs,
		fromEmail: appConfig.reacherFromEmail ? maskEmail(appConfig.reacherFromEmail) : null,
		helloName: appConfig.reacherHelloName ?? null,
		smtpPort: appConfig.reacherSmtpPort
	});

	try {
		const result = await runEmbeddedReacher(email);
		const decision = mapVerificationResult(result);

		logVerification('attempt_complete', {
			email: maskEmail(email),
			reachable: result.is_reachable,
			status: decision.verificationStatus,
			riskLevel: decision.riskLevel,
			technicalFailure: decision.technicalFailure,
			failureClass: decision.failureClassification?.failureClass ?? null
		});

		return decision;
	} catch (error) {
		const classification = classifyProcessError(error);

		logVerification('attempt_error', {
			email: maskEmail(email),
			failureClass: classification.failureClass,
			summary: classification.summary,
			isAppSide: classification.isAppSide,
			isInfrastructureSide: classification.isInfrastructureSide
		});

		throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
			classification
		});
	}
};

const persistLeadVerification = (
	leadId: string,
	runId: string | null,
	decision: VerificationDecision,
	verifiedAt: Date
) => {
	const verificationId = crypto.randomUUID();

	db.transaction((tx) => {
		tx.insert(leadVerifications)
			.values({
				id: verificationId,
				leadId,
				runId,
				engine: 'reacher',
				verificationStatus: decision.verificationStatus,
				riskLevel: decision.riskLevel,
				reason: decision.reason,
				technicalFailure: decision.technicalFailure,
				details: decision.details,
				verifiedAt
			})
			.run();

		tx.update(leads)
			.set({
				latestVerificationStatus: decision.verificationStatus,
				latestRiskLevel: decision.riskLevel,
				latestReason: decision.reason,
				latestVerifiedAt: verifiedAt,
				updatedAt: new Date()
			})
			.where(eq(leads.id, leadId))
			.run();
	});

	return verificationId;
};

const incrementRunMetrics = (runId: string, decision: VerificationDecision) => {
	const updates: Record<string, unknown> = {
		processedCount: sql`${verificationRuns.processedCount} + 1`,
		heartbeatAt: new Date(),
		updatedAt: new Date()
	};

	if (decision.riskLevel === 'valid') {
		updates.validCount = sql`${verificationRuns.validCount} + 1`;
	}

	if (decision.riskLevel === 'risky') {
		updates.riskyCount = sql`${verificationRuns.riskyCount} + 1`;
	}

	if (decision.riskLevel === 'invalid') {
		updates.invalidCount = sql`${verificationRuns.invalidCount} + 1`;
	}

	if (decision.riskLevel === 'unknown') {
		updates.unknownCount = sql`${verificationRuns.unknownCount} + 1`;
	}

	if (decision.technicalFailure) {
		updates.failedCount = sql`${verificationRuns.failedCount} + 1`;
	}

	db.update(verificationRuns).set(updates).where(eq(verificationRuns.id, runId)).run();
};

const getRunRecord = (runId: string) =>
	db
		.select({
			id: verificationRuns.id,
			createdByUserId: verificationRuns.createdByUserId,
			status: verificationRuns.status,
			source: verificationRuns.source,
			filterSnapshot: verificationRuns.filterSnapshot,
			totalLeads: verificationRuns.totalLeads,
			processedCount: verificationRuns.processedCount,
			validCount: verificationRuns.validCount,
			riskyCount: verificationRuns.riskyCount,
			invalidCount: verificationRuns.invalidCount,
			unknownCount: verificationRuns.unknownCount,
			failedCount: verificationRuns.failedCount,
			startedAt: verificationRuns.startedAt,
			completedAt: verificationRuns.completedAt,
			heartbeatAt: verificationRuns.heartbeatAt,
			errorMessage: verificationRuns.errorMessage,
			createdAt: verificationRuns.createdAt,
			updatedAt: verificationRuns.updatedAt
		})
		.from(verificationRuns)
		.where(eq(verificationRuns.id, runId))
		.get();

export const listVerificationRuns = (limit = 10) =>
	db
		.select({
			id: verificationRuns.id,
			status: verificationRuns.status,
			source: verificationRuns.source,
			totalLeads: verificationRuns.totalLeads,
			processedCount: verificationRuns.processedCount,
			validCount: verificationRuns.validCount,
			riskyCount: verificationRuns.riskyCount,
			invalidCount: verificationRuns.invalidCount,
			unknownCount: verificationRuns.unknownCount,
			failedCount: verificationRuns.failedCount,
			startedAt: verificationRuns.startedAt,
			completedAt: verificationRuns.completedAt,
			heartbeatAt: verificationRuns.heartbeatAt,
			errorMessage: verificationRuns.errorMessage,
			createdAt: verificationRuns.createdAt,
			updatedAt: verificationRuns.updatedAt
		})
		.from(verificationRuns)
		.orderBy(desc(verificationRuns.createdAt))
		.limit(limit)
		.all();

export const getVerificationRun = (runId: string) => getRunRecord(runId);

export const createVerificationRun = ({
	createdByUserId,
	filters,
	leadIds,
	source = 'filter'
}: {
	createdByUserId: string;
	filters?: LeadFilters;
	leadIds?: string[];
	source?: 'filter' | 'manual';
}) => {
	const uniqueLeadIds = Array.from(
		new Set((leadIds?.length ? leadIds : listLeadIds(filters ?? {})).filter(Boolean))
	);
	const filterSnapshot: VerificationRunSnapshot = {
		leadIds: uniqueLeadIds,
		filters: filters ?? {},
		uploadId: filters?.uploadId ?? null
	};

	const runId = crypto.randomUUID();
	db.insert(verificationRuns)
		.values({
			id: runId,
			createdByUserId,
			status: uniqueLeadIds.length > 0 ? 'pending' : 'completed',
			source,
			filterSnapshot,
			totalLeads: uniqueLeadIds.length,
			processedCount: 0,
			validCount: 0,
			riskyCount: 0,
			invalidCount: 0,
			unknownCount: 0,
			failedCount: 0,
			completedAt: uniqueLeadIds.length > 0 ? null : new Date()
		})
		.run();

	return getRunRecord(runId);
};

export const verifySingleEmail = async (email: string) => {
	const normalizedEmailValue = normalizeEmail(email);
	if (!normalizedEmailValue || !isValidEmailSyntax(normalizedEmailValue)) {
		throw new Error('Enter a valid email address.');
	}

	let lead = findLeadByNormalizedEmail(normalizedEmailValue);
	if (!lead) {
		const leadId = crypto.randomUUID();
		db.insert(leads)
			.values({
				id: leadId,
				firstUploadId: null,
				originalEmail: email.trim(),
				normalizedEmail: normalizedEmailValue,
				domain: extractDomain(normalizedEmailValue),
				mappedFields: { source: 'manual', email: email.trim() }
			})
			.run();
		lead = findLeadByNormalizedEmail(normalizedEmailValue);
	}

	if (!lead) {
		throw new Error('Unable to create a lead record for manual verification.');
	}

	let decision: VerificationDecision;
	try {
		decision = await runReacherVerification(normalizedEmailValue);
	} catch (error) {
		const classification = (error as { classification?: ClassifiedFailure }).classification
			?? classifyProcessError(error);
		decision = {
			verificationStatus: 'unknown',
			riskLevel: 'unknown',
			reason: error instanceof Error ? error.message : 'Verification failed.',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error',
				failureClass: classification.failureClass,
				failureSummary: classification.summary,
				isAppSide: classification.isAppSide,
				isInfrastructureSide: classification.isInfrastructureSide
			},
			technicalFailure: true,
			failureClassification: classification
		};
	}

	const verifiedAt = new Date();
	persistLeadVerification(lead.id, null, decision, verifiedAt);

	return {
		leadId: lead.id,
		email: normalizedEmailValue,
		...decision,
		verifiedAt
	};
};

export const processVerificationRun = async (runId: string) => {
	logVerification('run_chunk_start', { runId });

	const run = getRunRecord(runId);
	if (!run) {
		throw new Error('Verification run not found.');
	}

	if (run.status === 'completed') {
		return run;
	}

	const staleCutoff = Date.now() - appConfig.verificationStaleRunMinutes * 60_000;
	if (
		run.status === 'processing' &&
		run.heartbeatAt &&
		new Date(run.heartbeatAt).getTime() > staleCutoff
	) {
		return run;
	}

	const snapshot = run.filterSnapshot as VerificationRunSnapshot | null;
	const leadIds = snapshot?.leadIds ?? [];
	if (leadIds.length === 0) {
		db.update(verificationRuns)
			.set({
				status: 'completed',
				completedAt: new Date(),
				heartbeatAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(verificationRuns.id, runId))
			.run();
		return getRunRecord(runId);
	}

	db.update(verificationRuns)
		.set({
			status: 'processing',
			startedAt: run.startedAt ?? new Date(),
			heartbeatAt: new Date(),
			errorMessage: null,
			updatedAt: new Date()
		})
		.where(eq(verificationRuns.id, runId))
		.run();

	const processedLeadIds = db
		.select({ leadId: leadVerifications.leadId })
		.from(leadVerifications)
		.where(eq(leadVerifications.runId, runId))
		.all()
		.map((row) => row.leadId);

	const remainingLeadIds = leadIds.filter((leadId) => !processedLeadIds.includes(leadId));
	const currentBatch = remainingLeadIds.slice(0, appConfig.verificationBatchSize);

	try {
		for (let index = 0; index < currentBatch.length; index += 1) {
			const leadId = currentBatch[index];
			const lead = db
				.select({ id: leads.id, normalizedEmail: leads.normalizedEmail })
				.from(leads)
				.where(eq(leads.id, leadId))
				.get();

			if (!lead) {
				const fallbackDecision: VerificationDecision = {
					verificationStatus: 'unknown',
					riskLevel: 'unknown',
					reason: 'Lead record was missing when the run resumed.',
					details: { error: 'missing_lead' },
					technicalFailure: true,
					failureClassification: { failureClass: 'app_error', summary: 'Lead record was missing.', rawError: 'missing_lead', isAppSide: true, isInfrastructureSide: false }
				};
				persistLeadVerification(leadId, runId, fallbackDecision, new Date());
				incrementRunMetrics(runId, fallbackDecision);
				continue;
			}

			let decision: VerificationDecision;
			try {
				decision = await runReacherVerification(lead.normalizedEmail);
			} catch (error) {
				const classification = (error as { classification?: ClassifiedFailure }).classification
					?? classifyProcessError(error);
				decision = {
					verificationStatus: 'unknown',
					riskLevel: 'unknown',
					reason: error instanceof Error ? error.message : 'Verification failed.',
					details: {
						error: error instanceof Error ? error.message : 'Unknown error',
						input: lead.normalizedEmail,
						failureClass: classification.failureClass,
						failureSummary: classification.summary,
						isAppSide: classification.isAppSide,
						isInfrastructureSide: classification.isInfrastructureSide
					},
					technicalFailure: true,
					failureClassification: classification
				};
			}

			persistLeadVerification(lead.id, runId, decision, new Date());
			incrementRunMetrics(runId, decision);

			if (index < currentBatch.length - 1) {
				await sleep(appConfig.verificationPacingMs);
			}
		}
	} catch (error) {
		db.update(verificationRuns)
			.set({
				status: 'retryable',
				errorMessage: error instanceof Error ? error.message : 'The run stopped unexpectedly.',
				heartbeatAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(verificationRuns.id, runId))
			.run();

		return getRunRecord(runId);
	}

	syncRunMetrics(runId);

	const refreshedRun = getRunRecord(runId);
	if (!refreshedRun) {
		throw new Error('Verification run could not be reloaded after processing.');
	}

	const isComplete = refreshedRun.processedCount >= refreshedRun.totalLeads;
	db.update(verificationRuns)
		.set({
			status: isComplete ? 'completed' : 'processing',
			completedAt: isComplete ? new Date() : null,
			heartbeatAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(verificationRuns.id, runId))
		.run();

	logVerification('run_chunk_complete', {
		runId,
		processedCount: refreshedRun.processedCount,
		totalLeads: refreshedRun.totalLeads,
		isComplete
	});

	return getRunRecord(runId);
};

export const getLatestFailureInfo = () => {
	const row = db
		.select({
			reason: leadVerifications.reason,
			details: leadVerifications.details,
			verifiedAt: leadVerifications.verifiedAt
		})
		.from(leadVerifications)
		.where(eq(leadVerifications.technicalFailure, true))
		.orderBy(desc(leadVerifications.verifiedAt))
		.limit(1)
		.get();

	if (!row) return null;
	const details = row.details as Record<string, unknown> | null;
	return {
		reason: row.reason,
		failureClass: (details?.failureClass as string) ?? null,
		failureSummary: (details?.failureSummary as string) ?? null,
		isAppSide: (details?.isAppSide as boolean) ?? null,
		isInfrastructureSide: (details?.isInfrastructureSide as boolean) ?? null,
		verifiedAt: row.verifiedAt
	};
};
