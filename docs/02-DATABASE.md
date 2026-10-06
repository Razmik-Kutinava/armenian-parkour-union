# 02-DATABASE: Структура базы данных

> Отвечает на вопросы: какие таблицы, поля, типы, enum, связи, индексы, ограничения.
> Правила работы агента — `.cursor/rules/main.mdc` (раздел «База данных (Migration Gate)»).
> Бизнес-логика (когда и почему что меняется) — `03-BUSINESS-RULES.md`. Права — `04-ROLES-PERMISSIONS.md`.

Источник правды по структуре БД. Любое отклонение сначала вносится сюда (с согласия владельца), потом в код.
СУБД: PostgreSQL. ORM: Drizzle. Схема лежит в `src/lib/server/db/schema/`, миграции только через `db:generate`.

**Для агента:**
- Не добавлять таблицы, поля, enum-значения и индексы, которых здесь нет. Нужно новое — стоп и вопрос.
- Перед любой миграцией — Migration Gate: что меняется, план отката, ждать «go».
- Строки «Правило» в таблицах ниже — ограничения целостности данных, которые обязана соблюдать схема и сервисы. Полная логика процессов — в `03-BUSINESS-RULES.md`; при расхождении — стоп и вопрос.

## Общие соглашения

- **PK:** `id uuid` (default `gen_random_uuid()`), если не указано иное.
- **Время:** `timestamptz`. В каждой таблице `created_at` (default now), в изменяемых ещё `updated_at`.
- **Деньги:** `amount_minor integer` (целое, в минимальных единицах, например центы или драмы без дробной части) + `currency char(3)` (`AMD`, `USD`, `EUR`). Никаких float.
- **Мягкое удаление:** `deleted_at timestamptz null` там, где на запись есть ссылки. Все выборки для сайта фильтруют `deleted_at is null`.
- **Многоязычные тексты:** `jsonb` вида `{"ru": "...", "hy": "...", "en": "..."}`. Язык `ru` обязателен, при отсутствии перевода сайт показывает `ru`.
- **Имена:** таблицы и поля `snake_case`, английский. Таблицы во множественном числе.
- **Файлы:** в БД хранится только ключ в хранилище (`*_key`), не полный URL.
- **Append-only таблицы:** `points_ledger`, `audit_log`, `payment_webhook_events`. Записи не обновляются и не удаляются. Запретить `UPDATE` и `DELETE` триггером.
- **Автор изменений:** поля `created_by`, `reviewed_by` и т. п. ссылаются на `users.id`. `null` означает «система».
- **Транзакции:** всё, что меняет несколько таблиц сразу (баллы + баланс, сертификат + степень + баллы, заказ + списание + остаток), выполняется одной транзакцией в сервисе.

## Enum-типы

| Enum | Значения |
|---|---|
| `user_role` | `member`, `editor`, `moderator`, `admin` |
| `user_status` | `active`, `blocked` |
| `membership_level` | `novice`, `advanced`, `pro` |
| `membership_status` | `pending`, `active`, `expired`, `cancelled` |
| `staff_kind` | `trainer`, `judge` |
| `certificate_kind` | `level`, `trainer`, `judge` |
| `certificate_status` | `active`, `expired`, `revoked` |
| `exam_kind` | `level_advanced`, `level_pro`, `trainer`, `judge` |
| `exam_result` | `scheduled`, `passed`, `failed`, `cancelled` |
| `content_status` | `draft`, `published`, `archived` |
| `event_status` | `draft`, `published`, `finished`, `cancelled`, `archived` |
| `discipline` | `speed`, `style`, `tricking`, `freerun`, `other` |
| `registration_status` | `registered`, `waitlist`, `cancelled`, `attended`, `no_show` |
| `payment_kind` | `membership`, `donation`, `event_fee` |
| `payment_status` | `pending`, `paid`, `failed`, `cancelled`, `refunded` |
| `video_status` | `pending`, `approved`, `rejected` |
| `points_reason` | `certificate`, `event_registration`, `event_participation`, `event_win`, `video`, `manual`, `shop_order`, `shop_refund`, `reversal` |
| `order_status` | `new`, `confirmed`, `shipped`, `delivered`, `cancelled` |
| `hero_type` | `event`, `presentation`, `video`, `person`, `custom` |
| `consent_kind` | `parental`, `medical`, `privacy` |
| `consent_status` | `pending`, `approved`, `rejected`, `expired` |

