import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	archiveHeroBlock,
	duplicateHeroBlock,
	restoreHeroBlock,
	updateHeroBlock
} from '#lib/server/services/hero/edit.ts';
import { getHeroBlock } from '#lib/server/services/hero/list.ts';
import { heroChoices, readHeroForm, refused } from '../form';
import { formValues } from './values';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'hero.write');
	const block = await getHeroBlock(db, params.id);
	if (!block) error(404, 'Not found');
	return {
		...(await heroChoices(block.eventId, block.personUserId)),
		block: { id: block.id, title: block.title, archived: block.archivedAt !== null },
		values: formValues(block)
	};
};

type Lifecycle = typeof archiveHeroBlock;

/** Buttons outside the form: an archived block is a message, the rest is 403 / 404. */
function stateRefused(result: string) {
	if (result === 'bad_state') return fail(400, { badState: true as const });
	error(result === 'not_found' ? 404 : 403, result === 'not_found' ? 'Not found' : 'Forbidden');
}

async function move(event: RequestEvent<{ id: string }>, run: Lifecycle) {
	const actor = requirePermission(event.locals.user, 'hero.write');
	const result = await run(db, actor, event.params.id, event.getClientAddress());
	if (result !== 'ok') return stateRefused(result);
	return { saved: true as const };
}

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'hero.write');
		const form = await readHeroForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updateHeroBlock(db, actor, event.params.id, form.values, ip);
		if (result !== 'ok') return refused(result, form.raw);
		return { saved: true as const };
	},
	duplicate: async (event) => {
		const actor = requirePermission(event.locals.user, 'hero.write');
		const result = await duplicateHeroBlock(db, actor, event.params.id, event.getClientAddress());
		if (typeof result === 'string') return stateRefused(result);
		redirect(303, `/admin/hero/${result.id}`);
	},
	archive: (event) => move(event, archiveHeroBlock),
	restore: (event) => move(event, restoreHeroBlock)
};
