import { describe, expect, it } from 'vitest';
import { ALL_GROUPS, groupsToInvalidate } from './admin-groups';

const staffWrite = (path: string, method = 'POST') => groupsToInvalidate(method, path, true);

describe('groupsToInvalidate (2.10: admin writes reset the public cache)', () => {
	it('reads never reset anything', () => {
		expect(staffWrite('/admin/news/1', 'GET')).toEqual([]);
		expect(staffWrite('/admin/news', 'HEAD')).toEqual([]);
	});

	it('only admin writes reset', () => {
		expect(staffWrite('/login')).toEqual([]);
		expect(staffWrite('/administrator')).toEqual([]);
	});

	it('a guest or member posting to /admin cannot flush the cache', () => {
		expect(groupsToInvalidate('POST', '/admin/media/1', false)).toEqual([]);
		expect(groupsToInvalidate('POST', '/admin/unknown', false)).toEqual([]);
	});

	it('each section resets its group', () => {
		expect(staffWrite('/admin/pages/1')).toEqual(['pages']);
		expect(staffWrite('/admin/news/new')).toEqual(['posts']);
		expect(staffWrite('/admin/events/1')).toEqual(['events']);
		expect(staffWrite('/admin/hero')).toEqual(['hero']);
		expect(staffWrite('/admin/settings')).toEqual(['settings']);
		expect(staffWrite('/admin/users/1')).toEqual(['hero']);
	});

	it('donation purposes and payments reset /donate (settings group: purposes, recent donations)', () => {
		expect(staffWrite('/admin/donation-purposes/1')).toEqual(['settings']);
		expect(staffWrite('/admin/payments/new')).toEqual(['settings']);
	});

	it('media (alt and covers everywhere) and unknown sections reset everything', () => {
		expect(staffWrite('/admin/media/1')).toEqual(ALL_GROUPS);
		expect(staffWrite('/admin/something-new', 'DELETE')).toEqual(ALL_GROUPS);
		expect(staffWrite('/admin')).toEqual(ALL_GROUPS);
	});

	it('sections that show nothing on the site reset nothing', () => {
		for (const path of ['/admin/audit', '/admin/roles', '/admin/locale']) {
			expect(staffWrite(path)).toEqual([]);
		}
	});
});