Роль `user_role` это системный доступ. **Тренер и судья не роли:** это участник, у которого есть профиль в `staff_profiles` и действующий сертификат. Права по ролям описаны в `04-ROLES-PERMISSIONS.md`.

---

## 1. Пользователи и авторизация

### Таблицы Better Auth
`session`, `account`, `verification` создаются библиотекой Better Auth, структуру не менять вручную. Таблица `users` ниже расширяет её пользовательскую таблицу (`additionalFields`).

### `users`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| email | text unique not null | в нижнем регистре |
| email_verified | boolean default false | |
| name | text not null | отображаемое имя (требование Better Auth) |
| first_name, last_name | text | |
| birth_date | date | нужен для возрастных групп |
| phone | text | |
| country | char(2) default 'AM' | |
| city | text | |
| avatar_key | text | |
| bio | text | |
| locale | text default 'ru' | `ru`, `hy`, `en` |
| role | user_role default 'member' | |
| status | user_status default 'active' | |
| level | membership_level null | текущая степень, `null` до оплаты первого взноса |
| points_balance | integer default 0, check >= 0 | кэш баланса, пересчитывается в той же транзакции, что и запись в журнал |
| guardian_name, guardian_phone, guardian_email | text | для несовершеннолетних |
| deleted_at | timestamptz | |
| created_at, updated_at | timestamptz | |

Индексы: unique(`email`), `role`, `level`, `status`, (`last_name`, `first_name`).
Правило: источник правды по баллам `points_ledger`, `points_balance` только кэш.

### `staff_profiles`
Профиль тренера или судьи. Один пользователь может иметь оба.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| kind | staff_kind | |
| category | text | категория или квалификация |
| license_number | text | |
| bio | jsonb | многоязычное |
| is_public | boolean default false | показывать на публичной странице |
| is_active | boolean default true | |

Ограничения: unique(`user_id`, `kind`).

---

## 2. Членство, экзамены, сертификаты

### `memberships`
Периоды членства. Годовой взнос, продление создаёт новую запись.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| status | membership_status | |
| starts_at, ends_at | timestamptz | заполняются после оплаты |
| payment_id | uuid FK payments null | |
| created_at | timestamptz | |

Индексы: `user_id`, (`status`, `ends_at`).
Правило: при оплате взноса `status='active'`; если `users.level` пустой, ставится `novice`.

### `exams`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | кто сдаёт |
| kind | exam_kind | |
| event_id | uuid FK events null | если экзамен проходит на событии |
| scheduled_at | timestamptz | |
| result | exam_result default 'scheduled' | |
| score | numeric(5,2) null | |
| examiner_id | uuid FK users null | |
| notes | text | |
| decided_at | timestamptz | |
| created_at | timestamptz | |

Индексы: `user_id`, (`result`, `scheduled_at`).

### `certificates`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| kind | certificate_kind | |
| level | membership_level null | только для `kind='level'` (`advanced` или `pro`) |
| category | text null | категория для тренера и судьи |
| number | text unique not null | человекочитаемый номер, например `APU-2027-0001` |
| public_token | text unique not null | случайный токен для страницы проверки и QR |
| status | certificate_status default 'active' | |
| issued_at | timestamptz not null | |
| expires_at | timestamptz null | |
| exam_id | uuid FK exams null | |
| issued_by | uuid FK users | |
| file_key | text null | PDF в хранилище |
| revoked_at | timestamptz null | |
| revoke_reason | text null | |
| created_at | timestamptz | |

Индексы: `user_id`, unique(`number`), unique(`public_token`), (`kind`, `status`).
Проверка: `level` обязателен при `kind='level'` и должен быть `null` иначе.
Правило: выдача сертификата уровня обновляет `users.level` и начисляет баллы (правило `certificate`). Всё делает сервис одной транзакцией.

---

## 3. События

