import type { Messages } from '../translate';

/** Partner cashier pages: binding the phone. Part of `hy`. */
export const hyVolunteerCashier: Partial<Messages> = {
	'volunteerCashier.join.title': 'Գանձապահի հեռախոս',
	'volunteerCashier.join.text':
		'Այս հեռախոսը կկապվի գործընկերոջը՝ {partner} ({label})։ Դրանից հետո այն կարող է նշել արտոնությունների օգտագործումը կամավորի գրքույկի ստուգման էջերում։',
	'volunteerCashier.join.browser':
		'Բացեք այս հղումը այն դիտարկիչում, որով բացվում են տեսախցիկի QR կոդերը (սովորաբար՝ հեռախոսի հիմնական դիտարկիչը)։',
	'volunteerCashier.join.bind': 'Կապել այս հեռախոսը',
	'volunteerCashier.join.invalid': 'Հղումն անվավեր է։ Խնդրեք ֆեդերացիայից նորը։',
	'volunteerCashier.partner.title': 'Գործընկերոջ գանձապահ',
	'volunteerCashier.partner.bound': 'Հեռախոսը կապված է՝ {partner}, {label}',
	'volunteerCashier.partner.hint':
		'Սկանավորեք կամավորի գրքույկի QR կոդը հեռախոսի տեսախցիկով․ էջը պետք է բացվի այս դիտարկիչում։',
	'volunteerCashier.partner.unbound': 'Հեռախոսը կապված չէ',
	'volunteerCashier.partner.unboundHint': 'Խնդրեք ֆեդերացիայից հրավերի հղում։',
	'volunteerCashier.check.banner': 'Դուք — {partner}, {label}',
	'volunteerCashier.mark.remaining': 'Մնացել է օգտագործումներ այս գրքույկում՝ {count}',
	'volunteerCashier.mark.action': 'Նշել',
	'volunteerCashier.mark.confirm': 'Հաստատել նշումը',
	'volunteerCashier.mark.cancel': 'Չեղարկել',
	'volunteerCashier.mark.done': 'Նշվել է {time}-ին',
	'volunteerCashier.mark.noAccess': 'Այս հեռախոսում գործող գանձապահի մուտք չկա։',
	'volunteerCashier.mark.invalidCard': 'Այս կամավորի գրքույկը վավեր չէ։',
	'volunteerCashier.mark.noUsesLeft': 'Այս գրքույկում այս արտոնության օգտագործումներ չեն մնացել։',
	'volunteerCashier.mark.perkUnavailable': 'Այս արտոնությունը հնարավոր չէ նշել։'
};
