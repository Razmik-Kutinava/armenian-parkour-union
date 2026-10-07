import { describe, expect, it } from 'vitest';
import { errorContent } from './error-message';

describe('errorContent', () => {
	it('uses fixed texts for 404 and 403', () => {
		expect(errorContent(404, 'Not Found')).toEqual({
			title: 'error.notFound.title',
			text: 'error.notFound.text'
		});
		expect(errorContent(403, 'Forbidden')).toEqual({
			title: 'error.forbidden.title',
			text: 'error.forbidden.text'
		});
	});

	it('shows our own message for other client errors', () => {
		expect(errorContent(400, 'This link is invalid.')).toEqual({
			title: 'error.request.title',
			message: 'This link is invalid.'
		});
	});

	it('never shows the message of a server error', () => {
		for (const status of [500, 502, 503]) {
			expect(errorContent(status, 'TypeError: secret is undefined')).toEqual({
				title: 'error.server.title',
				text: 'error.server.text'
			});
		}
	});

	it('falls back to the server text when a client error has no message', () => {
		expect(errorContent(400, '')).toEqual({
			title: 'error.server.title',
			text: 'error.server.text'
		});
	});
});
