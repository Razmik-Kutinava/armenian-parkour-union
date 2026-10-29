import type { Messages } from '../translate';

export const ruCabinetPrivacy: Partial<Messages> = {
	'cabinet.privacy.title': 'Приватность',
	'cabinet.privacy.hint':
		'Выберите, что видят посетители сайта. Контакты и дата рождения не показываются никогда.',
	'cabinet.privacy.showCity': 'Показывать мой город публично',
	'cabinet.privacy.showAvatar': 'Показывать моё фото публично',
	'cabinet.privacy.submit': 'Сохранить настройки приватности',
	'cabinet.privacy.saved': 'Сохранено.',
	'cabinet.deletion.title': 'Удаление аккаунта',
	'cabinet.deletion.hint':
		'Администратор рассмотрит запрос и удалит аккаунт. Войти будет нельзя; баллы, платежи и сертификаты останутся в записях федерации.',
	'cabinet.deletion.request': 'Запросить удаление',
	'cabinet.deletion.confirm': 'Отправить запрос на удаление аккаунта?',
	'cabinet.deletion.requested': 'Запрос отправлен {date}. Его рассмотрит администратор.',
	'cabinet.deletion.cancel': 'Отозвать запрос',
	'cabinet.deletion.cancelled': 'Запрос отозван.'
};
