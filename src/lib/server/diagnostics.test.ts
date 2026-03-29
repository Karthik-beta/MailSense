import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for diagnostics module.
 * Tests config parsing, identity validation, and health check logic.
 */

const mockConfig = {
	reacherCliPath: '.reacher/bin/check_if_email_exists',
	reacherFromEmail: undefined as string | undefined,
	reacherHelloName: undefined as string | undefined,
	reacherSmtpPort: 25,
	reacherCheckGravatar: false,
	verificationTimeoutMs: 15000,
	verificationPacingMs: 1500,
	verificationBatchSize: 25,
	verificationStaleRunMinutes: 15,
	databaseUrl: './data/test.db',
	publicBaseUrl: 'http://localhost:5173',
	maxUploadBytes: 10485760
};

let mockBinaryAvailable = true;
let mockBinaryExecutable = true;
let mockBinaryVersion: string | null = 'check_if_email_exists 0.11.7';

vi.mock('$lib/server/config', () => ({
	appConfig: mockConfig
}));

vi.mock('$lib/server/reacher-cli', () => ({
	isEmbeddedReacherAvailable: () => mockBinaryAvailable,
	isEmbeddedReacherExecutable: () => mockBinaryExecutable,
	getEmbeddedReacherVersion: () => mockBinaryVersion,
	getEmbeddedReacherBinaryPath: () => '.reacher/bin/check_if_email_exists',
	buildCliArguments: (email: string) => {
		const args: string[] = [];
		if (mockConfig.reacherFromEmail) args.push('--from-email', mockConfig.reacherFromEmail);
		if (mockConfig.reacherHelloName) args.push('--hello-name', mockConfig.reacherHelloName);
		args.push('--smtp-port', String(mockConfig.reacherSmtpPort));
		args.push(email);
		return args;
	}
}));

vi.mock('node:dns/promises', () => ({
	resolve: vi.fn(async (hostname: string) => {
		if (hostname === 'resolves.example.com') return ['1.2.3.4'];
		if (hostname === 'noresolve.example.com') throw new Error('ENOTFOUND');
		return ['1.2.3.4'];
	}),
	resolveMx: vi.fn(async (domain: string) => {
		if (domain === 'resolves.example.com') return [{ exchange: 'mx.resolves.example.com', priority: 10 }];
		if (domain === 'noresolve.example.com') throw new Error('ENOTFOUND');
		return [];
	})
}));

vi.mock('node:net', () => ({
	createConnection: vi.fn(({ host, port }: { host: string; port: number }) => {
		const EventEmitter = require('node:events');
		const socket = new EventEmitter();
		socket.destroy = vi.fn();
		// Simulate successful connection for 1.2.3.4
		if (host === '1.2.3.4') {
			setTimeout(() => socket.emit('connect'), 10);
		} else {
			setTimeout(() => socket.emit('error', new Error('Connection refused')), 10);
		}
		return socket;
	})
}));

vi.mock('$lib/server/verification', () => ({
	getLatestFailureInfo: vi.fn(() => null)
}));

const { runDiagnostics } = await import('$lib/server/diagnostics');

