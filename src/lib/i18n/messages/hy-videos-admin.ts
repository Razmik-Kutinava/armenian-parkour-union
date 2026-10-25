import type { Messages } from '../translate';

export const hyVideosAdmin: Partial<Messages> = {
	'videos.status.hidden': 'Թաքցված է',
	'videos.platform.youtube': 'YouTube',
	'videos.platform.instagram': 'Instagram',
	'videos.platform.tiktok': 'TikTok',
	'videos.platform.other': 'Այլ',
	'videos.admin.search': 'Որոնում ըստ անվան',
	'videos.admin.filter.all': 'Բոլորը',
	'videos.admin.col.member': 'Մասնակից',
	'videos.admin.col.video': 'Տեսանյութ',
	'videos.admin.col.platform': 'Հարթակ',
	'videos.admin.col.event': 'Միջոցառում',
	'videos.admin.col.createdAt': 'Ավելացված է',
	'videos.admin.col.status': 'Կարգավիճակ',
	'videos.admin.col.actions': 'Գործողություններ',
	'videos.admin.untitled': 'Անանուն տեսանյութ',
	'videos.admin.openHint': 'Կբացվի հարթակում՝ նոր ներդիրում',
	'videos.admin.approve': 'Հաստատել',
	'videos.admin.reject': 'Մերժել',
	'videos.admin.hide': 'Թաքցնել',
	'videos.admin.selected': 'Ընտրված է՝ {count}',
	'videos.admin.approveSelected': 'Հաստատել ընտրվածները',
	'videos.admin.rejectSelected': 'Մերժել ընտրվածները',
	'videos.admin.hideSelected': 'Թաքցնել ընտրվածները',
	'videos.admin.rejectTitle': 'Մերժել տեսանյութերը՝ {count}',
	'videos.admin.rejectText':
		'Մասնակիցը կստանա նամակ՝ պատճառով։ Մերժված տեսանյութի համար միավորներ չեն տրվում։',
	'videos.admin.result': 'Կատարված է՝ {done}։ Բաց է թողնված՝ {skipped}։',
	'videos.admin.skippedHint':
		'Բաց են թողնված՝ արդեն որոշվածները, դեռ չհաստատվածները (թաքցնելու համար), ձեր սեփականները կամ ջնջված հաշիվների տեսանյութերը։',
	'videos.admin.empty': 'Տեսանյութեր չկան։',
	'videos.admin.error.select': 'Ընտրեք առնվազն մեկ տեսանյութ։',
	'videos.admin.error.tooMany': 'Միանգամից ոչ ավելի, քան 25 տեսանյութ։',
	'videos.admin.error.reason': 'Նշեք մերժման պատճառը։',
	'videos.mail.approved.subject': 'Ձեր տեսանյութը հաստատված է',
	'videos.mail.approved.text':
		'Բարև, {name}։\n\nՄոդերատորը հաստատել է ձեր «{title}» տեսանյութը։\n\nՁեր տեսանյութերը՝ {url}',
	'videos.mail.approved.textPoints':
		'Բարև, {name}։\n\nՄոդերատորը հաստատել է ձեր «{title}» տեսանյութը։ Ստացել եք {points} միավոր։\n\nՁեր տեսանյութերը՝ {url}',
	'videos.mail.rejected.subject': 'Ձեր տեսանյութը չի հաստատվել',
	'videos.mail.rejected.text':
		'Բարև, {name}։\n\nՁեր «{title}» տեսանյութը չի հաստատվել։ Պատճառը՝ {reason}\n\nՁեր տեսանյութերը՝ {url}',
	'settings.tab.videos': 'Տեսանյութեր',
	'videos.settings.section': 'Մասնակիցների տեսանյութեր',
	'videos.settings.sectionHint':
		'Մերժված տեսանյութերը հաշվվում են սահմանի մեջ, մասնակցի ջնջածները՝ ոչ։ Ամիսը օրացուցային է՝ ըստ Երևանի ժամանակի։',
	'videos.settings.limit': 'Տեսանյութ ամսական',
	'videos.settings.limitHint': 'Քանի տեսանյութ կարող է մեկ մասնակիցն ավելացնել ամսական՝ 1-ից 100։',
	'videos.settings.platforms': 'Թույլատրված հարթակներ',
	'videos.settings.error.limit': '1-ից 100։',
	'videos.settings.error.platforms': 'Ընտրեք առնվազն մեկ հարթակ։'
};
