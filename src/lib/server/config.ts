import { env } from '$env/dynamic/private';

const parseInteger = (value: string | undefined, fallback: number) => {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const stripProtocol = (value: string) => value.replace(/^https?:\/\//, '');

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const parseBoolean = (value: string | undefined, fallback = false) => {
	if (!value) {
		return fallback;
	}

	const normalized = value.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) {
		return true;
	}

	if (['0', 'false', 'no', 'off'].includes(normalized)) {
		return false;
	}

	return fallback;
};

const railwayPublicBaseUrl = env.RAILWAY_PUBLIC_DOMAIN
	? `https://${stripTrailingSlash(stripProtocol(env.RAILWAY_PUBLIC_DOMAIN))}`
	: undefined;

const railwayVolumeDatabaseUrl = env.RAILWAY_VOLUME_MOUNT_PATH
	? `${stripTrailingSlash(env.RAILWAY_VOLUME_MOUNT_PATH)}/mailsense.db`
	: undefined;

const defaultPublicBaseUrl =
	env.BETTER_AUTH_URL || env.ORIGIN || railwayPublicBaseUrl || 'http://localhost:5173';

const defaultDatabaseUrl = env.DATABASE_URL || railwayVolumeDatabaseUrl || './data/mailsense.db';

export const appConfig = {
	databaseUrl: defaultDatabaseUrl,
	publicBaseUrl: defaultPublicBaseUrl,
	reacherCliPath: env.REACHER_CLI_PATH || '.reacher/bin/check_if_email_exists',
	reacherFromEmail: env.REACHER_FROM_EMAIL || undefined,
	reacherHelloName: env.REACHER_HELLO_NAME || undefined,
	reacherSmtpPort: parseInteger(env.REACHER_SMTP_PORT, 25),
	reacherCheckGravatar: parseBoolean(env.REACHER_CHECK_GRAVATAR, false),
	verificationPacingMs: parseInteger(env.VERIFICATION_PACING_MS, 1500),
	verificationTimeoutMs: parseInteger(env.VERIFICATION_TIMEOUT_MS, 30000),
	verificationBatchSize: parseInteger(env.VERIFICATION_BATCH_SIZE, 25),
	verificationStaleRunMinutes: parseInteger(env.VERIFICATION_STALE_RUN_MINUTES, 15),
	maxUploadBytes: parseInteger(env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024)
} as const;
