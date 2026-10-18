import { describe, expect, it } from 'vitest';
import { ALL_GROUPS, groupsToInvalidate } from './admin-groups';

describe('groupsToInvalidate (2.10: admin writes reset the public cache)', () => {
	it('reads never reset anything', () => {
		expect(groupsToInvalidate('GET', '/admin/news/1')).toEqual([]);
		expect(groupsToInvalidate('HEAD', '/admin/news')).toEqual([]);
	});

	it('only admin writes reset', () => {
		expect(groupsToInvalidate('POST', '/login')).toEqual([]);
		expect(groupsToInvalidate('POST', '/administrator')).toEqual([]);
	});

	it('each section resets its group', () => {
		expect(groupsToInvalidate('POST', '/admin/pages/1')).toEqual(['pages']);
		expect(groupsToInvalidate('POST', '/admin/news/new')).toEqual(['posts']);
		expect(groupsToInvalidate('POST', '/admin/events/1')).toEqual(['events']);
		expect(groupsToInvalidate('POST', '/admin/hero')).toEqual(['hero']);
		expect(groupsToInvalidate('POST', '/admin/settings')).toEqual(['settings']);
		expect(groupsToInvalidate('POST', '/admin/users/1')).toEqual(['hero']);
	});

	it('media (alt and covers everywhere) and unknown sections reset everything', () => {
		expect(groupsToInvalidate('POST', '/admin/media/1')).toEqual(ALL_GROUPS);
		expect(groupsToInvalidate('DELETE', '/admin/something-new')).toEqual(ALL_GROUPS);
		expect(groupsToInvalidate('POST', '/admin')).toEqual(ALL_GROUPS);
	});

	it('sections that show nothing on the site reset nothing', () => {
		for (const path of ['/admin/audit', '/admin/roles', '/admin/locale']) {
			expect(groupsToInvalidate('POST', path)).toEqual([]);
		}
	});
});
