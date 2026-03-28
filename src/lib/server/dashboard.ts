import { count, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { leads, uploadRows } from '$lib/server/db/schema';
import { listUploads } from './imports';
import { listVerificationRuns } from './verification';

export const getDashboardData = () => {
	const totalImportedEmails =
		db.select({ total: count() }).from(uploadRows).where(ne(uploadRows.status, 'rejected')).get()
			?.total ?? 0;
	const totalUniqueLeads = db.select({ total: count() }).from(leads).get()?.total ?? 0;
	const totalVerified =
		db.select({ total: count() }).from(leads).where(isNotNull(leads.latestVerifiedAt)).get()
			?.total ?? 0;
	const validCount =
		db.select({ total: count() }).from(leads).where(eq(leads.latestRiskLevel, 'valid')).get()
			?.total ?? 0;
	const riskyCount =
		db.select({ total: count() }).from(leads).where(eq(leads.latestRiskLevel, 'risky')).get()
			?.total ?? 0;
	const invalidCount =
		db.select({ total: count() }).from(leads).where(eq(leads.latestRiskLevel, 'invalid')).get()
			?.total ?? 0;
	const unknownCount =
		db.select({ total: count() }).from(leads).where(eq(leads.latestRiskLevel, 'unknown')).get()
			?.total ?? 0;
	const exportReadyCount = validCount;
	const duplicateAcrossUploads =
		db
			.select({ total: count() })
			.from(uploadRows)
			.where(eq(uploadRows.status, 'linked-existing'))
			.get()?.total ?? 0;

	return {
		stats: {
			totalImportedEmails,
			totalUniqueLeads,
			totalVerified,
			validCount,
			riskyCount,
			invalidCount,
			unknownCount,
			exportReadyCount,
			duplicateAcrossUploads,
			verificationCoverage:
				totalUniqueLeads === 0 ? 0 : Math.round((totalVerified / totalUniqueLeads) * 100)
		},
		recentUploads: listUploads(6),
		recentRuns: listVerificationRuns(6)
	};
};
