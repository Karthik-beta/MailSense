import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { generateSignedCookie } from 'hono/cookie';

const command = process.argv[2] ?? 'predeploy';
const validCommands = new Set(['build', 'runtime', 'predeploy']);

if (!validCommands.has(command)) {
	console.error('Usage: node scripts/validate-railway-local.mjs <build|runtime|predeploy>');
	process.exit(1);
}

const rootDir = process.cwd();
const tempDirectory = resolve(rootDir, '.tmp/railway-local');
const tempDatabasePath = resolve(tempDirectory, 'mailsense.db');
const sampleCsvPath = resolve(tempDirectory, 'sample.csv');
const buildDirectoryPath = resolve(rootDir, 'build');
const buildEntryPath = resolve(buildDirectoryPath, 'index.js');
const defaultReacherBinaryPath = resolve(rootDir, '.reacher/bin/check_if_email_exists');
const sessionToken = 'validation-session-token';
const placeholderSecret = 'local-validation-secret-0123456789abcdef';
const placeholderGoogleClientId = 'local-validation-google-client-id';
const placeholderGoogleClientSecret = 'local-validation-google-client-secret';
const requiredTables = ['user', 'session', 'uploads', 'upload_rows', 'leads', 'verification_runs'];
const sampleCsv = [
	'email,company,name',
	'alice@example.com,Acme,Alice',
	'bad-email,Acme,Bad',
	'alice@example.com,Acme,Duplicate',
	'bob@example.org,Globex,Bob',
	''
].join('\n');

const log = (message) => console.log(message);

const assert = (condition, message) => {
	if (!condition) {
		throw new Error(message);
	}
};

const isBlank = (value) => !value || value.trim().length === 0;

const isLocalHost = (value) => {
	try {
		const url = new URL(value);
		return ['127.0.0.1', '0.0.0.0', 'localhost'].includes(url.hostname);
	} catch {
		return false;
	}
};

const parseDotEnv = (filePath) => {
	if (!existsSync(filePath)) {
		return {};
	}

	const parsed = {};
	for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const separatorIndex = line.indexOf('=');
		if (separatorIndex === -1) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		let value = line.slice(separatorIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		parsed[key] = value;
	}

	return parsed;
};

const resolveReacherBinaryPath = (env) =>
	resolve(rootDir, env.REACHER_CLI_PATH || defaultReacherBinaryPath);

const baseEnv = {
	...parseDotEnv(resolve(rootDir, '.env')),
	...process.env
};

