import { env } from '$env/dynamic/private';

const parseInteger = (value: string | undefined, fallback: number) => {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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

const defaultPublicBaseUrl = env.BETTER_AUTH_URL || env.ORIGIN || 'http://localhost:5173';

const deriveHelloName = (value: string) => {
	try {
		return new URL(value).hostname || 'localhost';
	} catch {
		return 'localhost';
	}
};

export const appConfig = {
	databaseUrl: env.DATABASE_URL || './data/mailsense.db',
	publicBaseUrl: defaultPublicBaseUrl,
	reacherCliPath: env.REACHER_CLI_PATH || '.reacher/bin/check_if_email_exists',
	reacherFromEmail: env.REACHER_FROM_EMAIL || undefined,
	reacherHelloName: env.REACHER_HELLO_NAME || deriveHelloName(defaultPublicBaseUrl),
	reacherSmtpPort: parseInteger(env.REACHER_SMTP_PORT, 25),
	reacherCheckGravatar: parseBoolean(env.REACHER_CHECK_GRAVATAR, false),
	verificationPacingMs: parseInteger(env.VERIFICATION_PACING_MS, 1500),
	verificationTimeoutMs: parseInteger(env.VERIFICATION_TIMEOUT_MS, 15000),
	verificationBatchSize: parseInteger(env.VERIFICATION_BATCH_SIZE, 25),
	verificationStaleRunMinutes: parseInteger(env.VERIFICATION_STALE_RUN_MINUTES, 15),
	maxUploadBytes: parseInteger(env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024)
} as const;
