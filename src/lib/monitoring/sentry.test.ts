import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/sveltekit';
import { isMissingChunk, scrubBreadcrumb, scrubEmails, scrubEvent } from './sentry.ts';

describe('scrubEmails', () => {
	it('replaces every address and keeps the rest', () => {
		expect(scrubEmails('letter to a.b+c@mail.example.am and x@y.io not sent')).toBe(
			'letter to [email] and [email] not sent'
		);
	});

	it('leaves text without addresses alone', () => {
		expect(scrubEmails('payment 42: refund failed')).toBe('payment 42: refund failed');
	});
});

describe('scrubEvent', () => {
	it('cleans the message, exception values, console arguments and breadcrumbs', () => {
		const event = {
			type: undefined,
			message: 'certificate letter to kid@example.com not sent',
			exception: { values: [{ type: 'Error', value: 'Key (email)=(kid@example.com) exists' }] },
			extra: { arguments: ['order 7: letter to kid@example.com', new Error('to kid@example.com')] },
			breadcrumbs: [
				{ message: 'sent to kid@example.com', data: { arguments: ['kid@example.com'] } }
			]
		} as ErrorEvent;

		const out = scrubEvent(event)!;

		expect(JSON.stringify(out)).not.toContain('kid@example.com');
		expect(out.message).toBe('certificate letter to [email] not sent');
		expect(out.extra?.arguments).toEqual(['order 7: letter to [email]', 'Error: to [email]']);
	});

	it('names a synthetic console capture by its level, not by the route', () => {
		const consoleEvent = (level: 'warning' | 'error', exception: object) =>
			({
				type: undefined,
				logger: 'console',
				level,
				exception: { values: [exception] }
			}) as ErrorEvent;
		const synthetic = () => ({
			value: 'refund refused',
			mechanism: { type: 'x', synthetic: true }
		});

		const warning = scrubEvent(consoleEvent('warning', synthetic()))?.exception?.values?.[0];
		const error = scrubEvent(consoleEvent('error', synthetic()))?.exception?.values?.[0];
		const logged = scrubEvent(consoleEvent('error', { type: 'TypeError', value: 'y' }));

		expect(warning).toMatchObject({ type: 'Warning', mechanism: { synthetic: false } });
		expect(error?.type).toBe('Error');
		expect(logged?.exception?.values?.[0].type).toBe('TypeError');
	});

	it('drops the Better Auth sign-in mistakes, keeps its other warnings', () => {
		const warn = (text: string) =>
			({
				type: undefined,
				logger: 'console',
				level: 'warning',
				message: text,
				exception: { values: [{ value: text, mechanism: { type: 'x', synthetic: true } }] }
			}) as ErrorEvent;
		const at = '2026-10-28T12:00:00.000Z WARN [Better Auth]: ';

		expect(scrubEvent(warn(`${at}Invalid password`))).toBeNull();
		expect(scrubEvent(warn('\x1b[1m[Better Auth]:\x1b[0m Invalid password'))).toBeNull();
		expect(scrubEvent(warn(`${at}User not found`))).toBeNull();
		expect(scrubEvent(warn(`${at}Password not found`))).toBeNull();
		expect(scrubEvent(warn(`${at}Reset Password: User not found`))).toBeNull();
		expect(scrubEvent(warn(`${at}Invalid email or password`))).not.toBeNull();
		expect(scrubEvent(warn(`${at}User not found for member 7`))).not.toBeNull();
		expect(scrubEvent(warn('order 7: Invalid password field in letter'))).not.toBeNull();
	});

	it('drops a connection lost on the visitor side, keeps other fetch errors', () => {
		const thrown = (type: string, value: string) =>
			({ type: undefined, exception: { values: [{ type, value }] } }) as ErrorEvent;

		expect(scrubEvent(thrown('TypeError', 'Failed to fetch'))).toBeNull();
		expect(scrubEvent(thrown('TypeError', 'Failed to fetch (parkour.am)'))).toBeNull();
		expect(scrubEvent(thrown('TypeError', 'Load failed'))).toBeNull();
		expect(
			scrubEvent(thrown('TypeError', 'NetworkError when attempting to fetch resource.'))
		).toBeNull();
		expect(scrubEvent(thrown('Error', 'aborted'))).toBeNull();
		expect(scrubEvent(thrown('TypeError', 'fetch failed'))).not.toBeNull();
		expect(scrubEvent(thrown('Error', 'Failed to fetch'))).not.toBeNull();
		expect(scrubEvent(thrown('Error', 'upload aborted by quota'))).not.toBeNull();
	});

	it('accepts an event without optional parts', () => {
		expect(scrubEvent({ type: undefined } as ErrorEvent)).toEqual({ type: undefined });
	});
});

describe('isMissingChunk', () => {
	it('knows a failed chunk load in every browser and nothing else', () => {
		const chunk = 'https://parkour.am/_app/immutable/nodes/56.Bg7RUYGi.js';
		expect(
			isMissingChunk(new TypeError(`Failed to fetch dynamically imported module: ${chunk}`))
		).toBe(true);
		expect(
			isMissingChunk(new TypeError(`error loading dynamically imported module: ${chunk}`))
		).toBe(true);
		expect(isMissingChunk(new TypeError('Importing a module script failed.'))).toBe(true);
		expect(isMissingChunk(new TypeError('Failed to fetch'))).toBe(false);
		expect(isMissingChunk('dynamically imported module')).toBe(false);
	});
});

describe('scrubBreadcrumb', () => {
	it('cleans a console breadcrumb', () => {
		expect(scrubBreadcrumb({ message: 'a@b.cd', data: { arguments: [1, 'a@b.cd'] } })).toEqual({
			message: '[email]',
			data: { arguments: ['1', '[email]'] }
		});
	});
});
