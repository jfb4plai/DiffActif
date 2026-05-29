-- Migration : ajout colonne feedback sur adaptations
-- À exécuter dans Supabase SQL Editor (projet dfoaumjleqtxjeaplnna)
alter table public.adaptations
  add column if not exists feedback text;
