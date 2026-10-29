# 02-DATABASE: Структура базы данных

> Отвечает на вопросы: какие таблицы, поля, типы, enum, связи, индексы, ограничения.
> Правила работы агента — `.cursor/rules/main.mdc` (раздел «База данных (Migration Gate)»).
> Бизнес-логика (когда и почему что меняется) — `03-BUSINESS-RULES.md`. Права — `04-ROLES-PERMISSIONS.md`.

**Оглавление** (раздел искать по заголовку `## …`, читать только его): Общие соглашения · Enum-типы · 1. Пользователи и авторизация · 2. Членство, экзамены, сертификаты · 3. События · 4. Платежи · 5. Баллы · 6. Видео · 7. Магазин · 8. Контент и главная · 9. Согласия и документы · 10. Служебные · 11. Обучающий портал · 12. Волонтёрство · Карта связей · Начальные данные (seed) · Что нужно уточнить у владельца

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
- **Многоязычные тексты:** `jsonb` вида `{"en": "...", "hy": "...", "ru": "..."}`. Язык `en` обязателен, при отсутствии перевода сайт показывает `en` (решение 2026-10-07).
- **Имена:** таблицы и поля `snake_case`, английский. Таблицы во множественном числе.
- **Файлы:** в БД хранится только ключ в хранилище (`*_key`), не полный URL.
- **Append-only таблицы:** `points_ledger`, `audit_log`, `payment_webhook_events`, `perk_redemptions`. Записи не обновляются и не удаляются. Запретить `UPDATE` и `DELETE` триггером.
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
| `registration_status` | `registered`, `pending_payment`, `waitlist`, `cancelled`, `attended`, `no_show` |
| `payment_kind` | `membership`, `donation`, `event_fee` |
| `payment_status` | `pending`, `paid`, `failed`, `cancelled`, `refunded` |
| `video_status` | `pending`, `approved`, `rejected` |
| `points_reason` | `certificate`, `event_registration`, `event_participation`, `event_place`, `video`, `manual`, `shop_order`, `shop_refund`, `reversal`, `volunteer_participation`, `volunteer_report` (два последних — этап 10) |
| `order_status` | `new`, `confirmed`, `shipped`, `delivered`, `cancelled` |
| `hero_type` | `event`, `presentation`, `video`, `person`, `custom` |
| `consent_kind` | `parental`, `medical`, `privacy` |
| `consent_status` | `pending`, `approved`, `rejected`, `expired` |
| `training_access_status` | `pending`, `approved`, `rejected`, `revoked` (этап 9) |
| `practice_status` | `pending`, `approved`, `rejected` (этап 9; с этапа 10 — и фотоотчёты волонтёров) |
| `volunteer_card_status` | `pending`, `active`, `rejected`, `revoked` (этап 10) |
| `perk_kind` | `reusable`, `single` (этап 10) |
| `volunteer_request_status` | `draft`, `open`, `finished`, `cancelled` (этап 10) |
| `volunteer_answer` | `invited`, `accepted`, `declined`, `expired`, `excused`, `attended`, `no_show` (этап 10) |

Роль `user_role` это системный доступ. **Тренер и судья не роли:** это участник, у которого есть профиль в `staff_profiles` и действующий сертификат. Права по ролям описаны в `04-ROLES-PERMISSIONS.md`.

---

## 1. Пользователи и авторизация

### Таблицы Better Auth
`session`, `account`, `verification`, `rate_limit` — таблицы Better Auth 1.7 (поля из `@better-auth/core`, колонки `snake_case`, `id uuid`), структуру не менять вручную. `rate_limit` — счётчики попыток входа (`rateLimit.storage = 'database'`, решение 2026-10-07). Таблица `users` ниже — пользовательская модель Better Auth (`additionalFields`); поле Better Auth `image` отображается на `avatar_key`, URL фото из Google не сохраняется. Схема — `src/lib/server/db/schema/`.

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
| terms_accepted_at | timestamptz null | согласие с политикой и правилами при регистрации (решение 2026-10-07) |
| deleted_at | timestamptz | |
| created_at, updated_at | timestamptz | |

