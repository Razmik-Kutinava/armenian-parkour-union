import { describe, expect, it } from 'vitest';
import { auditLabel, formatAuditCode } from './audit-label';

describe('auditLabel', () => {
	it('translates known action and entity codes', () => {
		expect(auditLabel('ru', 'action', 'certificate.revoke')).toBe('Отозвать сертификат');
		expect(auditLabel('ru', 'entity', 'donation_purpose')).toBe('Назначение доната');
		expect(auditLabel('en', 'action', 'donation_purpose.create')).toBe('Create donation purpose');
	});

	it('keeps unknown codes as-is', () => {
		expect(auditLabel('ru', 'action', 'future.thing')).toBe('future.thing');
		expect(formatAuditCode('ru', 'action', 'future.thing')).toBe('future.thing');
	});

	it('puts the code next to the translation', () => {
		expect(formatAuditCode('ru', 'action', 'certificate.revoke')).toBe(
			'Отозвать сертификат (certificate.revoke)'
		);
	});
});
