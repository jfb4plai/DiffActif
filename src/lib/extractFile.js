/**
 * Extraction de texte client-side (navigateur)
 * PDF : rendu canvas → Claude Vision OCR + vérification cohérence via /api/extract
 * DOCX : mammoth browser build (texte natif, pas d'OCR nécessaire)
 * Images (JPG/PNG/WebP) : conversion JPEG via canvas → même pipeline OCR que PDF
 */

import * as pdfjsLib from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

const MAX_PAGES = 6

// Charge une image File et retourne un base64 JPEG normalisé (fond blanc pour PNG)
function imageFileToBase64Jpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de charger l\'image.')) }
    img.src = url
  })
}

// Rend les pages PDF en images JPEG base64 pour Claude Vision
async function renderPagesToBase64(pdf, maxPages = MAX_PAGES) {
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

// Retourne { text, hasDoutes, nbDoutes, pageWarning? }
// pageWarning = { total, extracted } si le PDF dépasse MAX_PAGES pages
export async function extractFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const totalPages = pdf.numPages
    const pageWarning = totalPages > MAX_PAGES
      ? { total: totalPages, extracted: MAX_PAGES }
      : null

    // Toujours passer par Claude Vision pour la meilleure qualité
    const images = await renderPagesToBase64(pdf)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text, hasDoutes: data.hasDoutes, nbDoutes: data.nbDoutes ?? 0, pageWarning }
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw new Error('Aucun texte extrait du fichier DOCX.')
    return { text, hasDoutes: false, nbDoutes: 0 }
  }

  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    const base64 = await imageFileToBase64Jpeg(file)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [base64] }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text, hasDoutes: data.hasDoutes, nbDoutes: data.nbDoutes ?? 0 }
  }

  throw new Error('Format non supporté — utilisez PDF, DOCX ou une image (JPG, PNG, WebP).')
}
