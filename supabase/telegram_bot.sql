-- Телеграм-бот репетитора: привязка чата к аккаунту платформы.
--
-- Бот — это второй вход в тот же кабинет, а не отдельный продукт: он читает
-- те же students / homework / lessons и ничего своего не хранит, кроме связки
-- «аккаунт репетитора ↔ chat_id» и настроек показа.
--
-- Кто что делает с этими таблицами:
--   * репетитор — читает СВОЮ привязку (RLS по auth.uid()) и просит одноразовый
--     код через RPC telegram_link_code_new();
--   * запись привязки, её удаление и весь обмен с Telegram — только сервер под
--     service_role (api/telegram.js). Клиенту писать нельзя: иначе можно было бы
--     привязать свой чат к чужому аккаунту одним INSERT и читать чужих учеников.
--
-- Доступ к боту даёт тариф «Про» и выше — проверку делает сервер на каждом
-- сообщении (api/telegram.js → featureAllowed(..., "telegramBot")), потому что
-- Telegram обращается к нам напрямую, минуя интерфейс с его ограничениями.
--
-- Выполнить в Supabase → SQL Editor. Идемпотентно. Пока миграция не выполнена,
-- блок «Телеграм-бот» на странице «Подписка» честно пишет, что бот не подключён,
-- а сам бот отвечает «привязка недоступна» вместо тишины.

-- ── Привязка чата к репетитору ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutor_telegram (
  tutor_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- chat_id у Telegram 64-битный, в bigint влезает с запасом.
  -- UNIQUE: один чат обслуживает один аккаунт, иначе в одном чате смешались бы
  -- ученики двух репетиторов.
  chat_id     bigint NOT NULL UNIQUE,
  username    text,
  first_name  text,
  -- Показывать фамилию ученика полностью. По умолчанию НЕТ: Telegram — внешний
  -- сервис за пределами РФ, и отправлять туда полные имена школьников без
  -- необходимости не нужно (152-ФЗ, минимизация). Репетитор включает сам.
  full_names  boolean NOT NULL DEFAULT false,
  -- Присылать ли уведомления (сдал ДЗ, написал в чат). Выключается из бота.
  notify      boolean NOT NULL DEFAULT true,
  linked_at   timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz
);

ALTER TABLE public.tutor_telegram ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_telegram_read ON public.tutor_telegram;
CREATE POLICY tutor_telegram_read ON public.tutor_telegram
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- Отвязать чат репетитор может сам из интерфейса — это не выдача доступа,
-- а его снятие, ограничивать смысла нет.
DROP POLICY IF EXISTS tutor_telegram_unlink ON public.tutor_telegram;
CREATE POLICY tutor_telegram_unlink ON public.tutor_telegram
  FOR DELETE TO authenticated
  USING (tutor_id = auth.uid());

REVOKE ALL ON public.tutor_telegram FROM anon, app_user;
GRANT SELECT, DELETE ON public.tutor_telegram TO authenticated;

-- ── Одноразовые коды привязки ───────────────────────────────────────────────
-- Привязка идёт кодом, а не «напишите боту свой e-mail»: код выдаёт уже вошедший
-- в кабинет репетитор, живёт 15 минут и сгорает после первого использования.
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code       text PRIMARY KEY,
  tutor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE INDEX IF NOT EXISTS telegram_link_codes_tutor_idx
  ON public.telegram_link_codes (tutor_id, created_at DESC);

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
-- Политик нет намеренно: таблица целиком служебная. Репетитор получает код
-- значением из RPC, сервер читает её под service_role. Прямого доступа с
-- клиента нет — иначе чужой код можно было бы подсмотреть SELECT-ом.
REVOKE ALL ON public.telegram_link_codes FROM anon, authenticated, app_user;

