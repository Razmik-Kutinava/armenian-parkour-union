import { isDeepStrictEqual } from 'node:util';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PartnerValues } from '#lib/validation/volunteer-partners.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { volunteerPartners } from '../../db/schema/volunteer-partners';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 28 "Partners"; decisions — docs/todo.md 10.2. Never deleted: archived. */

type Refusal = 'not_allowed' | 'not_found' | 'bad_logo';
const LOGGED = ['name', 'logoKey', 'website', 'address', 'status'] as const;

const columns = {
	id: volunteerPartners.id,
	name: volunteerPartners.name,
	logoKey: volunteerPartners.logoKey,
	website: volunteerPartners.website,
	address: volunteerPartners.address,
	status: volunteerPartners.status,
	sortOrder: volunteerPartners.sortOrder
};
export type AdminPartner = PartnerValues & { id: string; sortOrder: number };
const asPartner = (row: { address: unknown } & Omit<AdminPartner, 'address'>): AdminPartner => ({
	...row,
	address: row.address as PartnerValues['address']
});

const canManage = (actor: Actor) => roleCan(actor.role, 'volunteer.manage');

/** docs/05 section 20: the logo is locked FOR SHARE, so a parallel delete of the file waits. */
async function lockLogo(tx: LimitDb, key: string | null) {
	if (!key) return true;
	const [row] = await tx
		.select({ mime: media.mime })
		.from(media)
		.where(and(eq(media.key, key), isNull(media.deletedAt)))
		.for('share');
	return !!row && row.mime.startsWith('image/');
}

export async function getPartner(db: LimitDb, id: string): Promise<AdminPartner | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select(columns)
		.from(volunteerPartners)
		.where(eq(volunteerPartners.id, id));
	return row ? asPartner(row) : null;
}

/** A new partner goes to the end of the list. */
export async function createPartner(
	db: LimitDb,
	actor: Actor,
	values: PartnerValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found'>> {
	if (!canManage(actor)) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (!(await lockLogo(tx, values.logoKey))) return 'bad_logo' as const;
		const [{ next }] = await tx
			.select({ next: sql<number>`coalesce(max(${volunteerPartners.sortOrder}) + 1, 0)::int` })
			.from(volunteerPartners);
		const [row] = await tx
			.insert(volunteerPartners)
			.values({ ...values, sortOrder: next, createdBy: actor.id })
			.returning({ id: volunteerPartners.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_partner.create',
			entityType: 'volunteer_partner',
			entityId: row.id,
			after: values,
			ip
		});
		return { id: row.id };
	});
}

/** Only the changed fields go to the journal; nothing changed — no entry. */
export async function updatePartner(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: PartnerValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!canManage(actor)) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [partner] = await tx
			.select(columns)
			.from(volunteerPartners)
			.where(eq(volunteerPartners.id, id))
			.for('update');
		if (!partner) return 'not_found' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(partner[key], values[key])) continue;
			before[key] = partner[key];
			after[key] = values[key];
		}
		if (Object.keys(after).length === 0) return 'ok' as const;
		if (!(await lockLogo(tx, values.logoKey))) return 'bad_logo' as const;
		await tx.update(volunteerPartners).set(values).where(eq(volunteerPartners.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_partner.update',
			entityType: 'volunteer_partner',
			entityId: id,
			before,
			after,
			ip
		});
		return 'ok' as const;
	});
}
