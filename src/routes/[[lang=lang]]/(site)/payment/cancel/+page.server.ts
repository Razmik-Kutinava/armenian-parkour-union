import { paymentReturn } from '../return';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => paymentReturn(event);
