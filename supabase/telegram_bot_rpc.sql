-- Доступ телеграм-бота к базе без service_role.
--
-- Раньше api/telegram.js читал таблицы под service_role — ключом, который может
-- в базе ВСЁ. Боту столько не нужно: ему хватает семи операций (кто привязан,
-- какой тариф, ученики, домашки, сменить статус ДЗ, факты для уведомления,
-- разовая отправка). Здесь они и перечислены — всё остальное для бота закрыто.
--
-- Опознаётся бот собственным секретом (`TELEGRAM_DB_SECRET` в env Vercel):
-- в базе лежит только его SHA-256, сам секрет знает лишь сервер функции.
-- Гранты выданы роли anon, потому что бот приходит с публичным ключом
-- PostgREST — но без секрета ни одна функция ничего не отдаёт.
--
-- Почему это лучше прежней схемы, а не просто «иначе»:
--   * утечка секрета бота не даёт доступа к базе целиком, только к этим семи
--     операциям, каждая из которых ограничена одним репетитором;
--   * список того, что бот умеет делать с данными, виден целиком в одном файле.
--
-- Выполнить в SQL Editor (или psql) ПОСЛЕ telegram_bot.sql, затем задать секрет:
--   select public.bot_secret_set('<случайная строка>');
-- Идемпотентно.

