/**
 * Extraction de texte client-side (navigateur)
 * PDF : rendu canvas → Claude Vision OCR + vérification cohérence via /api/extract
 * DOCX : mammoth browser build (texte natif, pas d'OCR nécessaire)
 * Images (JPG/PNG/WebP) : conversion JPEG via canvas → même pipeline OCR que PDF
 */

import * as pdfjsLib from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { apiFetch } from './apiFetch'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

const MAX_PAGES = 6

// Grand côté maximum exploité par le modèle de lecture. Au-delà, l'API
// redimensionne — on paierait le transfert sans gagner en détail. En deçà,
// on perd de l'information pour rien.
// ⚠️ Couplé au modèle choisi dans api/extract.js : 1568 px pour Sonnet 4.6.
// Un passage à Sonnet 5 ou Opus 4.7+ porterait cette borne à 2576.
const MAX_COTE = 1568

// Le nombre de tokens d'une image dépend de ses DIMENSIONS, pas du taux de
// compression. Une qualité élevée est donc gratuite — et sur du trait fin
// manuscrit, c'est elle qui décide si un « n » reste un « n ».
const QUALITE_JPEG = 0.95

// Charge une image File et retourne un base64 JPEG normalisé (fond blanc pour PNG)
function imageFileToBase64Jpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      // On réduit si l'image dépasse la borne, jamais on n'agrandit :
      // agrandir n'inventerait aucun détail et coûterait des tokens.
      const cote = Math.max(img.naturalWidth, img.naturalHeight)
      const facteur = cote > MAX_COTE ? MAX_COTE / cote : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * facteur)
      canvas.height = Math.round(img.naturalHeight * facteur)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', QUALITE_JPEG).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de charger l\'image.')) }
    img.src = url
  })
}

// Rend les pages PDF en images JPEG base64 pour Claude Vision.
// Le facteur d'échelle est calculé page par page pour atteindre MAX_COTE :
// un facteur fixe donnait un résultat différent selon le format du document,
// et laissait une A4 à 1263 px là où 1568 étaient exploitables.
async function renderPagesToBase64(pdf, maxPages = MAX_PAGES) {
  const count = Math.min(pdf.numPages, maxPages)
  const images = []
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i)
    const base = page.getViewport({ scale: 1 })
    // Borne haute : une page au cadrage minuscule ne doit pas produire un
    // canvas démesuré à partir d'un scan de faible résolution.
    const scale = Math.min(MAX_COTE / Math.max(base.width, base.height), 4)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', QUALITE_JPEG).split(',')[1])
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
    const res = await apiFetch('/api/extract', { images })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text, doc: data.doc ?? null, anomalies: data.anomalies ?? [], hasDoutes: data.hasDoutes, nbDoutes: data.nbDoutes ?? 0, warnings: data.warnings ?? [], pageWarning }
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw new Error('Aucun texte extrait du fichier DOCX.')
    return { text, doc: null, anomalies: [], hasDoutes: false, nbDoutes: 0, warnings: [] }
  }

  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    const base64 = await imageFileToBase64Jpeg(file)
    const res = await apiFetch('/api/extract', { images: [base64] })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur OCR')
    return { text: data.text, doc: data.doc ?? null, anomalies: data.anomalies ?? [], hasDoutes: data.hasDoutes, nbDoutes: data.nbDoutes ?? 0, warnings: data.warnings ?? [] }
  }

  throw new Error('Format non supporté — utilisez PDF, DOCX ou une image (JPG, PNG, WebP).')
}
