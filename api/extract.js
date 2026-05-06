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
    // ── Étape 1 : OCR Vision ──────────────────────────────────────────
    const ocrContent = [
      ...images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: img },
      })),
      {
        type: 'text',
        text: `Tu es un OCR expert pour documents scolaires francophones (FWB — Fédération Wallonie-Bruxelles).

Extrais tout le texte visible dans ces pages dans l'ordre naturel de lecture.

RÈGLES IMPÉRATIVES :
- Respecte la structure exacte : numérotation, sauts de ligne, paragraphes, tirets
- Pour tout passage illisible, dégradé ou ambigu : entoure-le de [? ... ?]
  Ex : [?mot illisible?] ou [?chien / chier?] si deux lectures sont possibles
- Ne commente pas — retourne uniquement le texte avec les marqueurs [? ?]`,
      },
    ]

    const ocrResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: ocrContent }],
      }),
    })
    if (!ocrResp.ok) {
      const e = await ocrResp.json()
      return res.status(500).json({ error: e.error?.message ?? 'Erreur OCR Vision' })
    }
    const ocrData = await ocrResp.json()
    const textOcr = ocrData.content[0].text.trim()

    // ── Étape 2 : Vérification cohérence ─────────────────────────────
    const verifResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `Tu vérifies la cohérence d'un texte extrait par OCR depuis un document scolaire francophone (FWB).
Détecte les mots qui semblent incorrects au regard du sens pédagogique, de la syntaxe française et du contexte scolaire.
Conserve les marqueurs [? ?] déjà présents. Ajoute [? ... ?] sur tout passage non marqué mais manifestement suspect.
Ne modifie rien d'autre — retourne le texte tel quel avec les marqueurs.`,
        messages: [{
          role: 'user',
          content: `Voici le texte OCR extrait. Vérifie la cohérence et retourne-le avec les marqueurs [? ?] sur les passages douteux :\n\n${textOcr}`,
        }],
      }),
    })
    if (!verifResp.ok) {
      // Si la vérif échoue, on retourne quand même l'OCR brut
      return res.status(200).json({ text: textOcr, hasDoutes: false, nbDoutes: 0 })
    }
    const verifData = await verifResp.json()
    const textFinal = verifData.content[0].text.trim()
    const nbDoutes = (textFinal.match(/\[\?/g) || []).length

    return res.status(200).json({ text: textFinal, hasDoutes: nbDoutes > 0, nbDoutes })

  } catch (err) {
    return res.status(500).json({ error: `Erreur OCR : ${err.message}` })
  }
}
