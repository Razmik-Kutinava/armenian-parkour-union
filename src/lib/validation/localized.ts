import type { z } from 'zod';

type Texts = Partial<Record<'en' | 'hy' | 'ru', string>> | null;

/**
 * English is the fallback language (docs/03 section 12): a text only in HY / RU would leave the
 * English site empty, so EN is required once another language is filled (decisions 2026-10-18).
 */
export function requireEnIfAny(texts: Texts, ctx: z.RefinementCtx): void {
	if (texts && !texts.en && (texts.hy || texts.ru)) {
		ctx.addIssue({ code: 'custom', path: ['en'], message: 'auth.error.required' });
	}
}
