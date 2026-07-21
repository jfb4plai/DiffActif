/**
 * Protection des espaces-réponse élève — module partagé serveur + client.
 *
 * Principe : un blanc tokenisé ne peut pas être complété par un modèle,
 * parce qu'il n'y a plus de blanc à compléter. La garantie ne vient pas
 * d'une consigne de prompt mais de l'absence de l'objet.
 *
 * Le préfixe `_` exclut ce fichier du routage Vercel (comme _auth.js).
 * Importé côté client via `../../api/_blanks.js` — aucune dépendance Node.
 */

// Pointillés (........), tirets bas (______) et points de suspension.
const BLANK_RE = /\.{3,}|_{3,}|…/g
const TOKEN_RE = /\[\[B(\d+)\]\]/g

export class BlanksIntegrityError extends Error {
  constructor(reason) {
    super(`Espaces-réponse altérés : ${reason}. Régénérez le document.`)
    this.name = 'BlanksIntegrityError'
    this.reason = reason
  }
}

/**
 * Remplace chaque espace-réponse par un token indexé.
 * Retourne { text, map } — map[i] contient la graphie exacte du blanc i.
 */
export function protectBlanks(text) {
  const map = []
  const protectedText = String(text).replace(BLANK_RE, match => {
    const token = `[[B${map.length}]]`
    map.push(match)
    return token
  })
  return { text: protectedText, map }
}

/**
 * Invariant : la passe IA n'a ni perdu, ni dupliqué, ni réordonné les tokens.
 * C'est le seul contrôle qui rende la préservation des blancs déterministe.
 */
export function checkBlanksIntegrity(text, map) {
  const found = [...String(text).matchAll(TOKEN_RE)].map(m => Number(m[1]))
  if (found.length !== map.length) {
    return { ok: false, reason: `${found.length} espace(s)-réponse sur ${map.length} attendu(s)` }
  }
  for (let i = 0; i < found.length; i++) {
    if (found[i] !== i) {
      return { ok: false, reason: `espaces-réponse réordonnés (position ${i + 1})` }
    }
  }
  return { ok: true, reason: '' }
}

/** Restauration tolérante — pour les textes qui ne citent qu'une partie du document. */
export function restoreBlanks(text, map) {
  return String(text).replace(TOKEN_RE, (whole, i) => map[Number(i)] ?? whole)
}

/** Restauration bloquante — pour le document AU, où chaque blanc doit survivre. */
export function restoreBlanksStrict(text, map) {
  const check = checkBlanksIntegrity(text, map)
  if (!check.ok) throw new BlanksIntegrityError(check.reason)
  return restoreBlanks(text, map)
}

/** Nombre d'espaces-réponse d'un texte non protégé — pour comparer avant/après. */
export function countBlanks(text) {
  return (String(text).match(BLANK_RE) || []).length
}

/**
 * Paires de choix « ( a – b ) » dont les deux options sont identiques.
 * Un distracteur écrasé rend l'exercice insoluble sans que ça se voie.
 */
export function findDegenerateChoices(text) {
  const CHOICE_RE = /\(\s*([^()|\n]{1,40}?)\s*[–—-]\s*([^()|\n]{1,40}?)\s*\)/g
  const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const bad = []
  for (const m of String(text).matchAll(CHOICE_RE)) {
    if (norm(m[1]) && norm(m[1]) === norm(m[2])) bad.push(m[0].trim())
  }
  return bad
}
