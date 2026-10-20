import { and, asc, eq, sql } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { PurposeValues } from '#lib/validation/donation-purposes.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { donationPurposes, payments } from '../../db/schema/payments';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 17: purposes are hidden, never deleted — payments point to them. */

export type AdminPurpose = {
	id: string;
	title: LocalizedText;
	isActive: boolean;
	sortOrder: number;
};
export type AdminPurposeRow = AdminPurpose & {
	collected: { currency: string; amountMinor: number }[];
};

const columns = {
	id: donationPurposes.id,
	title: donationPurposes.title,
	isActive: donationPurposes.isActive,
	sortOrder: donationPurposes.sortOrder
};
const asPurpose = (row: { title: unknown } & Omit<AdminPurpose, 'title'>): AdminPurpose => ({
	...row,
	title: row.title as LocalizedText
});
const canConfig = (actor: Actor) => roleCan(actor.role, 'donations.config');

/** In the donors' order, with the sum of paid donations per currency. */
export async function listPurposesAdmin(db: LimitDb): Promise<AdminPurposeRow[]> {
	const rows = await db
		.select(columns)
		.from(donationPurposes)
		.orderBy(asc(donationPurposes.sortOrder), asc(donationPurposes.createdAt));
	const sums = await db
		.select({
			purposeId: payments.donationPurposeId,
			currency: payments.currency,
			amountMinor: sql<number>`sum(${payments.amountMinor})`.mapWith(Number)
		})
		.from(payments)
		.where(and(eq(payments.kind, 'donation'), eq(payments.status, 'paid')))
		.groupBy(payments.donationPurposeId, payments.currency)
		.orderBy(asc(payments.currency));
	return rows.map((row) => ({
		...asPurpose(row),
		collected: sums
			.filter((s) => s.purposeId === row.id)
			.map(({ currency, amountMinor }) => ({ currency, amountMinor }))
	}));
}

export async function getPurpose(db: LimitDb, id: string): Promise<AdminPurpose | null> {
	if (!isUuid(id)) return null;
	const [row] = await db.select(columns).from(donationPurposes).where(eq(donationPurposes.id, id));
	return row ? asPurpose(row) : null;
}

export async function createPurpose(
	db: LimitDb,
	actor: Actor,
	values: PurposeValues,
	ip: string | null
): Promise<{ id: string } | 'not_allowed'> {
	if (!canConfig(actor)) return 'not_allowed';
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(donationPurposes)
			.values(values)
			.returning({ id: donationPurposes.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'donation_purpose.create',
			entityType: 'donation_purpose',
			entityId: row.id,
			after: values,
			ip
		});
		return row;
	});
}

export async function updatePurpose(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: PurposeValues,
	ip: string | null
): Promise<'ok' | 'not_found' | 'not_allowed'> {
	if (!canConfig(actor)) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [before] = await tx
			.select(columns)
			.from(donationPurposes)
			.where(eq(donationPurposes.id, id))
			.for('update');
		if (!before) return 'not_found';
		await tx.update(donationPurposes).set(values).where(eq(donationPurposes.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'donation_purpose.update',
			entityType: 'donation_purpose',
			entityId: id,
			before: { title: before.title, isActive: before.isActive, sortOrder: before.sortOrder },
			after: values,
			ip
		});
		return 'ok';
	});
}
