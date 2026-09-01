-- Удаление сообщений в чате: своё — у всех, вся переписка — репетитором.
--
-- До этого удалить было нельзя вообще ничего: политик DELETE на chat_messages
-- не существовало, поэтому опечатка или случайно отправленное сообщение
-- оставались в переписке навсегда.
--
-- Кто что может:
--   * ученик и родитель удаляют СВОИ сообщения — и удаляют по-настоящему,
--     у обеих сторон. «Удалить только у себя» намеренно не делаем: два разных
--     представления одной переписки — источник спора «я это не писал»;
--   * репетитор удаляет любое сообщение в СВОЕЙ переписке и может очистить её
--     целиком. Это его рабочее пространство, он же отвечает за содержимое.
--     Ученику права стереть чужие сообщения не даём.
--
-- REPLICA IDENTITY FULL нужен для realtime: при обычной настройке в событии
-- DELETE едет только первичный ключ, и Realtime не может проверить по нему
-- политики — событие до второй стороны просто не доходит, и удалённое
-- сообщение висит у собеседника до перезагрузки страницы.
alter table public.chat_messages replica identity full;

grant delete on public.chat_messages to app_user;

drop policy if exists chat_delete_own on public.chat_messages;
create policy chat_delete_own on public.chat_messages
  for delete to app_user
  using (
    sender_id = ('s:' || current_account_id()::text)
    or sender_id = ('p:' || current_parent_student_id()::text)
  );

drop policy if exists chat_tutor_delete on public.chat_messages;
create policy chat_tutor_delete on public.chat_messages
  for delete to authenticated
  using (
    sender_id = ('t:' || auth.uid()::text)
    or recipient_id = ('t:' || auth.uid()::text)
  );
