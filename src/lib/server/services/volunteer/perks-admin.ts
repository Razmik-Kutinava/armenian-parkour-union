import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { PerkValues } from '#lib/validation/volunteer-partners.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerPartners, volunteerPerks } from '../../db/schema/volunteer-partners';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 28 "Perks" tab; decisions — docs/todo.md 10.2. Never deleted: archived
 * (redemptions point here). A perk is reached only through its own partner. */

type Refusal = 'not_allowed' | 'not_found';
const LOGGED = [
	'title',
	'terms',
	'kind',
	'usesLimit',
	'validFrom',
	'validUntil',
	'status',
	'sortOrder'
] as const;

const columns = {
	id: volunteerPerks.id,
	title: volunteerPerks.title,
	terms: volunteerPerks.terms,
	kind: volunteerPerks.kind,
	usesLimit: volunteerPerks.usesLimit,
	validFrom: volunteerPerks.validFrom,
	validUntil: volunteerPerks.validUntil,
	status: volunteerPerks.status,
	sortOrder: volunteerPerks.sortOrder
};
export type AdminPerk = PerkValues & { id: string };
const asPerk = (row: { title: unknown; terms: unknown } & Omit<AdminPerk, 'title' | 'terms'>) => ({
	...row,
	title: row.title as LocalizedText,
	terms: row.terms as PerkValues['terms']
});

const canManage = (actor: Actor) => roleCan(actor.role, 'volunteer.manage');
const ofPartner = (partnerId: string, perkId: string) =>
	and(eq(volunteerPerks.id, perkId), eq(volunteerPerks.partnerId, partnerId));

export async function listPerks(db: LimitDb, partnerId: string): Promise<AdminPerk[]> {
	if (!isUuid(partnerId)) return [];
	const rows = await db
		.select(columns)
		.from(volunteerPerks)
		.where(eq(volunteerPerks.partnerId, partnerId))
		.orderBy(asc(volunteerPerks.sortOrder), asc(volunteerPerks.createdAt), asc(volunteerPerks.id));
	return rows.map(asPerk);
}

export async function getPerk(db: LimitDb, partnerId: string, perkId: string) {
	if (!isUuid(partnerId) || !isUuid(perkId)) return null;
	const [row] = await db.select(columns).from(volunteerPerks).where(ofPartner(partnerId, perkId));
	return row ? asPerk(row) : null;
}

export async function createPerk(
	db: LimitDb,
	actor: Actor,
	partnerId: string,
	values: PerkValues,
	ip: string | null
): Promise<{ id: string } | Refusal> {
	if (!canManage(actor)) return 'not_allowed';
	if (!isUuid(partnerId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [partner] = await tx
			.select({ id: volunteerPartners.id })
			.from(volunteerPartners)
			.where(eq(volunteerPartners.id, partnerId))
			.for('share');
		if (!partner) return 'not_found' as const;
		const [row] = await tx
			.insert(volunteerPerks)
			.values({ ...values, partnerId })
			.returning({ id: volunteerPerks.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_perk.create',
			entityType: 'volunteer_perk',
			entityId: row.id,
			after: { partnerId, ...values },
			ip
		});
		return { id: row.id };
	});
}

/** Only the changed fields go to the journal; nothing changed — no entry. Past marks stay as they
 * are when the kind or the limit changes (docs/03 section 19.3 item 2). */
export async function updatePerk(
	db: LimitDb,
	actor: Actor,
	partnerId: string,
	perkId: string,
	values: PerkValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!canManage(actor)) return 'not_allowed';
	if (!isUuid(partnerId) || !isUuid(perkId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [perk] = await tx
			.select(columns)
			.from(volunteerPerks)
			.where(ofPartner(partnerId, perkId))
			.for('update');
		if (!perk) return 'not_found' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(perk[key], values[key])) continue;
			before[key] = perk[key];
			after[key] = values[key];
		}
		if (Object.keys(after).length === 0) return 'ok' as const;
		await tx.update(volunteerPerks).set(values).where(eq(volunteerPerks.id, perk.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_perk.update',
			entityType: 'volunteer_perk',
			entityId: perk.id,
			before,
			after: { partnerId, ...after },
			ip
		});
		return 'ok' as const;
	});
}
