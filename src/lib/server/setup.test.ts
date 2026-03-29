import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConfig = {
	reacherCliPath: '.reacher/bin/check_if_email_exists',
	reacherFromEmail: undefined as string | undefined,
	reacherHelloName: undefined as string | undefined,
	reacherSmtpPort: 25,
	reacherCheckGravatar: false,
	verificationTimeoutMs: 15000
};

let mockBinaryAvailable = true;

vi.mock('$lib/server/config', () => ({
	appConfig: mockConfig
}));

vi.mock('$lib/server/reacher-cli', () => ({
	isEmbeddedReacherAvailable: () => mockBinaryAvailable
}));

vi.mock('node:dns/promises', () => ({
	resolve: vi.fn(async (hostname: string) => {
		if (hostname === 'resolves.example.com') return ['1.2.3.4'];
		if (hostname === 'noresolve.example.com') throw new Error('ENOTFOUND');
		return ['1.2.3.4'];
	})
}));

const { checkSetupReadiness } = await import('$lib/server/setup');

describe('checkSetupReadiness', () => {
	beforeEach(() => {
		mockConfig.reacherFromEmail = undefined;
		mockConfig.reacherHelloName = undefined;
		mockConfig.reacherSmtpPort = 25;
		mockBinaryAvailable = true;
	});

	it('reports ready when binary is available and no identity is configured', async () => {
		const result = await checkSetupReadiness();
		expect(result.binaryAvailable).toBe(true);
		expect(result.readyToRun).toBe(true);
		expect(result.identity.subdomainConfigured).toBe(false);
		expect(result.identity.fromEmail.configured).toBe(false);
		expect(result.identity.fromEmail.effectiveValue).toBe('reacher.email@gmail.com');
		expect(result.identity.helloName.configured).toBe(false);
		expect(result.identity.helloName.effectiveValue).toBe('gmail.com');
		expect(result.issues).toHaveLength(0);
	});

	it('reports not ready when binary is missing', async () => {
		mockBinaryAvailable = false;
		const result = await checkSetupReadiness();
		expect(result.binaryAvailable).toBe(false);
		expect(result.readyToRun).toBe(false);
		expect(result.issues).toContain(
			'Reacher CLI binary is not installed. Run: bun run reacher:install'
		);
	});

	it('validates from email syntax', async () => {
		mockConfig.reacherFromEmail = 'not-an-email';
		const result = await checkSetupReadiness();
		expect(result.identity.fromEmail.configured).toBe(true);
		expect(result.identity.fromEmail.valid).toBe(false);
		expect(result.readyToRun).toBe(false);
		expect(result.issues.some((i) => i.includes('not a valid email'))).toBe(true);
	});

	it('accepts valid from email', async () => {
		mockConfig.reacherFromEmail = 'check@verify.example.com';
		const result = await checkSetupReadiness();
		expect(result.identity.fromEmail.configured).toBe(true);
		expect(result.identity.fromEmail.valid).toBe(true);
		expect(result.identity.fromEmail.effectiveValue).toBe('check@verify.example.com');
	});

	it('validates hello name as hostname', async () => {
		mockConfig.reacherHelloName = 'not a hostname!';
		const result = await checkSetupReadiness();
		expect(result.identity.helloName.configured).toBe(true);
		expect(result.identity.helloName.valid).toBe(false);
		expect(result.readyToRun).toBe(false);
		expect(result.issues.some((i) => i.includes('not a valid hostname'))).toBe(true);
	});

	it('accepts valid hello name and checks DNS', async () => {
		mockConfig.reacherHelloName = 'resolves.example.com';
		const result = await checkSetupReadiness();
		expect(result.identity.helloName.configured).toBe(true);
		expect(result.identity.helloName.valid).toBe(true);
		expect(result.identity.helloName.resolves).toBe(true);
	});

	it('reports when hello name does not resolve', async () => {
		mockConfig.reacherHelloName = 'noresolve.example.com';
		const result = await checkSetupReadiness();
		expect(result.identity.helloName.resolves).toBe(false);
		expect(result.issues.some((i) => i.includes('does not resolve'))).toBe(true);
		// Still ready to run — DNS not resolving is a warning, not a block
		expect(result.readyToRun).toBe(true);
	});

	it('reports subdomain configured when both values are set', async () => {
		mockConfig.reacherFromEmail = 'check@verify.example.com';
		mockConfig.reacherHelloName = 'resolves.example.com';
		const result = await checkSetupReadiness();
		expect(result.identity.subdomainConfigured).toBe(true);
		expect(result.readyToRun).toBe(true);
		expect(result.issues).toHaveLength(0);
	});

	it('reports correct SMTP port', async () => {
		mockConfig.reacherSmtpPort = 587;
		const result = await checkSetupReadiness();
		expect(result.identity.smtpPort).toBe(587);
	});

	it('skips DNS check when hello name is invalid', async () => {
		mockConfig.reacherHelloName = '!!!';
		const result = await checkSetupReadiness();
		expect(result.identity.helloName.resolves).toBeNull();
	});

	it('skips validation for unconfigured values', async () => {
		const result = await checkSetupReadiness();
		expect(result.identity.fromEmail.valid).toBeNull();
		expect(result.identity.helloName.valid).toBeNull();
		expect(result.identity.helloName.resolves).toBeNull();
	});
});
