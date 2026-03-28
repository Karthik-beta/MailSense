import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { appConfig } from '$lib/server/config';
import * as schema from './schema';

const databasePath = appConfig.databaseUrl.startsWith('/')
	? appConfig.databaseUrl
	: resolve(process.cwd(), appConfig.databaseUrl);

mkdirSync(dirname(databasePath), { recursive: true });

const client = new Database(databasePath);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');
client.pragma('synchronous = NORMAL');

export const db = drizzle(client, { schema });

export { client };
export { databasePath };
