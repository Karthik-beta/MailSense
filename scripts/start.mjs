import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const rawDatabasePath = process.env.DATABASE_URL || './data/mailsense.db';
const databasePath = rawDatabasePath.startsWith('/')
	? rawDatabasePath
	: resolve(process.cwd(), rawDatabasePath);
const buildDirectoryPath = resolve(process.cwd(), 'build');
const buildIndexPath = resolve(buildDirectoryPath, 'index.js');

const resolveBuildEntry = () => {
	if (existsSync(buildIndexPath)) {
		return buildIndexPath;
	}

	if (existsSync(buildDirectoryPath) && !statSync(buildDirectoryPath).isDirectory()) {
		return buildDirectoryPath;
	}

	console.error('Production build output is missing. Run `bun run build` before `bun run start`.');
	process.exit(1);
};

const failDatabaseStart = (error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Failed to initialize SQLite at ${databasePath}: ${message}`);
	process.exit(1);
};

try {
	mkdirSync(dirname(databasePath), { recursive: true });
} catch (error) {
	failDatabaseStart(error);
}

const migrationsFolder = resolve(process.cwd(), 'drizzle');

if (existsSync(migrationsFolder)) {
	let client;

	try {
		client = new Database(databasePath);
		client.pragma('journal_mode = WAL');
		client.pragma('foreign_keys = ON');
		const db = drizzle(client);
		migrate(db, { migrationsFolder });
	} catch (error) {
		failDatabaseStart(error);
	} finally {
		client?.close();
	}
}

const child = spawn(process.execPath, [resolveBuildEntry()], {
	stdio: 'inherit',
	env: {
		...process.env,
		HOST: process.env.HOST || '0.0.0.0',
		PROTOCOL_HEADER: process.env.PROTOCOL_HEADER || 'x-forwarded-proto',
		HOST_HEADER: process.env.HOST_HEADER || 'x-forwarded-host',
		PORT_HEADER: process.env.PORT_HEADER || 'x-forwarded-port',
		BODY_SIZE_LIMIT: process.env.BODY_SIZE_LIMIT || '20M'
	}
});

const forwardSignal = (signal) => {
	if (child.exitCode === null) {
		child.kill(signal);
	}
};

process.on('SIGTERM', () => {
	forwardSignal('SIGTERM');
});

process.on('SIGINT', () => {
	forwardSignal('SIGINT');
});

child.on('exit', (code) => {
	process.exit(code ?? 0);
});

child.on('error', (error) => {
	console.error(`Failed to start the production server: ${error.message}`);
	process.exit(1);
});
