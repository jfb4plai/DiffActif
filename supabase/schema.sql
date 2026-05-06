-- ============================================================
-- DiffActif — Schéma Supabase
-- À exécuter dans l'éditeur SQL du projet RetroActif (dfoaumjleqtxjeaplnna)
--
-- IMPORTANT : la table `profiles` et le trigger `on_auth_user_created`
-- existent déjà dans ce projet (RetroActif). Ne pas les recréer.
-- DiffActif réutilise profiles tel quel (colonnes identiques).
--
-- Ce script ajoute uniquement les 4 tables DiffActif.
-- ============================================================

-- Extension UUID (déjà activée dans RetroActif, sans effet si relancée)
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────
-- TABLE : eleves
-- Codes anonymes + profils de besoins
-- ──────────────────────────────────────────
create table if not exists public.eleves (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  code_anonyme text not null,
  profils      text[]   default '{}',
  notes        text,
  created_at   timestamptz default now()
);

alter table public.eleves enable row level security;

create policy "Chaque enseignant gère ses élèves"
  on public.eleves for all
  using (auth.uid() = user_id);

create index idx_eleves_user_id on public.eleves(user_id);

-- ──────────────────────────────────────────
-- TABLE : adaptations
-- Activités adaptées par profil (Module 2)
-- ──────────────────────────────────────────
create table if not exists public.adaptations (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  activite_originale text,
  objectif           text,
  profils            text[]   default '{}',
  matiere            text,
  niveau             text,
  type_enseignement  text,
  variantes_ia       text,    -- proposition brute de Claude Haiku
  texte_final        text,    -- version personnalisée par l'enseignant (20%)
  created_at         timestamptz default now()
);

alter table public.adaptations enable row level security;

create policy "Chaque enseignant gère ses adaptations"
  on public.adaptations for all
  using (auth.uid() = user_id);

create index idx_adaptations_user_id on public.adaptations(user_id);

-- ──────────────────────────────────────────
-- TABLE : sequences
-- Séquences différenciées CUA (Module 3)
-- ──────────────────────────────────────────
create table if not exists public.sequences (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  titre              text,
  matiere            text,
  niveau             text,
  type_enseignement  text,
  objectif           text,
  nb_seances         integer,
  profils_cibles     text[]   default '{}',
  sequence_ia        text,    -- proposition brute
  texte_final        text,    -- version finalisée par l'enseignant
  created_at         timestamptz default now()
);

alter table public.sequences enable row level security;

create policy "Chaque enseignant gère ses séquences"
  on public.sequences for all
  using (auth.uid() = user_id);

create index idx_sequences_user_id on public.sequences(user_id);

-- ──────────────────────────────────────────
-- TABLE : progressions
-- Auto-évaluations de la pratique (Module 5)
-- ──────────────────────────────────────────
create table if not exists public.progressions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date default current_date,
  scores      jsonb default '{}',  -- { dimension_id: score (1-3) }
  commentaire text,
  created_at  timestamptz default now()
);

alter table public.progressions enable row level security;

create policy "Chaque enseignant gère sa progression"
  on public.progressions for all
  using (auth.uid() = user_id);

create index idx_progressions_user_id on public.progressions(user_id);

-- ──────────────────────────────────────────
-- NOTE : trigger on_auth_user_created
-- Déjà présent dans RetroActif — ne pas recréer.
-- L'onboarding DiffActif fait un upsert dans profiles
-- de la même façon que RetroActif.
-- ──────────────────────────────────────────