Индексы: unique(`email`), `role`, `level`, `status`, (`last_name`, `first_name`). Проверки: `email = lower(email)`, `locale in ('en','hy','ru')`, `points_balance >= 0`.
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
| hold_until | timestamptz null | до какого момента `pending_payment` держит место: удержание при оплате или срок оплаты после очереди |
| registered_at | timestamptz default now | |
| attended_at | timestamptz null | |
| place | smallint null | итоговое место, `1` победа |
| score | numeric(6,2) null | |
| result_note | text | |
| created_at, updated_at | timestamptz | |

Ограничения: unique(`event_id`, `user_id`).
Индексы: `user_id`, (`event_id`, `status`).
Правила:
- Для платного события регистрация создаётся в `pending_payment` с `hold_until` и становится активной (`registered`) после оплаты (`payments.status='paid'`); `pending_payment` занимает место в лимите.
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
| expires_at | timestamptz null | до какого времени ждём оплату (для `pending`) |
| failure_reason | text null | `amount_mismatch`, `provider_error`, `declined` и т. п. |
| needs_review | boolean default false | флаг «требует проверки админом» |
| membership_id | uuid FK memberships null | связь с членством (если нужна прямая ссылка) |
| locale | text null | язык страницы при онлайн-оплате; письма гостю — на нём, `null` — EN |
| created_at, updated_at | timestamptz | |

Ограничения: unique(`provider`, `provider_payment_id`) where `provider_payment_id is not null`; `locale is null or locale in ('en','hy','ru')`.
Индексы: `user_id`, (`kind`, `status`), `paid_at`, (`status`, `expires_at`) для фоновой сверки.
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

Коды правил (создаются seed-скриптом): `certificate_level_advanced`, `certificate_level_pro`, `certificate_trainer`, `certificate_judge`, `event_registration`, `event_participation`, `event_place_1`, `event_place_2`, `event_place_3`, `video_approved`, `volunteer_participation`, `volunteer_report` (два последних — этап 10). Стартовые значения — `03`, раздел 6.1.

### `points_ledger`
Журнал начислений. **Append-only.**
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | |
| delta | integer not null, check <> 0 | плюс начисление, минус списание |
| reason | points_reason | |
| rule_id | uuid FK points_rules null | |
| source_type | text null | `certificate`, `event_registration`, `video`, `shop_order`, `volunteer_invitation`, `volunteer_report` |
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
| review_note | text null | причина отказа, видна участнику |
| created_at, updated_at | timestamptz | |

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

Ключи (создаются seed-скриптом): `membership_fee` (`{"amount_minor":..., "currency":"AMD", "period_months":12}`), `contacts`, `socials`, `footer`, `requisites` (реквизиты федерации), `feature_flags`; с этапа 10 — `volunteer` (`{"decline_threshold":3, "cashier_invite_hours":72}`, `03` раздел 19).

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

## 11. Обучающий портал

Этап 9 (`09`). Логика — `03` раздел 18, права — `04`, админка — `05` раздел 27, кабинет — `06` раздел 5.11. Таблицы создаются одной миграцией через Migration Gate (задача 9.1).
Многоязычные поля портала — тот же `jsonb` `{en, hy, ru}`, но, в отличие от общего соглашения, обязателен хотя бы один любой язык (контент на старте только на русском); показ — язык страницы → `ru` → `en` (решение 2026-10-27).

