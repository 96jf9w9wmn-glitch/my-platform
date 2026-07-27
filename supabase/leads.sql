-- Заявки на пробный урок с лендинга (воронка: новый → связались → пробный → клиент).
-- Пишет их анонимный посетитель, поэтому доступ асимметричный: вставка разрешена
-- всем, ЧТЕНИЕ — только вошедшему репетитору. Иначе публичный anon-ключ, лежащий
-- в клиентском бандле, отдавал бы чужие контакты кому угодно.
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.

CREATE TABLE IF NOT EXISTS public.leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  contact    text NOT NULL,            -- телефон или @телеграм, как оставил человек
  goal       text,                     -- предмет/класс/цель своими словами
  source     text DEFAULT 'landing',
  status     text NOT NULL DEFAULT 'new',   -- 'new' | 'contacted' | 'trial' | 'client' | 'lost'
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_created_idx ON public.leads (created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Оставить заявку может кто угодно (форма на лендинге, посетитель не авторизован).
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
CREATE POLICY leads_public_insert ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- А читать и вести воронку — только вошедший репетитор.
DROP POLICY IF EXISTS leads_tutor_read ON public.leads;
CREATE POLICY leads_tutor_read ON public.leads
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS leads_tutor_update ON public.leads;
CREATE POLICY leads_tutor_update ON public.leads
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
