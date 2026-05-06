/**
 * Extraction de texte client-side (navigateur)
 * PDF : rendu canvas → Claude Vision OCR + vérification cohérence via /api/extract
 * DOCX : mammoth browser build (texte natif, pas d'OCR nécessaire)
 */

import * as pdfjsLib from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

// Rend les pages PDF en images JPEG base64 pour Claude Vision
async function renderPagesToBase64(pdf, maxPages = 6) {
  const count = Math.min(pdf.numPages, maxPages)
  const images = []
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
  }
  return images
}

// Retourne { text, hasDoutes, nbDoutes }
export async function extractFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    // Toujours passer par Claude Vision pour la meilleure qualité
    const images = await renderPagesToBase64(pdf)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text, hasDoutes: data.hasDoutes, nbDoutes: data.nbDoutes ?? 0 }
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw new Error('Aucun texte extrait du fichier DOCX.')
    return { text, hasDoutes: false, nbDoutes: 0 }
  }

  throw new Error('Format non supporté — utilisez PDF ou DOCX.')
}
