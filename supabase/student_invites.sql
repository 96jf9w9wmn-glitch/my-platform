-- Приглашение ученика одной ссылкой: репетитор жмёт «Пригласить», получает
-- ссылку с одноразовым токеном на 7 дней и отправляет её в мессенджер. Ученик
-- по ссылке регистрируется и сразу оказывается привязан к этому репетитору —
-- код вводить не нужно.
--
-- Выполнить один раз в Supabase → SQL Editor. Идемпотентно.

CREATE TABLE IF NOT EXISTS public.student_invites (
  token       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at     timestamptz,          -- проставляется при первом успешном использовании
  used_by     uuid                  -- student_accounts.id того, кто воспользовался
);

CREATE INDEX IF NOT EXISTS student_invites_tutor_idx ON public.student_invites (tutor_id);

-- В отличие от старых таблиц (students/homework/…), эта заводится СРАЗУ с RLS:
-- репетитор — обычный пользователь auth.users, значит политика по auth.uid()
-- здесь работает без RPC-слоя.
ALTER TABLE public.student_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_invites_owner ON public.student_invites;
CREATE POLICY student_invites_owner ON public.student_invites
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- Ученик к таблице доступа не имеет вовсе: он ходит только через функцию ниже.
-- Она отдаёт КОД репетитора (тот же, что ученик иначе вводил бы руками) и гасит
-- токен, поэтому повторно ссылка не сработает.
--
-- SECURITY DEFINER: ученик не заведён в auth.users и работает под anon-ключом.
CREATE OR REPLACE FUNCTION public.invite_claim(p_token uuid, p_account uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor uuid;
  v_code  text;
BEGIN
  -- Гасим токен и забираем владельца одним запросом: параллельные попытки
  -- воспользоваться одной ссылкой второй раз не пройдут (used_at IS NULL).
  UPDATE student_invites
     SET used_at = now(), used_by = p_account
   WHERE token = p_token
     AND used_at IS NULL
     AND expires_at > now()
  RETURNING tutor_id INTO v_tutor;

  IF v_tutor IS NULL THEN
    RETURN NULL;  -- нет такого токена, просрочен или уже использован
  END IF;

  SELECT code INTO v_code FROM tutors WHERE id = v_tutor;
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_claim(uuid, uuid) TO anon, authenticated;

-- Сбросить кэш схемы PostgREST, иначе таблица и функция не подхватятся сразу.
NOTIFY pgrst, 'reload schema';
