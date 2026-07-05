/**
 * Vérification d'authentification pour les serverless functions.
 * Valide le jeton Supabase (Authorization: Bearer <access_token>) et
 * retourne l'utilisateur, ou null après avoir envoyé la réponse 401.
 *
 * Empêche la consommation de la clé Anthropic par des requêtes anonymes.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export async function requireUser(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Connexion requise.' })
    return null
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' })
    return null
  }

  return data.user
}
