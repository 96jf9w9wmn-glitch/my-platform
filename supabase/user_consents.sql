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

NOTIFY pgrst, 'reload schema';
