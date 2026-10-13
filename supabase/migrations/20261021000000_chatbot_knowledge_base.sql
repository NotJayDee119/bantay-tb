-- RAG knowledge base for the public (homepage) chatbot.
--
-- Scope is deliberately closed: the topic check below is the whitelist of
-- what the public assistant may talk about — the BANTAY-TB system itself and
-- eight respiratory diseases. Rows are written by scripts/ingest-kb.ts and
-- read only by the chatbot Edge Function (service role); RLS has no policies
-- and the match function is not executable by anon/authenticated.

create extension if not exists vector;

create table if not exists public.kb_documents (
  id         uuid primary key default gen_random_uuid(),
  topic      text not null check (topic in (
               'system','tuberculosis','pneumonia','covid19','influenza',
               'bronchitis','copd','asthma','paragonimiasis')),
  language   text not null check (language in ('en','tl','ceb')),
  title      text not null,
  source     text,
  updated_at timestamptz default now()
);

create table if not exists public.kb_chunks (
  id          bigserial primary key,
  document_id uuid references public.kb_documents on delete cascade,
  topic       text not null,
  language    text not null,
  content     text not null,
  embedding   vector(1536)
);
create index if not exists kb_chunks_embedding_idx
  on public.kb_chunks using hnsw (embedding vector_cosine_ops);

alter table public.kb_documents enable row level security;
alter table public.kb_chunks    enable row level security;

create or replace function public.match_kb_chunks(q vector(1536), k int default 5, min_sim float default 0.5)
returns table (content text, topic text, title text, similarity float)
language sql stable security definer set search_path = public as $$
  select c.content, c.topic, d.title, 1 - (c.embedding <=> q)
  from kb_chunks c join kb_documents d on d.id = c.document_id
  where 1 - (c.embedding <=> q) >= min_sim
  order by c.embedding <=> q
  limit k;
$$;

-- Functions are executable by PUBLIC by default, so revoking anon and
-- authenticated alone leaves them able to call it through PUBLIC.
revoke execute on function public.match_kb_chunks(vector, int, float) from public, anon, authenticated;
grant  execute on function public.match_kb_chunks(vector, int, float) to service_role;
