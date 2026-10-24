import type { Messages } from '../translate';

export const hyStaffAdmin: Partial<Messages> = {
	'staff.col.member': 'Մասնակից',
	'staff.col.kind': 'Տեսակ',
	'staff.col.category': 'Կարգ',
	'staff.col.license': 'Լիցենզիայի համար',
	'staff.col.certificate': 'Հավաստագիր',
	'staff.col.public': 'Հրապարակային',
	'staff.col.active': 'Ակտիվ',
	'staff.flag.yes': 'Այո',
	'staff.flag.no': 'Ոչ',
	'staff.search': 'Մասնակից կամ լիցենզիայի համար',
	'staff.empty':
		'Մարզիչներ և մրցավարներ դեռ չկան. պրոֆիլը հայտնվում է մարզչի կամ մրցավարի հավաստագիր տալիս։',
	'staff.card.photo': 'Լուսանկար',
	'staff.card.photoHint': 'Լուսանկարը մասնակիցը փոխում է իր անձնական էջում։',
	'staff.card.certificate': 'Վավեր հավաստագիր',
	'staff.card.until': 'մինչև {date}',
	'staff.card.noCertificate': 'Չկա։',
	'staff.form.title': 'Պրոֆիլ',
	'staff.form.category': 'Կարգ',
	'staff.form.license': 'Լիցենզիայի համար',
	'staff.form.bio': 'Նկարագրություն',
	'staff.form.bioHint':
		'Պարզ տեքստ «Մարզիչներ և մրցավարներ» էջի համար։ Անգլերենը պարտադիր է, եթե լրացված է այլ լեզու։',
	'staff.form.public': 'Ցույց տալ հրապարակայնորեն',
	'staff.form.active': 'Ակտիվ',
	'staff.form.activeHint':
		'Միանում է միայն այս տեսակի վավեր հավաստագրի դեպքում։ Այս տեսակի նոր հավաստագիրը կրկին կմիացնի պրոֆիլը։',
	'staff.saved': 'Պահպանված է։',
	'staff.error.bioEn': 'Նախ լրացրեք անգլերենը. այն ցույց է տրվում, երբ լեզուն դատարկ է։',
	'staff.refusal.no_live_certificate':
		'Այս տեսակի վավեր հավաստագիր չկա. պրոֆիլը հնարավոր չէ միացնել։'
};
