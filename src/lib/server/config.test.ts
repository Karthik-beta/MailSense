import { afterEach, describe, expect, it, vi } from 'vitest';

const loadConfig = async (mockEnv: Record<string, string | undefined>) => {
	vi.resetModules();
	vi.doMock('$env/dynamic/private', () => ({ env: mockEnv }));
	return (await import('$lib/server/config')).appConfig;
};

afterEach(() => {
	vi.resetModules();
	vi.doUnmock('$env/dynamic/private');
});

describe('appConfig Railway fallbacks', () => {
	it('uses local defaults when Railway variables are absent', async () => {
		const config = await loadConfig({});

		expect(config.publicBaseUrl).toBe('http://localhost:5173');
		expect(config.databaseUrl).toBe('./data/mailsense.db');
	});

	it('derives URL and database path from Railway-provided variables', async () => {
		const config = await loadConfig({
			RAILWAY_PUBLIC_DOMAIN: 'mailsense-production.up.railway.app',
			RAILWAY_VOLUME_MOUNT_PATH: '/data'
		});

		expect(config.publicBaseUrl).toBe('https://mailsense-production.up.railway.app');
		expect(config.databaseUrl).toBe('/data/mailsense.db');
	});

	it('prefers explicit values over Railway fallbacks', async () => {
		const config = await loadConfig({
			BETTER_AUTH_URL: 'https://app.example.com',
			ORIGIN: 'https://ignored.example.com',
			DATABASE_URL: '/custom/data.db',
			RAILWAY_PUBLIC_DOMAIN: 'mailsense-production.up.railway.app',
			RAILWAY_VOLUME_MOUNT_PATH: '/data'
		});

		expect(config.publicBaseUrl).toBe('https://app.example.com');
		expect(config.databaseUrl).toBe('/custom/data.db');
	});
});