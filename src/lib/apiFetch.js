/**
 * fetch authentifié vers les serverless functions /api/*.
 * Ajoute le jeton Supabase de la session courante (Authorization: Bearer).
 * Retourne la Response brute — même usage que fetch.
 */

import { supabase } from './supabase'

export async function apiFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Connexion requise — votre session a expiré, reconnectez-vous.')
  }

  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
}
