/**
 * Vercel Serverless Function — OCR + vérification cohérence
 * Route : POST /api/extract
 * Body  : { images: string[] }  // base64 JPEG, max 6 pages
 * Return: { text: string, hasDoutes: boolean, nbDoutes: number }
 *
 * Pipeline en 2 étapes :
 *  1. Claude Vision → extrait le texte, marque les incertitudes [?..?]
 *  2. Claude texte → vérifie la cohérence, corrige/signale les passages suspects
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { images } = req.body
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images[] requis' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante (ANTHROPIC_API_KEY)' })

  const HEADERS = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  try {
    // ── Étape 1 : OCR Vision avec contexte (Sonnet pour qualité maximale) ──
    const SYSTEM_OCR = `Tu es un OCR expert pour documents scolaires francophones (FWB — Fédération Wallonie-Bruxelles).

ÉTAPE 1 — IDENTIFICATION DU CONTEXTE (obligatoire avant transcription) :
- Détermine la matière (français, maths, éveil, etc.) et le niveau (maternelle, primaire cycle 1/2/3, secondaire)
- Identifie le type d'exercice dominant (phonologie, conjugaison, vocabulaire, calcul…)
- Repère le champ lexical attendu selon le titre et les éléments visibles

ÉTAPE 2 — TRANSCRIPTION FIDÈLE :
- Extrais TOUT le texte dans l'ordre naturel de lecture
- Respecte la structure : numérotation, sauts de ligne, paragraphes, tirets
- Les espaces vides / lignes pointillées / blancs à compléter par l'élève → transcris-les comme "______" (ne pas les marquer comme douteux)
- Pour tout passage TEXTE réellement illisible ou ambigu : [?mot douteux?]
  Ex : [?chien / chier?] si deux lectures sont possibles — jamais sur des blancs d'exercice

ÉTAPE 3 — CONTRÔLE DE COHÉRENCE :
- Vérifie que chaque mot est cohérent avec le contexte identifié
- En cas d'ambiguïté OCR, préfère le mot du champ lexical probable plutôt qu'une transcription littérale improbable
- EXERCICES DE PHONOLOGIE : les sons listés dans le titre DOIVENT former une famille phonologique cohérente
  Familles valides : "eu / oeu / eur / oeur", "an / en / am / em", "in / ain / ein", "ill / ail / eil / euil", "ou / on", "oi / oin"…
  En cursive/manuscrit : le "e" ressemble visuellement à un "o" → vérifier la cohérence AVANT de valider
  Si la série lue est incohérente, corrige le son qui rompt la famille phonologique

Retourne uniquement le texte extrait avec les marqueurs [? ?] sur les seuls passages textuels incertains.
Ne commente pas.`

    const ocrContent = [
      ...images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: img },
      })),
      { type: 'text', text: 'Extrais le texte de ce document scolaire en appliquant les 3 étapes du système.' },
    ]

    const ocrResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_OCR,
        messages: [{ role: 'user', content: ocrContent }],
      }),
    })
    if (!ocrResp.ok) {
      const e = await ocrResp.json()
      return res.status(500).json({ error: e.error?.message ?? 'Erreur OCR Vision' })
    }
    const ocrData = await ocrResp.json()
    const textOcr = ocrData.content[0].text.trim()

    // ── Étape 2 : Vérification cohérence (Haiku suffit pour ce pass) ──
    const verifResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `Tu vérifies la cohérence pédagogique d'un texte OCR issu d'un document scolaire FWB.
Conserve les marqueurs [? ?] déjà présents.
Ajoute [? mot suspect ?] uniquement sur des mots textuels manifestement incohérents avec le sens du document.
Attention aux artefacts de reconnaissance cursive : les suites de 1–3 lettres isolées (ex : "ll", "rn", "cl", "ll") sont souvent des mots courants mal lus — marque-les comme douteux si incohérents.
NE JAMAIS marquer les blancs "______" ou les points "......" comme douteux — ce sont des espaces-réponse normaux.
Ne modifie rien d'autre. Retourne le texte avec les seuls marqueurs justifiés.`,
        messages: [{
          role: 'user',
          content: `Voici le texte OCR. Vérifie la cohérence et retourne-le avec les marqueurs [? ?] sur les passages douteux :\n\n${textOcr}`,
        }],
      }),
    })
    if (!verifResp.ok) {
      return res.status(200).json({ text: textOcr, hasDoutes: false, nbDoutes: 0 })
    }
    const verifData = await verifResp.json()
    const textApresVerif = verifData.content[0].text.trim()

    // ── Étape 3 : Résolution active des marqueurs [? ?] ──────────────────
    // Tente de résoudre chaque [?..?] via contexte grammatical + phonologique.
    // Seuls les passages vraiment insolubles restent marqués et bloquent l'export.
    const nbDoutesApresVerif = (textApresVerif.match(/\[\?/g) || []).length
    if (nbDoutesApresVerif === 0) {
      return res.status(200).json({ text: textApresVerif, hasDoutes: false, nbDoutes: 0 })
    }

    const resolResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `Tu résous les passages incertains [?..?] dans un texte scolaire FWB.

Pour chaque marqueur [?texte douteux?], applique dans cet ordre :

1. ACCORD GRAMMATICAL — Analyse le contexte immédiat (article, genre, nombre, temps verbal).
   Exemple : "un [?n?]eu" → article "un" est masculin → le mot doit être masculin → "pneu" ✓ (et non "peur" qui est féminin — *une* peur).
   Exemple : "une [?f?]ille" → article "une" féminin → "fille" ✓ ou "famille" ✓.

2. CONTEXTE PHONOLOGIQUE — Si le document traite un son précis (indiqué dans le titre ou la consigne), le mot résolu doit contenir ce son.
   Familles valides : "eu/oeu/eur/oeur", "ill/aille/euil", "an/en/am/em", "in/ain/ein", "ou/on", "oi/oin".
   Exemple : document sur "eu/oeu/eur/oeur" + "un p[?n?]eu" → le mot contient "eu" → "pneu" ✓.

3. CONTEXTE LEXICAL — Utilise les autres mots du document (titres, listes, exemples) pour choisir le mot le plus probable dans le champ lexical établi.

Règles absolues :
- Si résolution certaine ou très probable → remplace le marqueur par le mot résolu, sans aucun marqueur résiduel.
- Si vraiment insoluble (aucun contexte disponible, ambiguïté totale) → conserve [? texte douteux ?].
- Ne modifie RIEN d'autre dans le texte (structure, ponctuation, ordre des mots).
- NE JAMAIS toucher aux blancs "______" ou aux points "......" — ce sont des espaces-réponse élève.
- Retourne uniquement le texte résolu, sans commentaire.`,
        messages: [{
          role: 'user',
          content: `Voici le texte avec les passages incertains [?..?]. Résous-les en appliquant les 3 règles :\n\n${textApresVerif}`,
        }],
      }),
    })

    if (!resolResp.ok) {
      // Si l'étape 3 échoue, on retourne le résultat de l'étape 2 sans bloquer
      return res.status(200).json({ text: textApresVerif, hasDoutes: nbDoutesApresVerif > 0, nbDoutes: nbDoutesApresVerif })
    }
    const resolData = await resolResp.json()
    const textFinal = resolData.content[0].text.trim()
    const nbDoutes = (textFinal.match(/\[\?/g) || []).length

    return res.status(200).json({ text: textFinal, hasDoutes: nbDoutes > 0, nbDoutes })

  } catch (err) {
    return res.status(500).json({ error: `Erreur OCR : ${err.message}` })
  }
}
