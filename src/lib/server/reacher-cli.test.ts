import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock $lib/server/config before importing the module under test
const mockConfig = {
	reacherCliPath: '.reacher/bin/check_if_email_exists',
	reacherFromEmail: undefined as string | undefined,
	reacherHelloName: undefined as string | undefined,
	reacherSmtpPort: 25,
	reacherCheckGravatar: false,
	verificationTimeoutMs: 15000
};

vi.mock('$lib/server/config', () => ({
	appConfig: mockConfig
}));

// Import after mock is set up
const { buildCliArguments } = await import('$lib/server/reacher-cli');

describe('buildCliArguments', () => {
	beforeEach(() => {
		mockConfig.reacherFromEmail = undefined;
		mockConfig.reacherHelloName = undefined;
		mockConfig.reacherSmtpPort = 25;
		mockConfig.reacherCheckGravatar = false;
	});

	it('includes only smtp-port and the email when no identity is configured', () => {
		const args = buildCliArguments('test@example.com');
		expect(args).toEqual(['--smtp-port', '25', 'test@example.com']);
	});

	it('includes --from-email when configured', () => {
		mockConfig.reacherFromEmail = 'check@verify.example.com';
		const args = buildCliArguments('test@example.com');
		expect(args).toContain('--from-email');
		expect(args).toContain('check@verify.example.com');
		expect(args[args.length - 1]).toBe('test@example.com');
	});

	it('includes --hello-name when configured', () => {
		mockConfig.reacherHelloName = 'verify.example.com';
		const args = buildCliArguments('test@example.com');
		expect(args).toContain('--hello-name');
		expect(args).toContain('verify.example.com');
		expect(args[args.length - 1]).toBe('test@example.com');
	});

	it('includes both identity flags when both are configured', () => {
		mockConfig.reacherFromEmail = 'check@verify.example.com';
		mockConfig.reacherHelloName = 'verify.example.com';
		const args = buildCliArguments('test@example.com');
		expect(args).toContain('--from-email');
		expect(args).toContain('check@verify.example.com');
		expect(args).toContain('--hello-name');
		expect(args).toContain('verify.example.com');
		expect(args[args.length - 1]).toBe('test@example.com');
	});

	it('includes --smtp-port when not the default', () => {
		mockConfig.reacherSmtpPort = 587;
		const args = buildCliArguments('test@example.com');
		expect(args).toContain('--smtp-port');
		expect(args).toContain('587');
	});

	it('includes --smtp-port even when default 25', () => {
		// The current code always includes smtp-port if it's set (it always is via config)
		mockConfig.reacherSmtpPort = 25;
		const args = buildCliArguments('test@example.com');
		// smtp-port is included because appConfig.reacherSmtpPort is always a number
		expect(args).toContain('--smtp-port');
		expect(args).toContain('25');
	});

	it('includes --check-gravatar when enabled', () => {
		mockConfig.reacherCheckGravatar = true;
		const args = buildCliArguments('test@example.com');
		expect(args).toContain('--check-gravatar');
		expect(args).toContain('true');
	});

	it('does not include --check-gravatar when disabled', () => {
		mockConfig.reacherCheckGravatar = false;
		const args = buildCliArguments('test@example.com');
		expect(args).not.toContain('--check-gravatar');
	});

	it('always places the email as the last argument', () => {
		mockConfig.reacherFromEmail = 'x@y.com';
		mockConfig.reacherHelloName = 'y.com';
		mockConfig.reacherSmtpPort = 587;
		mockConfig.reacherCheckGravatar = true;
		const args = buildCliArguments('target@example.com');
		expect(args[args.length - 1]).toBe('target@example.com');
	});
});
