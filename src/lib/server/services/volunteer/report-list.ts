import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import {
	pageOffset,
	PAGE_SIZE,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import {
	volunteerInvitations,
	volunteerReports,
	volunteerRequests
} from '../../db/schema/volunteer-requests';
import type { PrivateStorage } from '../../storage/types';
import { isUuid } from '../users/target';
import { reportFileLink } from './report-files';

/* docs/05 section 28 "Reports": queue (pending first), card with history for the invitation. */

export const reportListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'request'],
	defaultSort: { key: 'date', dir: 'asc' }
};

export const reportStatuses = ['pending', 'approved', 'rejected'] as const;

export type ReportFilter = {
	status: (typeof reportStatuses)[number] | 'all';
	requestId: string | null;
	page: number;
};

const uuidOrNull = (v: string | undefined) => (v && isUuid(v) ? v : null);

export const reportFilter = (state: ListState): ReportFilter => ({
	status:
		state.filters.status === 'all'
			? 'all'
			: (reportStatuses.find((s) => s === state.filters.status) ?? 'pending'),
	requestId: uuidOrNull(state.filters.request),
	page: state.page
});

export type ReportListRow = {
	id: string;
	userId: string;
	name: string;
	requestId: string;
	requestTitle: LocalizedText;
	url: string | null;
	hasFile: boolean;
	note: string | null;
	status: (typeof reportStatuses)[number];
	date: Date;
};

export async function listReports(db: LimitDb, filter: ReportFilter) {
	const where: SQL[] = [];
	if (filter.status !== 'all') where.push(eq(volunteerReports.status, filter.status));
	if (filter.requestId) where.push(eq(volunteerRequests.id, filter.requestId));
	const clause = where.length ? and(...where) : undefined;
	const [{ n: total }] = await db
		.select({ n: count() })
		.from(volunteerReports)
		.innerJoin(volunteerInvitations, eq(volunteerInvitations.id, volunteerReports.invitationId))
		.innerJoin(volunteerRequests, eq(volunteerRequests.id, volunteerInvitations.requestId))
		.where(clause);
	const rows = await db
		.select({
			id: volunteerReports.id,
			userId: volunteerReports.userId,
			name: users.name,
			requestId: volunteerRequests.id,
			requestTitle: volunteerRequests.title,
			url: volunteerReports.url,
			fileKey: volunteerReports.fileKey,
			note: volunteerReports.note,
			status: volunteerReports.status,
			date: volunteerReports.createdAt
		})
		.from(volunteerReports)
		.innerJoin(volunteerInvitations, eq(volunteerInvitations.id, volunteerReports.invitationId))
		.innerJoin(volunteerRequests, eq(volunteerRequests.id, volunteerInvitations.requestId))
		.innerJoin(users, eq(users.id, volunteerReports.userId))
		.where(clause)
		.orderBy(asc(volunteerReports.createdAt), asc(volunteerReports.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(filter.page));
	return {
		total,
		rows: rows.map((r): ReportListRow => ({
			id: r.id,
			userId: r.userId,
			name: r.name,
			requestId: r.requestId,
			requestTitle: r.requestTitle as LocalizedText,
			url: r.url,
			hasFile: Boolean(r.fileKey),
			note: r.note,
			status: r.status,
			date: r.date
		}))
	};
}

export type ReportCard = {
	id: string;
	userId: string;
	name: string;
	own: boolean;
	invitationId: string;
	requestId: string;
	requestTitle: LocalizedText;
	url: string | null;
	fileUrl: string | null;
	shown: string;
	note: string | null;
	status: (typeof reportStatuses)[number];
	reviewNote: string | null;
	date: Date;
	history: {
		id: string;
		status: (typeof reportStatuses)[number];
		url: string | null;
		hasFile: boolean;
		note: string | null;
		reviewNote: string | null;
		date: Date;
	}[];
};

export async function reportDetail(
	db: LimitDb,
	id: string,
	viewerId: string,
	storage: PrivateStorage | null
): Promise<ReportCard | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: volunteerReports.id,
			userId: volunteerReports.userId,
			name: users.name,
			invitationId: volunteerReports.invitationId,
			requestId: volunteerRequests.id,
			requestTitle: volunteerRequests.title,
			url: volunteerReports.url,
			fileKey: volunteerReports.fileKey,
			note: volunteerReports.note,
			status: volunteerReports.status,
			reviewNote: volunteerReports.reviewNote,
			date: volunteerReports.createdAt
		})
		.from(volunteerReports)
		.innerJoin(volunteerInvitations, eq(volunteerInvitations.id, volunteerReports.invitationId))
		.innerJoin(volunteerRequests, eq(volunteerRequests.id, volunteerInvitations.requestId))
		.innerJoin(users, eq(users.id, volunteerReports.userId))
		.where(eq(volunteerReports.id, id));
	if (!row) return null;
	const history = await db
		.select({
			id: volunteerReports.id,
			status: volunteerReports.status,
			url: volunteerReports.url,
			fileKey: volunteerReports.fileKey,
			note: volunteerReports.note,
			reviewNote: volunteerReports.reviewNote,
			date: volunteerReports.createdAt
		})
		.from(volunteerReports)
		.where(eq(volunteerReports.invitationId, row.invitationId))
		.orderBy(desc(volunteerReports.createdAt), desc(volunteerReports.id));
	const fileUrl = await reportFileLink(storage, row.userId, row.fileKey);
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		own: row.userId === viewerId,
		invitationId: row.invitationId,
		requestId: row.requestId,
		requestTitle: row.requestTitle as LocalizedText,
		url: row.url,
		fileUrl,
		shown: row.url ?? row.fileKey ?? '',
		note: row.note,
		status: row.status,
		reviewNote: row.reviewNote,
		date: row.date,
		history: history.map((h) => ({
			id: h.id,
			status: h.status,
			url: h.url,
			hasFile: Boolean(h.fileKey),
			note: h.note,
			reviewNote: h.reviewNote,
			date: h.date
		}))
	};
}

export async function pendingReportCount(db: LimitDb) {
	return (
		await db
			.select({ n: count() })
			.from(volunteerReports)
			.where(eq(volunteerReports.status, 'pending'))
	)[0].n;
}
