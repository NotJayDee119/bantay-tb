-- Let the public chatbot answer without spending AI requests where it can.
--
-- kb_documents.category: overview / symptoms / treatment / prevention /
--   lifestyle for disease articles, the doc key (about, free-care, …) for
--   system docs. A question with one clear disease + category is answered
--   straight from that article — no embedding, no completion.
--
-- chatbot_answer_cache: AI answers keyed by the normalised question, so a
--   repeated question costs nothing. Cleared on every knowledge-base
--   rebuild (scripts/ingest-kb.ts). Service role only — RLS, no policies.

alter table public.kb_documents add column if not exists category text;
create index if not exists kb_documents_lookup_idx
  on public.kb_documents (topic, language, category);

create table if not exists public.chatbot_answer_cache (
  question_key text not null,
  language     text not null check (language in ('en','tl','ceb')),
  reply        text not null,
  sources      text[] not null default '{}',
  created_at   timestamptz not null default now(),
  primary key (question_key, language)
);
alter table public.chatbot_answer_cache enable row level security;
