-- Migration : feedback rapide sur les adaptations (O6)
-- À exécuter dans l'éditeur SQL Supabase (projet dfoaumjleqtxjeaplnna)

alter table public.adaptations
  add column if not exists feedback text check (feedback in ('positif', 'negatif'));
