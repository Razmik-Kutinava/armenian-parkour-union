import type { Messages } from '../translate';
import { hyFest } from './hy-fest';

export const hy: Partial<Messages> = {
	...hyFest,
	'site.underConstruction': 'Կայքը մշակման փուլում է։',
	'common.close': 'Փակել'
};
