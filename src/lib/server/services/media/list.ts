import { and, count, desc, eq, ilike, isNull, like, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { AltText } from '#lib/validation/media.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { isUuid } from '../users/target';

export const mediaListOptions: ListOptions = {
	sortable: ['createdAt'],
	filters: ['kind'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type MediaRow = {
	id: string;
	key: string;
	originalName: string;
	mime: string;
	sizeBytes: number;
	alt: AltText;
	createdAt: Date;
	deletedAt: Date | null;
};

const columns = {
	id: media.id,
	key: media.key,
	originalName: media.originalName,
	mime: media.mime,
	sizeBytes: media.sizeBytes,
	alt: media.alt,
	createdAt: media.createdAt,
	deletedAt: media.deletedAt
};
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions(state: ListState): SQL[] {
	const where: SQL[] = [isNull(media.deletedAt)];
	if (state.q) where.push(ilike(media.originalName, `%${escapeLike(state.q)}%`));
	if (state.filters.kind === 'image') where.push(like(media.mime, 'image/%'));
	if (state.filters.kind === 'pdf') where.push(eq(media.mime, 'application/pdf'));
	return where;
}

/** docs/05 section 20: newest first, search by file name, filter by kind; deleted files hidden. */
export async function listMedia(
	db: LimitDb,
	state: ListState
): Promise<{ rows: MediaRow[]; total: number }> {
	const where = and(...conditions(state));
	const rows = await db
		.select(columns)
		.from(media)
		.where(where)
		.orderBy(desc(media.createdAt), desc(media.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db.select({ total: count() }).from(media).where(where);
	return { rows: rows as MediaRow[], total };
}

export async function getMedia(db: LimitDb, id: string): Promise<MediaRow | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select(columns)
		.from(media)
		.where(and(eq(media.id, id), isNull(media.deletedAt)));
	return (row as MediaRow | undefined) ?? null;
}
