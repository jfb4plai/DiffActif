/**
 * Extraction de texte client-side (navigateur)
 * PDF natif : pdfjs-dist
 * PDF scanné : rendu canvas → Claude Vision OCR via /api/extract
 * DOCX : mammoth browser build
 */

import * as pdfjsLib from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

// Détecte si le texte extrait est du charabia (PDF scanné mal encodé)
function isGarbled(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (words.length < 10) return true
  const shortWords = words.filter(w => w.replace(/[^a-zA-ZÀ-ÿ]/g, '').length <= 2)
  return shortWords.length / words.length > 0.5
}

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
    images.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
  }
  return images
}

export async function extractFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pageTexts = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
      if (pageText.trim()) pageTexts.push(pageText.trim())
    }

    const rawText = pageTexts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()

    // PDF natif avec texte lisible
    if (rawText && !isGarbled(rawText)) {
      return rawText
    }

    // PDF scanné → OCR via Claude Vision
    const images = await renderPagesToBase64(pdf)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return data.text
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw new Error('Aucun texte extrait du fichier DOCX.')
    return text
  }

  throw new Error('Format non supporté — utilisez PDF ou DOCX.')
}