### `courses`
Курс: теория, тест и практика, ведущие к экзамену одного вида. Настройки теста и допуска — здесь, правятся в админке.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| slug | text unique not null | адрес курса, например `trainer` |
| exam_kind | exam_kind not null | какой экзамен создаётся по итогам (`trainer`, позже `judge`, `level_*`) |
| title, description | jsonb | |
| status | content_status default 'draft' | участник видит только `published` |
| quiz_size | smallint not null default 27 | вопросов в тесте |
| pass_count | smallint not null default 25 | сколько правильных нужно; `1 ≤ pass_count ≤ quiz_size` |
| quiz_minutes | smallint not null default 60 | время на попытку |
| retake_days | smallint not null default 30 | пауза после несданной попытки |
| attempts_limit | smallint not null default 3 | попыток за период |
| attempts_period_days | smallint not null default 180 | период лимита («полгода»), скользящий |
| requires_membership | boolean not null default true | нужно действующее членство |
| min_age | smallint null | минимальный возраст (тренер — 18) |
| required_level | membership_level null | минимальная степень (тренер — `advanced`) |
| created_at, updated_at | timestamptz | |

### `course_topics`
Темы курса: группируют уроки и вопросы, по ним тест берёт вопросы равномерно.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK courses not null | |
| title | jsonb not null | |
| sort_order | smallint not null | |
| hidden_at | timestamptz null | скрытая тема не участвует в тесте и не видна в портале |
| created_at, updated_at | timestamptz | |

### `course_lessons`
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK courses not null | |
| topic_id | uuid FK course_topics null | |
| title | jsonb not null | |
| body | jsonb null | очищенный HTML по языкам (как `posts.body`): текст, картинки из медиатеки, YouTube |
| file_key | text null | PDF в **приватном** бакете R2 (`training/<course id>/<uuid>.pdf`) |
| file_name | text null | имя файла для скачивания |
| sort_order | smallint not null | |
| status | content_status default 'draft' | |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |
| deleted_at | timestamptz null | |

Индексы: (`course_id`, `sort_order`).

### `quiz_questions`
Банк вопросов курса. Вопрос не удаляется — скрывается (старые попытки хранят снимок, но статистика ссылается на `id`).
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK courses not null | |
| topic_id | uuid FK course_topics not null | |
| text | jsonb not null | |
| options | jsonb not null | массив вариантов `[{en,hy,ru}, …]`, от 2 до 6 |
| correct_index | smallint not null | номер правильного варианта (с 0); проверка: внутри массива `options` |
| source | text null | ссылка на раздел материала («Первая помощь, раздел 3») |
| hidden_at | timestamptz null | |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

Индексы: (`course_id`, `topic_id`) where `hidden_at is null`.

### `course_access`
Заявка участника на курс и её решение. Одна строка на пару курс — участник; повторная заявка после отказа возвращает ту же строку в `pending`.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK courses not null | |
| user_id | uuid FK users not null | |
| status | training_access_status default 'pending' | |
| reviewed_by | uuid FK users null | |
| reviewed_at | timestamptz null | |
| review_note | text null | причина отказа или закрытия доступа, видна участнику; обязательна при `rejected` и `revoked` |
| extra_attempts | smallint not null default 0 | внеочередные попытки, выданные админом и ещё не использованные |
| exam_id | uuid FK exams null unique | экзамен, созданный по итогам курса; заполнен — курс завершён |
| created_at, updated_at | timestamptz | |

Ограничения: unique(`course_id`, `user_id`). Индексы: (`status`, `created_at`).

### `quiz_attempts`
Попытка теста. Вопросы и правильные ответы фиксируются снимком в момент начала — правка банка старые попытки не меняет.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK courses not null | |
| user_id | uuid FK users not null | |
| questions | jsonb not null | снимок: `[{question_id, text, options (в перемешанном порядке), correct_index}]`; в браузер `correct_index` не отдаётся |
| answers | jsonb null | выбранные номера вариантов по порядку вопросов |
| total | smallint not null | вопросов в попытке |
| pass_count | smallint not null | порог на момент начала |
| correct_count | smallint null | |
| passed | boolean null | `null` — попытка идёт |
| is_extra | boolean not null default false | внеочередная (не считается в лимите) |
| started_at | timestamptz not null | |
| expires_at | timestamptz not null | `started_at + quiz_minutes` |
| submitted_at | timestamptz null | время отправки или истечения |
| created_at | timestamptz | |

