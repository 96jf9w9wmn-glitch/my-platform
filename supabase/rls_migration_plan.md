# План включения RLS + закрытия прямого anon-доступа (152-ФЗ ст. 19)

> Составлено на основе инвентаря прямых обращений к БД из клиента (`grep .from(`).
> Цель — устранить возможность любого человека с публичным anon-ключом читать/писать
> данные учеников напрямую. **Не катить на прод без прогона на тестовой базе** — это
> прямое требование из `auth_hardening.sql` и `CLAUDE.md` (долги).

## Почему нельзя просто `enable row level security`

- Репетитор заведён в `auth.users` → у него есть `auth.uid()`, RLS-политика
  `auth.uid() = tutor_id` работает (так уже сделано в `finance.sql`).
- **Ученик и родитель НЕ заведены в `auth.users`** → у них нет `auth.uid()`.
  Их клиент ходит под ролью `anon`. Включение RLS с дефолт-deny немедленно
  запретит все их прямые `.from(...)`-запросы, и приложение сломается.
- Значит каждую ученическую/родительскую операцию надо либо (а) увести в
  SECURITY DEFINER RPC, проверяющую `session_token` (паттерн уже есть:
  `student_login/validate_session/...`), либо (б) покрыть RLS-политикой,
  проверяющей переданный session_token против строки.

## Инвентарь: что трогает каждую таблицу (из клиента)

| Таблица | Операции (из клиента) | Кто ходит | Файлы |
|---|---|---|---|
| `students` | select×6, insert×2, update×2, upsert×1, delete×1 | тьютор + **ученик/родитель** | App, Auth, Chat, ParentDashboard, StudentDashboard, Students |
| `homework` | select×5, update×5, insert, delete, (+8 прочих) | тьютор + **ученик/родитель** | Homework, ParentDashboard, StudentDashboard, StudentProfile |
| `notifications` | insert×11, update×4, delete×3, select×2 | тьютор + **ученик** | App, Chat, Homework, StudentDashboard, Variants |
| `chat_messages` | select×5, update×2, insert | тьютор + **ученик/родитель** | App, Chat, ParentDashboard, StudentDashboard |
| `variant_submissions` | update×4, select×3, insert, delete | тьютор + **ученик** | StudentDashboard, Variants |
| `variants` | select×2, insert, delete, (+8 прочих) | тьютор + **ученик** | Results, StudentDashboard, TaskBank, Variants |
| `pending_students` | select×2, delete×2, insert | тьютор (+ RPC при регистрации) | StudentDashboard, Students |
| `boards` | select, upsert | тьютор + **ученик** | components/Board |
| `student_accounts` | select×7, update×3 | смешанно | App, Chat, Homework, Results, StudentDashboard, Variants, AddStudentModal, StudentOnboardingModal |
| `tutors` | select×6, update, insert | тьютор + **ученик/родитель читают** | App, Auth, ParentDashboard, StudentDashboard, TutorOnboardingModal |
| `tasks` | select×3, insert, update, delete | тьютор | TaskBank, taskBankApi |
| `tutor_expenses` | ✅ уже под RLS | тьютор | Payment |
| `tutor_finance_settings` | ✅ уже под RLS | тьютор | Payment |

> Вывод: **фактически «безопасных» таблиц, где ходит только тьютор, почти нет** —
> `tasks` близко к этому, всё остальное трогают ученик/родитель. Поэтому это
> не точечная правка, а согласованная миграция «таблица + все её клиентские
> операции» за один заход на каждую таблицу.

## Стратегия миграции (по таблице за раз, с тестом)

Для каждой таблицы:
1. Выписать все клиентские операции ученика/родителя по ней.
2. Заменить их на вызовы SECURITY DEFINER RPC, принимающих `(p_student_id, p_token, …)`
   и внутри проверяющих `session_token` (как `student_validate_session`).
3. Оставить тьюторские операции как прямые (они под `auth.uid()`-политикой).
4. Включить RLS: политика тьютора `auth.uid() = tutor_id` (SELECT/ALL);
   для anon — **без** разрешающих политик (весь ученический доступ теперь через
   RPC, который бежит от владельца и RLS обходит).
5. Прогнать на тестовой базе оба сценария (тьютор и ученик), затем — прод.

### Пример паттерна RPC (шаблон, НЕ применять вслепую)

```sql
-- Чтение ДЗ учеником: вместо клиентского .from('homework').select().eq('student_id', id)
create or replace function public.student_homework_list(p_student_id uuid, p_token uuid)
returns setof public.homework
language plpgsql security definer set search_path = public as $$
begin
  -- проверяем, что токен действительно принадлежит этому ученику
  if not exists (
    select 1 from student_accounts a
    where a.id = p_student_id and a.session_token = p_token
  ) then
    raise exception 'Недействительная сессия';
  end if;
  return query select * from homework h where h.student_id = p_student_id;
end;
$$;
revoke execute on function public.student_homework_list(uuid, uuid) from public;
grant execute on function public.student_homework_list(uuid, uuid) to anon, authenticated;
```

Аналогично для: сдачи ДЗ, чтения/отправки чата, сдачи вариантов, чтения профиля,
аватара, доски, уведомлений, чтения карточки тьютора.

## Сопутствующее (тоже ст. 19, тоже нельзя «просто выключить»)

- **Storage-бакеты `homework`, `variants` публичные.** Клиент сейчас показывает
  файлы по прямому public URL. Закрытие бакета сломает показ — нужна миграция на
  подписанные URL (`createSignedUrl`) везде, где сейчас берётся public URL.
- **`src/supabase.js` с ключами в публичном репозитории.** Anon-ключ всё равно
  уходит в браузерный бандл, поэтому «приватный репо» не закрывает дыру сам по
  себе — но снижает лёгкость обнаружения. Настоящая защита — только RLS выше.

## ⚠️ Стратегическая развилка перед началом (решить ДО кодинга)

242-ФЗ требует переноса БД на российский хостинг (у Supabase нет РФ-региона).
**Если БД всё равно мигрирует на РФ-Postgres — весь RLS+RPC-слой логичнее делать
сразу на новой базе, а не дважды.** Тот же дизайн (SECURITY DEFINER + session_token)
переносится на любой Postgres. Поэтому порядок:

1. Решить по хостингу (остаёмся на Supabase / переезжаем на РФ-Postgres).
2. Поднять тестовую/staging-базу.
3. Выполнять миграцию по таблице за раз с прогоном обоих сценариев.

Без тестовой базы включать RLS на живой базе — гарантированно положить ученический
доступ. Поэтому этот шаг ждёт решения по инфраструктуре.
