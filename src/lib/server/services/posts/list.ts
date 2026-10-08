import {
	and,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	sql,
	type SQL
} from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { PostStatus, PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';

export const postListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'tag', 'from', 'to'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type PostRow = {
	id: string;
	slug: string;
	title: LocalizedText;
	coverKey: string | null;
	status: PostStatus;
	publishedAt: Date | null;
	authorName: string | null;
	/** Published with a date still ahead: not on the site yet. */
	scheduled: boolean;
};
export type PostDetail = {
	id: string;
	slug: string;
	title: LocalizedText;
	excerpt: PostText;
	body: PostText;
	coverKey: string | null;
	tags: string[];
	status: PostStatus;
	publishedAt: Date | null;
	authorId: string | null;
	updatedAt: Date;
};

/** Who may be named the author (decision 2.4): active editors and admins. */
export const authorCondition = and(
	inArray(users.role, ['editor', 'admin']),
	eq(users.status, 'active'),
	isNull(users.deletedAt)
);

export async function listAuthors(db: LimitDb): Promise<{ id: string; name: string }[]> {
	return db.select({ id: users.id, name: users.name }).from(users).where(authorCondition);
}

/** Tags in use, for the filter. */
export async function listPostTags(db: LimitDb): Promise<string[]> {
	const rows = await db
		.selectDistinct({ tag: sql<string>`unnest(${posts.tags})` })
		.from(posts)
		.where(isNull(posts.deletedAt))
		.orderBy(sql`1`)
		.limit(200);
	return rows.map((r) => r.tag);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const yerevanDay = (day: string) => sql`(${day}::date)::timestamp AT TIME ZONE 'Asia/Yerevan'`;

function conditions({ q, filters }: ListState): SQL[] {
	const where: SQL[] = [isNull(posts.deletedAt)];
	if (q) where.push(sql`${posts.title}::text ilike ${`%${escapeLike(q)}%`}`);
	const status = filters.status;
	if (status === 'scheduled') {
		where.push(eq(posts.status, 'published'), gt(posts.publishedAt, sql`now()`));
	} else if (status === 'published') {
		where.push(eq(posts.status, 'published'), lte(posts.publishedAt, sql`now()`));
	} else if (status === 'draft' || status === 'archived') {
		where.push(eq(posts.status, status));
	}
	if (filters.tag) where.push(sql`${filters.tag} = any(${posts.tags})`);
	if (filters.from && DAY.test(filters.from)) {
		where.push(gte(posts.publishedAt, yerevanDay(filters.from)));
	}
	if (filters.to && DAY.test(filters.to)) {
		where.push(lt(posts.publishedAt, sql`${yerevanDay(filters.to)} + interval '1 day'`));
	}
	return where;
}

/** docs/05 section 18: cover, title, status, date, author; filters status, tag, period; search. */
export async function listPosts(
	db: LimitDb,
	state: ListState
): Promise<{ rows: PostRow[]; total: number }> {
	const where = and(...conditions(state));
	const rows = await db
		.select({
			id: posts.id,
			slug: posts.slug,
			title: posts.title,
			coverKey: posts.coverKey,
			status: posts.status,
			publishedAt: posts.publishedAt,
			authorName: users.name,
			scheduled: sql<boolean>`(${posts.status} = 'published' and ${posts.publishedAt} > now())`
		})
		.from(posts)
		.leftJoin(users, eq(users.id, posts.authorId))
		.where(where)
		.orderBy(desc(posts.createdAt), desc(posts.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db.select({ total: count() }).from(posts).where(where);
	return { rows: rows as PostRow[], total };
}

export async function getPost(db: LimitDb, id: string): Promise<PostDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: posts.id,
			slug: posts.slug,
			title: posts.title,
			excerpt: posts.excerpt,
			body: posts.body,
			coverKey: posts.coverKey,
			tags: posts.tags,
			status: posts.status,
			publishedAt: posts.publishedAt,
			authorId: posts.authorId,
			updatedAt: posts.updatedAt
		})
		.from(posts)
		.where(and(eq(posts.id, id), isNull(posts.deletedAt)));
	return (row as PostDetail | undefined) ?? null;
}
