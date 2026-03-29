import type { PageServerLoad } from './$types';
import { runDiagnostics, type DiagnosticsResult } from '$lib/server/diagnostics';

export const load: PageServerLoad = async (): Promise<{ diagnostics: DiagnosticsResult }> => ({
	diagnostics: await runDiagnostics()
});