Ограничения: одна идущая попытка — unique(`course_id`, `user_id`) where `passed is null`. Индексы: (`user_id`, `course_id`, `started_at` desc).

### `practice_tasks`
Практическое задание курса: что показать на видео и по каким признакам «правильно».
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK courses not null | |
| title | jsonb not null | |
| description | jsonb not null | что показать, требования к видео и критерии проверки (очищенный HTML) |
| sort_order | smallint not null | |
| hidden_at | timestamptz null | скрытое задание не требуется для завершения курса |
| created_at, updated_at | timestamptz | |

### `practice_submissions`
Видео участника по заданию — только ссылка (YouTube, Google Drive), файлы не принимаются. Пересъёмка — новая строка, история остаётся.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| task_id | uuid FK practice_tasks not null | |
| user_id | uuid FK users not null | |
| url | text not null | нормализованная ссылка |
| platform | text not null | `youtube`, `google_drive` |
| status | practice_status default 'pending' | |
| reviewed_by | uuid FK users null | |
| reviewed_at | timestamptz null | |
| review_note | text null | комментарий проверяющего; обязателен при `rejected` |
| created_at, updated_at | timestamptz | |

Ограничения: одна живая отправка на задание — unique(`task_id`, `user_id`) where `status in ('pending', 'approved')`. Индексы: (`status`, `created_at`), `user_id`.
Таблица отдельна от `videos`: практические видео не публичны и баллов не дают.

---

## 12. Волонтёрство

Этап 10 (`09`). Логика — `03` раздел 19, права — `04` (`volunteer.manage`, кассир партнёра — раздел 2), админка — `05` раздел 28, сайт и кабинет — `06` разделы 4.12, 4.13, 5.12. Таблицы создаются одной миграцией через Migration Gate (задача 10.1). Многоязычные поля — по общему соглашению (`en` обязателен).

### `volunteer_partners`
Компания-партнёр: даёт владельцам книжки волонтёра скидки и подарки («плюшки»).
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| name | text not null | название (бренд, не переводится) |
| logo_key | text null | логотип в публичном бакете (медиатека) |
| website | text null | |
| address | jsonb null | где действует, многоязычное |
| status | content_status default 'draft' | на странице проверки, в PDF и кабинете — только `published` |
| sort_order | integer default 0 | |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

Индексы: (`status`, `sort_order`). Удаления нет — `archived`.

### `volunteer_perks`
Плюшка партнёра.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| partner_id | uuid FK volunteer_partners not null | |
| title | jsonb not null | например «Скидка 10 %» |
| terms | jsonb null | условия: на что действует, как получить |
| kind | perk_kind not null | `reusable` — сколько угодно раз; `single` — ограниченное число раз на книжку |
| uses_limit | smallint null | только у `single`, ≥ 1; проверка: `kind = 'single'` ⇔ `uses_limit is not null` |
| valid_from, valid_until | date null | срок плюшки (дни по Еревану); пусто — без ограничения; проверка: `valid_from <= valid_until` |
| status | content_status default 'draft' | |
| sort_order | integer default 0 | |
| created_at, updated_at | timestamptz | |

Индексы: (`partner_id`, `status`). Удаления нет — `archived` (на плюшку ссылаются использования).

### `partner_cashiers`
Доступ кассира партнёра: один телефон (браузер), привязанный по ссылке-приглашению. Аккаунта на сайте у кассира нет.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| partner_id | uuid FK volunteer_partners not null | |
| label | text not null | кто или где, например «Касса 1, Комитас» |
| invite_token_hash | text unique null | SHA-256 токена из ссылки-приглашения; после привязки `null` |
| invite_expires_at | timestamptz null | до какого времени ссылка действует |
| device_token_hash | text unique null | SHA-256 токена из cookie телефона; заполняется при привязке |
| bound_at | timestamptz null | когда телефон привязан |
| last_used_at | timestamptz null | последняя отметка |
| disabled_at | timestamptz null | отключён — не работают ни ссылка, ни телефон |
| disabled_by | uuid FK users null | |
| created_by | uuid FK users not null | |
| created_at, updated_at | timestamptz | |

