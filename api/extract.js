/**
 * Vercel Serverless Function — Extraction de texte depuis PDF ou DOCX
 * Route : POST /api/extract
 * Body  : { fileContent: string (base64), fileName: string }
 * Return: { text: string }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const { fileContent, fileName } = req.body
  if (!fileContent || !fileName) {
    return res.status(400).json({ error: 'fileContent et fileName sont requis' })
  }

  const ext = fileName.split('.').pop().toLowerCase()
  const buffer = Buffer.from(fileContent, 'base64')

  try {
    let text = ''

    if (ext === 'pdf') {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
      const result = await pdfParse(buffer)
      text = result.text
    } else if (ext === 'docx') {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return res.status(400).json({ error: 'Format non supporté. Utilisez PDF ou DOCX.' })
    }

    // Nettoyage basique du texte extrait
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (!text) {
      return res.status(422).json({ error: 'Aucun texte extrait — le fichier est peut-être scanné ou protégé.' })
    }

    return res.status(200).json({ text })

  } catch (err) {
    return res.status(500).json({ error: `Erreur d'extraction : ${err.message}` })
  }
}