### `events`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| slug | text unique not null | для URL |
| title | jsonb not null | многоязычное |
| description | jsonb | многоязычное, HTML из редактора |
| cover_key | text | |
| status | event_status default 'draft' | |
| starts_at, ends_at | timestamptz not null | |
| location_name | text | |
| address | text | |
| city | text | |
| latitude, longitude | numeric(9,6) null | |
| capacity | integer null | `null` без лимита |
| price_amount_minor | integer default 0 | `0` бесплатно |
| price_currency | char(3) default 'AMD' | |
| registration_opens_at, registration_closes_at | timestamptz null | |
| published_at | timestamptz null | |
| created_by | uuid FK users | |
| deleted_at | timestamptz | |
| created_at, updated_at | timestamptz | |

Индексы: unique(`slug`), (`status`, `starts_at`).
Проверка: `ends_at >= starts_at`.

### `event_categories`
Категории и возрастные группы внутри события.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK events, on delete cascade | |
| name | jsonb | например «Speed, 12–14» |
| discipline | discipline | |
| age_min, age_max | smallint null | |
| capacity | integer null | |
| sort_order | integer default 0 | |

Индекс: `event_id`.

### `event_registrations`
Связь «пользователь и событие». Результаты хранятся здесь же.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK events | |
| user_id | uuid FK users | |
| category_id | uuid FK event_categories null | |
| status | registration_status default 'registered' | |
| payment_id | uuid FK payments null | если событие платное |
| registered_at | timestamptz default now | |
| attended_at | timestamptz null | |
| place | smallint null | итоговое место, `1` победа |
| score | numeric(6,2) null | |
| result_note | text | |
| created_at, updated_at | timestamptz | |

Ограничения: unique(`event_id`, `user_id`).
Индексы: `user_id`, (`event_id`, `status`).
Правила:
- Для платного события регистрация становится активной после оплаты (`payments.status='paid'`).
- Баллы за регистрацию начисляются при создании активной регистрации.
- Баллы за участие при смене статуса на `attended`.
- Баллы за победу при установке `place = 1`.
- Лимит `capacity` проверяется в транзакции; при превышении статус `waitlist`.

---

## 4. Платежи

### `payments`
Все платежи: взносы, донаты, оплата участия.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users null | `null` для анонимного доната |
| kind | payment_kind | |
| status | payment_status default 'pending' | |
| amount_minor | integer not null, check > 0 | |
| currency | char(3) not null | |
| provider | text not null | `manual` для ручного подтверждения |
| provider_payment_id | text null | ID у провайдера |
| provider_payload | jsonb null | сырой ответ, для разбора спорных случаев |
| donation_purpose_id | uuid FK donation_purposes null | только для донатов |
| donor_name, donor_email | text null | для анонимных донатов |
| is_anonymous | boolean default false | скрыть имя в публичном списке |
| receipt_url | text null | |
| paid_at | timestamptz null | |
| refunded_at | timestamptz null | |
| confirmed_by | uuid FK users null | кто подтвердил вручную |
| created_at, updated_at | timestamptz | |

Ограничения: unique(`provider`, `provider_payment_id`) where `provider_payment_id is not null`.
Индексы: `user_id`, (`kind`, `status`), `paid_at`.
Правила:
- Членский взнос и донат это **разные** `kind`, обрабатываются разными сценариями.
- Статус меняется только сервисом платежей или ручным подтверждением админом (с записью в `audit_log`).

### `payment_webhook_events`
Защита от повторной обработки вебхуков. **Append-only.**
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| provider | text | |
| event_id | text | ID события у провайдера |
| payload | jsonb | |
| processed_at | timestamptz null | |
| error | text null | |
| created_at | timestamptz | |

Ограничения: unique(`provider`, `event_id`).

### `donation_purposes`
Назначения донатов, редактируются в админке.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| title | jsonb | например «На паркур-парк» |
| is_active | boolean default true | |
| sort_order | integer default 0 | |

---

## 5. Баллы

### `points_rules`
Сколько баллов за что. Правится в админке.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| code | text unique not null | см. список ниже |
| title | jsonb | описание для админки |
| points | integer not null | |
| is_active | boolean default true | |
| updated_by | uuid FK users null | |
| updated_at | timestamptz | |

Коды правил (создаются seed-скриптом): `certificate_level_advanced`, `certificate_level_pro`, `certificate_trainer`, `certificate_judge`, `event_registration`, `event_participation`, `event_win`, `video_approved`. Значения баллов на старте задаёт владелец проекта.