-- pgcrypto в self-hosted Supabase живёт в схеме extensions, а не в public,
-- поэтому digest() зовём по полному имени, а не полагаемся на search_path.
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- ── Секрет бота ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_config (
  key         text PRIMARY KEY,
  secret_hash text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;
-- Политик нет: таблицу читают только функции ниже (SECURITY DEFINER).
REVOKE ALL ON public.bot_config FROM anon, authenticated, app_user;

-- Установка секрета. Вызывается вручную владельцем через psql/SQL Editor —
-- клиентским ролям не выдаётся, иначе секрет можно было бы подменить снаружи.
CREATE OR REPLACE FUNCTION public.bot_secret_set(p_secret text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO bot_config (key, secret_hash, updated_at)
  VALUES ('telegram', encode(extensions.digest(p_secret, 'sha256'), 'hex'), now())
  ON CONFLICT (key) DO UPDATE
    SET secret_hash = EXCLUDED.secret_hash, updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.bot_secret_set(text) FROM PUBLIC, anon, authenticated, app_user;

-- Проверка секрета. Отдельной функцией, чтобы сравнение хэшей было в одном месте.
CREATE OR REPLACE FUNCTION public.bot_ok(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM bot_config
     WHERE key = 'telegram'
       AND secret_hash = encode(extensions.digest(COALESCE(p_secret, ''), 'sha256'), 'hex')
  );
$$;

REVOKE ALL ON FUNCTION public.bot_ok(text) FROM PUBLIC, anon, authenticated, app_user;

-- ── 1. Привязка чата ────────────────────────────────────────────────────────
-- Всё про одну связку «чат ↔ репетитор» одной функцией: чтение, отметка
-- активности, переключение настроек и отвязка. Возвращает актуальную строку.
CREATE OR REPLACE FUNCTION public.bot_link(
  p_secret     text,
  p_chat       bigint,
  p_touch      boolean DEFAULT false,
  p_full_names boolean DEFAULT NULL,
  p_notify     boolean DEFAULT NULL,
  p_unlink     boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;

  IF p_unlink THEN
    DELETE FROM tutor_telegram WHERE chat_id = p_chat;
    RETURN NULL;
  END IF;

  IF p_full_names IS NOT NULL OR p_notify IS NOT NULL THEN
    UPDATE tutor_telegram
       SET full_names = COALESCE(p_full_names, full_names),
           notify     = COALESCE(p_notify, notify)
     WHERE chat_id = p_chat;
  END IF;

  IF p_touch THEN
    UPDATE tutor_telegram SET last_seen = now() WHERE chat_id = p_chat;
  END IF;

  SELECT to_jsonb(t) INTO r
    FROM (SELECT tutor_id, chat_id, full_names, notify
            FROM tutor_telegram WHERE chat_id = p_chat) t;
  RETURN r;
END;
$$;

-- ── 2. Тариф репетитора ─────────────────────────────────────────────────────
-- installed=false означает «миграции subscriptions.sql нет» — то же различие,
-- что и в api/plan-gate.js: это не бесплатный тариф, а неустановленный биллинг.
CREATE OR REPLACE FUNCTION public.bot_plan(p_secret text, p_tutor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;

  IF to_regclass('public.tutor_subscriptions') IS NULL THEN
    RETURN jsonb_build_object('installed', false);
  END IF;

  SELECT to_jsonb(s) INTO r
    FROM (SELECT plan, status, current_period_end
            FROM tutor_subscriptions WHERE tutor_id = p_tutor) s;

  RETURN jsonb_build_object('installed', true, 'sub', r);
END;
$$;

-- ── 3. Ученики репетитора ───────────────────────────────────────────────────
-- Ровно те поля, которые бот показывает. Телефонов, адресов и заметок здесь
-- нет намеренно: в Telegram они не уходят (152-ФЗ, минимизация).
CREATE OR REPLACE FUNCTION public.bot_students(p_secret text, p_tutor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
      FROM (SELECT id, name, goal, lesson_price, lessons, payments,
                   exam_date, target_score, created_at
              FROM students WHERE tutor_id = p_tutor) s
  ), '[]'::jsonb);
END;
$$;

-- ── 4. Домашние задания ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_homework(p_secret text, p_tutor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at DESC)
      FROM (SELECT id, student_id, title, status, deadline, grade,
                   submitted_at, submission_url, created_at
              FROM homework WHERE tutor_id = p_tutor
             ORDER BY created_at DESC LIMIT 400) h
  ), '[]'::jsonb);
END;
$$;

-- ── 5. Зачесть работу или вернуть на доработку ──────────────────────────────
-- Единственная операция бота, которая ПИШЕТ в учебные данные. Условие по
-- tutor_id обязательно: id задания приходит из кнопки, то есть снаружи.
CREATE OR REPLACE FUNCTION public.bot_hw_status(
  p_secret text,
  p_tutor  uuid,
  p_hw     uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;
  IF p_status NOT IN ('done', 'revision') THEN RETURN NULL; END IF;

  UPDATE homework SET status = p_status
   WHERE id = p_hw AND tutor_id = p_tutor
  RETURNING jsonb_build_object('id', id, 'title', title) INTO r;

  RETURN r;
END;
$$;

-- ── 6. Факты для уведомления ────────────────────────────────────────────────
-- Клиент ученика сообщает только вид события и его id; что произошло и кому это
-- принадлежит, выясняется здесь. Текст сообщения собирает бот — база отдаёт
-- только факты.
CREATE OR REPLACE FUNCTION public.bot_notice(p_secret text, p_kind text, p_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h        record;
  v        record;
  m        record;
  v_tutor  uuid;
  v_name   text;
  v_key    text;
  v_title  text;
  v_url    text;
  v_test   boolean := false;
  v_link   jsonb;
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;

  IF p_kind = 'hw_submitted' THEN
    SELECT id, tutor_id, student_id, title, status, grade, test_score,
           question_count, submission_url
      INTO h FROM homework WHERE id = p_id::uuid;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Обычная работа приходит со статусом submitted, чистый тест ученик сдаёт
    -- сразу проверенным (status done с оценкой) — репетитору важно и то, и то.
    v_test := (h.status = 'done' AND h.grade IS NOT NULL);
    IF h.status <> 'submitted' AND NOT v_test THEN RETURN NULL; END IF;

    v_tutor := h.tutor_id;
    v_key   := 'hw:' || h.id || ':' || h.status;
    v_url   := h.submission_url;
    v_title := CASE WHEN v_test AND h.question_count IS NOT NULL
                    THEN h.title || ' — ' || COALESCE(h.test_score::text, '?') ||
                         ' / ' || h.question_count || ', оценка ' || h.grade
                    ELSE h.title END;
    SELECT name INTO v_name FROM students
      WHERE id = h.student_id AND tutor_id = v_tutor;

  ELSIF p_kind = 'variant_submitted' THEN
    SELECT vs.id, vs.student_id, vs.status, vr.tutor_id, vr.title
      INTO v FROM variant_submissions vs
      JOIN variants vr ON vr.id = vs.variant_id
     WHERE vs.id = p_id::uuid;
    IF NOT FOUND THEN RETURN NULL; END IF;

    v_tutor := v.tutor_id;
    v_key   := 'vs:' || v.id || ':' || v.status;
    v_title := COALESCE(v.title, 'вариант');
    SELECT name INTO v_name FROM student_accounts WHERE id = v.student_id;

  ELSIF p_kind = 'chat' THEN
    -- id здесь — conversation_id: вставка сообщения идёт без returning, и id
    -- строки клиенту неизвестен. Последнее сообщение разговора находим сами,
    -- поэтому подменить автора через этот вызов нельзя.
    SELECT sender_id, recipient_id, created_at
      INTO m FROM chat_messages
     WHERE conversation_id = p_id
     ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF left(m.recipient_id, 2) <> 't:' THEN RETURN NULL; END IF;
    -- Старое сообщение уведомлением не считается.
    IF m.created_at < now() - interval '5 minutes' THEN RETURN NULL; END IF;

    v_tutor := substr(m.recipient_id, 3)::uuid;
    -- Номер десятиминутки в ключе: подряд идущие сообщения схлопываются сами.
    v_key   := 'chat:' || m.sender_id || ':' ||
               floor(extract(epoch FROM m.created_at) / 600)::bigint;
    IF left(m.sender_id, 2) = 's:' THEN
      SELECT name INTO v_name FROM student_accounts
        WHERE id = substr(m.sender_id, 3)::uuid;
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  -- Кому писать. Нет привязки или уведомления выключены — событие не нужно.
  SELECT to_jsonb(t) INTO v_link
    FROM (SELECT chat_id, full_names, notify
            FROM tutor_telegram WHERE tutor_id = v_tutor) t;
  IF v_link IS NULL OR NOT (v_link->>'notify')::boolean THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'kind',    p_kind,
    'test',    v_test,
    'tutor',   v_tutor,
    'chat_id', (v_link->>'chat_id')::bigint,
    'full_names', (v_link->>'full_names')::boolean,
    'key',     v_key,
    'name',    COALESCE(v_name, 'Ученик'),
    'title',   v_title,
    'url',     v_url
  );
END;
$$;

-- ── 7. Разовая отправка ─────────────────────────────────────────────────────
-- Обёртка над telegram_event_claim: тот выдан только service_role, а боту нужен
-- вызов с секретом.
CREATE OR REPLACE FUNCTION public.bot_event_claim(p_secret text, p_key text, p_tutor uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN false; END IF;
  INSERT INTO telegram_events (event_key, tutor_id) VALUES (p_key, p_tutor);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;

-- ── 8. Погашение кода привязки ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_link_claim(
  p_secret     text,
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
BEGIN
  IF NOT bot_ok(p_secret) THEN RETURN NULL; END IF;
  RETURN telegram_link_claim(p_code, p_chat, p_username, p_first_name);
END;
$$;

-- ── Гранты ──────────────────────────────────────────────────────────────────
-- Бот приходит с публичным ключом PostgREST (роль anon), поэтому право вызова
-- нужно именно ей. Без верного секрета каждая функция возвращает NULL/false.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_link(text, bigint, boolean, boolean, boolean, boolean)',
    'public.bot_plan(text, uuid)',
    'public.bot_students(text, uuid)',
    'public.bot_homework(text, uuid)',
    'public.bot_hw_status(text, uuid, uuid, text)',
    'public.bot_notice(text, text, text)',
    'public.bot_event_claim(text, text, uuid)',
    'public.bot_link_claim(text, text, bigint, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, authenticated, app_user', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, service_role', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
