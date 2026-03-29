/**
 * Structured failure classification for Reacher verification.
 *
 * This layer describes WHY the app could not get a useful answer.
 * It does NOT replace or reinterpret Reacher's mailbox verdicts.
 * It does NOT invent a "valid/invalid" answer when Reacher could not determine one.
 */

export const failureClasses = [
	'config_invalid',
	'identity_config_invalid',
	'binary_missing',
	'binary_unusable',
	'cli_invocation_failure',
	'cli_timeout',
	'malformed_output',
	'dns_resolution_failure',
	'no_mx_or_smtp_target',
	'smtp_connection_refused',
	'smtp_timeout',
	'remote_ambiguous',
	'app_error',
	'unknown_failure'
] as const;

export type FailureClass = (typeof failureClasses)[number];

export type ClassifiedFailure = {
	failureClass: FailureClass;
	summary: string;
	rawError: string;
	isAppSide: boolean;
	isInfrastructureSide: boolean;
};

const APP_SIDE: Pick<ClassifiedFailure, 'isAppSide' | 'isInfrastructureSide'> = {
	isAppSide: true,
	isInfrastructureSide: false
};

const INFRA_SIDE: Pick<ClassifiedFailure, 'isAppSide' | 'isInfrastructureSide'> = {
	isAppSide: false,
	isInfrastructureSide: true
};

const AMBIGUOUS_SIDE: Pick<ClassifiedFailure, 'isAppSide' | 'isInfrastructureSide'> = {
	isAppSide: false,
	isInfrastructureSide: false
};

/**
 * Classify a process-level error (thrown before or during Reacher execution).
 */
export const classifyProcessError = (error: unknown): ClassifiedFailure => {
	const message = error instanceof Error ? error.message : String(error);
	const lower = message.toLowerCase();

	if (lower.includes('unavailable') || lower.includes('not installed') || lower.includes('reacher:install')) {
		return { failureClass: 'binary_missing', summary: 'Reacher CLI binary is not installed.', rawError: message, ...APP_SIDE };
	}

	if (lower.includes('enoent') || lower.includes('eacces') || lower.includes('eperm') || lower.includes('permission denied')) {
		return { failureClass: 'binary_unusable', summary: 'Reacher CLI binary exists but cannot be executed.', rawError: message, ...APP_SIDE };
	}

	if (lower.includes('timed out') || lower.includes('timeout')) {
		return { failureClass: 'cli_timeout', summary: 'Verification process timed out before Reacher returned a result.', rawError: message, ...INFRA_SIDE };
	}

	if (lower.includes('invalid json') || lower.includes('no output') || lower.includes('unexpected json') || lower.includes('returned invalid output')) {
		return { failureClass: 'malformed_output', summary: 'Reacher CLI returned output that could not be parsed.', rawError: message, ...APP_SIDE };
	}

	if (lower.includes('exit code') || lower.includes('failed with')) {
		return { failureClass: 'cli_invocation_failure', summary: 'Reacher CLI exited with an error status.', rawError: message, ...APP_SIDE };
	}

	return { failureClass: 'unknown_failure', summary: 'Verification failed for an unclassified reason.', rawError: message, ...AMBIGUOUS_SIDE };
};

/**
 * Classify a Reacher field-level core error (from the structured JSON output).
 * These occur when Reacher returns a result but individual fields report errors.
 */
