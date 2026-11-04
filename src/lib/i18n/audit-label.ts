import type { Locale } from './locales';
import { en } from './messages/en';
import { translate, type MessageKey } from './translate';

/** Label for an audit action/entity code; unknown codes stay as-is. */
export function auditLabel(locale: Locale, kind: 'action' | 'entity', code: string): string {
	const key = `audit.${kind}.${code}`;
	return Object.hasOwn(en, key) ? translate(locale, key as MessageKey) : code;
}

/** Human text with the technical code in parentheses (filter, table, card). */
export function formatAuditCode(locale: Locale, kind: 'action' | 'entity', code: string): string {
	const label = auditLabel(locale, kind, code);
	return label === code ? code : `${label} (${code})`;
}
