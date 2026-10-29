-- Chat history belongs to whoever wrote it.
--
-- The original policies also allowed `user_id is null`, which made every
-- public-visitor exchange readable — and writable — by anyone holding the
-- anon key. Those rows are written by the chatbot Edge Function with the
-- service role (which bypasses RLS), and it now stores the visitor's question
-- as well as the reply, so the loophole would expose what people asked.
--
-- Signed-in users still read, write and delete only their own rows.

drop policy if exists "chatbot self read" on public.chatbot_messages;
create policy "chatbot self read"
  on public.chatbot_messages for select
  using (user_id = auth.uid());

drop policy if exists "chatbot self write" on public.chatbot_messages;
create policy "chatbot self write"
  on public.chatbot_messages for insert
  with check (user_id = auth.uid());

-- Created outside migrations on the hosted project; recorded here so a fresh
-- database lets users delete their own conversations too.
drop policy if exists "chatbot self delete" on public.chatbot_messages;
create policy "chatbot self delete"
  on public.chatbot_messages for delete
  using (user_id = auth.uid());
