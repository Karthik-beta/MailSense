import { describe, it, expect } from 'vitest';
import {
	classifyProcessError,
	classifyReacherFieldError,
	classifyAppError,
	failureClassLabel,
	failureRemediationHint,
	type FailureClass
} from '$lib/server/failure-classification';

describe('classifyProcessError', () => {
	it('classifies binary missing errors', () => {
		const result = classifyProcessError(
			new Error('Embedded Reacher CLI is unavailable. Run bun run reacher:install')
		);
		expect(result.failureClass).toBe('binary_missing');
		expect(result.isAppSide).toBe(true);
		expect(result.isInfrastructureSide).toBe(false);
	});

	it('classifies binary permission errors (EACCES)', () => {
		const result = classifyProcessError(new Error('spawn EACCES'));
		expect(result.failureClass).toBe('binary_unusable');
		expect(result.isAppSide).toBe(true);
	});

	it('classifies binary not found errors (ENOENT)', () => {
		const result = classifyProcessError(new Error('spawn ENOENT'));
		expect(result.failureClass).toBe('binary_unusable');
		expect(result.isAppSide).toBe(true);
	});

	it('classifies timeout errors', () => {
		const result = classifyProcessError(new Error('Verification timed out.'));
		expect(result.failureClass).toBe('cli_timeout');
		expect(result.isInfrastructureSide).toBe(false);
		expect(result.isAppSide).toBe(false);
	});

	it('classifies malformed output errors', () => {
		const result = classifyProcessError(
			new Error('Embedded Reacher CLI returned invalid JSON output.')
		);
		expect(result.failureClass).toBe('malformed_output');
		expect(result.isAppSide).toBe(true);
	});

	it('classifies no output errors', () => {
		const result = classifyProcessError(
			new Error('Embedded Reacher CLI returned no output.')
		);
		expect(result.failureClass).toBe('malformed_output');
	});

	it('classifies exit code errors', () => {
		const result = classifyProcessError(
			new Error('Embedded Reacher CLI failed with exit code 1.')
		);
		expect(result.failureClass).toBe('cli_invocation_failure');
		expect(result.isAppSide).toBe(true);
	});

	it('classifies signal termination errors', () => {
		const result = classifyProcessError(
			new Error('Embedded Reacher CLI failed with SIGKILL.')
		);
		expect(result.failureClass).toBe('cli_invocation_failure');
	});

	it('classifies unknown errors', () => {
		const result = classifyProcessError(new Error('Something completely unexpected'));
		expect(result.failureClass).toBe('unknown_failure');
		expect(result.isAppSide).toBe(false);
		expect(result.isInfrastructureSide).toBe(false);
	});

	it('handles non-Error inputs', () => {
		const result = classifyProcessError('string error');
		expect(result.rawError).toBe('string error');
	});
});

describe('classifyReacherFieldError', () => {
	it('classifies DNS resolution failures', () => {
		const result = classifyReacherFieldError('DnsError', 'Failed to resolve domain');
		expect(result.failureClass).toBe('dns_resolution_failure');
		expect(result.isInfrastructureSide).toBe(true);
	});

	it('classifies NXDOMAIN errors', () => {
		const result = classifyReacherFieldError('LookupError', 'NXDOMAIN');
		expect(result.failureClass).toBe('dns_resolution_failure');
	});

	it('classifies connection refused', () => {
		const result = classifyReacherFieldError('SmtpError', 'Connection refused');
		expect(result.failureClass).toBe('smtp_connection_refused');
		expect(result.isInfrastructureSide).toBe(true);
	});

	it('classifies ECONNREFUSED', () => {
		const result = classifyReacherFieldError('SmtpError', 'ECONNREFUSED');
		expect(result.failureClass).toBe('smtp_connection_refused');
	});

	it('classifies SMTP timeouts', () => {
		const result = classifyReacherFieldError('SmtpError', 'Connection timed out');
		expect(result.failureClass).toBe('smtp_timeout');
		expect(result.isInfrastructureSide).toBe(true);
	});

	it('classifies blocked/reputation issues', () => {
		const result = classifyReacherFieldError('SmtpError', 'Blocked by spamhaus');
		expect(result.failureClass).toBe('smtp_connection_refused');
	});

	it('classifies greylisting as remote_ambiguous', () => {
		const result = classifyReacherFieldError('SmtpError', 'Greylisting in effect, try again later');
		expect(result.failureClass).toBe('remote_ambiguous');
		expect(result.isInfrastructureSide).toBe(true);
	});

	it('classifies catch-all as remote_ambiguous', () => {
		const result = classifyReacherFieldError('SmtpError', 'Catch-all detected');
		expect(result.failureClass).toBe('remote_ambiguous');
	});

	it('classifies unknown field errors as remote_ambiguous', () => {
		const result = classifyReacherFieldError('SomeError', 'Some message');
		expect(result.failureClass).toBe('remote_ambiguous');
	});

	it('uses description in classification', () => {
		const result = classifyReacherFieldError('Error', 'generic', 'DNS resolution failed');
		expect(result.failureClass).toBe('dns_resolution_failure');
	});
});

describe('classifyAppError', () => {
	it('classifies app errors', () => {
		const result = classifyAppError(new Error('Database write failed'));
		expect(result.failureClass).toBe('app_error');
		expect(result.isAppSide).toBe(true);
		expect(result.rawError).toBe('Database write failed');
	});

	it('handles non-Error inputs', () => {
		const result = classifyAppError('string error');
		expect(result.rawError).toBe('string error');
	});
});

describe('failureClassLabel', () => {
	it('returns human-readable labels for all failure classes', () => {
		const classes: FailureClass[] = [
			'config_invalid', 'identity_config_invalid', 'binary_missing',
			'binary_unusable', 'cli_invocation_failure', 'cli_timeout',
			'malformed_output', 'dns_resolution_failure', 'no_mx_or_smtp_target',
			'smtp_connection_refused', 'smtp_timeout', 'remote_ambiguous',
			'app_error', 'unknown_failure'
		];
		for (const fc of classes) {
			const label = failureClassLabel(fc);
			expect(typeof label).toBe('string');
			expect(label.length).toBeGreaterThan(0);
		}
	});
});

describe('failureRemediationHint', () => {
	it('returns hints for all failure classes', () => {
		const classes: FailureClass[] = [
			'config_invalid', 'identity_config_invalid', 'binary_missing',
			'binary_unusable', 'cli_invocation_failure', 'cli_timeout',
			'malformed_output', 'dns_resolution_failure', 'no_mx_or_smtp_target',
			'smtp_connection_refused', 'smtp_timeout', 'remote_ambiguous',
			'app_error', 'unknown_failure'
		];
		for (const fc of classes) {
			const hint = failureRemediationHint(fc);
			expect(typeof hint).toBe('string');
			expect(hint.length).toBeGreaterThan(0);
		}
	});
});
