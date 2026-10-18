import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { heroLimit } from '#lib/server/services/hero/checks.ts';
import { listHeroBlocks } from '#lib/server/services/hero/list.ts';
import { reorderHeroBlocks } from '#lib/server/services/hero/order.ts';
import { getHeroSlides } from '#lib/server/services/hero/public.ts';
import { setHeroActive } from '#lib/server/services/hero/toggle.ts';
import { withHeroMedia } from '#lib/server/services/hero/view.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { heroTypes, type HeroType } from '#lib/validation/hero-enums.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 4: what the home page shows now, cards in order, switch, order, filters. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'hero.write');
	const archived = url.searchParams.get('archived') === '1';
	const typeParam = url.searchParams.get('type') ?? '';
	const type = (heroTypes as readonly string[]).includes(typeParam)
		? (typeParam as HeroType)
		: undefined;
	const activeParam = url.searchParams.get('active');
	const active = activeParam === '1' ? true : activeParam === '0' ? false : undefined;
	const rows = await listHeroBlocks(db, { archived, type, active });
	return {
		rows: rows.map((r) => ({ ...r, mediaUrl: r.mediaKey ? publicUrl(r.mediaKey) : null })),
		slides: (await getHeroSlides(db, locals.locale)).map(withHeroMedia),
		max: await heroLimit(db),
		filter: { archived, type: type ?? '', active: activeParam ?? '' }
	};
};

export const actions: Actions = {
	toggle: async (event) => {
		const actor = requirePermission(event.locals.user, 'hero.write');
		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		const on = data.get('active') === 'true';
		const result = await setHeroActive(db, actor, id, on, event.getClientAddress());
		if (result === 'limit') return fail(400, { limit: true as const });
		if (result === 'bad_state') return fail(400, { badState: true as const });
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { saved: true as const };
	},
	reorder: async (event) => {
		const actor = requirePermission(event.locals.user, 'hero.write');
		const order = String((await event.request.formData()).get('order') ?? '');
		const ids = order.split(',').filter(Boolean);
		const result = await reorderHeroBlocks(db, actor, ids, event.getClientAddress());
		if (result === 'bad_order') return fail(400, { badOrder: true as const });
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { saved: true as const };
	}
};
