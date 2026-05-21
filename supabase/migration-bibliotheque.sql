-- ──────────────────────────────────────────────────────────
-- Migration : bibliothèque contributive d'exemples (Module 4)
-- À exécuter dans l'éditeur SQL Supabase (projet dfoaumjleqtxjeaplnna)
-- ──────────────────────────────────────────────────────────

create table if not exists public.exemples_bibliotheque (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  titre        text not null,
  matiere      text,
  niveau       text,
  profils      text[]  default '{}',
  principe_cua text,
  description  text,
  adaptation   text not null,
  reference    text,
  created_at   timestamptz default now()
);

alter table public.exemples_bibliotheque enable row level security;

-- Chaque enseignant lit et gère ses propres exemples
create policy "Lecture propres exemples"
  on public.exemples_bibliotheque for select
  using (auth.uid() = user_id);

create policy "Insertion propres exemples"
  on public.exemples_bibliotheque for insert
  with check (auth.uid() = user_id);

create policy "Suppression propres exemples"
  on public.exemples_bibliotheque for delete
  using (auth.uid() = user_id);

create index idx_exemples_bibliotheque_user_id on public.exemples_bibliotheque(user_id);
