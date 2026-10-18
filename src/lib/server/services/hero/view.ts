import { publicUrl } from '../../storage/r2';
import type { HeroSlide } from './public';

/* What the hero renders: image addresses from R2 (docs/06 section 4.1). */

export type HeroSlideView = Omit<HeroSlide, 'person'> & {
	mediaUrl: string | null;
	person: { name: string; avatarUrl: string | null } | null;
};

export const withHeroMedia = (slide: HeroSlide): HeroSlideView => ({
	...slide,
	mediaUrl: slide.mediaKey ? publicUrl(slide.mediaKey) : null,
	person: slide.person
		? {
				name: slide.person.name,
				avatarUrl: slide.person.avatarKey ? publicUrl(slide.person.avatarKey) : null
			}
		: null
});
