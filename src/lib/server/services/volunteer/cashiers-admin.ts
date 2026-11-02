import { and, asc, eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { partnerCashiers, volunteerPartners } from '../../db/schema/volunteer-partners';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { cashierTokenHash, newCashierToken } from './cashier-access';
import { volunteerSettings } from './settings';

/* docs/05 section 28 "Cashiers"; decisions — docs/todo.md 10.6. The link token leaves only in the
 * return value (shown once); the journal and the table get neither token. Disable is final. */

export type CashierState = 'waiting' | 'expired' | 'bound' | 'disabled';
export type AdminCashier = {
	id: string;
	label: string;
	state: CashierState;
	inviteExpiresAt: Date | null;
	boundAt: Date | null;
	lastUsedAt: Date | null;
	disabledAt: Date | null;
};
type Link = { token: string; expiresAt: Date };

const canManage = (actor: Actor) => roleCan(actor.role, 'volunteer.manage');
const HOUR = 3_600_000;

function stateOf(row: Omit<AdminCashier, 'state'>, now: Date): CashierState {
	if (row.disabledAt) return 'disabled';
	if (row.boundAt) return 'bound';
	return row.inviteExpiresAt && row.inviteExpiresAt > now ? 'waiting' : 'expired';
}

const columns = {
	id: partnerCashiers.id,
	label: partnerCashiers.label,
	inviteExpiresAt: partnerCashiers.inviteExpiresAt,
	boundAt: partnerCashiers.boundAt,
	lastUsedAt: partnerCashiers.lastUsedAt,
	disabledAt: partnerCashiers.disabledAt
};

export async function listCashiers(db: LimitDb, partnerId: string, now = new Date()) {
	if (!isUuid(partnerId)) return [];
	const rows = await db
		.select(columns)
		.from(partnerCashiers)
		.where(eq(partnerCashiers.partnerId, partnerId))
		.orderBy(asc(partnerCashiers.createdAt), asc(partnerCashiers.id));
	return rows.map((row): AdminCashier => ({ ...row, state: stateOf(row, now) }));
}

async function newLink(tx: LimitDb, now: Date) {
	const { cashierInviteHours } = await volunteerSettings(tx);
	const token = newCashierToken();
	const expiresAt = new Date(now.getTime() + cashierInviteHours * HOUR);
	return {
		token,
		expiresAt,
		set: { inviteTokenHash: cashierTokenHash(token), inviteExpiresAt: expiresAt }
	};
}

export async function createCashier(
	db: LimitDb,
	actor: Actor,
	partnerId: string,
	label: string,
	ip: string | null,
	now = new Date()
): Promise<(Link & { id: string }) | 'not_allowed' | 'not_found' | 'bad_label'> {
	if (!canManage(actor)) return 'not_allowed';
	const clean = label.trim();
	if (clean.length < 1 || clean.length > 80) return 'bad_label';
	if (!isUuid(partnerId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [partner] = await tx
			.select({ id: volunteerPartners.id })
			.from(volunteerPartners)
			.where(eq(volunteerPartners.id, partnerId))
			.for('share');
		if (!partner) return 'not_found' as const;
		const { token, expiresAt, set } = await newLink(tx, now);
		const [row] = await tx
			.insert(partnerCashiers)
			.values({ partnerId, label: clean, createdBy: actor.id, ...set })
			.returning({ id: partnerCashiers.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'partner_cashier.create',
			entityType: 'partner_cashier',
			entityId: row.id,
			after: { partnerId, label: clean, inviteExpiresAt: expiresAt },
			ip
		});
		return { id: row.id, token, expiresAt };
	});
}

async function lockCashier(tx: LimitDb, partnerId: string, cashierId: string) {
	const [row] = await tx
		.select({ ...columns, partnerId: partnerCashiers.partnerId })
		.from(partnerCashiers)
		.where(and(eq(partnerCashiers.id, cashierId), eq(partnerCashiers.partnerId, partnerId)))
		.for('update');
	return row ?? null;
}

/** docs/02 rule: the same row gets a new link, the bound phone stops working. */
export async function newCashierLink(
	db: LimitDb,
	actor: Actor,
	partnerId: string,
	cashierId: string,
	ip: string | null,
	now = new Date()
): Promise<Link | 'not_allowed' | 'not_found' | 'disabled'> {
	if (!canManage(actor)) return 'not_allowed';
	if (!isUuid(partnerId) || !isUuid(cashierId)) return 'not_found';
	return db.transaction(async (tx) => {
		const cashier = await lockCashier(tx, partnerId, cashierId);
		if (!cashier) return 'not_found' as const;
		if (cashier.disabledAt) return 'disabled' as const;
		const { token, expiresAt, set } = await newLink(tx, now);
		await tx
			.update(partnerCashiers)
			.set({ ...set, deviceTokenHash: null, boundAt: null })
			.where(eq(partnerCashiers.id, cashierId));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'partner_cashier.relink',
			entityType: 'partner_cashier',
			entityId: cashierId,
			before: { boundAt: cashier.boundAt, inviteExpiresAt: cashier.inviteExpiresAt },
			after: { partnerId, label: cashier.label, inviteExpiresAt: expiresAt },
			ip
		});
		return { token, expiresAt };
	});
}

/** Both the link and the phone stop at once; a second disable changes nothing. */
export async function disableCashier(
	db: LimitDb,
	actor: Actor,
	partnerId: string,
	cashierId: string,
	ip: string | null,
	now = new Date()
): Promise<'ok' | 'not_allowed' | 'not_found'> {
	if (!canManage(actor)) return 'not_allowed';
	if (!isUuid(partnerId) || !isUuid(cashierId)) return 'not_found';
	return db.transaction(async (tx) => {
		const cashier = await lockCashier(tx, partnerId, cashierId);
		if (!cashier) return 'not_found' as const;
		if (cashier.disabledAt) return 'ok' as const;
		await tx
			.update(partnerCashiers)
			.set({ disabledAt: now, disabledBy: actor.id })
			.where(eq(partnerCashiers.id, cashierId));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'partner_cashier.disable',
			entityType: 'partner_cashier',
			entityId: cashierId,
			after: { partnerId, label: cashier.label },
			ip
		});
		return 'ok' as const;
	});
}