const auditEnvironment = (env) => {
	const failures = [];
	const warnings = [];
	const infos = [];

	const checkUrl = (name, value) => {
		if (isBlank(value)) {
			failures.push(`${name} is missing.`);
			return null;
		}

		try {
			return new URL(value);
		} catch {
			failures.push(`${name} must be a valid absolute URL.`);
			return null;
		}
	};

	const origin = checkUrl('ORIGIN', env.ORIGIN);
	const authUrl = checkUrl('BETTER_AUTH_URL', env.BETTER_AUTH_URL);

	if (origin && authUrl && origin.origin !== authUrl.origin) {
		failures.push('ORIGIN and BETTER_AUTH_URL must point at the same public origin.');
	}

	if (origin && isLocalHost(origin.toString())) {
		failures.push(
			'ORIGIN still points to a local hostname. Set it to the Railway public URL or custom domain.'
		);
	}

	if (origin && !isLocalHost(origin.toString()) && origin.protocol !== 'https:') {
		failures.push('ORIGIN must use https:// in production.');
	}

	if (authUrl && isLocalHost(authUrl.toString())) {
		failures.push(
			'BETTER_AUTH_URL still points to a local hostname. Set it to the Railway public URL or custom domain.'
		);
	}

	if (authUrl && !isLocalHost(authUrl.toString()) && authUrl.protocol !== 'https:') {
		failures.push('BETTER_AUTH_URL must use https:// in production.');
	}

	if (isBlank(env.BETTER_AUTH_SECRET)) {
		failures.push('BETTER_AUTH_SECRET is missing.');
	} else if (env.BETTER_AUTH_SECRET.length < 32) {
		failures.push('BETTER_AUTH_SECRET must be at least 32 characters long.');
	}

	if (isBlank(env.GOOGLE_CLIENT_ID)) {
		failures.push('GOOGLE_CLIENT_ID is missing.');
	}

	if (isBlank(env.GOOGLE_CLIENT_SECRET)) {
		failures.push('GOOGLE_CLIENT_SECRET is missing.');
	}

	if (!isBlank(env.REACHER_API_TOKEN)) {
		warnings.push(
			'REACHER_API_TOKEN is obsolete and ignored. MailSense now runs embedded verification internally.'
		);
	}

	if (!isBlank(env.REACHER_BACKEND_URL)) {
		warnings.push(
			'REACHER_BACKEND_URL is obsolete and ignored. MailSense no longer calls an external Reacher backend.'
		);
	}

	warnings.push(
		'Embedded verification still depends on outbound SMTP reachability. Railway only allows SMTP on Pro plans and above.'
	);
	infos.push(
		'MailSense now verifies email inside the app service with an embedded Reacher CLI binary.'
	);

	if (isBlank(env.DATABASE_URL)) {
		failures.push('DATABASE_URL is missing.');
	} else if (!env.DATABASE_URL.startsWith('/')) {
		failures.push(
			'DATABASE_URL should be an absolute persistent path on Railway, typically /data/mailsense.db.'
		);
	} else if (!env.DATABASE_URL.startsWith('/data/')) {
		warnings.push(
			'DATABASE_URL is absolute but does not use the recommended /data volume path. Confirm your Railway volume mount matches it.'
		);
	} else {
		infos.push('DATABASE_URL uses the recommended /data volume path for Railway persistence.');
	}

	if (!existsSync(resolve(rootDir, '.env'))) {
		warnings.push(
			'No .env file was found, so only current shell environment variables were audited.'
		);
	}

	return { failures, warnings, infos };
};

const getAvailablePort = () =>
	new Promise((resolvePromise, rejectPromise) => {
		const server = createServer();
		server.unref();
		server.on('error', rejectPromise);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close(() => rejectPromise(new Error('Unable to allocate a validation port.')));
				return;
			}

			server.close((error) => {
				if (error) {
					rejectPromise(error);
					return;
				}

				resolvePromise(address.port);
			});
		});
	});

const createValidationEnv = (env, port) => {
	const origin = `http://127.0.0.1:${port}`;

	return {
		...process.env,
		...env,
		NODE_ENV: 'production',
		PORT: String(port),
		HOST: '0.0.0.0',
		ORIGIN: origin,
		BETTER_AUTH_URL: origin,
		BETTER_AUTH_SECRET:
			env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32
				? env.BETTER_AUTH_SECRET
				: placeholderSecret,
		GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || placeholderGoogleClientId,
		GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || placeholderGoogleClientSecret,
		DATABASE_URL: tempDatabasePath,
		PROTOCOL_HEADER: env.PROTOCOL_HEADER || 'x-forwarded-proto',
		HOST_HEADER: env.HOST_HEADER || 'x-forwarded-host',
		PORT_HEADER: env.PORT_HEADER || 'x-forwarded-port',
		BODY_SIZE_LIMIT: env.BODY_SIZE_LIMIT || '20M'
	};
};

