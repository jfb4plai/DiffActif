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
  if (images.length > 6) {
    return res.status(400).json({ error: 'Maximum 6 pages par requête OCR.' })
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

RÈGLE ABSOLUE — BLANCS ET MOTS PARTIELS (priorité maximale) :
Un mot partiel suivi de pointillés, tirets ou d'une ligne est un ESPACE-RÉPONSE ÉLÈVE — l'élève doit le compléter, pas toi.
Transcris ces espaces-réponse sous forme de dix points : ..........
Ne jamais compléter le mot, même si la réponse est évidente.

Cas 1 — Lettres AVANT les pointillés seulement :
  "un j.........." → transcris "un j.........." — JAMAIS "un jeu"
  "ma s.........." → transcris "ma s.........." — JAMAIS "ma sœur"

Cas 2 — Lettres AVANT et APRÈS les pointillés (les deux sont des amorces du mot) :
  "un b..........f" → transcris "un b..........f" — JAMAIS "un bœuf" ni "un b.........."
  "l'h..........e" → transcris "l'h..........e" — JAMAIS "l'heure" ni "l'h.........."
  "un vi..........x" → transcris "un vi..........x" — JAMAIS "un vieux"
  "un n..........d" → transcris "un n..........d" — JAMAIS "un nœud"
  ⚠️ La lettre après les pointillés est OBLIGATOIRE — ne jamais l'omettre.

Cas 3 — Lettres AVANT les pointillés avec suite de texte :
  "j..........di" → transcris "j..........di" — JAMAIS "jeudi"
  "un fact.........." → transcris "un fact.........."

Cas 4 — Blank en milieu de phrase :
  "Elle mange un .......... cuit dur." → conserve les points — JAMAIS "Elle mange un œuf cuit dur."

Cas 5 — Groupes consonantiques (ne jamais ajouter d'espace à l'intérieur) :
  "pn.........." → transcris "pn.........." — JAMAIS "p n.........."

Cette règle prime sur toute interprétation contextuelle ou phonologique. Jamais d'exception.

ÉTAPE 2 — TRANSCRIPTION FIDÈLE :
- Extrais TOUT le texte dans l'ordre naturel de lecture
- Respecte la structure : numérotation, sauts de ligne, paragraphes, tirets
- Les espaces vides / lignes pointillées / blancs à compléter par l'élève → transcris les points exactement tels qu'ils apparaissent (ex : "un j.........." reste "un j..........")
- Pour tout passage TEXTE réellement illisible ou ambigu : [?mot douteux?]
  Ex : [?chien / chier?] si deux lectures sont possibles — jamais sur des blancs d'exercice

ÉTAPE 3 — CONTRÔLE DE COHÉRENCE :
- Vérifie que chaque MOT COMPLET est cohérent avec le contexte identifié
- Ce contrôle s'applique UNIQUEMENT aux mots complets du document (titres, listes, consignes, exemples).
- Il NE s'applique PAS aux mots partiels suivis de points — ceux-ci sont des blancs-réponse (voir RÈGLE ABSOLUE).
- En cas d'ambiguïté OCR sur un mot complet, préfère le mot du champ lexical probable plutôt qu'une transcription littérale improbable
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
      if (ocrResp.status === 504) return res.status(504).json({ error: 'Délai dépassé — document trop volumineux. Réduisez à 4 pages maximum.' })
      const e = await ocrResp.json().catch(() => ({}))
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
          content: `Voici le texte OCR. Vérifie la cohérence et retourne-le avec les marqueurs [? ?] sur les passages douteux :\n\n<texte_ocr>\n${textOcr}\n</texte_ocr>`,
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
          content: `Voici le texte avec les passages incertains [?..?]. Résous-les en appliquant les 3 règles :\n\n<texte_ocr>\n${textApresVerif}\n</texte_ocr>`,
        }],
      }),
    })

    if (!resolResp.ok) {
      return res.status(200).json({ text: textApresVerif, hasDoutes: nbDoutesApresVerif > 0, nbDoutes: nbDoutesApresVerif })
    }
    const resolData = await resolResp.json()
    const textApresResol = resolData.content[0].text.trim()

    // ── Étape 4 : Validation par complétion simulée ──────────────────────────
    // Pour chaque exercice de complétion (phonologique ou liste de mots),
    // l'IA tente de compléter chaque mot-amorce avec les éléments disponibles.
    // Si aucune combinaison ne donne un mot français réel → OCR incomplet → correction.
    const validResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `Tu valides la qualité OCR d'un document scolaire en simulant la résolution des exercices.

ALGORITHME GÉNÉRAL (applicable à tout document) :

ÉTAPE A — Identifie les éléments à insérer pour chaque exercice :
- Exercice phonologique : sons listés dans la consigne (ex : eu / oeu / eur / oeur)
- Exercice de complétion avec liste : les mots fournis dans la liste
- Applique cet algorithme à chaque exercice indépendamment.

ÉTAPE B — Pour chaque mot-amorce avec blancs :
1. Essaie d'insérer chaque élément disponible dans le blanc.
2. Si au moins une combinaison produit un mot français réel → amorce correcte, ne touche pas.
3. Si AUCUNE combinaison ne produit un mot français réel → l'OCR a introduit une erreur.

ÉTAPE C — Correction d'une amorce sans solution valide :
1. Cherche dans ton lexique français le mot le plus probable qui :
   - Contient un des éléments disponibles (son ou mot de la liste)
   - Est cohérent avec l'article ou le contexte grammatical visible
   - A des lettres visibles qui correspondent à ce que l'OCR a retranscrit
2. Identifie l'écart entre ce mot cible et l'amorce OCR :
   - Lettre(s) manquante(s) après le blanc → ajoute-les après les points
   - Lettre(s) manquante(s) avant le blanc → ajoute-les avant les points
   - Lettre(s) mal lue(s) dans l'amorce (confusion graphique cursive) → remplace-les
   - Espace parasite dans un groupe de lettres → supprime l'espace
3. Corrige l'amorce en conséquence. Ne complète jamais le blanc lui-même.

RÈGLE ABSOLUE : les points "........." représentent l'espace-réponse élève.
Ne jamais les supprimer ni les remplacer par la réponse.
La correction porte uniquement sur les lettres AUTOUR des points.

Retourne le texte corrigé uniquement. Sans commentaire.`,
        messages: [{
          role: 'user',
          content: `Voici le texte OCR. Valide chaque exercice de complétion et corrige les mots-amorces dont aucune combinaison n'est valide :\n\n<texte_ocr>\n${textApresResol}\n</texte_ocr>`,
        }],
      }),
    })

    if (!validResp.ok) {
      const nbDoutes0 = (textApresResol.match(/\[\?/g) || []).length
      return res.status(200).json({ text: textApresResol, hasDoutes: nbDoutes0 > 0, nbDoutes: nbDoutes0 })
    }
    const validData = await validResp.json()
    const textFinal = validData.content[0].text.trim()
    const nbDoutes = (textFinal.match(/\[\?/g) || []).length

    return res.status(200).json({ text: textFinal, hasDoutes: nbDoutes > 0, nbDoutes })

  } catch (err) {
    return res.status(500).json({ error: `Erreur OCR : ${err.message}` })
  }
}
