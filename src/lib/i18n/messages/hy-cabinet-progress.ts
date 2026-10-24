import type { Messages } from '../translate';

export const hyCabinetProgress: Partial<Messages> = {
	'cabinet.nav.progress': 'Առաջընթաց',
	'cabinet.progress.title': 'Առաջընթաց',
	'cabinet.progress.levels': 'Աստիճաններ',
	'cabinet.progress.current': 'ձեր աստիճանը',
	'cabinet.progress.noLevel': 'Աստիճան դեռ չկա։',
	'cabinet.progress.next.join': '«Սկսնակ» աստիճանը տրվում է անդամավճարի առաջին վճարմամբ։',
	'cabinet.progress.next.top': 'Սա ամենաբարձր աստիճանն է։',
	'cabinet.progress.next.ready':
		'Հաջորդ քննությունը՝ {exam}։ Քննությունները նշանակում է ֆեդերացիան․ դիմեք ձեր մարզչին կամ գրեք մեզ։',
	'cabinet.progress.next.blocked': 'Հաշիվն արգելափակված է։',
	'cabinet.progress.next.no_membership':
		'Հաջորդ քննությունը՝ {exam}։ Դրա համար անհրաժեշտ է գործող անդամություն։',
	'cabinet.progress.next.already_scheduled':
		'Հաջորդ քննությունը՝ {exam} — նշանակված է, տե՛ս ստորև։',
	'cabinet.progress.next.awaiting_certificate':
		'Հաջորդ քննությունը՝ {exam} — հանձնված է, վկայականը պատրաստվում է։',
	'cabinet.progress.next.retake_too_soon': 'Հաջորդ քննությունը՝ {exam} — վերահանձնում {date}-ից։',
	'cabinet.progress.next.level_too_recent': 'Հաջորդ քննությունը՝ {exam} — {date}-ից։',
	'cabinet.progress.membership': 'Անդամություն',
	'cabinet.progress.exams': 'Քննություններ',
	'cabinet.progress.examsEmpty': 'Քննություններ դեռ չկան։',
	'cabinet.progress.certificates': 'Վկայականներ',
	'cabinet.progress.certificatesEmpty': 'Վկայականներ դեռ չկան։',
	'cabinet.progress.pdf': 'Ներբեռնել PDF',
	'cabinet.progress.pdfNone': 'PDF-ը դեռ պատրաստ չէ։',
	'cabinet.progress.check': 'Բացել ստուգման էջը',
	'cabinet.progress.qr': 'QR կոդ',
	'cabinet.progress.qrLabel': '{number} վկայականի QR կոդ',
	'cabinet.progress.staff': 'Իմ մարզչի և մրցավարի պրոֆիլը',
	'cabinet.progress.staff.license': 'Լիցենզիայի համար',
	'cabinet.progress.staff.public': 'Ցուցադրվում է կայքում',
	'cabinet.progress.staff.hidden': 'Չի ցուցադրվում կայքում',
	'cabinet.progress.staff.hint': 'Պրոֆիլը կայքում ցուցադրելու մասին որոշում է ֆեդերացիան։',
	'cabinet.progress.staff.team': 'Մարզիչներ և մրցավարներ'
};
