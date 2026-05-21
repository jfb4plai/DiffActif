/**
 * Arasaac API — libre d'accès, sans authentification
 * Licence pictogrammes : CC BY-NC-SA 4.0
 * Attribution obligatoire : © Arasaac (arasaac.org)
 */

// ── Cache localStorage — TTL 7 jours ─────────────────────
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000

function getCached(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { value, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null }
    return value
  } catch { return null }
}

function setCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }))
  } catch { /* quota dépassé — ignorer */ }
}

// Mots-outils français à exclure de la recherche picto
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'est', 'en',
  'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'se', 'ce',
  'que', 'qui', 'dans', 'sur', 'pour', 'par', 'avec', 'au', 'aux', 'ou',
  'où', 'mais', 'ne', 'pas', 'plus', 'si', 'car', 'aussi', 'très', 'bien',
  'tout', 'tous', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'cette', 'cet', 'ces', 'alors', 'donc', 'comme', 'même', 'fait', 'être',
  'avoir', 'faire', 'dire', 'aller', 'voir', 'vouloir', 'pouvoir', 'venir',
])

/**
 * Extrait les mots-clés d'un texte pour Arasaac (max n mots)
 */
export function extractKeywords(text, n = 6) {
  return [...new Set(
    text
      .toLowerCase()
      .split(/[\s,.!?;:()\[\]"""«»\n]+/)
      .filter(w => w.length >= 4 && !STOP_WORDS.has(w) && /^[a-zàâéèêëîïôùûüœæç]+$/.test(w))
  )].slice(0, n)
}

/**
 * Sélectionne le meilleur résultat Arasaac parmi les 3 premiers.
 * Priorité : correspondance exacte du mot-clé, puis chevauchement lexical avec le contexte.
 */
function selectBestResult(results, keyword, contextWords = []) {
  const candidates = results.slice(0, 3)
  const kw = keyword.toLowerCase()

  // Priorité 1 : correspondance exacte dans les mots-clés du picto
  for (const r of candidates) {
    const tags = (r.keywords ?? []).map(k => (k.keyword ?? '').toLowerCase())
    if (tags.includes(kw)) return r
  }

  // Priorité 2 : score de chevauchement avec les mots du contexte
  if (contextWords.length > 0) {
    const ctx = new Set(contextWords.map(w => w.toLowerCase()))
    let bestScore = -1
    let best = candidates[0]
    for (const r of candidates) {
      const tags = (r.keywords ?? []).map(k => (k.keyword ?? '').toLowerCase())
      const score = tags.filter(t => ctx.has(t)).length
      if (score > bestScore) { bestScore = score; best = r }
    }
    return best
  }

  return candidates[0]
}

/**
 * Cherche un pictogramme Arasaac pour un mot-clé.
 * contextWords : mots environnants pour affiner la sélection parmi les 3 premiers résultats.
 * Retourne { id, keyword, url } ou null.
 */
export async function searchArasaac(keyword, contextWords = []) {
  const cacheKey = `arasaac_s_${keyword}`
  const cached = getCached(cacheKey)
  if (cached !== null) return cached

  try {
    const res = await fetch(
      `https://api.arasaac.org/v1/pictograms/fr/search/${encodeURIComponent(keyword)}`
    )
    if (!res.ok) return null
    const results = await res.json()
    if (!results?.length) return null
    const best = selectBestResult(results, keyword, contextWords)
    const id = best._id
    const result = {
      id,
      keyword,
      url: `https://static.arasaac.org/pictograms/${id}/${id}_500.png`,
    }
    setCache(cacheKey, result)
    return result
  } catch {
    return null
  }
}

/**
 * Télécharge une image picto et retourne son contenu en base64 (sans préfixe data:)
 */
export async function pictoToBase64(url) {
  const cacheKey = `arasaac_b64_${url}`
  const cached = getCached(cacheKey)
  if (cached !== null) return cached

  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = reader.result.split(',')[1]
        setCache(cacheKey, b64)
        resolve(b64)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Cherche et télécharge plusieurs pictos depuis un texte.
 * Retourne [{ keyword, id, url, base64 }]
 */
export async function fetchPictosForText(text, maxPictos = 5) {
  const keywords = extractKeywords(text, maxPictos + 3)
  const results = await Promise.all(
    keywords.map(async kw => {
      const found = await searchArasaac(kw)
      if (!found) return null
      const base64 = await pictoToBase64(found.url)
      if (!base64) return null
      return { ...found, base64 }
    })
  )
  return results.filter(Boolean).slice(0, maxPictos)
}

export const ARASAAC_ATTRIBUTION = 'Pictogrammes © Arasaac (arasaac.org) — Licence CC BY-NC-SA 4.0'
