import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { paymentsCsv, paymentsForExport } from '#lib/server/services/payments/admin/index.ts';
import { exportQuerySchema } from '#lib/validation/admin-payments.ts';
import type { RequestHandler } from './$types';

/** docs/05 section 16, docs/07 section 12 p. 4: fees or donations of a period, for accounting. */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals.user, 'payments.read');
	const parsed = exportQuerySchema.safeParse({ kind: url.searchParams.get('kind') ?? undefined });
	if (!parsed.success) error(400, 'Choose fees or donations');
	const { kind } = parsed.data;
	const from = url.searchParams.get('from') ?? undefined;
	const to = url.searchParams.get('to') ?? undefined;
	const csv = paymentsCsv(kind, await paymentsForExport(db, { kind, from, to }));
	const name = [kind, from, to].filter(Boolean).join('-');
	// BOM: spreadsheets then read Armenian and Russian text as UTF-8
	return new Response('\uFEFF' + csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="payments-${name.replace(/[^a-z0-9-]/gi, '')}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
