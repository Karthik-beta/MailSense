import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { appConfig } from '$lib/server/config';

export type ReacherCoreError = {
	type: string;
	message: string;
};

export type ReacherWrappedError = {
	error: ReacherCoreError;
	description?: string | null;
};

export type ReacherOutputField<T> = T | ReacherCoreError | ReacherWrappedError;

export type ReacherMiscDetails = {
	is_disposable: boolean;
	is_role_account: boolean;
	is_b2c: boolean;
	gravatar_url?: string | null;
	haveibeenpwned?: unknown;
};

export type ReacherMxDetails = {
	accepts_mail: boolean;
	records: string[];
};

export type ReacherSmtpDetails = {
	can_connect_smtp: boolean;
	has_full_inbox: boolean;
	is_catch_all: boolean;
	is_deliverable: boolean;
	is_disabled: boolean;
};

export type ReacherSyntaxDetails = {
	address?: string | null;
	username?: string;
	domain?: string;
	normalized?: string | null;
	suggestion?: string | null;
	is_valid_syntax: boolean;
};

export type ReacherCliOutput = {
	input: string;
	is_reachable: 'safe' | 'risky' | 'invalid' | 'unknown';
	syntax: ReacherSyntaxDetails;
	misc: ReacherOutputField<ReacherMiscDetails>;
	mx: ReacherOutputField<ReacherMxDetails>;
	smtp: ReacherOutputField<ReacherSmtpDetails>;
	debug?: Record<string, unknown> | null;
};

const getBinaryPath = () => resolve(process.cwd(), appConfig.reacherCliPath);

export const buildCliArguments = (email: string) => {
	const args: string[] = [];

	if (appConfig.reacherFromEmail) {
		args.push('--from-email', appConfig.reacherFromEmail);
	}

	if (appConfig.reacherHelloName) {
		args.push('--hello-name', appConfig.reacherHelloName);
	}

	if (appConfig.reacherSmtpPort) {
		args.push('--smtp-port', String(appConfig.reacherSmtpPort));
	}

	if (appConfig.reacherCheckGravatar) {
		args.push('--check-gravatar', 'true');
	}

	args.push(email);
	return args;
};

const parseCliOutput = (stdout: string): ReacherCliOutput => {
	const trimmed = stdout.trim();
	if (!trimmed) {
		throw new Error('Embedded Reacher CLI returned no output.');
	}

	const parseJson = (payload: string) => JSON.parse(payload) as ReacherCliOutput;

	const assertValidOutput = (parsed: ReacherCliOutput) => {
		if (
			typeof parsed.input !== 'string' ||
			typeof parsed.is_reachable !== 'string' ||
			!parsed.syntax ||
			typeof parsed.syntax !== 'object'
		) {
			throw new Error('Embedded Reacher CLI returned an unexpected JSON payload.');
		}

		return parsed;
	};

	try {
		return assertValidOutput(parseJson(trimmed));
	} catch {
		const startIndex = trimmed.indexOf('{');
		const endIndex = trimmed.lastIndexOf('}');
		if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
			throw new Error('Embedded Reacher CLI returned invalid JSON output.');
		}

		return assertValidOutput(parseJson(trimmed.slice(startIndex, endIndex + 1)));
	}
};

export const getEmbeddedReacherBinaryPath = () => getBinaryPath();

export const isEmbeddedReacherAvailable = () => existsSync(getBinaryPath());

export const runEmbeddedReacher = (email: string) =>
	new Promise<ReacherCliOutput>((resolvePromise, rejectPromise) => {
		const binaryPath = getBinaryPath();
		if (!existsSync(binaryPath)) {
			rejectPromise(
				new Error(
					'Embedded Reacher CLI is unavailable. Run bun run reacher:install or rebuild the app before verifying emails.'
				)
			);
			return;
		}

		const child = spawn(binaryPath, buildCliArguments(email), {
			cwd: process.cwd(),
			env: {
				...process.env,
				RUST_LOG: process.env.RUST_LOG || 'error'
			},
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';
		let settled = false;

		const settleReject = (error: Error) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			rejectPromise(error);
		};

		const settleResolve = (result: ReacherCliOutput) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			resolvePromise(result);
		};

		const timer = setTimeout(() => {
			child.kill('SIGTERM');
			setTimeout(() => {
				if (child.exitCode === null) {
					child.kill('SIGKILL');
				}
			}, 1_000).unref();
			settleReject(new Error('Verification timed out.'));
		}, appConfig.verificationTimeoutMs);

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			settleReject(error instanceof Error ? error : new Error(String(error)));
		});

		child.on('close', (code, signal) => {
			if (settled) {
				return;
			}

			if (code !== 0) {
				const suffix = (stderr || stdout).trim();
				settleReject(
					new Error(
						`Embedded Reacher CLI failed with ${signal || `exit code ${code ?? 'unknown'}`}.${suffix ? ` ${suffix}` : ''}`
					)
				);
				return;
			}

			try {
				settleResolve(parseCliOutput(stdout));
			} catch (error) {
				settleReject(
					error instanceof Error
						? error
						: new Error('Embedded Reacher CLI returned invalid output.')
				);
			}
		});
	});
