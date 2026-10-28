import type { Messages } from '../translate';

/** Cabinet "Training": practice videos and the decision letter. Part of `hyCabinet`. */
export const hyCabinetPractice: Partial<Messages> = {
	'cabinet.practice.title': 'Պրակտիկա',
	'cabinet.practice.go': 'Անցնել պրակտիկային',
	'cabinet.practice.progress': 'Ընդունված՝ {accepted} / {total}։',
	'cabinet.practice.state.open': 'Ուղարկեք տեսանյութի հղում յուրաքանչյուր առաջադրանքի համար։',
	'cabinet.practice.state.quiz': 'Պրակտիկան կբացվի թեստը հանձնելուց հետո։',
	'cabinet.practice.state.finished': 'Դասընթացն ավարտված է։',
	'cabinet.practice.state.preview': 'Նախադիտում․ պրակտիկան հանձնում են միայն հաստատված հայտով։',
	'cabinet.practice.empty': 'Առաջադրանքներ դեռ չկան։',
	'cabinet.practice.link': 'Տեսանյութի հղում (YouTube կամ Google Drive)',
	'cabinet.practice.hint':
		'Վերբեռնեք տեսանյութը հղումով հասանելիությամբ (YouTube «Unlisted» կամ Google Drive «Anyone with the link») և տեղադրեք հղումը։ Ֆայլեր չեն ընդունվում։',
	'cabinet.practice.send': 'Ուղարկել ստուգման',
	'cabinet.practice.replace': 'Փոխել հղումը',
	'cabinet.practice.status.pending': 'Ստուգման մեջ է',
	'cabinet.practice.status.approved': 'Ընդունված է',
	'cabinet.practice.status.rejected': 'Վերադարձված է',
	'cabinet.practice.note': 'Մեկնաբանություն՝ {note}',
	'cabinet.practice.history': 'Ուղարկումներ',
	'cabinet.practice.video': 'Տեսանյութ',
	'cabinet.practice.sent': 'Հղումն ուղարկված է ստուգման։',
	'cabinet.practice.replaced': 'Հղումը փոխված է։',
	'cabinet.practice.error.bad_url': 'Տեղադրեք YouTube տեսանյութի կամ Google Drive ֆայլի հղում։',
	'cabinet.practice.error.quiz': 'Պրակտիկան կբացվի թեստը հանձնելուց հետո։',
	'cabinet.practice.error.finished': 'Դասընթացն արդեն ավարտված է։',
	'cabinet.practice.error.bad_state': 'Այս առաջադրանքն արդեն ընդունված է։',
	'cabinet.practice.error.preview': 'Նախադիտում․ պրակտիկան հանձնում են միայն հաստատված հայտով։',
	'cabinet.action.retake':
		'«{course}» դասընթացի տեսանյութը վերադարձվել է․ նորից նկարահանեք առաջադրանքը։',
	'cabinet.practice.retakeGo': 'Անցնել պրակտիկային',
	'training.mail.practiceApproved.subject': 'Պրակտիկայի տեսանյութն ընդունված է',
	'training.mail.practiceApproved.text':
		'Բարև, {name}։\n\n«{course}» դասընթացի «{task}» առաջադրանքի ձեր տեսանյութն ընդունված է։\n\nՊրակտիկա՝ {url}',
	'training.mail.practiceRejected.subject': 'Պրակտիկայի տեսանյութը վերադարձվել է',
	'training.mail.practiceRejected.text':
		'Բարև, {name}։\n\n«{course}» դասընթացի «{task}» առաջադրանքի ձեր տեսանյութը վերադարձվել է։ Մեկնաբանություն՝ {note}\n\nՆորից նկարահանեք և ուղարկեք նոր հղում՝ {url}',
	'training.mail.practiceComment': 'Մեկնաբանություն՝ {note}'
};
