import type { RequestEvent } from '@sveltejs/kit';
import type { User } from 'better-auth';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDashboardData } from './dashboard';
import { exportLeadRows } from './export';
import { getUploadDetails, importLeadFile, listUploads } from './imports';
import { listLeads, parseLeadFilters } from './leads';
import {
	createVerificationRun,
	getVerificationRun,
	listVerificationRuns,
	processVerificationRun,
	verifySingleEmail
} from './verification';
import { checkSetupReadiness } from './setup';

type ApiVariables = {
	user: User | null;
};

const singleVerificationSchema = z.object({
	email: z.string().min(3)
});

const runCreateSchema = z.object({
	leadIds: z.array(z.string()).optional(),
	filters: z
		.object({
			query: z.string().optional(),
			status: z.enum(['safe', 'risky', 'invalid', 'unknown', 'unverified', 'all']).optional(),
			risk: z.enum(['valid', 'risky', 'invalid', 'unknown', 'all']).optional(),
			uploadId: z.string().nullable().optional(),
			sort: z.enum(['newest', 'oldest', 'email', 'status', 'risk', 'verified']).optional(),
			page: z.number().int().positive().optional(),
			pageSize: z.number().int().positive().optional()
		})
		.optional(),
	source: z.enum(['filter', 'manual']).optional()
});

export const createApiApp = (event: RequestEvent) => {
	const app = new Hono<{ Variables: ApiVariables }>().basePath('/api');

	app.use('*', async (c, next) => {
		c.set('user', event.locals.user ?? null);
		await next();
	});

	app.get('/health', (c) => c.json({ ok: true, service: 'mailsense' }));

	app.use('*', async (c, next) => {
		if (c.req.path === '/api/health') {
			await next();
			return;
		}

		if (!c.get('user')) {
			return c.json({ error: 'Unauthorized' }, 401);
		}

		await next();
	});

	app.get('/dashboard', (c) => c.json(getDashboardData()));

	app.get('/uploads', (c) => {
		const uploadId = c.req.query('uploadId');
		if (uploadId) {
			const upload = getUploadDetails(uploadId);
			if (!upload) {
				return c.json({ error: 'Upload not found' }, 404);
			}

			return c.json(upload);
		}

		return c.json({ items: listUploads(20) });
	});

	app.post('/uploads', async (c) => {
		const user = c.get('user');
		if (!user) {
			return c.json({ error: 'Unauthorized' }, 401);
		}

		const formData = await c.req.formData();
		const file = formData.get('file');
		const emailColumn = formData.get('emailColumn');

		if (!(file instanceof File)) {
			return c.json({ error: 'Upload a .csv or .xlsx file.' }, 400);
		}

		try {
			const result = await importLeadFile({
				file,
				requestedEmailColumn: typeof emailColumn === 'string' ? emailColumn : null,
				userId: user.id
			});
			return c.json(result, result.status === 'failed' ? 400 : 200);
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Unable to import the uploaded file.' },
				400
			);
		}
	});

	app.get('/leads', (c) => {
		const filters = parseLeadFilters(new URL(c.req.url).searchParams);
		return c.json(listLeads(filters));
	});

	app.get('/runs', (c) => {
		const runId = c.req.query('runId');
		if (runId) {
			const run = getVerificationRun(runId);
			if (!run) {
				return c.json({ error: 'Run not found' }, 404);
			}

			return c.json(run);
		}

		return c.json({ items: listVerificationRuns(20) });
	});

	app.post('/runs', async (c) => {
		const user = c.get('user');
		if (!user) {
			return c.json({ error: 'Unauthorized' }, 401);
		}

		const parsed = runCreateSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) {
			return c.json({ error: 'Invalid verification run payload.' }, 400);
		}

		const run = createVerificationRun({
			createdByUserId: user.id,
			leadIds: parsed.data.leadIds,
			filters: parsed.data.filters,
			source: parsed.data.source ?? 'filter'
		});

		return c.json(run, 201);
	});

	app.post('/runs/:id/process', async (c) => {
		try {
			const run = await processVerificationRun(c.req.param('id'));
			return c.json(run);
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Unable to process the run.' },
				400
			);
		}
	});

	app.post('/verify/single', async (c) => {
		const parsed = singleVerificationSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) {
			return c.json({ error: 'Enter a valid email address.' }, 400);
		}

		try {
			const result = await verifySingleEmail(parsed.data.email);
			return c.json(result);
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Unable to verify the email.' },
				400
			);
		}
	});

	app.get('/export', (c) => {
		const format = c.req.query('format') === 'xlsx' ? 'xlsx' : 'csv';
		const payload = exportLeadRows(parseLeadFilters(new URL(c.req.url).searchParams), format);

		return new Response(payload.body, {
			status: 200,
			headers: {
				'content-type': payload.contentType,
				'content-disposition': `attachment; filename="${payload.fileName}"`
			}
		});
	});

	app.get('/setup/reacher', async (c) => {
		try {
			const result = await checkSetupReadiness();
			return c.json(result);
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : 'Setup check failed.' },
				500
			);
		}
	});

	app.notFound((c) => c.json({ error: 'Not found' }, 404));

	return app;
};