-- ── Отправленные уведомления ────────────────────────────────────────────────
-- Клиент ученика сообщает серверу «я сдал ДЗ», а сервер уже сам проверяет факт
-- в базе и пишет репетитору. Эта таблица — защита от повтора: один и тот же
-- ключ события шлётся ровно один раз (двойной клик, ретрай сети, перезагрузка).
CREATE TABLE IF NOT EXISTS public.telegram_events (
  event_key text PRIMARY KEY,
  tutor_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_events_sent_idx
  ON public.telegram_events (sent_at DESC);

ALTER TABLE public.telegram_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_events FROM anon, authenticated, app_user;

-- ── Выдача кода привязки репетитору ─────────────────────────────────────────
-- Возвращает готовый код. Старые неиспользованные коды того же репетитора
-- гасим: иначе «я нажал кнопку три раза» оставляло бы три рабочих ключа.
CREATE OR REPLACE FUNCTION public.telegram_link_code_new()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor uuid := auth.uid();
  v_code  text;
BEGIN
  IF v_tutor IS NULL THEN
    RAISE EXCEPTION 'Нужен вход репетитора';
  END IF;

  DELETE FROM telegram_link_codes
   WHERE tutor_id = v_tutor AND used_at IS NULL;

  -- Код короткий, чтобы его можно было ввести руками, но не угадываемый:
  -- 8 знаков base32 без похожих друг на друга символов ≈ 40 бит.
  v_code := (
    SELECT string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                    1 + floor(random() * 32)::int, 1), '')
      FROM generate_series(1, 8)
  );

  INSERT INTO telegram_link_codes (code, tutor_id, expires_at)
  VALUES (v_code, v_tutor, now() + interval '15 minutes');

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_link_code_new() FROM PUBLIC, anon, app_user;
GRANT EXECUTE ON FUNCTION public.telegram_link_code_new() TO authenticated;

-- ── Погашение кода ботом ────────────────────────────────────────────────────
-- Всё одной функцией, потому что операция обязана быть атомарной: код должен
-- сгорать ровно один раз, даже если два сообщения с ним пришли одновременно.
-- Возвращает tutor_id при успехе и NULL, если код не найден, просрочен или уже
-- использован — бот по NULL отвечает «код не годится», не различая причины.
CREATE OR REPLACE FUNCTION public.telegram_link_claim(
  p_code       text,
  p_chat       bigint,
  p_username   text,
  p_first_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor uuid;
BEGIN
  UPDATE telegram_link_codes
     SET used_at = now()
   WHERE code = upper(btrim(p_code))
     AND used_at IS NULL
     AND expires_at > now()
  RETURNING tutor_id INTO v_tutor;

  IF v_tutor IS NULL THEN
    RETURN NULL;
  END IF;

  -- Чат мог быть привязан к другому аккаунту (репетитор сменил кабинет) —
  -- тогда прежняя привязка этого чата уступает новой.
  DELETE FROM tutor_telegram WHERE chat_id = p_chat AND tutor_id <> v_tutor;

  INSERT INTO tutor_telegram (tutor_id, chat_id, username, first_name, last_seen)
  VALUES (v_tutor, p_chat, p_username, p_first_name, now())
  ON CONFLICT (tutor_id) DO UPDATE
    SET chat_id    = EXCLUDED.chat_id,
        username   = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        linked_at  = now(),
        last_seen  = now();

  RETURN v_tutor;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_link_claim(text, bigint, text, text)
  FROM PUBLIC, anon, authenticated, app_user;
GRANT EXECUTE ON FUNCTION public.telegram_link_claim(text, bigint, text, text) TO service_role;

-- ── Однократная отправка уведомления ────────────────────────────────────────
-- true — событие занято именно этим вызовом (можно писать в Telegram),
-- false — его уже отправляли. Захват и проверка одним INSERT, потому что
-- уведомление легко приходит дважды из двух вкладок одновременно.
CREATE OR REPLACE FUNCTION public.telegram_event_claim(p_key text, p_tutor uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO telegram_events (event_key, tutor_id) VALUES (p_key, p_tutor);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_event_claim(text, uuid)
  FROM PUBLIC, anon, authenticated, app_user;
GRANT EXECUTE ON FUNCTION public.telegram_event_claim(text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
