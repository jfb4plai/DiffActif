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

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

    const ocrResp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: ocrContent }],
    })
    const textOcr = ocrResp.content[0].text.trim()

    // ── Étape 2 : Vérification cohérence ─────────────────────────────
    const verifResp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: `Tu vérifies la cohérence d'un texte extrait par OCR depuis un document scolaire francophone (FWB).
Ton rôle : détecter les mots qui semblent incorrects au regard du sens pédagogique, de la syntaxe française et du contexte scolaire.
Si un passage déjà marqué [? ?] te semble confirmé comme douteux, conserve le marqueur.
Si un passage NON marqué te semble incorrect (mot absurde dans le contexte, graphème improbable), entoure-le aussi de [? ... ?].
Ne modifie rien d'autre — retourne le texte tel quel avec les éventuels marqueurs ajoutés ou conservés.`,
      messages: [{
        role: 'user',
        content: `Voici le texte OCR extrait. Vérifie la cohérence et retourne-le avec les marqueurs [? ?] sur les passages douteux :\n\n${textOcr}`,
      }],
    })

    const textFinal = verifResp.content[0].text.trim()
    const doutes = (textFinal.match(/\[\\?/g) || textFinal.match(/\[\?/g) || []).length
    const nbDoutes = (textFinal.match(/\[\?/g) || []).length

    return res.status(200).json({
      text: textFinal,
      hasDoutes: nbDoutes > 0,
      nbDoutes,
    })

  } catch (err) {
    return res.status(500).json({ error: `Erreur OCR : ${err.message}` })
  }
}
