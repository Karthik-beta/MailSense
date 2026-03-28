import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const version = '0.11.6';
const rootDir = process.cwd();
const installRoot = resolve(rootDir, '.reacher');
const installDirectory = resolve(installRoot, 'bin');
const versionFilePath = resolve(installRoot, 'VERSION');
const binaryName = 'check_if_email_exists';
const binaryPath = resolve(installDirectory, binaryName);

const shouldSkipInstall = () =>
	(process.env.SKIP_REACHER_CLI_INSTALL || '').trim().toLowerCase() === 'true';

const getTargetTriple = () => {
	if (process.platform === 'linux' && process.arch === 'x64') {
		return 'x86_64-unknown-linux-gnu';
	}

	if (process.platform === 'linux' && process.arch === 'arm64') {
		return 'aarch64-unknown-linux-gnu';
	}

	if (process.platform === 'darwin' && process.arch === 'x64') {
		return 'x86_64-apple-darwin';
	}

	if (process.platform === 'darwin' && process.arch === 'arm64') {
		return 'aarch64-apple-darwin';
	}

	throw new Error(`Embedded Reacher CLI is not supported on ${process.platform}/${process.arch}.`);
};

const getInstalledVersion = () => {
	if (!existsSync(binaryPath) || !existsSync(versionFilePath)) {
		return null;
	}

	return readFileSync(versionFilePath, 'utf8').trim() || null;
};

const downloadArchive = async (url, destinationPath) => {
	const response = await fetch(url, {
		headers: {
			'user-agent': 'MailSense build/install'
		}
	});

	if (!response.ok || !response.body) {
		throw new Error(`Download failed with ${response.status} for ${url}.`);
	}

	await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath));
};

const installBinary = async () => {
	const targetTriple = getTargetTriple();
	const assetName = `${binaryName}-${targetTriple}.tar.gz`;
	const tmpDirectory = resolve(installRoot, 'tmp');
	const archivePath = resolve(tmpDirectory, assetName);
	const extractDirectory = resolve(tmpDirectory, 'extract');
	const releaseUrls = [
		`https://github.com/reacherhq/check-if-email-exists/releases/download/v${version}/${assetName}`,
		`https://github.com/reacherhq/check-if-email-exists/releases/download/${version}/${assetName}`
	];

	rmSync(tmpDirectory, { recursive: true, force: true });
	mkdirSync(tmpDirectory, { recursive: true });
	mkdirSync(installDirectory, { recursive: true });

	let lastError = null;
	for (const url of releaseUrls) {
		try {
			await downloadArchive(url, archivePath);
			lastError = null;
			break;
		} catch (error) {
			lastError = error;
		}
	}

	if (lastError) {
		throw lastError;
	}

	mkdirSync(extractDirectory, { recursive: true });
	const tarResult = spawnSync('tar', ['-xzf', archivePath, '-C', extractDirectory], {
		cwd: rootDir,
		encoding: 'utf8'
	});

	if (tarResult.status !== 0) {
		throw new Error(
			`Failed to extract embedded Reacher CLI. ${tarResult.stderr || tarResult.stdout || tarResult.error?.message || 'Ensure tar is installed in the build environment.'}`
		);
	}

	const extractedBinaryPath = resolve(extractDirectory, binaryName);
	if (!existsSync(extractedBinaryPath)) {
		throw new Error('Embedded Reacher CLI archive did not contain the expected binary.');
	}

	rmSync(binaryPath, { force: true });
	renameSync(extractedBinaryPath, binaryPath);
	chmodSync(binaryPath, 0o755);
	writeFileSync(versionFilePath, `${version}\n`, 'utf8');
	rmSync(tmpDirectory, { recursive: true, force: true });
};

const main = async () => {
	if (shouldSkipInstall()) {
		console.log('Skipping embedded Reacher CLI install because SKIP_REACHER_CLI_INSTALL=true.');
		return;
	}

	if (getInstalledVersion() === version) {
		console.log(`Embedded Reacher CLI ${version} is already installed.`);
		return;
	}

	await installBinary();
	console.log(`Embedded Reacher CLI ${version} installed at ${binaryPath}.`);
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
