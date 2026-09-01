-- Подтверждение телефона ученика кодом из SMS.
--
-- Зачем. Телефон у ученика — это логин, и до сих пор он не подтверждался
-- никак: формат проверяется (supabase/phone_check.sql), но что номер
-- действительно твой — никем. Отсюда две дыры:
--   1) регистрация на ЧУЖОЙ номер: аккаунт заводится на живого человека,
--      который об этом не знает;
--   2) куда хуже — сброс пароля шёл ТОЛЬКО по номеру. Кто знал телефон ученика
--      (а его знает одноклассник), тот менял пароль и забирал аккаунт вместе с
--      перепиской, домашними работами и данными родителя.
--
-- Код живёт только здесь и только хэшем: сам он существует в SMS и в памяти
-- обработчика. Хэш считает сервер (sha256 от кода с серверным секретом), так же
-- как для почты репетитора (supabase/email_codes.sql).
--
-- Ключ таблицы — телефон И назначение: код на регистрацию не должен подходить
-- к сбросу пароля, иначе один выпрошенный код открывал бы обе двери.
create table if not exists public.phone_codes (
  phone      text        not null,
  purpose    text        not null check (purpose in ('register', 'reset')),
  code_hash  text        not null,
  expires_at timestamptz not null,
  tries      integer     not null default 0,
  created_at timestamptz not null default now(),
  primary key (phone, purpose)
);

alter table public.phone_codes enable row level security;
revoke all on public.phone_codes from anon, authenticated, app_user;

comment on table public.phone_codes is
  'Коды подтверждения телефона. Только хэш; пишет api/phone-verify.js.';

-- Регистрация и сброс пароля больше НЕ вызываются из браузера напрямую.
-- Иначе проверка кода не значит ничего: клиент просто послал бы запрос мимо
-- неё — ровно та же причина, по которой аккаунт репетитора создаёт сервер.
-- Теперь единственный вход — обработчик api/phone-verify.js под service_role.
-- from PUBLIC обязательно: у student_register право EXECUTE висело именно на
-- PUBLIC (в proacl это строка «=X/…»), и снятие его только с anon ничего не
-- меняло — аноним по-прежнему заводил аккаунты в обход кода. Проверено живым
-- запросом на боевой.
revoke execute on function public.student_register(text, text, text)
  from public, anon, authenticated, app_user;
revoke execute on function public.student_reset_password(text, text)
  from public, anon, authenticated, app_user;
grant execute on function public.student_register(text, text, text) to service_role;
grant execute on function public.student_reset_password(text, text) to service_role;
