import { env } from '$env/dynamic/private';

const parseInteger = (value: string | undefined, fallback: number) => {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const appConfig = {
	databaseUrl: env.DATABASE_URL || './data/mailsense.db',
	publicBaseUrl: env.BETTER_AUTH_URL || env.ORIGIN || 'http://localhost:5173',
	reacherApiToken: env.REACHER_API_TOKEN || '',
	reacherBackendUrl: env.REACHER_BACKEND_URL || undefined,
	verificationPacingMs: parseInteger(env.VERIFICATION_PACING_MS, 1500),
	verificationTimeoutMs: parseInteger(env.VERIFICATION_TIMEOUT_MS, 15000),
	verificationBatchSize: parseInteger(env.VERIFICATION_BATCH_SIZE, 25),
	verificationStaleRunMinutes: parseInteger(env.VERIFICATION_STALE_RUN_MINUTES, 15),
	maxUploadBytes: parseInteger(env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024)
} as const;

export const isReacherConfigured = () =>
	Boolean(appConfig.reacherApiToken) || Boolean(appConfig.reacherBackendUrl);
