-- Журнал согласий, которые пользователь даёт при регистрации.
--
-- Зачем отдельная таблица, а не колонки в tutors/student_accounts: 152-ФЗ требует
-- зафиксировать ФАКТ и ДАТУ согласия, а документы со временем меняются — нужна
-- история («на что именно и в какой редакции согласился этот человек тогда»),
-- а не текущее состояние галочки. Поэтому таблица append-only.
--
-- Доступ асимметричный, как у leads: писать может аноним (регистрация идёт до
-- логина), читать — никто из клиента. Журнал согласий смотрит только оператор
-- через SQL Editor / service_role, иначе публичный anon-ключ отдавал бы чужие
-- телефоны и email кому угодно.
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.
-- Пока миграция не выполнена, регистрация работает как раньше: запись в журнал
-- делается best-effort и её ошибка намеренно игнорируется (не ломать регистрацию
-- из-за забытой миграции).

CREATE TABLE IF NOT EXISTS public.user_consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_role   text NOT NULL,             -- 'tutor' | 'student'
  subject_id     uuid,                      -- tutors.id / student_accounts.id
  contact        text,                      -- email или телефон, как регистрировался
  doc_version    text NOT NULL,             -- редакция документов на момент согласия
  terms          boolean NOT NULL DEFAULT false,  -- Правила сервиса + Политика
  personal_data  boolean NOT NULL DEFAULT false,  -- Согласие на обработку ПДн
  guardian       boolean,                   -- 18+ либо согласие законного представителя
  marketing      boolean NOT NULL DEFAULT false,  -- необязательное: рассылка
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_consents_subject_idx
  ON public.user_consents (subject_role, subject_id);
CREATE INDEX IF NOT EXISTS user_consents_created_idx
  ON public.user_consents (created_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Записать согласие может кто угодно: в момент регистрации сессии ещё нет.
DROP POLICY IF EXISTS user_consents_public_insert ON public.user_consents;
CREATE POLICY user_consents_public_insert ON public.user_consents
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- SELECT/UPDATE/DELETE-политик нет намеренно: журнал append-only и читается
-- только через service_role (SQL Editor). Отзыв согласия оформляется новой
-- записью, а не правкой старой.

-- Текущее состояние необязательной рассылки держим в профиле: журнал append-only
-- и из клиента не читается, а переключатель в кабинете должен показывать, как
-- сейчас. Каждое переключение дополнительно ложится записью в журнал.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.student_accounts
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

-- Колонка добавлена в таблицы, доступ к которым выдан ПОИМЁННО (rls_step3),
-- поэтому без гранта она невидима ролям кабинета. Хуже того: `select *` из
-- tutors при восстановлении сессии начинал возвращать 42501, репетитора не
-- пускало в кабинет после перезагрузки страницы, и это выглядело как выход
-- из аккаунта. Новую колонку в этих таблицах всегда сопровождать грантом.
GRANT SELECT (marketing_opt_in) ON public.tutors TO authenticated;
GRANT SELECT (marketing_opt_in), UPDATE (marketing_opt_in)
  ON public.student_accounts TO app_user, authenticated;

NOTIFY pgrst, 'reload schema';
