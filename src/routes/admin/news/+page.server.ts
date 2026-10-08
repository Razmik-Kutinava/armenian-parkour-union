import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPostTags, listPosts, postListOptions } from '#lib/server/services/posts/list.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'posts.write');
	const state = readListState(url.searchParams, postListOptions);
	const [{ rows, total }, tags] = await Promise.all([listPosts(db, state), listPostTags(db)]);
	return {
		state,
		total,
		tags,
		rows: rows.map((r) => ({ ...r, coverUrl: r.coverKey ? publicUrl(r.coverKey) : null }))
	};
};
