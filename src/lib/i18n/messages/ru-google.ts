import type { Messages } from '../translate';

export const ruGoogle: Partial<Messages> = {
	'auth.google.continue': 'Войти через Google',
	'auth.google.or': 'или по email',
	'auth.google.failed': 'Не удалось войти через Google. Попробуйте ещё раз или войдите по email.',
	'auth.google.notLinked':
		'Аккаунт с этим email уже есть. Войдите по паролю и подтвердите email — после этого заработает и вход через Google.',
	'auth.profile.title': 'Дополните профиль',
	'auth.profile.text':
		'Чтобы пользоваться сайтом, нужно ещё несколько данных. Для участников младше 18 лет — данные родителя.',
	'auth.profile.submit': 'Сохранить и продолжить'
};
