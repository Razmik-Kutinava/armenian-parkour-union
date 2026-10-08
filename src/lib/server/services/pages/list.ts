import { and, desc, eq, isNull } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { PageBody, PageStatus } from '#lib/validation/pages.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pages } from '../../db/schema/content';
import { isUuid } from '../users/target';

export type PageRow = {
	id: string;
	slug: string;
	title: LocalizedText;
	status: PageStatus;
	isSystem: boolean;
	updatedAt: Date;
};
export type PageDetail = PageRow & { body: PageBody; updatedBy: string | null; deletedAt: null };

const columns = {
	id: pages.id,
	slug: pages.slug,
	title: pages.title,
	status: pages.status,
	isSystem: pages.isSystem,
	updatedAt: pages.updatedAt
};

/** docs/05 section 19: title, address, status, last change. Pages are few: no paging. */
export async function listPages(db: LimitDb): Promise<PageRow[]> {
	const rows = await db
		.select(columns)
		.from(pages)
		.where(isNull(pages.deletedAt))
		.orderBy(desc(pages.isSystem), desc(pages.updatedAt));
	return rows as PageRow[];
}

export async function getPage(db: LimitDb, id: string): Promise<PageDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			...columns,
			body: pages.body,
			updatedBy: pages.updatedBy,
			deletedAt: pages.deletedAt
		})
		.from(pages)
		.where(and(eq(pages.id, id), isNull(pages.deletedAt)));
	return (row as PageDetail | undefined) ?? null;
}