Индексы: `partner_id`. Сами токены в базе не хранятся — только хеши.
Правило: новая ссылка тому же доступу (кассир сменил телефон) — та же строка: новый `invite_token_hash`, `device_token_hash` и `bound_at` очищаются, старый телефон перестаёт работать.

### `volunteer_cards`
Заявка на книжку волонтёра и сама книжка. Одна строка на участника; повторная заявка после отказа или отзыва возвращает ту же строку в `pending`.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users unique not null | |
| status | volunteer_card_status default 'pending' | |
| number | text unique null | `APU-V-{год}-{0001}`, присваивается при первой выдаче и не меняется |
| public_token | text unique null | случайный токен страницы проверки и QR; новый при каждой выдаче (старый QR после отзыва и повторной выдачи не работает) |
| applied_at | timestamptz not null | последняя подача заявки |
| issued_at | timestamptz null | последняя выдача |
| reviewed_by | uuid FK users null | |
| reviewed_at | timestamptz null | |
| review_note | text null | причина отказа или отзыва, видна участнику; обязательна при `rejected` и `revoked` |
| decline_streak | smallint not null default 0, check >= 0 | отказов подряд (`03` 19.6) |
| flagged_at | timestamptz null | порог отказов достигнут: предупреждение участнику, пометка у admin |
| created_at, updated_at | timestamptz | |

Индексы: unique(`user_id`), unique(`number`), unique(`public_token`), (`status`, `applied_at`), `flagged_at` where `flagged_at is not null`.
Срока в книжке нет: она действительна, пока у владельца действующее членство (`03` 19.2).

### `perk_redemptions`
Использование плюшки. **Append-only.** Ошибка исправляется обратной записью.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| card_id | uuid FK volunteer_cards not null | |
| perk_id | uuid FK volunteer_perks not null | |
| partner_id | uuid FK volunteer_partners not null | партнёр плюшки — для сводки по партнёрам |
| cashier_id | uuid FK partner_cashiers null | кто отметил; `null` у обратной записи |
| reversal_of_id | uuid FK perk_redemptions null unique | обратная запись: какую отметку отменяет |
| comment | text null | обязателен у обратной записи |
| created_by | uuid FK users null | admin, сделавший обратную запись; `null` у отметки кассира |
| created_at | timestamptz | |

Индексы: (`card_id`, `perk_id`), (`partner_id`, `created_at` desc), (`cashier_id`, `created_at` desc).
Проверка: обратная запись ⇔ заполнены `reversal_of_id`, `comment`, `created_by` и пуст `cashier_id`; у отметки — наоборот.
Правило: остаток разовой плюшки = `uses_limit` − (отметки по книжке − их обратные записи), не меньше 0.

### `volunteer_requests`
Запрос федерации на волонтёров.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| title | jsonb not null | |
| description | jsonb null | что делать, где и во сколько сбор (очищенный HTML) |
| event_id | uuid FK events null | если запрос к событию |
| starts_at, ends_at | timestamptz not null | проверка: `ends_at >= starts_at` |
| location | text null | |
| places | smallint not null, check >= 1 | сколько волонтёров нужно |
| respond_by | timestamptz not null | срок ответа; проверка: `respond_by <= starts_at` |
| status | volunteer_request_status default 'draft' | |
| published_at | timestamptz null | время рассылки |
| closed_at | timestamptz null | итоги ответов подведены по сроку (`03` 19.5 п. 4) |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

