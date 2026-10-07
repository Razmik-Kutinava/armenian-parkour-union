import { describe, expect, it } from 'vitest';
import { ADMIN_AUDIT, NOT_AUDITED } from '../../../tests/e2e/admin-audit-map';

const pages = import.meta.glob<{ actions?: Record<string, unknown> }>('./**/+page.server.ts');
const endpoints = import.meta.glob<Record<string, unknown>>('./**/+server.ts');
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/* './users/[id]/+page.server.ts' → '/admin/users/[id]' */
const routeId = (file: string, name: string) => `/admin${file.slice(1, -(name.length + 1))}`;

async function adminWrites(): Promise<string[]> {
	const found: string[] = [];
	for (const [file, load] of Object.entries(pages)) {
		const id = routeId(file, '+page.server.ts');
		for (const action of Object.keys((await load()).actions ?? {})) found.push(`${id}?/${action}`);
	}
	for (const [file, load] of Object.entries(endpoints)) {
		const id = routeId(file, '+server.ts');
		const mod = await load();
		for (const method of WRITE_METHODS) if (method in mod) found.push(`${method} ${id}`);
	}
	return found.sort();
}

describe('every admin action is in the audit log (docs/04 section 2, roadmap 1.11)', () => {
	it('each data-changing action or endpoint is mapped to audit codes or a reason', async () => {
		const mapped = [...Object.keys(ADMIN_AUDIT), ...Object.keys(NOT_AUDITED)].sort();
		expect(await adminWrites()).toEqual(mapped);
	});

	it('each mapped action writes at least one audit code', () => {
		for (const codes of Object.values(ADMIN_AUDIT)) expect(codes.length).toBeGreaterThan(0);
	});
});