### `points_ledger`
Журнал начислений. **Append-only.**
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| delta | integer not null, check <> 0 | плюс начисление, минус списание |
| reason | points_reason | |
| rule_id | uuid FK points_rules null | |
| source_type | text null | `certificate`, `event_registration`, `video`, `shop_order` |
| source_id | uuid null | ID источника |
| comment | text null | обязателен при `reason='manual'` и `'reversal'` |
| reversal_of_id | uuid FK points_ledger null | для отмены ошибочной записи |
| created_by | uuid FK users null | `null` система |
| created_at | timestamptz | |

Индексы: (`user_id`, `created_at` desc), (`source_type`, `source_id`).
Защита от двойного начисления: unique(`user_id`, `reason`, `source_type`, `source_id`) where `reason not in ('manual','reversal')` and `source_id is not null`.
Правила:
- Ошибка исправляется записью с `reason='reversal'`, `delta` противоположного знака и `reversal_of_id`. Одну запись можно отменить только один раз.
- Каждая запись в журнале в той же транзакции меняет `users.points_balance`. Баланс не может уйти ниже нуля.

---

## 6. Видео

### `videos`
Видеоистория участника (только ссылки).
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| url | text not null | |
| platform | text | `youtube`, `instagram`, `tiktok`, `other` |
| title | text | |
| event_id | uuid FK events null | если видео с события |
| status | video_status default 'pending' | |
| reviewed_by | uuid FK users null | |
| reviewed_at | timestamptz null | |
| reject_reason | text null | |
| created_at | timestamptz | |

Ограничения: unique(`user_id`, `url`).
Индексы: `user_id`, (`status`, `created_at`).
Правило: баллы (`video_approved`) начисляются один раз при переходе в `approved`.

---

## 7. Магазин

### `shop_items`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| slug | text unique | |
| title | jsonb | |
| description | jsonb | |
| image_keys | jsonb | массив ключей изображений |
| price_points | integer not null, check > 0 | |
| options | jsonb null | например `{"size": ["S","M","L"]}` |
| stock | integer null, check >= 0 | `null` без ограничения |
| status | content_status default 'draft' | |
| sort_order | integer default 0 | |
| deleted_at | timestamptz | |
| created_at, updated_at | timestamptz | |

### `shop_orders`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| status | order_status default 'new' | |
| total_points | integer not null | |
| ledger_id | uuid FK points_ledger null | списание баллов |
| recipient_name, phone, city, address | text | данные доставки |
| comment | text | |
| tracking_note | text | |
| created_at, updated_at | timestamptz | |

Индексы: `user_id`, `status`.

### `shop_order_items`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK shop_orders, on delete cascade | |
| item_id | uuid FK shop_items | |
| selected_options | jsonb null | |
| quantity | integer check > 0 | |
| price_points_snapshot | integer | цена на момент заказа |

Правила:
- Создание заказа одной транзакцией: проверка баланса и остатка, списание баллов (запись `shop_order` в журнал), уменьшение `stock`.
- Отмена заказа возвращает баллы (`shop_refund`) и остаток.

---

## 8. Контент и главная

### `posts`
Новости и блог.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| slug | text unique | |
| title | jsonb | |
| excerpt | jsonb | |
| body | jsonb | HTML из редактора по языкам |
| cover_key | text | |
| tags | text[] default '{}' | |
| status | content_status default 'draft' | |
| published_at | timestamptz null | |
| author_id | uuid FK users | |
| deleted_at | timestamptz | |
| created_at, updated_at | timestamptz | |

Индексы: unique(`slug`), (`status`, `published_at` desc).

### `pages`
Статические страницы («О федерации», «Правила», «Контакты»), чтобы админ правил их без кода.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| slug | text unique | |
| title | jsonb | |
| body | jsonb | |
| status | content_status | |
| updated_by | uuid FK users | |
| updated_at | timestamptz | |

### `hero_blocks`
Сменные блоки верха главной страницы.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| type | hero_type | |
| title | jsonb | |
| subtitle | jsonb | |
| media_key | text null | фон или изображение |
| video_url | text null | для типа `video` |
| cta_label | jsonb null | текст кнопки |
| cta_url | text null | |
| event_id | uuid FK events null | для типа `event` |
| person_user_id | uuid FK users null | для типа `person` |
| sort_order | integer default 0 | |
| is_active | boolean default false | |
| starts_at, ends_at | timestamptz null | период показа |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

