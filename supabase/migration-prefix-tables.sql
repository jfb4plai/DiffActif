-- ============================================================
-- DiffActif — Migration : préfixage des tables avec diff_
-- Projet partagé dfoaumjleqtxjeaplnna
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

ALTER TABLE public.eleves              RENAME TO diff_eleves;
ALTER TABLE public.adaptations         RENAME TO diff_adaptations;
ALTER TABLE public.sequences           RENAME TO diff_sequences;
ALTER TABLE public.progressions        RENAME TO diff_progressions;
ALTER TABLE public.exemples_bibliotheque RENAME TO diff_exemples_bibliotheque;

-- Renommer les index
ALTER INDEX idx_eleves_user_id              RENAME TO idx_diff_eleves_user_id;
ALTER INDEX idx_adaptations_user_id         RENAME TO idx_diff_adaptations_user_id;
ALTER INDEX idx_sequences_user_id           RENAME TO idx_diff_sequences_user_id;
ALTER INDEX idx_progressions_user_id        RENAME TO idx_diff_progressions_user_id;
ALTER INDEX idx_exemples_bibliotheque_user_id RENAME TO idx_diff_exemples_bibliotheque_user_id;