Индексы: (`status`, `respond_by`), `event_id`. Удаления нет: черновик можно отменить (`cancelled`).

### `volunteer_invitations`
Приглашение участнику и его ответ. Создаётся при рассылке запроса.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| request_id | uuid FK volunteer_requests not null | |
| user_id | uuid FK users not null | |
| status | volunteer_answer default 'invited' | |
| answered_at | timestamptz null | последний ответ участника |
| marked_by | uuid FK users null | кто отметил явку или освободил |
| marked_at | timestamptz null | |
| counted_at | timestamptz null | итог учтён в счётчике отказов (один раз на приглашение) |
| created_at, updated_at | timestamptz | |

Ограничения: unique(`request_id`, `user_id`). Индексы: (`user_id`, `created_at` desc), (`request_id`, `status`).

### `volunteer_reports`
Фото или ссылка с мероприятия от участника, отмеченного «пришёл». Повторная отправка после отказа — новая строка, история остаётся.
| Поле | Тип | Описание |
|---|---|---|
| id | uuid PK | |
| invitation_id | uuid FK volunteer_invitations not null | |
| user_id | uuid FK users not null | |
| file_key | text null | фото в **приватном** бакете (`volunteer/<user id>/<uuid>.<ext>`) |
| url | text null | нормализованная ссылка (Instagram, YouTube, Google Drive) |
| note | text null | комментарий участника |
| status | practice_status default 'pending' | |
| reviewed_by | uuid FK users null | |
| reviewed_at | timestamptz null | |
| review_note | text null | причина отказа, видна участнику; обязательна при `rejected` |
| created_at, updated_at | timestamptz | |

Проверка: заполнено ровно одно из `file_key`, `url`. Ограничения: одна живая отправка на приглашение — unique(`invitation_id`) where `status in ('pending', 'approved')`. Индексы: (`status`, `created_at`), `user_id`.

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
- `courses` 1—N `course_topics`, `course_lessons`, `quiz_questions`, `course_access`, `quiz_attempts`, `practice_tasks`; `course_topics` 1—N `course_lessons`, `quiz_questions`
- `practice_tasks` 1—N `practice_submissions`; `users` 1—N `course_access`, `quiz_attempts`, `practice_submissions`
- `course_access` 1—1 `exams` (экзамен по итогам курса)
- `users` 1—1 `volunteer_cards`; `users` 1—N `volunteer_invitations`, `volunteer_reports`
- `volunteer_partners` 1—N `volunteer_perks`, `partner_cashiers`, `perk_redemptions`
- `volunteer_cards` 1—N `perk_redemptions` N—1 `volunteer_perks`; `perk_redemptions` N—1 `partner_cashiers`
- `volunteer_requests` N—1 `events` (необязательно); `volunteer_requests` 1—N `volunteer_invitations` 1—N `volunteer_reports`

## Начальные данные (seed)

Скрипт `scripts/seed.ts` создаёт: правила баллов (коды выше), ключи `site_settings` (с этапа 10 — и `volunteer`), несколько `donation_purposes`, системные страницы `pages` (`about`, `rules`, `contacts`, `privacy`, `offer`, `refund-policy`), первого админа (из `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `01-STACK.md`). Тестовые события, участников и товары скрипт создаёт только в `development`. Фальшивые данные в рабочем коде запрещены — только здесь.

## Что нужно уточнить у владельца
1. Значения баллов за каждое правило.
2. Размер членского взноса и валюта (по умолчанию годовой).
3. Список начальных назначений донатов.

Уже решено: роль `editor` описана в `04` и `00`; экзаменатор (`exams.examiner_id`) — пользователь с ролью `moderator` или `admin` (`04`); переменные первого админа — в `01-STACK.md`.

Поля и статусы, которых требуют другие документы, но которых пока нет в схеме, собраны в `PROGRESS.md` («Открытые вопросы», расхождения схемы). Схема дополняется только после решения владельца и через Migration Gate.
