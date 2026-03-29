/**
 * Comprehensive diagnostics for operator confidence.
 *
 * Separates:
 * - Application integration health (app wired correctly)
 * - Binary health (Reacher binary present, executable, version)
 * - Configuration health (identity config valid)
 * - Network readiness (DNS, MX, port reachability)
 */

import { resolve as dnsResolve, resolveMx } from 'node:dns/promises';
import { createConnection } from 'node:net';
import { appConfig } from '$lib/server/config';
import {
	isEmbeddedReacherAvailable,
	isEmbeddedReacherExecutable,
	getEmbeddedReacherVersion,
	getEmbeddedReacherBinaryPath,
	buildCliArguments
} from '$lib/server/reacher-cli';
import { getLatestFailureInfo } from '$lib/server/verification';

const REACHER_DEFAULT_FROM_EMAIL = 'reacher.email@gmail.com';
const REACHER_DEFAULT_HELLO_NAME = 'gmail.com';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hostnamePattern =
	/^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;

const isValidEmail = (value: string) => emailPattern.test(value);
const isValidHostname = (value: string) => hostnamePattern.test(value);

const resolveHostname = async (hostname: string): Promise<{ ok: boolean; addresses: string[]; error: string | null }> => {
	try {
		const results = await dnsResolve(hostname);
		return { ok: results.length > 0, addresses: results, error: null };
	} catch (err) {
		return { ok: false, addresses: [], error: err instanceof Error ? err.message : String(err) };
	}
};

const resolveMxRecords = async (domain: string): Promise<{ ok: boolean; records: Array<{ exchange: string; priority: number }>; error: string | null }> => {
	try {
		const records = await resolveMx(domain);
		return { ok: records.length > 0, records, error: null };
	} catch (err) {
		return { ok: false, records: [], error: err instanceof Error ? err.message : String(err) };
	}
};

const checkPortReachability = (host: string, port: number, timeoutMs = 5000): Promise<{ reachable: boolean; latencyMs: number | null; error: string | null }> => {
	return new Promise((resolve) => {
		const start = Date.now();
		const socket = createConnection({ host, port, timeout: timeoutMs });

		socket.on('connect', () => {
			const latencyMs = Date.now() - start;
			socket.destroy();
			resolve({ reachable: true, latencyMs, error: null });
		});

		socket.on('timeout', () => {
			socket.destroy();
			resolve({ reachable: false, latencyMs: null, error: 'Connection timed out' });
		});

		socket.on('error', (err) => {
			socket.destroy();
			resolve({ reachable: false, latencyMs: null, error: err.message });
		});
	});
};

// --- Health check types ---

export type BinaryHealth = {
	installed: boolean;
	executable: boolean;
	path: string;
	version: string | null;
};

export type ConfigHealth = {
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
	};
	smtpPort: number;
	checkGravatar: boolean;
	subdomainConfigured: boolean;
	identityAligned: boolean | null;
	timeoutMs: number;
	pacingMs: number;
	batchSize: number;
	issues: string[];
};

export type DnsHealth = {
	helloNameResolves: boolean | null;
	helloNameAddresses: string[];
	helloNameError: string | null;
};

export type NetworkHealth = {
	dns: DnsHealth;
	smtpReachability: {
		tested: boolean;
		targetHost: string | null;
		targetPort: number;
		reachable: boolean | null;
		latencyMs: number | null;
		error: string | null;
	};
	mxLookup: {
		tested: boolean;
		domain: string | null;
		records: Array<{ exchange: string; priority: number }>;
		error: string | null;
	};
};

export type LastFailure = {
	reason: string;
	failureClass: string | null;
	failureSummary: string | null;
	isAppSide: boolean | null;
	isInfrastructureSide: boolean | null;
	verifiedAt: Date | null;
} | null;

export type DiagnosticsResult = {
	timestamp: string;
	binary: BinaryHealth;
	config: ConfigHealth;
	network: NetworkHealth;
	lastFailure: LastFailure;
	effectiveCliArgs: string[];
	appIntegrationHealthy: boolean;
	infrastructureLikelyHealthy: boolean | null;
	summary: string[];
};

// --- Diagnostic checks ---

const checkBinaryHealth = (): BinaryHealth => {
	const installed = isEmbeddedReacherAvailable();
	const executable = installed ? isEmbeddedReacherExecutable() : false;
	const version = executable ? getEmbeddedReacherVersion() : null;
	return {
		installed,
		executable,
		path: getEmbeddedReacherBinaryPath(),
		version
	};
};

const checkConfigHealth = (): ConfigHealth => {
	const issues: string[] = [];

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

	const subdomainConfigured = fromEmailConfigured && helloNameConfigured;

	// Check identity alignment: from-email domain should match hello-name
	let identityAligned: boolean | null = null;
	if (fromEmailConfigured && helloNameConfigured && fromEmailValid && helloNameValid) {
		const fromDomain = fromEmailValue!.split('@')[1];
		identityAligned = fromDomain === helloNameValue;
		if (!identityAligned) {
			issues.push(`REACHER_FROM_EMAIL domain "${fromDomain}" does not match REACHER_HELLO_NAME "${helloNameValue}". This may cause remote servers to reject SMTP connections.`);
		}
	}

	return {
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
			valid: helloNameValid
		},
		smtpPort: appConfig.reacherSmtpPort,
		checkGravatar: appConfig.reacherCheckGravatar,
		subdomainConfigured,
		identityAligned,
		timeoutMs: appConfig.verificationTimeoutMs,
		pacingMs: appConfig.verificationPacingMs,
		batchSize: appConfig.verificationBatchSize,
		issues
	};
};

