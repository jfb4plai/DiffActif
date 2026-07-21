/**
 * Vercel Serverless Function — Lecture structurée d'un document scolaire
 * Route : POST /api/extract
 * Body  : { images: string[] }  // base64 JPEG, max 6 pages
 * Return: { doc, text, anomalies, warnings, hasDoutes, nbDoutes }
 *
 * UNE seule passe IA : image → JSON typé (voir _docSchema.js), contraint par
 * `output_config.format`. Tout le reste — mise en page, numérotation, sauts de
 * page, espaces-réponse — est calculé en JavaScript à partir de ce JSON.
 *
 * Pourquoi une seule passe : chaque réécriture libre supplémentaire était une
 * occasion de compléter une réponse ou d'écraser un distracteur. Ici le schéma
 * n'offre aucun champ où écrire une réponse — la faute est inexprimable.
 */

import { requireUser } from './_auth.js'
import { DOC_SCHEMA, validerDoc, renderSource, normaliserDoc } from './_docSchema.js'
import { SYSTEM_LECTURE } from './_lecturePrompt.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { images } = req.body
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images[] requis' })
  }
  if (images.length > 6) {
    return res.status(400).json({ error: 'Maximum 6 pages par requête OCR.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante (ANTHROPIC_API_KEY)' })

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        // temperature: 0 — deux lectures du même scan doivent donner le même JSON.
        temperature: 0,
        system: SYSTEM_LECTURE,
        // Le schéma est imposé par l'API, pas demandé dans le prompt :
        // la sortie ne peut pas être du Markdown ni du JSON malformé.
        output_config: { format: { type: 'json_schema', schema: DOC_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            ...images.map(img => ({
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: img },
            })),
            { type: 'text', text: 'Décris ce document scolaire sous forme structurée.' },
          ],
        }],
      }),
    })

    if (!resp.ok) {
      if (resp.status === 504) {
        return res.status(504).json({ error: 'Délai dépassé — document trop volumineux. Réduisez à 4 pages maximum.' })
      }
      const e = await resp.json().catch(() => ({}))
      if (resp.status === 529 || e.error?.type === 'overloaded_error') {
        return res.status(503).json({ error: 'API surchargée — réessayez dans quelques secondes.' })
      }
      return res.status(500).json({ error: e.error?.message ?? 'Erreur de lecture du document' })
    }

    const data = await resp.json()
    if (data.stop_reason === 'max_tokens') {
      return res.status(500).json({ error: 'Document trop dense pour une seule lecture — réduisez le nombre de pages.' })
    }

    const brut = data.content?.find(b => b.type === 'text')?.text ?? ''
    let doc
    try {
      doc = JSON.parse(brut)
    } catch {
      return res.status(500).json({ error: 'Lecture illisible — relancez l\'import.' })
    }

    normaliserDoc(doc)
    const anomalies = validerDoc(doc)
    const text = renderSource(doc)

    return res.status(200).json({
      doc,
      text,
      anomalies,
      warnings: anomalies,
      hasDoutes: false,
      nbDoutes: 0,
    })

  } catch (err) {
    return res.status(500).json({ error: `Erreur de lecture : ${err.message}` })
  }
}
