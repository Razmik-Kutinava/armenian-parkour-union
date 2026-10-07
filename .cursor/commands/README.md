# Команды Cursor

В чате Agent набрать `/` и выбрать команду. Каждая команда в конце печатает `Next: /…` — следующий шаг для копипаста.

| Команда | Когда | Дальше |
|---|---|---|
| `/start` | начало сессии: где мы, что в работе, что блокирует | `/spec`, `/sbr` или `/trim` |
| `/spec` | задача с логикой: todo, файлы, «Не ломать», «Проверка» | `/sbr` |
| `/sbr` | RED → GREEN по todo | `/regress` |
| `/regress` | тесты зоны до REVIEW | `/review` (FAIL → `/sbr`) |
| `/review` | local → субагенты по риску (`high`: `bugbot` + `security-review`, `normal`: `bugbot`, `low`: нет) + `/crit-audit` → PROGRESS → push → CI | `/deploy` по апруву |
| `/crit-audit` | только K1–K5, каждая находка с падающим тестом, журнал `docs/critical-ledger.md` | `CLEAN` → дальше; `BLOCKED` → `/sbr` |
| `/trace-bug` | баг в оплате, правах, баллах — разбор цепочки до правок | `/spec` или `/sbr` |
| `/deploy` | только по явному апруву владельца | `/spec` |
| `/patch` | после REVIEW поведение кривое | `/sbr` или `/spec` |
| `/trim` | раздулся `PROGRESS.md` или закрыт этап | `/start` |

Цепочка: `/start` → `/spec` → `/sbr` → `/regress` → `/review` → `/deploy`.
Баг в опасной зоне: `/trace-bug` → `/spec` → …  Кривая после REVIEW: `/patch` → `/sbr`.
