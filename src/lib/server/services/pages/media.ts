import { and, inArray, isNull } from 'drizzle-orm';
import type { PageBody } from '#lib/validation/pages.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';

/** Library images in the cleaned HTML: `<img src="{R2_PUBLIC_URL}/media/…">`. */
function mediaKeys(body: PageBody): string[] {
	const keys = new Set<string>();
	for (const html of Object.values(body)) {
		for (const m of (html ?? '').matchAll(/<img\b[^>]*?\bsrc="[^"]*?\/(media\/[^"]+)"/g)) {
			keys.add(m[1]);
		}
	}
	return [...keys];
}

/** docs/05 section 20: a file starting to be used is locked, so a parallel delete waits. */
export async function lockPageMedia(tx: LimitDb, body: PageBody) {
	const keys = mediaKeys(body);
	if (keys.length === 0) return;
	await tx
		.select({ id: media.id })
		.from(media)
		.where(and(inArray(media.key, keys), isNull(media.deletedAt)))
		.for('share');
}
