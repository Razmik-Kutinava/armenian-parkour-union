import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { volunteerCards } from '#lib/server/db/schema/volunteer-cards.ts';
import { findPublicCard } from '#lib/server/services/volunteer/card-public.ts';
import { CASHIER_COOKIE, findCashier } from '#lib/server/services/volunteer/cashier-access.ts';
import { lastCashierMark, markPerk } from '#lib/server/services/volunteer/perk-mark.ts';
import { visiblePartners } from '#lib/server/services/volunteer/perks-visible.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { LimitDb } from '#lib/server/auth/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 4.12–4.13: the QR leads here; a bound cashier sees mark buttons for their partner
 * only. Not cached — revokes and marks show at once. */
export const load: PageServerLoad = async ({ params, cookies, setHeaders }) => {
	const card = await findPublicCard(db, params.token);
	if (!card) error(404, 'Not Found');
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	const cashier = await findCashier(db, cookies.get(CASHIER_COOKIE));
	if (!card.valid) return { card, cashier: null, mark: null };

	const { avatarKey, partners, ...rest } = card;
	const [row] = await db
		.select({ id: volunteerCards.id })
		.from(volunteerCards)
		.where(eq(volunteerCards.publicToken, params.token));
	const mark =
		cashier && row ? await cashierMarkState(db, row.id, cashier.id, cashier.partnerId) : null;
	const partnerViews = partners.map(({ logoKey, ...p }) => ({
		...p,
		logoUrl: logoKey ? publicUrl(logoKey) : null,
		perks: p.perks.map((perk) => ({ ...perk, mark: markPerkView(mark, perk.id) }))
	}));
	if (cashier && row && mark) {
		const all = await visiblePartners(db, row.id);
		const mine = all.find((p) => p.id === cashier.partnerId);
		if (mine) {
			const merged = {
				id: mine.id,
				name: mine.name,
				logoUrl: mine.logoKey ? publicUrl(mine.logoKey) : null,
				perks: mine.perks.map((perk) => ({
					...perk,
					mark: markPerkView(mark, perk.id)
				}))
			};
			const idx = partnerViews.findIndex((p) => p.id === mine.id);
			if (idx >= 0) partnerViews[idx] = merged;
			else partnerViews.push(merged);
		}
	}

	return {
		card: {
			...rest,
			photoUrl: avatarKey ? publicUrl(avatarKey) : null,
			partners: partnerViews
		},
		cashier: cashier && {
			partnerId: cashier.partnerId,
			partnerName: cashier.partnerName,
			label: cashier.label
		},
		mark
	};
};

async function cashierMarkState(db: LimitDb, cardId: string, cashierId: string, partnerId: string) {
	const all = await visiblePartners(db, cardId);
	const mine = all.find((p) => p.id === partnerId);
	if (!mine) return { perks: [] as MarkPerkView[] };
	const perks: MarkPerkView[] = [];
	for (const perk of mine.perks) {
		const markedAt = await lastCashierMark(db, cardId, perk.id, cashierId);
		perks.push({
			id: perk.id,
			remaining: perk.remaining,
			kind: perk.kind,
			canMark: perk.kind === 'reusable' || (perk.remaining !== null && perk.remaining > 0),
			markedAt: markedAt && perk.kind === 'single' && perk.remaining === 0 ? markedAt : null
		});
	}
	return { perks };
}

type MarkPerkView = {
	id: string;
	remaining: number | null;
	kind: 'reusable' | 'single';
	canMark: boolean;
	markedAt: Date | null;
};

const markPerkView = (mark: { perks: MarkPerkView[] } | null, perkId: string) =>
	mark?.perks.find((p) => p.id === perkId) ?? null;

const markErrors: Record<string, MessageKey> = {
	invalid_card: 'volunteerCashier.mark.invalidCard',
	no_uses_left: 'volunteerCashier.mark.noUsesLeft',
	perk_unavailable: 'volunteerCashier.mark.perkUnavailable',
	wrong_partner: 'volunteerCashier.mark.perkUnavailable',
	cashier_gone: 'volunteerCashier.mark.noAccess',
	bad_request: 'volunteerCashier.mark.perkUnavailable',
	not_found: 'volunteerCashier.mark.perkUnavailable'
};

export const actions: Actions = {
	mark: async ({ params, request, cookies, url }) => {
		const cashier = await findCashier(db, cookies.get(CASHIER_COOKIE));
		if (!cashier) return fail(403, { error: 'volunteerCashier.mark.noAccess' as MessageKey });
		const formData = await request.formData();
		const partnerId = String(formData.get('partnerId') ?? '');
		const perkId = String(formData.get('perkId') ?? '');
		const confirm = String(formData.get('confirm') ?? '') === '1';
		if (!confirm) return { confirm: { partnerId, perkId } as const };

		const result = await markPerk(db, params.token, cashier, partnerId, perkId);
		if (!result.ok) {
			const key = markErrors[result.reason] ?? 'volunteerCashier.mark.perkUnavailable';
			return fail(400, { error: key });
		}
		redirect(303, url.pathname + url.search);
	}
};
