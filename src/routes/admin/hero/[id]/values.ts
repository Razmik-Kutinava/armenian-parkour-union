import type { HeroDetail } from '#lib/server/services/hero/list.ts';
import { toYerevanInput } from '#lib/validation/posts.ts';
import { flattenValues } from '#lib/validation/site-settings-form.ts';

/** The saved block as form field values: dates in Yerevan time. */
export function formValues(block: HeroDetail): Record<string, string> {
	const date = (d: Date | null) => (d ? toYerevanInput(d) : '');
	return {
		...flattenValues({
			title: block.title,
			subtitle: block.subtitle,
			ctaLabel: block.ctaLabel ?? {}
		}),
		type: block.type,
		mediaKey: block.mediaKey ?? '',
		videoUrl: block.videoUrl ?? '',
		ctaUrl: block.ctaUrl ?? '',
		eventId: block.eventId ?? '',
		personUserId: block.personUserId ?? '',
		startsAt: date(block.startsAt),
		endsAt: date(block.endsAt),
		isActive: String(block.isActive)
	};
}
