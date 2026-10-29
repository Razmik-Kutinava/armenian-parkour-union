import { asc, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerPartners } from '../../db/schema/volunteer-partners';

/* docs/05 section 28 "Partners": every partner (archived too) in the order of the check page. */

export const partnerOrder = [
	asc(volunteerPartners.sortOrder),
	asc(volunteerPartners.createdAt),
	asc(volunteerPartners.id)
];

export async function listPartnersAdmin(db: LimitDb) {
	return db
		.select({
			id: volunteerPartners.id,
			name: volunteerPartners.name,
			logoKey: volunteerPartners.logoKey,
			status: volunteerPartners.status,
			/* Plain SQL: with one table in FROM, Drizzle drops the table name of columns. */
			perksPublished: sql<number>`(select count(*)::int from volunteer_perks p
				where p.partner_id = volunteer_partners.id and p.status = 'published')`,
			cashiersActive: sql<number>`(select count(*)::int from partner_cashiers c
				where c.partner_id = volunteer_partners.id and c.bound_at is not null
					and c.disabled_at is null)`,
			/* Cashier marks of the last 30 days that were not reversed. */
			uses30Days: sql<number>`(select count(*)::int from perk_redemptions r
				where r.partner_id = volunteer_partners.id and r.reversal_of_id is null
					and r.created_at > now() - interval '30 days'
					and not exists (select 1 from perk_redemptions x where x.reversal_of_id = r.id))`
		})
		.from(volunteerPartners)
		.orderBy(...partnerOrder);
}
export type PartnerRow = Awaited<ReturnType<typeof listPartnersAdmin>>[number];
