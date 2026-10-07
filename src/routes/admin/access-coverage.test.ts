import { describe, expect, it } from 'vitest';
import { ADMIN_READS, ADMIN_WRITES } from '../../../tests/e2e/admin-access-map';
import { ADMIN_AUDIT, NOT_AUDITED } from '../../../tests/e2e/admin-audit-map';

const pages = import.meta.glob('./**/+page.svelte');
const endpoints = import.meta.glob<Record<string, unknown>>('./**/+server.ts');

/* './users/[id]/+page.svelte' → '/admin/users/[id]' */
const routeId = (file: string, name: string) => `/admin${file.slice(1, -(name.length + 1))}`;

async function adminReads(): Promise<string[]> {
	const found = Object.keys(pages).map((file) => routeId(file, '+page.svelte'));
	for (const [file, load] of Object.entries(endpoints)) {
		if ('GET' in (await load())) found.push(`GET ${routeId(file, '+server.ts')}`);
	}
	return found.sort();
}

describe('every admin route is in the access map (docs/04 section 5, roadmap 1.13)', () => {
	it('each page and GET endpoint has its permission', async () => {
		expect(await adminReads()).toEqual(Object.keys(ADMIN_READS).sort());
	});

	it('each data-changing action has its permission (same list as the audit map)', () => {
		const writes = [...Object.keys(ADMIN_AUDIT), ...Object.keys(NOT_AUDITED)].sort();
		expect(Object.keys(ADMIN_WRITES).sort()).toEqual(writes);
	});
});
