-- Онлайн-оплата занятий через ЮKassa.
--
-- Схема денег: магазин ЮKassa оформлен на самого репетитора, ученик (или
-- родитель) платит НАПРЯМУЮ ему. Платформа деньги не держит и не делит —
-- она только заводит заказ, отправляет плательщика на страницу оплаты и
-- ловит уведомление об успехе.
--
-- Кто что делает с этой таблицей:
--   * репетитор  — читает свои заказы (обычная RLS по auth.uid(), он в auth.users);
--   * ученик     — читает свои через RPC payment_order_list (session_token),
--                  напрямую доступа НЕТ;
--   * сервер     — api/yookassa.js и api/yookassa-webhook.js ходят под
--                  service_role (RLS обходится), ключ живёт только в env Vercel.
--
-- Клиент НИКОГДА не присылает сумму: её считает сервер по students.lesson_price.
-- Поэтому в таблице лежит уже проверенная сумма, а не «сколько сказал браузер».
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id         uuid NOT NULL,          -- кому идут деньги (auth.users.id)
  -- students.id в этой базе bigint (uuid остался только у student_accounts).
  -- Колонка была объявлена uuid, и первая же вставка заказа падала бы на
  -- несовпадении типов — api/yookassa.js кладёт сюда students.id как есть.
  student_id       bigint,                 -- students.id у этого репетитора
  account_id       uuid,                   -- student_accounts.id того, кто платил
  student_name     text,                   -- снимок имени на момент заказа
  lessons          smallint,               -- за сколько занятий платят (null = произвольная сумма)
  amount           numeric NOT NULL CHECK (amount > 0),
  description      text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'succeeded', 'canceled')),
  yk_payment_id    text UNIQUE,            -- id платежа в ЮKassa
  confirmation_url text,                   -- куда отправляли плательщика
  test             boolean NOT NULL DEFAULT false,  -- платёж тестового магазина
  -- Успех уже перенесён в students.payments. Отдельный флаг (а не только status)
  -- нужен потому, что ЮKassa доставляет уведомление повторно, пока не увидит 200:
  -- без него один платёж дописался бы в историю несколько раз.
  applied          boolean NOT NULL DEFAULT false,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_orders_tutor_idx   ON public.payment_orders (tutor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_account_idx ON public.payment_orders (account_id, created_at DESC);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Репетитор видит только свои заказы. Менять их руками ему незачем: статус
-- ставит только вебхук (service_role), поэтому политика — на чтение.
DROP POLICY IF EXISTS payment_orders_tutor_read ON public.payment_orders;
CREATE POLICY payment_orders_tutor_read ON public.payment_orders
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- Ученик: своя история платежей. Токен сессии обязателен — иначе по чужому
-- account_id можно было бы прочитать чужие суммы.
CREATE OR REPLACE FUNCTION public.payment_order_list(p_account uuid, p_token uuid)
RETURNS TABLE (
  id          uuid,
  amount      numeric,
  lessons     smallint,
  description text,
  status      text,
  paid_at     timestamptz,
  created_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM student_accounts a
     WHERE a.id = p_account AND a.session_token = p_token
  ) THEN
    RETURN;  -- чужой или протухший токен: пустой список, без объяснений
  END IF;

  RETURN QUERY
    SELECT o.id, o.amount, o.lessons, o.description, o.status, o.paid_at, o.created_at
      FROM payment_orders o
     WHERE o.account_id = p_account
     ORDER BY o.created_at DESC
     LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.payment_order_list(uuid, uuid) TO anon, authenticated;

-- Реквизиты магазина ЮKassa в базе НЕ хранятся: shopId и секретный ключ лежат
-- в переменных окружения Vercel (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY).
-- Здесь только выключатель приёма оплаты и текст для страницы ученика.
CREATE TABLE IF NOT EXISTS public.tutor_payment_settings (
  tutor_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  online_enabled boolean NOT NULL DEFAULT false,
  max_lessons  smallint NOT NULL DEFAULT 10 CHECK (max_lessons BETWEEN 1 AND 50),
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_payment_settings_own ON public.tutor_payment_settings;
CREATE POLICY tutor_payment_settings_own ON public.tutor_payment_settings
  FOR ALL TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- Ученику нужно знать только одно: можно ли платить онлайн и на сколько занятий.
-- Отдаём это отдельной функцией, чтобы не открывать таблицу настроек целиком.
CREATE OR REPLACE FUNCTION public.payment_settings_public(p_tutor uuid)
RETURNS TABLE (online_enabled boolean, max_lessons smallint, note text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(s.online_enabled, false),
         COALESCE(s.max_lessons, 10)::smallint,
         s.note
    FROM (SELECT p_tutor AS id) t
    LEFT JOIN tutor_payment_settings s ON s.tutor_id = t.id;
$$;

GRANT EXECUTE ON FUNCTION public.payment_settings_public(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
