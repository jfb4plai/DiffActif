/**
 * Vercel Serverless Function — OCR via Claude Vision
 * Route : POST /api/extract
 * Body  : { images: string[] }  // base64 JPEG, max 6 pages
 * Return: { text: string }
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

    const content = [
      ...images.map(img => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: img },
      })),
      {
        type: 'text',
        text: 'Extrais tout le texte visible dans ces pages de document scolaire. Retourne uniquement le texte extrait, en respectant la structure (paragraphes, numérotations). Sans commentaire ni explication.',
      },
    ]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].text.trim()
    return res.status(200).json({ text })

  } catch (err) {
    return res.status(500).json({ error: `Erreur OCR : ${err.message}` })
  }
}
