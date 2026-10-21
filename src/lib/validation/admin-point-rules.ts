import { z } from 'zod';
import { localizedText } from './site-settings';

/* Admin "Point rules" (docs/05 section 13) and the thresholds of "suspicious" entries
 * (docs/03 section 6.4, decisions.md 2026-10-21). Messages are i18n keys. */

const MAX_POINTS = 1_000_000;
const checkbox = z.preprocess((v) => v === 'on', z.boolean());

/** A whole number from the form, within the range. */
const whole = (min: number, max: number, error: string) =>
	z
		.string({ error })
		.trim()
		.regex(/^\d{1,10}$/, { error })
		.transform(Number)
		.refine((n) => n >= min && n <= max, { error });

/** What the service accepts: the code is not here, it never changes. */
export const ruleValuesSchema = z.object({
	title: localizedText(200),
	points: z.number().int().min(0).max(MAX_POINTS),
	isActive: z.boolean()
});
export type RuleValues = z.output<typeof ruleValuesSchema>;

/** An unchecked "active" box sends nothing and turns the rule off. */
export const ruleFormSchema = z.object({
	title: localizedText(200),
	points: whole(0, MAX_POINTS, 'pointRules.error.points'),
	isActive: checkbox
});

export type SuspiciousThresholds = {
	manual: boolean;
	minAmount: number;
	burstCount: number;
	burstHours: number;
};

export const SUSPICIOUS_DEFAULTS: SuspiciousThresholds = {
	manual: true,
	minAmount: 100,
	burstCount: 5,
	burstHours: 24
};

export const thresholdsFormSchema = z.object({
	manual: checkbox,
	minAmount: whole(1, 1_000_000_000, 'pointRules.error.minAmount'),
	burstCount: whole(2, 1000, 'pointRules.error.burstCount'),
	burstHours: whole(1, 720, 'pointRules.error.burstHours')
});
export const THRESHOLD_FIELDS = ['manual', 'minAmount', 'burstCount', 'burstHours'] as const;

export function thresholdsToForm(t: SuspiciousThresholds): Record<string, string> {
	return {
		manual: t.manual ? 'on' : '',
		minAmount: String(t.minAmount),
		burstCount: String(t.burstCount),
		burstHours: String(t.burstHours)
	};
}