Индекс: (`is_active`, `sort_order`).
Проверки: `type='event'` требует `event_id`; `type='person'` требует `person_user_id`; `type='video'` требует `video_url`.
Правило: на главной показываются блоки с `is_active = true` и текущим временем внутри периода, по `sort_order`.

---

## 9. Согласия и документы

### `consents`
Для несовершеннолетних и медицинских допусков.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| kind | consent_kind | |
| status | consent_status default 'pending' | |
| guardian_name | text null | |
| file_key | text null | скан или фото |
| signed_at | timestamptz null | |
| valid_until | timestamptz null | |
| reviewed_by | uuid FK users null | |
| created_at | timestamptz | |

Индексы: `user_id`, (`kind`, `status`).
Правило: для пользователя младше 18 регистрация на событие требует действующего согласия `parental` со статусом `approved`.

---

## 10. Служебные

### `site_settings`
Настройки сайта (ключ и значение), правятся в админке.
| Поле | Тип | Описание |
|---|---|---|
| key | text PK | |
| value | jsonb not null | |
| updated_by | uuid FK users null | |
| updated_at | timestamptz | |

Ключи (создаются seed-скриптом): `membership_fee` (`{"amount_minor":..., "currency":"AMD", "period_months":12}`), `contacts`, `socials`, `footer`, `requisites` (реквизиты федерации), `feature_flags`.

### `media`
Библиотека загруженных файлов для админки.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| key | text unique | ключ в хранилище |
| mime | text | |
| size_bytes | integer | |
| alt | jsonb null | |
| uploaded_by | uuid FK users | |
| created_at | timestamptz | |

### `audit_log`
**Append-only.** Кто, что и когда менял.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| actor_id | uuid FK users null | `null` система |
| action | text not null | например `points.manual_add`, `certificate.revoke`, `payment.confirm_manual`, `user.role_change` |
| entity_type | text | |
| entity_id | uuid null | |
| before, after | jsonb null | |
| ip | inet null | |
| created_at | timestamptz | |

Индексы: (`entity_type`, `entity_id`), (`actor_id`, `created_at` desc).
Обязательно логировать: баллы, степени, сертификаты, платежи, роли, блокировки, смену настроек.

---

## Карта связей

- `users` 1—N `memberships`, `exams`, `certificates`, `event_registrations`, `payments`, `videos`, `points_ledger`, `shop_orders`, `consents`
- `users` 1—N `staff_profiles` (максимум по одному на `kind`)
- `events` 1—N `event_categories`, `event_registrations`
- `event_registrations` N—1 `payments` (оплата участия)
- `memberships` N—1 `payments` (оплата взноса)
- `certificates` N—1 `exams`
- `points_ledger` ссылается на источник через `source_type` и `source_id` (без жёсткого FK)
- `shop_orders` 1—N `shop_order_items` N—1 `shop_items`; `shop_orders` N—1 `points_ledger`
- `hero_blocks` N—1 `events` (тип `event`), N—1 `users` (тип `person`)
- `donation_purposes` 1—N `payments`

## Начальные данные (seed)

Скрипт `scripts/seed.ts` создаёт: правила баллов (коды выше), ключи `site_settings`, несколько `donation_purposes`, первого админа (из переменных окружения). Тестовые события, участников и товары скрипт создаёт только в `development`. Фальшивые данные в рабочем коде запрещены — только здесь.

## Что нужно уточнить у владельца
1. Значения баллов за каждое правило.
2. Размер членского взноса и валюта (по умолчанию годовой).
3. Список начальных назначений донатов.
4. Роль `editor` есть в `user_role`, но не описана в `00-PROJECT.md` (там гость, участник, тренер, судья, модератор, админ). Подтвердить роль и описать её в `04-ROLES-PERMISSIONS.md`.
5. Кто может быть экзаменатором (`exams.examiner_id`): любой пользователь, только судья/тренер с действующим сертификатом или только админ.
6. Переменные окружения для первого админа (например `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) — добавить в `01-STACK.md` и `.env.example`.
