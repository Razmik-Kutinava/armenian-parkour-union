import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type VideoAction = Extract<
	AdminAction,
	`/admin/videos${string}` | '/admin/settings/videos?/default'
>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

const ORIGIN = { origin: 'http://localhost:4173' };

/** Video moderation and the video settings for admin-audit.spec.ts: each on its own row. */
export function videoActions(
	sql: postgres.Sql,
	post: Post,
	page: Page,
	target: string
): Record<VideoAction, () => Promise<void>> {
	const video = async (approved: boolean) => {
		const id = crypto.randomUUID().replace(/-/g, '').slice(0, 11);
		const [row] = await sql`insert into videos (user_id, url, platform, title, status, reviewed_at)
			values (${target}, ${`https://www.youtube.com/watch?v=${id}`}, 'youtube', 'Audit video',
				${approved ? 'approved' : 'pending'}, ${approved ? new Date() : null})
			returning id`;
		return row.id as string;
	};
	/* Platforms are repeated fields; the value goes back at once, so cabinet-videos keeps its limit. */
	const saveSettings = async (limit: number, platforms: string[]) => {
		const form = new FormData();
		form.set('monthlyLimit', String(limit));
		for (const p of platforms) form.append('platforms', p);
		const res = await page.request.post('/admin/settings/videos', { form, headers: ORIGIN });
		expect(res.ok(), 'settings/videos').toBe(true);
	};
	return {
		'/admin/videos?/approve': async () =>
			post('/admin/videos?/approve', { ids: await video(false) }),
		'/admin/videos?/reject': async () =>
			post('/admin/videos?/reject', { ids: await video(false), comment: 'Audit check' }),
		'/admin/videos?/hide': async () => post('/admin/videos?/hide', { ids: await video(true) }),
		'/admin/settings/videos?/default': async () => {
			const [row] = await sql`select value from site_settings where key = 'videos'`;
			const limit = Number(row?.value?.monthly_limit ?? 5);
			const platforms: string[] = row?.value?.platforms ?? ['youtube', 'instagram'];
			await saveSettings(limit === 6 ? 7 : 6, platforms);
			await saveSettings(limit, platforms);
		}
	};
}