const runCommand = (commandName, args, options = {}) =>
	new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(commandName, args, {
			cwd: options.cwd || rootDir,
			env: options.env || process.env,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		const timeout =
			typeof options.timeoutMs === 'number' && options.timeoutMs > 0
				? setTimeout(() => {
						timedOut = true;
						child.kill('SIGTERM');
					}, options.timeoutMs)
				: null;

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			if (timeout) {
				clearTimeout(timeout);
			}
			rejectPromise(error);
		});

		child.on('exit', (code, signal) => {
			if (timeout) {
				clearTimeout(timeout);
			}

			const result = { code: code ?? 0, signal, stdout, stderr, timedOut };
			if (timedOut) {
				rejectPromise(new Error(`${commandName} ${args.join(' ')} timed out.`));
				return;
			}

			if (code !== 0 && !options.allowFailure) {
				const error = new Error(
					`${commandName} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}.`
				);
				error.result = result;
				rejectPromise(error);
				return;
			}

			resolvePromise(result);
		});
	});

const prepareValidationWorkspace = () => {
	rmSync(tempDirectory, { recursive: true, force: true });
	mkdirSync(tempDirectory, { recursive: true });
	writeFileSync(sampleCsvPath, sampleCsv, 'utf8');
};

const cleanBuildArtifacts = () => {
	rmSync(buildDirectoryPath, { recursive: true, force: true });
	rmSync(resolve(rootDir, '.svelte-kit'), { recursive: true, force: true });
};

const runBuildValidation = async (env) => {
	log('Running clean production build...');
	cleanBuildArtifacts();
	await runCommand('bun', ['run', 'build'], { env, timeoutMs: 120000 });
	assert(existsSync(buildEntryPath), 'Expected build/index.js after bun run build.');
	assert(
		existsSync(resolveReacherBinaryPath(env)),
		'Expected the embedded Reacher CLI binary after bun run build.'
	);
	log('Build validation passed.');
};

const waitForServer = async (child, origin) => {
	let stdout = '';
	let stderr = '';

	child.stdout.on('data', (chunk) => {
		stdout += chunk.toString();
	});

	child.stderr.on('data', (chunk) => {
		stderr += chunk.toString();
	});

	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`Production server exited early.\n${stdout}${stderr}`);
		}

		if (stdout.includes('Listening on') || stderr.includes('Listening on')) {
			return { stdout, stderr };
		}

		try {
			const response = await fetch(new URL('/api/health', origin));
			if (response.ok) {
				return { stdout, stderr };
			}
		} catch {
			// Wait for the server to come up.
		}

		await delay(250);
	}

	throw new Error(`Timed out waiting for the production server.\n${stdout}${stderr}`);
};

const stopServer = async (child) => {
	if (child.exitCode !== null) {
		return;
	}

	child.kill('SIGTERM');
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (child.exitCode !== null) {
			return;
		}

		await delay(100);
	}

	child.kill('SIGKILL');
	await delay(100);
};

const inspectDatabase = (databasePath) => {
	assert(existsSync(databasePath), `Expected SQLite database at ${databasePath}.`);
	const db = new Database(databasePath, { readonly: true });
	const rows = db
		.prepare("select name from sqlite_master where type = 'table'")
		.all()
		.map((row) => row.name);
	db.close();

	for (const table of requiredTables) {
		assert(rows.includes(table), `Expected SQLite table ${table} to exist after startup.`);
	}
};

const seedAuthenticatedSession = async (databasePath, secret) => {
	const db = new Database(databasePath);
	const now = Date.now();
	const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

	db.prepare('delete from session where token = ?').run(sessionToken);
	db.prepare('delete from user where id = ?').run('validation-user');
	db.prepare(
		'insert into user (id, name, email, email_verified, image, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
	).run('validation-user', 'Validation User', 'validation@example.com', 1, null, now, now);
	db.prepare(
		'insert into session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) values (?, ?, ?, ?, ?, ?, ?, ?)'
	).run(
		'validation-session',
		expiresAt,
		sessionToken,
		now,
		now,
		'127.0.0.1',
		'local-validation',
		'validation-user'
	);
	db.close();

	return (await generateSignedCookie('better-auth.session_token', sessionToken, secret)).split(
		';'
	)[0];
};

const createRequest = (origin, path, init = {}) =>
	fetch(new URL(path, origin), {
		redirect: 'manual',
		...init
	});

