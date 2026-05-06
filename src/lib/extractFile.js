/**
 * Extraction de texte client-side (navigateur)
 * PDF via pdfjs-dist · DOCX via mammoth browser build
 */

import * as pdfjsLib from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

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

    const text = pageTexts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
    if (!text) throw new Error('Aucun texte extrait — le PDF est peut-être scanné ou protégé.')
    return text
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
