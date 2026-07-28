-- Подписка репетитора на платформу: три тарифа («Старт», «Про», «Студия»).
--
-- Схема денег ОТЛИЧАЕТСЯ от оплаты занятий (supabase/yookassa.sql): там магазин
-- оформлен на самого репетитора и деньги идут ему, а здесь платит репетитор и
-- деньги идут ПЛАТФОРМЕ (отдельный магазин ЮKassa, ключи YOOKASSA_PLATFORM_*).
--
-- Кто что делает с этими таблицами:
--   * репетитор — читает СВОЮ подписку, свои заказы и свой счётчик (RLS по auth.uid());
--   * запись    — только сервер под service_role (api/subscription.js и вебхук).
--     Клиенту писать нельзя вообще: иначе тариф выдавался бы себе одним UPDATE.
--
-- Выполнить в Supabase → SQL Editor ДО деплоя фронта. Идемпотентно.
-- Пока миграция не выполнена, всё работает на бесплатном «Старте», а страница
-- «Подписка» честно пишет, что оплата ещё не подключена.

-- ── Текущий тариф репетитора ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutor_subscriptions (
  tutor_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan               text NOT NULL DEFAULT 'start'
                     CHECK (plan IN ('start', 'pro', 'studio')),
  status             text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'canceled')),
  -- Срок оплаченного периода. NULL или прошедшая дата = бесплатный «Старт»
  -- (см. isActive() в src/plans.js — та же логика на клиенте и на сервере).
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_subscriptions_read ON public.tutor_subscriptions;
CREATE POLICY tutor_subscriptions_read ON public.tutor_subscriptions
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());
-- Политик на INSERT/UPDATE нет намеренно: тариф ставит только вебхук
-- под service_role, который RLS обходит.

-- ── Заказы на подписку ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan             text NOT NULL CHECK (plan IN ('pro', 'studio')),  -- «Старт» не покупают
  period           text NOT NULL CHECK (period IN ('month', 'year')),
  months           smallint NOT NULL CHECK (months BETWEEN 1 AND 12),
  amount           numeric NOT NULL CHECK (amount > 0),
  description      text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'succeeded', 'canceled')),
  yk_payment_id    text UNIQUE,
  confirmation_url text,
  test             boolean NOT NULL DEFAULT false,
  -- Тариф уже продлён этим заказом. ЮKassa доставляет уведомление повторно,
  -- пока не увидит 200: без флага один платёж продлевал бы подписку несколько раз.
  applied          boolean NOT NULL DEFAULT false,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_orders_tutor_idx
  ON public.subscription_orders (tutor_id, created_at DESC);

ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_orders_read ON public.subscription_orders;
CREATE POLICY subscription_orders_read ON public.subscription_orders
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- ── Расход лимитов за месяц ─────────────────────────────────────────────────
-- Пока считаем только ИИ-генерации ДЗ: каждая стоит денег в DeepSeek, поэтому
-- лимит должен быть настоящим (серверным), а не «просьбой» в интерфейсе.
CREATE TABLE IF NOT EXISTS public.tutor_usage (
  tutor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period      date NOT NULL,                       -- первое число месяца
  ai_homework integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tutor_id, period)
);

ALTER TABLE public.tutor_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_usage_read ON public.tutor_usage;
CREATE POLICY tutor_usage_read ON public.tutor_usage
  FOR SELECT TO authenticated
  USING (tutor_id = auth.uid());

-- ── Продление подписки успешным платежом ────────────────────────────────────
-- Вся операция в одной функции, потому что она обязана быть атомарной:
-- захват флага applied и продление срока не должны разъезжаться при повторной
-- доставке уведомления. Возвращает true, только если продлили именно сейчас.
--
-- Смена тарифа: остаток оплаченного срока не сгорает, а прибавляется к новому
-- тарифу. Это щедро, зато предсказуемо и не требует пересчёта пропорций.
CREATE OR REPLACE FUNCTION public.subscription_apply(
  p_order   uuid,
  p_payment text,
  p_paid_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.subscription_orders%ROWTYPE;
BEGIN
  UPDATE subscription_orders
     SET status        = 'succeeded',
         applied       = true,
         yk_payment_id = COALESCE(p_payment, yk_payment_id),
         paid_at       = COALESCE(p_paid_at, now())
   WHERE id = p_order
     AND applied = false
  RETURNING * INTO o;

  IF NOT FOUND THEN
    RETURN false;             -- уже применён другим повтором уведомления
  END IF;

  INSERT INTO tutor_subscriptions (tutor_id, plan, status, current_period_end, updated_at)
  VALUES (o.tutor_id, o.plan, 'active', now() + make_interval(months => o.months), now())
  ON CONFLICT (tutor_id) DO UPDATE
    SET plan               = EXCLUDED.plan,
        status             = 'active',
        current_period_end = GREATEST(
                               COALESCE(tutor_subscriptions.current_period_end, now()),
                               now()
                             ) + make_interval(months => o.months),
        updated_at         = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.subscription_apply(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_apply(uuid, text, timestamptz) TO service_role;

-- ── Списание одной ИИ-генерации ─────────────────────────────────────────────
-- Инкремент и проверка лимита — одним UPDATE, иначе две параллельные вкладки
-- обе увидели бы «лимит не исчерпан». p_limit = −1 означает «без ограничений».
CREATE OR REPLACE FUNCTION public.usage_bump_ai(p_tutor uuid, p_limit integer)
RETURNS TABLE (allowed boolean, used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', now())::date;
  v_used   integer;
BEGIN
  INSERT INTO tutor_usage (tutor_id, period, ai_homework)
  VALUES (p_tutor, v_period, 0)
  ON CONFLICT (tutor_id, period) DO NOTHING;

  UPDATE tutor_usage
     SET ai_homework = ai_homework + 1,
         updated_at  = now()
   WHERE tutor_id = p_tutor
     AND period = v_period
     AND (p_limit < 0 OR ai_homework < p_limit)
  RETURNING ai_homework INTO v_used;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_used;
  ELSE
    SELECT ai_homework INTO v_used
      FROM tutor_usage WHERE tutor_id = p_tutor AND period = v_period;
    RETURN QUERY SELECT false, COALESCE(v_used, 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.usage_bump_ai(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_bump_ai(uuid, integer) TO service_role;

-- Возврат списанной генерации: DeepSeek не ответил — лимит репетитора не должен
-- сгорать за чужую поломку. Ниже нуля не уходим.
CREATE OR REPLACE FUNCTION public.usage_refund_ai(p_tutor uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tutor_usage
     SET ai_homework = GREATEST(ai_homework - 1, 0),
         updated_at  = now()
   WHERE tutor_id = p_tutor
     AND period = date_trunc('month', now())::date;
$$;

REVOKE ALL ON FUNCTION public.usage_refund_ai(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_refund_ai(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
