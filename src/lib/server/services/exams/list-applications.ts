import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { examApplications } from '../../db/schema/certification';
import { examApplicationStatus, examKind } from '../../db/schema/enums';
import { users } from '../../db/schema/users';
import type { Actor } from '../users/target';

/* Pending (and filtered) exam applications for /admin/exams/applications. */

export const applicationListOptions: ListOptions = {
	sortable: ['createdAt'],
	filters: ['status', 'kind'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type ApplicationListRow = {
	id: string;
	userId: string;
	memberName: string;
	kind: (typeof examKind.enumValues)[number];
	status: (typeof examApplicationStatus.enumValues)[number];
	createdAt: Date;
	reviewNote: string | null;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions(state: ListState, contacts: boolean): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(or(ilike(users.name, like), contacts ? ilike(users.email, like) : undefined));
	}
	const status = examApplicationStatus.enumValues.find((s) => s === f.status) ?? 'pending';
	where.push(eq(examApplications.status, status));
	const kind = examKind.enumValues.find((k) => k === f.kind);
	if (kind) where.push(eq(examApplications.kind, kind));
	return and(...where);
}

export async function listExamApplications(
	db: LimitDb,
	viewer: Actor,
	state: ListState
): Promise<{ rows: ApplicationListRow[]; total: number }> {
	if (!roleCan(viewer.role, 'exams.manage')) return { rows: [], total: 0 };
	const where = conditions(state, roleCan(viewer.role, 'users.read_full'));
	const rows = await db
		.select({
			id: examApplications.id,
			userId: examApplications.userId,
			memberName: users.name,
			kind: examApplications.kind,
			status: examApplications.status,
			createdAt: examApplications.createdAt,
			reviewNote: examApplications.reviewNote
		})
		.from(examApplications)
		.innerJoin(users, eq(users.id, examApplications.userId))
		.where(where)
		.orderBy(desc(examApplications.createdAt), examApplications.id)
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(examApplications)
		.innerJoin(users, eq(users.id, examApplications.userId))
		.where(where);
	return { rows, total };
}

export async function pendingApplicationCount(db: LimitDb) {
	const [{ total }] = await db
		.select({ total: count() })
		.from(examApplications)
		.where(eq(examApplications.status, 'pending'));
	return total;
}
