/**
 * Export DOCX — DiffActif
 * Génère un fichier Word depuis les adaptations ou séquences générées.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, Header, PageNumber,
} from 'docx'
import { saveAs } from 'file-saver'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from './constants'

const BRAND_TEAL = '0a9370'
const GRAY_LIGHT = 'F3F4F6'
const GRAY_TEXT  = '6B7280'

// ──────────────────────────────────────────
// Export adaptations (Module 2)
// ──────────────────────────────────────────

export async function exportAdaptationsDocx({
  activiteOriginale,
  objectif,
  texteFinal,
  profils,
  matiere,
  niveau,
  typeEnseignement,
}) {
  const date     = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL  = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL    = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''
  const profilsL = profils.map(v => PROFILS.find(p => p.value === v)?.label ?? v).join(', ')

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'DiffActif — PLAI', bold: true, color: BRAND_TEAL, size: 18 }),
                new TextRun({ text: `  |  ${date}`, color: GRAY_TEXT, size: 18 }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_TEAL } },
            }),
          ],
        }),
      },
      children: [
        // Titre principal
        new Paragraph({
          text: 'Adaptations pédagogiques différenciées',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 },
          run: { color: BRAND_TEAL, bold: true, size: 36 },
        }),

        // Métadonnées
        ...metaTable([
          ['Matière',         matiere       || '—'],
          ['Niveau',          niveauL       || '—'],
          ['Type',            typeL         || '—'],
          ['Profils ciblés',  profilsL      || '—'],
          ['Date',            date],
        ]),

        spacer(),

        // Activité originale
        sectionTitle('Activité originale'),
        new Paragraph({
          children: [new TextRun({ text: activiteOriginale || '—', size: 22, italics: true })],
          spacing: { after: 160 },
          shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
          indent: { left: 360 },
        }),

        // Objectif
        ...(objectif ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'Objectif : ', bold: true, size: 22 }),
              new TextRun({ text: objectif, size: 22 }),
            ],
            spacing: { after: 320 },
          }),
        ] : []),

        spacer(),

        // Adaptations
        sectionTitle('Adaptations par profil'),
        ...parseAdaptations(texteFinal),

        spacer(),

        // Pied de page scientifique
        new Paragraph({
          children: [
            new TextRun({
              text: 'Sources RISS : Fournier (2024) dumas-04562654 · Mahi Haddad & Beaud (2025) dumas-05106961 · Alvarez (2024) W4402615917',
              size: 16,
              color: GRAY_TEXT,
              italics: true,
            }),
          ],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' } },
          spacing: { before: 400 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `DiffActif_Adaptations_${matiere || 'cours'}_${new Date().toISOString().split('T')[0]}.docx`
  saveAs(blob, filename)
}

// ──────────────────────────────────────────
// Export séquence (Module 3)
// ──────────────────────────────────────────

export async function exportSequenceDocx({
  titre,
  matiere,
  niveau,
  typeEnseignement,
  objectif,
  nbSeances,
  profils,
  texteFinal,
}) {
  const date     = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL  = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL    = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''
  const profilsL = profils.map(v => PROFILS.find(p => p.value === v)?.label ?? v).join(', ') || 'Classe hétérogène'

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [{
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'DiffActif — PLAI', bold: true, color: BRAND_TEAL, size: 18 }),
                new TextRun({ text: `  |  Séquence CUA  |  ${date}`, color: GRAY_TEXT, size: 18 }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_TEAL } },
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          text: titre || 'Séquence différenciée CUA',
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
          run: { color: BRAND_TEAL, bold: true, size: 36 },
        }),

        ...metaTable([
          ['Matière',         matiere    || '—'],
          ['Niveau',          niveauL    || '—'],
          ['Type',            typeL      || '—'],
          ['Nombre de séances', String(nbSeances || '—')],
          ['Profils ciblés',  profilsL],
          ['Date',            date],
        ]),

        spacer(),

        sectionTitle('Objectif final'),
        new Paragraph({
          children: [new TextRun({ text: objectif || '—', size: 22 })],
          spacing: { after: 320 },
        }),

        sectionTitle('Séquence différenciée'),
        ...parseSequence(texteFinal),

        spacer(),

        new Paragraph({
          children: [
            new TextRun({
              text: 'Sources RISS : Rusconi (2025) W4414205903 · Alvarez (2024) W4402615917',
              size: 16, color: GRAY_TEXT, italics: true,
            }),
          ],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' } },
          spacing: { before: 400 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `DiffActif_Sequence_${matiere || 'cours'}_${new Date().toISOString().split('T')[0]}.docx`
  saveAs(blob, filename)
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function spacer() {
  return new Paragraph({ text: '', spacing: { after: 200 } })
}

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BRAND_TEAL, size: 26 })],
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_TEAL } },
  })
}

function metaTable(rows) {
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [new Paragraph({
                children: [new TextRun({ text: label, bold: true, size: 20, color: GRAY_TEXT })],
              })],
              shading: { type: ShadingType.CLEAR, fill: GRAY_LIGHT },
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [new Paragraph({
                children: [new TextRun({ text: value, size: 20 })],
              })],
            }),
          ],
        })
      ),
    }),
  ]
}

// Parse le texte des adaptations (séparé par profil via "[PROFIL] —")
function parseAdaptations(text) {
  if (!text) return [new Paragraph({ text: '—' })]

  const paragraphs = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      paragraphs.push(spacer())
      continue
    }

    // Ligne de profil (ex: "[DYSLEXIE] —" ou "DYSLEXIE —")
    const isProfileHeader = /^[\[A-ZÀÂÉÈÊËÎÏÔÙÛÜ\s\/]+[\]—\-:]/.test(trimmed) && trimmed.length < 80
    if (isProfileHeader) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 24, color: BRAND_TEAL })],
        spacing: { before: 240, after: 80 },
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 80 },
        indent: { left: 360 },
      }))
    }
  }
  return paragraphs
}

// Parse le texte de séquence (étapes numérotées)
function parseSequence(text) {
  if (!text) return [new Paragraph({ text: '—' })]

  const paragraphs = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { paragraphs.push(spacer()); continue }

    const isStep = /^(Étape|Séance|Step|\d+[.):])\s/i.test(trimmed)
    if (isStep) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 24, color: BRAND_TEAL })],
        spacing: { before: 280, after: 80 },
      }))
    } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 60 },
        indent: { left: 360 },
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 80 },
      }))
    }
  }
  return paragraphs
}
