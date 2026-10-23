import { z } from 'zod';

/* docs/05 section 5 "Results": place `smallint`, score `numeric(6,2)` (docs/02 section 3); an
 * empty cell — not set. Phones type a comma for the decimal point. */

export const RESULT_ROWS_MAX = 2000;

const place = z
	.string()
	.trim()
	.regex(/^(|[1-9]\d{0,2})$/)
	.transform((v) => (v === '' ? null : Number(v)));

const score = z
	.string()
	.trim()
	.transform((v) => v.replace(',', '.'))
	.pipe(z.string().regex(/^(|\d{1,4}(\.\d{1,2})?)$/))
	.transform((v) => (v === '' ? null : Number(v).toFixed(2)));

export const resultRowsSchema = z
	.array(z.object({ registrationId: z.uuid(), place, score }))
	.max(RESULT_ROWS_MAX);

export type ResultRow = z.output<typeof resultRowsSchema>[number];
