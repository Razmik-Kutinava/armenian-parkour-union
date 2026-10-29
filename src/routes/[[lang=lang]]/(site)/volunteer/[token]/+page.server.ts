import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { findPublicCard } from '#lib/server/services/volunteer/card-public.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.12: the QR of the card leads here. Not cached — a revoke or a lapsed membership
 * shows at once. */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const card = await findPublicCard(db, params.token);
	if (!card) error(404, 'Not Found');
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	if (!card.valid) return { card };
	const { avatarKey, partners, ...rest } = card;
	return {
		card: {
			...rest,
			photoUrl: avatarKey ? publicUrl(avatarKey) : null,
			partners: partners.map(({ logoKey, ...p }) => ({
				...p,
				logoUrl: logoKey ? publicUrl(logoKey) : null
			}))
		}
	};
};
