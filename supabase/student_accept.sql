-- Ученик попадает в ростер только после того, как репетитор принял заявку.
--
-- Как было. Карточку заводит привязка (student_link_cleanup.sql), а приём её
-- лишь ДОЗАПОЛНЯЕТ — так сделано намеренно, чтобы не появлялось двух карточек
-- на одного человека. Но следствие никто не заметил: строка в students
-- существует с первой секунды, поэтому ученик сразу же оказывался и в списке
-- «Ученики», и в контактах чата, и в счётчиках тарифа — хотя репетитор его ещё
-- не принял и, может быть, не примет вовсе.
--
-- Как стало. У карточки есть признак `accepted`. Привязка ставит false, приём —
-- true. Ростер, чат и деньги смотрят только на принятых; заявка теперь берётся
-- из самой непринятой карточки, а не только из pending_students — то есть
-- ученик не потеряется, даже если вставка заявки сорвётся.
--
-- ВАЖНО про значение по умолчанию: true. Все карточки, заведённые до этой
-- миграции, — это уже работающие ученики, и переключать их в «непринятых»
-- нельзя: репетитор увидел бы пустой список и десяток заявок от тех, с кем
-- занимается полгода.
alter table public.students
  add column if not exists accepted boolean not null default true;

comment on column public.students.accepted is
  'Репетитор принял заявку. false — карточка есть, но ученика в ростере ещё нет.';

CREATE OR REPLACE FUNCTION public.student_link_tutor(p_student_id uuid, p_token uuid, p_code text, p_subject text)
 RETURNS TABLE(tutor_id uuid, tutor_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_tutor_id uuid;
  v_tutor_name text;
  v_name text;
  v_phone text;
begin
  select a.name, a.phone into v_name, v_phone
  from student_accounts a where a.id = p_student_id and a.session_token = p_token;
  if v_name is null then
    raise exception 'Сессия недействительна';
  end if;

  select t.id, t.name into v_tutor_id, v_tutor_name from tutors t where t.code = lower(p_code);
  if v_tutor_id is null then
    raise exception 'Неверный код репетитора';
  end if;

  -- Карточка в ростере репетитора. Ищем по аккаунту, а не по телефону: номер в
  -- старой карточке мог быть записан иначе. id не задаём — его выдаёт sequence.
  if not exists (
    select 1 from students s
     where s.tutor_id = v_tutor_id
       and (s.student_account_id = p_student_id or s.phone = v_phone)
  ) then
    -- accepted = false: карточка заводится, но в ростер репетитора НЕ попадает,
    -- пока он не примет заявку. Раньше ученик оказывался в списке «Ученики» и в
    -- чате сразу после привязки — то есть до всякого согласия репетитора.
    insert into students (tutor_id, name, phone, subject, student_account_id, accepted)
      values (v_tutor_id, v_name, v_phone, p_subject, p_student_id, false);
  else
    -- Псевдоним обязателен: tutor_id — ещё и имя OUT-параметра функции, без
    -- квалификации Postgres не понимает, колонка это или переменная.
    update students s
       set subject = coalesce(s.subject, p_subject),
           student_account_id = coalesce(s.student_account_id, p_student_id)
     where s.tutor_id = v_tutor_id
       and (s.student_account_id = p_student_id or s.phone = v_phone);
  end if;

  -- Первый репетитор — основной: загрузка кабинета ученика идёт по tutor_id.
  update student_accounts sa set tutor_id = v_tutor_id, tutor_code = lower(p_code)
    where sa.id = p_student_id and sa.tutor_id is null;

  -- Заявка репетитору + уведомление. Best-effort: сорвётся — ученик всё равно
  -- виден репетитору как привязанный аккаунт без карточки (кабинет это учитывает).
  begin
    if not exists (select 1 from pending_students p
                    where p.tutor_id = v_tutor_id and p.student_account_id = p_student_id) then
      insert into pending_students (tutor_id, student_account_id, name, phone)
        values (v_tutor_id, p_student_id, v_name, v_phone);
    end if;
    insert into notifications (user_id, title, body)
      values (v_tutor_id, 'Новая заявка от ученика',
              v_name || ' привязался (' || coalesce(p_subject, 'предмет') || ')');
  exception when others then
    raise warning 'student_link_tutor side-effects: %', sqlerrm;
  end;

  return query select v_tutor_id, v_tutor_name;
end;
$function$
