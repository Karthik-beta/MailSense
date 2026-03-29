import { resolve as dnsResolve } from 'node:dns/promises';
import { appConfig } from '$lib/server/config';
import { isEmbeddedReacherAvailable } from '$lib/server/reacher-cli';

const REACHER_DEFAULT_FROM_EMAIL = 'reacher.email@gmail.com';
const REACHER_DEFAULT_HELLO_NAME = 'gmail.com';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hostnamePattern =
	/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;

const isValidEmail = (value: string) => emailPattern.test(value);

const isValidHostname = (value: string) => hostnamePattern.test(value);

const resolveHostname = async (hostname: string): Promise<boolean> => {
	try {
		const results = await dnsResolve(hostname);
		return results.length > 0;
	} catch {
		return false;
	}
};

export type SetupCheckResult = {
	binaryAvailable: boolean;
	identity: {
		fromEmail: {
			configured: boolean;
			value: string | null;
			effectiveValue: string;
			valid: boolean | null;
		};
		helloName: {
			configured: boolean;
			value: string | null;
			effectiveValue: string;
			valid: boolean | null;
			resolves: boolean | null;
		};
		smtpPort: number;
		subdomainConfigured: boolean;
	};
	readyToRun: boolean;
	issues: string[];
};

export const checkSetupReadiness = async (): Promise<SetupCheckResult> => {
	const issues: string[] = [];

	const binaryAvailable = isEmbeddedReacherAvailable();
	if (!binaryAvailable) {
		issues.push('Reacher CLI binary is not installed. Run: bun run reacher:install');
	}

	const fromEmailConfigured = typeof appConfig.reacherFromEmail === 'string' && appConfig.reacherFromEmail.length > 0;
	const fromEmailValue = fromEmailConfigured ? appConfig.reacherFromEmail! : null;
	const fromEmailValid = fromEmailValue ? isValidEmail(fromEmailValue) : null;
	if (fromEmailConfigured && !fromEmailValid) {
		issues.push(`REACHER_FROM_EMAIL "${fromEmailValue}" is not a valid email address.`);
	}

	const helloNameConfigured = typeof appConfig.reacherHelloName === 'string' && appConfig.reacherHelloName.length > 0;
	const helloNameValue = helloNameConfigured ? appConfig.reacherHelloName! : null;
	const helloNameValid = helloNameValue ? isValidHostname(helloNameValue) : null;
	if (helloNameConfigured && !helloNameValid) {
		issues.push(`REACHER_HELLO_NAME "${helloNameValue}" is not a valid hostname.`);
	}

	let helloNameResolves: boolean | null = null;
	if (helloNameConfigured && helloNameValid) {
		helloNameResolves = await resolveHostname(helloNameValue!);
		if (!helloNameResolves) {
			issues.push(`REACHER_HELLO_NAME "${helloNameValue}" does not resolve publicly.`);
		}
	}

	const subdomainConfigured = fromEmailConfigured && helloNameConfigured;

	const readyToRun =
		binaryAvailable &&
		(fromEmailValid !== false) &&
		(helloNameValid !== false);

	return {
		binaryAvailable,
		identity: {
			fromEmail: {
				configured: fromEmailConfigured,
				value: fromEmailValue,
				effectiveValue: fromEmailValue ?? REACHER_DEFAULT_FROM_EMAIL,
				valid: fromEmailValid
			},
			helloName: {
				configured: helloNameConfigured,
				value: helloNameValue,
				effectiveValue: helloNameValue ?? REACHER_DEFAULT_HELLO_NAME,
				valid: helloNameValid,
				resolves: helloNameResolves
			},
			smtpPort: appConfig.reacherSmtpPort,
			subdomainConfigured
		},
		readyToRun,
		issues
	};
};