describe('runDiagnostics', () => {
	beforeEach(() => {
		mockConfig.reacherFromEmail = undefined;
		mockConfig.reacherHelloName = undefined;
		mockConfig.reacherSmtpPort = 25;
		mockConfig.reacherCheckGravatar = false;
		mockBinaryAvailable = true;
		mockBinaryExecutable = true;
		mockBinaryVersion = 'check_if_email_exists 0.11.7';
	});

	it('reports healthy when binary is available with no custom config', async () => {
		const result = await runDiagnostics();
		expect(result.binary.installed).toBe(true);
		expect(result.binary.executable).toBe(true);
		expect(result.binary.version).toBe('check_if_email_exists 0.11.7');
		expect(result.appIntegrationHealthy).toBe(true);
		expect(result.config.subdomainConfigured).toBe(false);
	});

	it('reports unhealthy when binary is missing', async () => {
		mockBinaryAvailable = false;
		mockBinaryExecutable = false;
		mockBinaryVersion = null;
		const result = await runDiagnostics();
		expect(result.binary.installed).toBe(false);
		expect(result.appIntegrationHealthy).toBe(false);
		expect(result.summary.some(s => s.includes('CRITICAL'))).toBe(true);
	});

	it('reports unhealthy when binary is not executable', async () => {
		mockBinaryExecutable = false;
		mockBinaryVersion = null;
		const result = await runDiagnostics();
		expect(result.binary.executable).toBe(false);
		expect(result.appIntegrationHealthy).toBe(false);
	});

	it('reports subdomain configured when both from-email and hello-name set', async () => {
		mockConfig.reacherFromEmail = 'check@verify.example.com';
		mockConfig.reacherHelloName = 'verify.example.com';
		const result = await runDiagnostics();
		expect(result.config.subdomainConfigured).toBe(true);
		expect(result.config.identityAligned).toBe(true);
	});

	it('detects identity misalignment', async () => {
		mockConfig.reacherFromEmail = 'check@other.com';
		mockConfig.reacherHelloName = 'resolves.example.com';
		const result = await runDiagnostics();
		expect(result.config.identityAligned).toBe(false);
		expect(result.config.issues.some(i => i.includes('does not match'))).toBe(true);
	});

	it('validates from-email syntax', async () => {
		mockConfig.reacherFromEmail = 'not-an-email';
		const result = await runDiagnostics();
		expect(result.config.fromEmail.valid).toBe(false);
		expect(result.appIntegrationHealthy).toBe(false);
	});

	it('validates hello-name syntax', async () => {
		mockConfig.reacherHelloName = '!!!invalid';
		const result = await runDiagnostics();
		expect(result.config.helloName.valid).toBe(false);
		expect(result.appIntegrationHealthy).toBe(false);
	});

	it('checks DNS resolution for hello-name', async () => {
		mockConfig.reacherHelloName = 'resolves.example.com';
		const result = await runDiagnostics();
		expect(result.network.dns.helloNameResolves).toBe(true);
		expect(result.network.dns.helloNameAddresses).toContain('1.2.3.4');
	});

	it('reports DNS failure for unresolvable hello-name', async () => {
		mockConfig.reacherHelloName = 'noresolve.example.com';
		const result = await runDiagnostics();
		expect(result.network.dns.helloNameResolves).toBe(false);
		expect(result.infrastructureLikelyHealthy).toBe(false);
	});

	it('includes effective CLI args', async () => {
		mockConfig.reacherFromEmail = 'check@verify.example.com';
		const result = await runDiagnostics();
		expect(result.effectiveCliArgs).toContain('--from-email');
		expect(result.effectiveCliArgs).toContain('check@verify.example.com');
		expect(result.effectiveCliArgs[result.effectiveCliArgs.length - 1]).toBe('test@example.com');
	});

	it('returns correct config values', async () => {
		mockConfig.reacherSmtpPort = 587;
		mockConfig.reacherCheckGravatar = true;
		const result = await runDiagnostics();
		expect(result.config.smtpPort).toBe(587);
		expect(result.config.checkGravatar).toBe(true);
		expect(result.config.timeoutMs).toBe(15000);
		expect(result.config.pacingMs).toBe(1500);
		expect(result.config.batchSize).toBe(25);
	});

	it('includes timestamp', async () => {
		const result = await runDiagnostics();
		expect(result.timestamp).toBeTruthy();
		// Should be a valid ISO string
		expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
	});

	it('reports no last failure when none exist', async () => {
		const result = await runDiagnostics();
		expect(result.lastFailure).toBeNull();
	});

	it('reports default effective values when not configured', async () => {
		const result = await runDiagnostics();
		expect(result.config.fromEmail.effectiveValue).toBe('reacher.email@gmail.com');
		expect(result.config.helloName.effectiveValue).toBe('gmail.com');
	});
});