const expectJson = async (response, expectedStatus, label) => {
	assert(
		response.status === expectedStatus,
		`${label} returned ${response.status} instead of ${expectedStatus}.`
	);
	return response.json();
};

const expectText = async (response, expectedStatus, label) => {
	assert(
		response.status === expectedStatus,
		`${label} returned ${response.status} instead of ${expectedStatus}.`
	);
	return response.text();
};

const runRuntimeSmoke = async (env, origin) => {
	prepareValidationWorkspace();
	await runBuildValidation(env);

	log('Starting the production server with Railway-like runtime env...');
	const child = spawn('bun', ['run', 'start'], {
		cwd: rootDir,
		env,
		stdio: ['ignore', 'pipe', 'pipe']
	});

	try {
		await waitForServer(child, origin);
		inspectDatabase(tempDatabasePath);

		const healthPayload = await expectJson(
			await createRequest(origin, '/api/health'),
			200,
			'GET /api/health'
		);
		assert(healthPayload.ok === true, 'Health payload should report ok=true.');

		const rootResponse = await createRequest(origin, '/');
		assert(rootResponse.status === 303, 'GET / should redirect to /sign-in in production mode.');
		assert(
			rootResponse.headers.get('location') === '/sign-in',
			'GET / should redirect to /sign-in.'
		);

		const signInHtml = await expectText(
			await createRequest(origin, '/sign-in'),
			200,
			'GET /sign-in'
		);
		assert(signInHtml.includes('MailSense'), 'Sign-in page should render the MailSense shell.');

		assert(
			(await createRequest(origin, '/api/dashboard')).status === 401,
			'GET /api/dashboard without a session should return 401.'
		);

		const authCookie = await seedAuthenticatedSession(tempDatabasePath, env.BETTER_AUTH_SECRET);
		const sessionPayload = await expectJson(
			await createRequest(origin, '/api/auth/get-session', {
				headers: { Cookie: authCookie }
			}),
			200,
			'GET /api/auth/get-session'
		);
		assert(
			sessionPayload.user.email === 'validation@example.com',
			'Seeded Better Auth session was not resolved.'
		);

		const importsHtml = await expectText(
			await createRequest(origin, '/imports', {
				headers: { Cookie: authCookie }
			}),
			200,
			'GET /imports'
		);
		assert(
			importsHtml.includes('Bring leads in'),
			'Protected imports page did not render in production mode.'
		);

		const formData = new FormData();
		formData.set(
			'file',
			new File([readFileSync(sampleCsvPath)], 'sample.csv', { type: 'text/csv' })
		);

		const uploadPayload = await expectJson(
			await createRequest(origin, '/api/uploads', {
				method: 'POST',
				headers: {
					Cookie: authCookie,
					Origin: origin,
					Referer: `${origin}/imports`
				},
				body: formData
			}),
			200,
			'POST /api/uploads'
		);
		assert(uploadPayload.summary.acceptedRows === 2, 'Import smoke test should accept 2 rows.');
		assert(uploadPayload.summary.rejectedRows === 2, 'Import smoke test should reject 2 rows.');

		const leadsPayload = await expectJson(
			await createRequest(origin, '/api/leads', {
				headers: { Cookie: authCookie }
			}),
			200,
			'GET /api/leads'
		);
		assert(leadsPayload.total === 2, 'Lead listing should return the two imported unique leads.');
		const leadEmails = new Set(leadsPayload.items.map((item) => item.normalizedEmail));
		assert(leadEmails.has('alice@example.com'), 'Imported alice@example.com lead is missing.');
		assert(leadEmails.has('bob@example.org'), 'Imported bob@example.org lead is missing.');

		const exportResponse = await createRequest(origin, '/api/export?format=csv', {
			headers: { Cookie: authCookie }
		});
		assert(exportResponse.status === 200, 'CSV export should return 200.');
		assert(
			exportResponse.headers.get('content-type')?.includes('text/csv'),
			'CSV export should return text/csv.'
		);
		const exportBody = await exportResponse.text();
		assert(exportBody.includes('alice@example.com'), 'CSV export is missing alice@example.com.');
		assert(exportBody.includes('bob@example.org'), 'CSV export is missing bob@example.org.');

		const verifyPayload = await expectJson(
			await createRequest(origin, '/api/verify/single', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					Cookie: authCookie,
					Origin: origin,
					Referer: `${origin}/verify`
				},
				body: JSON.stringify({ email: 'alice@example.com' })
			}),
			200,
			'POST /api/verify/single'
		);
		assert(
			verifyPayload.email === 'alice@example.com',
			'Manual verification response used the wrong email.'
		);
		assert(
			['safe', 'risky', 'invalid', 'unknown'].includes(verifyPayload.verificationStatus),
			'Manual verification returned an unexpected verification status.'
		);
		assert(
			['valid', 'risky', 'invalid', 'unknown'].includes(verifyPayload.riskLevel),
			'Manual verification returned an unexpected risk level.'
		);
		assert(
			verifyPayload.details?.integration === 'embedded-reacher-cli',
			'Manual verification should use the embedded Reacher CLI integration.'
		);
		assert(
			!String(verifyPayload.reason).includes('REACHER_API_TOKEN') &&
				!String(verifyPayload.reason).includes('REACHER_BACKEND_URL'),
			'Manual verification should not depend on external Reacher credentials anymore.'
		);

		log('Runtime validation passed.');
	} finally {
		await stopServer(child);
	}
};

