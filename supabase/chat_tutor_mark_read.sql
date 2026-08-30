-- Репетитор не мог пометить входящее сообщение прочитанным (30.08.2026).
--
-- Политика chat_tutor из rls_step3_policies.sql была создана как FOR ALL с
-- WITH CHECK (sender_id = 't:' || auth.uid()). Для UPDATE это проверка строки
-- ПОСЛЕ правки, а у входящего сообщения отправитель — ученик ('s:…'), поэтому
-- `update chat_messages set read = true` у репетитора отклонялся (42501).
-- Счётчик непрочитанных в кабинете висел вечно и возвращался после перезагрузки.
-- У ученика такой беды нет: у него пометка «прочитано» вынесена в отдельную
-- политику chat_mark_read.
--
-- Разводим FOR ALL на три политики, чтобы WITH CHECK у вставки остался прежним
-- (репетитор пишет только от своего имени), а правка своих ВХОДЯЩИХ разрешалась.

drop policy if exists chat_tutor on public.chat_messages;

-- Видит переписки, где он с любой стороны.
create policy chat_tutor_select on public.chat_messages for select to authenticated
  using (
    sender_id    = 't:' || auth.uid()::text or
    recipient_id = 't:' || auth.uid()::text
  );

-- Пишет только от своего имени (как было).
create policy chat_tutor_insert on public.chat_messages for insert to authenticated
  with check (sender_id = 't:' || auth.uid()::text);

-- Пометка «прочитано» — только на своих входящих. Отправителя и получателя
-- менять нельзя: обе стороны строки закреплены и в USING, и в WITH CHECK.
create policy chat_tutor_mark_read on public.chat_messages for update to authenticated
  using (recipient_id = 't:' || auth.uid()::text)
  with check (recipient_id = 't:' || auth.uid()::text);