const checkDnsHealth = async (helloName: string | null, valid: boolean | null): Promise<DnsHealth> => {
	if (!helloName || !valid) {
		return { helloNameResolves: null, helloNameAddresses: [], helloNameError: null };
	}
	const result = await resolveHostname(helloName);
	return {
		helloNameResolves: result.ok,
		helloNameAddresses: result.addresses,
		helloNameError: result.error
	};
};

const checkNetworkHealth = async (config: ConfigHealth, dns: DnsHealth): Promise<NetworkHealth> => {
	const effectiveHello = config.helloName.effectiveValue;

	// Attempt MX lookup for the effective hello hostname domain to test DNS is working
	let mxLookup: NetworkHealth['mxLookup'] = { tested: false, domain: null, records: [], error: null };
	if (effectiveHello && isValidHostname(effectiveHello)) {
		const mx = await resolveMxRecords(effectiveHello);
		mxLookup = { tested: true, domain: effectiveHello, records: mx.records, error: mx.error };
	}

	// Attempt basic SMTP port reachability against a well-known public mail server
	// We test against the configured hello hostname if it resolves, otherwise skip
	let smtpReachability: NetworkHealth['smtpReachability'] = {
		tested: false, targetHost: null, targetPort: config.smtpPort, reachable: null, latencyMs: null, error: null
	};

	if (dns.helloNameResolves && dns.helloNameAddresses.length > 0) {
		const targetHost = dns.helloNameAddresses[0];
		const portCheck = await checkPortReachability(targetHost, config.smtpPort, 5000);
		smtpReachability = {
			tested: true,
			targetHost,
			targetPort: config.smtpPort,
			reachable: portCheck.reachable,
			latencyMs: portCheck.latencyMs,
			error: portCheck.error
		};
	}

	return { dns, smtpReachability, mxLookup };
};

export const runDiagnostics = async (): Promise<DiagnosticsResult> => {
	const summary: string[] = [];

	// 1. Binary health
	const binary = checkBinaryHealth();
	if (!binary.installed) {
		summary.push('CRITICAL: Reacher CLI binary is not installed.');
	} else if (!binary.executable) {
		summary.push('CRITICAL: Reacher CLI binary is not executable.');
	} else {
		summary.push(`Reacher CLI: ${binary.version ?? 'version unknown'}`);
	}

	// 2. Config health
	const config = checkConfigHealth();
	for (const issue of config.issues) {
		summary.push(`CONFIG: ${issue}`);
	}

	// 3. DNS health
	const dns = await checkDnsHealth(
		config.helloName.value,
		config.helloName.valid
	);
	if (dns.helloNameResolves === false) {
		summary.push(`DNS: REACHER_HELLO_NAME "${config.helloName.value}" does not resolve. Error: ${dns.helloNameError ?? 'unknown'}`);
	} else if (dns.helloNameResolves === true) {
		summary.push(`DNS: ${config.helloName.value} resolves to ${dns.helloNameAddresses.join(', ')}`);
	}

	// 4. Network health
	const network = await checkNetworkHealth(config, dns);
	if (network.smtpReachability.tested) {
		if (network.smtpReachability.reachable) {
			summary.push(`SMTP: Port ${network.smtpReachability.targetPort} on ${network.smtpReachability.targetHost} is reachable (${network.smtpReachability.latencyMs}ms).`);
		} else {
			summary.push(`SMTP: Port ${network.smtpReachability.targetPort} on ${network.smtpReachability.targetHost} is NOT reachable. Error: ${network.smtpReachability.error ?? 'unknown'}`);
		}
	}

	// 5. Last failure
	let lastFailure: LastFailure = null;
	try {
		lastFailure = getLatestFailureInfo();
	} catch {
		// DB may not be initialized in all contexts
	}

	// 6. Effective CLI args
	const effectiveCliArgs = buildCliArguments('test@example.com');

	// 7. Determine overall health
	const appIntegrationHealthy =
		binary.installed &&
		binary.executable &&
		config.fromEmail.valid !== false &&
		config.helloName.valid !== false;

	let infrastructureLikelyHealthy: boolean | null = null;
	if (dns.helloNameResolves === true && network.smtpReachability.tested) {
		infrastructureLikelyHealthy = network.smtpReachability.reachable === true;
	} else if (dns.helloNameResolves === false) {
		infrastructureLikelyHealthy = false;
	}

	if (appIntegrationHealthy) {
		summary.push('App integration: HEALTHY');
	} else {
		summary.push('App integration: NOT HEALTHY — fix app-side issues first.');
	}

	if (infrastructureLikelyHealthy === true) {
		summary.push('Infrastructure: likely healthy (DNS resolves, SMTP port reachable).');
	} else if (infrastructureLikelyHealthy === false) {
		summary.push('Infrastructure: likely unhealthy — DNS or network issues detected.');
	} else {
		summary.push('Infrastructure: insufficient data to determine — configure REACHER_HELLO_NAME to enable network checks.');
	}

	return {
		timestamp: new Date().toISOString(),
		binary,
		config,
		network,
		lastFailure,
		effectiveCliArgs,
		appIntegrationHealthy,
		infrastructureLikelyHealthy,
		summary
	};
};
