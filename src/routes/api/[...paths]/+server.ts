import type { RequestHandler } from './$types';
import { createApiApp } from '$lib/server/api';

const handle: RequestHandler = (event) => createApiApp(event).fetch(event.request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