export const classifyReacherFieldError = (
	errorType: string,
	errorMessage: string,
	description?: string | null
): ClassifiedFailure => {
	const combined = `${errorType} ${errorMessage} ${description ?? ''}`.toLowerCase();

	if (combined.includes('dns') || combined.includes('resolve') || combined.includes('nxdomain') || combined.includes('no record')) {
		return { failureClass: 'dns_resolution_failure', summary: 'DNS resolution failed for the target domain.', rawError: `${errorType}: ${errorMessage}`, ...INFRA_SIDE };
	}

	if (combined.includes('no mx') || combined.includes('mx') && combined.includes('empty')) {
		return { failureClass: 'no_mx_or_smtp_target', summary: 'No MX records found for the target domain.', rawError: `${errorType}: ${errorMessage}`, ...INFRA_SIDE };
	}

	if (combined.includes('connection refused') || combined.includes('connrefused') || combined.includes('econnrefused')) {
		return { failureClass: 'smtp_connection_refused', summary: 'SMTP connection was actively refused.', rawError: `${errorType}: ${errorMessage}`, ...INFRA_SIDE };
	}

	if (combined.includes('timeout') || combined.includes('timed out') || combined.includes('timedout')) {
		return { failureClass: 'smtp_timeout', summary: 'SMTP connection timed out reaching the remote server.', rawError: `${errorType}: ${errorMessage}`, ...INFRA_SIDE };
	}

	if (combined.includes('blocked') || combined.includes('blacklist') || combined.includes('banned') || combined.includes('denied') || combined.includes('rejected') || combined.includes('spamhaus')) {
		return { failureClass: 'smtp_connection_refused', summary: 'SMTP connection was rejected, possibly due to IP or domain reputation.', rawError: `${errorType}: ${errorMessage}`, ...INFRA_SIDE };
	}

	if (combined.includes('catch') || combined.includes('unknown') || combined.includes('greylist') || combined.includes('tempfail') || combined.includes('try again')) {
		return { failureClass: 'remote_ambiguous', summary: 'Remote server gave an ambiguous or inconclusive response.', rawError: `${errorType}: ${errorMessage}`, ...INFRA_SIDE };
	}

	return { failureClass: 'remote_ambiguous', summary: 'Reacher reported a field-level error with no specific classification.', rawError: `${errorType}: ${errorMessage}`, ...AMBIGUOUS_SIDE };
};

/**
 * Classify an app-side error (persistence, state transitions, etc.).
 */
export const classifyAppError = (error: unknown): ClassifiedFailure => {
	const message = error instanceof Error ? error.message : String(error);
	return { failureClass: 'app_error', summary: 'An application error occurred during result processing.', rawError: message, ...APP_SIDE };
};

/**
 * Human-readable label for a failure class.
 */
export const failureClassLabel = (fc: FailureClass): string => {
	const labels: Record<FailureClass, string> = {
		config_invalid: 'Invalid configuration',
		identity_config_invalid: 'Invalid identity configuration',
		binary_missing: 'Reacher binary missing',
		binary_unusable: 'Reacher binary unusable',
		cli_invocation_failure: 'CLI invocation failure',
		cli_timeout: 'Process timeout',
		malformed_output: 'Malformed CLI output',
		dns_resolution_failure: 'DNS resolution failure',
		no_mx_or_smtp_target: 'No MX / SMTP target',
		smtp_connection_refused: 'SMTP connection refused',
		smtp_timeout: 'SMTP timeout',
		remote_ambiguous: 'Remote ambiguous response',
		app_error: 'Application error',
		unknown_failure: 'Unknown failure'
	};
	return labels[fc];
};

/**
 * Suggest the likely remediation layer for a failure class.
 */
export const failureRemediationHint = (fc: FailureClass): string => {
	const hints: Record<FailureClass, string> = {
		config_invalid: 'Fix environment variables.',
		identity_config_invalid: 'Fix REACHER_FROM_EMAIL / REACHER_HELLO_NAME configuration.',
		binary_missing: 'Run bun run reacher:install or rebuild the app.',
		binary_unusable: 'Check file permissions on the Reacher binary.',
		cli_invocation_failure: 'Check Reacher CLI compatibility and logs.',
		cli_timeout: 'Increase VERIFICATION_TIMEOUT_MS or check network latency.',
		malformed_output: 'Check Reacher CLI version compatibility.',
		dns_resolution_failure: 'Check DNS configuration for the target domain.',
		no_mx_or_smtp_target: 'The target domain may not accept email.',
		smtp_connection_refused: 'Outbound SMTP may be blocked, or the remote server refused the connection.',
		smtp_timeout: 'Increase VERIFICATION_TIMEOUT_MS or check if outbound port 25 is reachable.',
		remote_ambiguous: 'The remote server gave an inconclusive response. Consider retrying or testing from a different network.',
		app_error: 'Fix application code or database state.',
		unknown_failure: 'Review logs for more detail.'
	};
	return hints[fc];
};