const runInvalidDatabasePathCheck = async (env, port) => {
	log('Checking invalid DATABASE_URL failure handling...');
	const invalidEnv = {
		...env,
		PORT: String(port),
		ORIGIN: `http://127.0.0.1:${port}`,
		BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
		DATABASE_URL: '/proc/mailsense-validation.db'
	};

	const result = await runCommand(process.execPath, ['scripts/start.mjs'], {
		env: invalidEnv,
		allowFailure: true,
		timeoutMs: 15000
	});

	assert(result.code !== 0, 'Invalid DATABASE_URL should fail before the server starts.');
	assert(
		/Failed to initialize SQLite|readonly|read-only|EACCES|EROFS|SQLITE_CANTOPEN/i.test(
			`${result.stdout}\n${result.stderr}`
		),
		'Invalid DATABASE_URL failure did not surface a clear SQLite startup error.'
	);
	log('Invalid DATABASE_URL failure check passed.');
};

const printAudit = (audit) => {
	if (audit.failures.length > 0) {
		log('Environment readiness failures:');
		for (const failure of audit.failures) {
			log(`- FAIL: ${failure}`);
		}
	}

	if (audit.warnings.length > 0) {
		log('Environment readiness warnings:');
		for (const warning of audit.warnings) {
			log(`- WARN: ${warning}`);
		}
	}

	if (audit.infos.length > 0) {
		log('Environment readiness notes:');
		for (const info of audit.infos) {
			log(`- INFO: ${info}`);
		}
	}
};

const main = async () => {
	const validationPort = await getAvailablePort();
	const validationOrigin = `http://127.0.0.1:${validationPort}`;
	const validationEnv = createValidationEnv(baseEnv, validationPort);

	if (command === 'build') {
		prepareValidationWorkspace();
		await runBuildValidation(validationEnv);
		return;
	}

	if (command === 'runtime') {
		await runRuntimeSmoke(validationEnv, validationOrigin);
		return;
	}

	const audit = auditEnvironment(baseEnv);
	printAudit(audit);
	await runRuntimeSmoke(validationEnv, validationOrigin);
	await runInvalidDatabasePathCheck(validationEnv, validationPort + 1);

	if (audit.failures.length > 0) {
		throw new Error(
			'Pre-deploy validation failed because the deployment environment is not ready yet.'
		);
	}

	log('Pre-deploy validation passed.');
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
