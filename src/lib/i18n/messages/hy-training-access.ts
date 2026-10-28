import type { Messages } from '../translate';

/** Admin "Training": access requests and letters. Part of `hyTrainingAdmin`. */
export const hyTrainingAccess: Partial<Messages> = {
	'admin.nav.trainingAccess': 'Հայտեր',
	'training.access.empty': 'Հայտեր չեն գտնվել',
	'training.access.filter.course': 'Դասընթաց',
	'training.access.filter.allCourses': 'Բոլոր դասընթացները',
	'training.access.filter.status': 'Կարգավիճակ',
	'training.access.status.all': 'Բոլորը',
	'training.access.status.pending': 'Քննարկման մեջ',
	'training.access.status.approved': 'Հաստատված',
	'training.access.status.rejected': 'Մերժված',
	'training.access.status.revoked': 'Մուտքը փակված է',
	'training.access.col.member': 'Մասնակից',
	'training.access.col.course': 'Դասընթաց',
	'training.access.col.date': 'Ամսաթիվ',
	'training.access.col.status': 'Կարգավիճակ',
	'training.access.col.age': 'Տարիք',
	'training.access.col.level': 'Աստիճան',
	'training.access.col.paidUntil': 'Անդամակցությունը մինչև',
	'training.access.col.actions': 'Որոշում',
	'training.access.none': '—',
	'training.access.approve': 'Հաստատել',
	'training.access.reject': 'Մերժել',
	'training.access.revoke': 'Փակել մուտքը',
	'training.access.search': 'Մասնակցի անունը',
	'training.access.rejectTitle': 'Մերժել հայտը',
	'training.access.rejectText':
		'Մասնակիցը կստանա նամակ պատճառով և կկարողանա կրկին դիմել։ Պատճառը երևում է անձնական էջում։',
	'training.access.revokeTitle': 'Փակել դասընթացի մուտքը',
	'training.access.revokeText':
		'Պորտալը կփակվի մասնակցի համար, փորձերն ու տեսանյութերը կմնան պատմության մեջ։ Մասնակիցը կստանա նամակ պատճառով և չի կարողանա կրկին դիմել։',
	'training.access.done.approve': 'Հայտը հաստատված է, մասնակցին նամակ է ուղարկվել։',
	'training.access.done.reject': 'Հայտը մերժված է, մասնակցին նամակ է ուղարկվել։',
	'training.access.done.revoke': 'Մուտքը փակված է, մասնակցին նամակ է ուղարկվել։',
	'training.access.error.reason': 'Նշեք պատճառը՝ մինչև 1000 նիշ։',
	'training.access.error.state': 'Հայտի վերաբերյալ արդեն որոշում կա։ Թարմացրեք էջը։',
	'training.access.extra': 'Արտահերթ փորձ',
	'training.access.extraTitle': 'Տրամադրել թեստի արտահերթ փորձ',
	'training.access.extraText':
		'Մասնակիցը կկարողանա ևս մեկ անգամ անցնել թեստը՝ առանց դադարի և փորձերի սահմանափակման։ Գործողությունը գրանցվում է մատյանում։',
	'training.access.extraUnused': 'Չօգտագործված արտահերթ փորձեր՝ {count}',
	'training.access.done.extra': 'Արտահերթ փորձը տրամադրված է։',
	'training.access.error.extraState':
		'Արտահերթ փորձ կարելի է տալ միայն հաստատված հայտով, քանի դեռ թեստը հանձնված չէ։ Թարմացրեք էջը։',
	'training.access.error.conditions':
		'Մասնակիցն այլևս չի համապատասխանում դասընթացի պայմաններին ({missing})։ Մերժեք հայտը կամ սպասեք։',
	'training.missing.membership': 'գործող անդամակցություն',
	'training.missing.age': 'տարիք',
	'training.missing.level': 'աստիճան',
	'training.mail.request.subject': 'Նոր հայտ դասընթացի համար',
	'training.mail.request.text':
		'Նոր հայտ «{course}» դասընթացի մուտքի համար։ Մասնակից՝ {name}։\n\nՀայտեր՝ {url}',
	'training.mail.approved.subject': 'Դասընթացի մուտքը բաց է',
	'training.mail.approved.text':
		'Բարև, {name}։\n\n«{course}» դասընթացի ձեր հայտը հաստատված է։\n\nԴասընթացի պորտալ՝ {url}',
	'training.mail.rejected.subject': 'Դասընթացի հայտը մերժված է',
	'training.mail.rejected.text':
		'Բարև, {name}։\n\n«{course}» դասընթացի ձեր հայտը մերժված է։ Պատճառը՝ {reason}\n\nԿրկին դիմել՝ {url}',
	'training.mail.revoked.subject': 'Դասընթացի մուտքը փակված է',
	'training.mail.revoked.text':
		'Բարև, {name}։\n\n«{course}» դասընթացի ձեր մուտքը փակված է։ Պատճառը՝ {reason}\n\nՈւսուցում՝ {url}'
};
