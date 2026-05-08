/**
 * Export DOCX — DiffActif
 * Génère un fichier Word depuis les adaptations ou séquences générées.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, Header, PageNumber, ImageRun,
} from 'docx'
import { saveAs } from 'file-saver'
import QRCode from 'qrcode'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from './constants'
import { ARASAAC_ATTRIBUTION, searchArasaac, pictoToBase64 } from './arasaac'

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
          text: 'Conseils pédagogiques différenciés',
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
        sectionTitle('Conseils par profil'),
        ...parseAdaptations(texteFinal),

        spacer(),

        // Pied de page scientifique
        new Paragraph({
          children: [
            new TextRun({
              text: 'Sources RISS — Dyslexie : Pattaro (2023) dumas-04361111 · Barbe et al. (2022) dumas-03978495 · Vadant (2025) dumas-05446436  |  TDAH : Bourgeois (2024) dumas-04903104 · Fosseux (2014) dumas-01072147  |  Dyscalculie : Thibaut (2016) dumas-01488139  |  Allophone : Bruisse et al. (2019) dumas-02159822  |  Décrocheur : Fromaget (2020) dumas-02867520 · Mons et al. (2017) hal-04622700  |  HPI : Masson (2024) dumas-05293977  |  Dyspraxie : Brenot (2025) dumas-05410646',
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

function spacer(keepNext = false) {
  return new Paragraph({ text: '', spacing: { after: 200 }, ...(keepNext ? { keepNext: true } : {}) })
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

// ──────────────────────────────────────────
// Pictos Arasaac — résolution des marqueurs [picto: mot]
// Retourne un map { mot: base64 } pour tous les [picto:] trouvés dans le texte
// ──────────────────────────────────────────

async function fetchPictoMap(text) {
  const matches = [...text.matchAll(/\[picto:\s*([^\]]+)\]/gi)]
  if (matches.length === 0) return {}
  const entries = await Promise.all(
    matches.map(async ([, mot]) => {
      const keyword = mot.trim().toLowerCase()
      const found = await searchArasaac(keyword)
      if (!found) return [keyword, null]
      const base64 = await pictoToBase64(found.url)
      return [keyword, base64]
    })
  )
  return Object.fromEntries(entries.filter(([, b64]) => b64 !== null))
}

// ──────────────────────────────────────────
// Export document AU universel (Module 2)
// ──────────────────────────────────────────

export async function exportUniverselDocx({ auTexte, matiere, niveau, typeEnseignement, withVerbPictos = false }) {
  const date    = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL   = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''

  // Pré-chargement des pictos avant construction du Document
  const [pictoMap, verbPictoMap] = await Promise.all([
    fetchPictoMap(auTexte),
    withVerbPictos ? fetchVerbPictoMap(auTexte) : Promise.resolve({}),
  ])
  const mergedPictoMap = { ...pictoMap, ...verbPictoMap }
  const hasPictos = Object.keys(mergedPictoMap).length > 0
  const auParagraphs = parseAuText(auTexte, mergedPictoMap, withVerbPictos)

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 850, bottom: 720, left: 850 }, // ~1.27cm/1.5cm — max contenu par page
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'DiffActif — PLAI', bold: true, color: BRAND_TEAL, size: 18 }),
              new TextRun({ text: `  |  Document AU universel  |  ${date}`, color: GRAY_TEXT, size: 18 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_TEAL } },
          })],
        }),
      },
      children: [
        new Paragraph({
          text: matiere ? `${matiere} — Aménagements Universels` : 'Document — Aménagements Universels',
          heading: HeadingLevel.TITLE,
          spacing: { after: 160 },
          run: { color: BRAND_TEAL, bold: true, size: 36 },
        }),

        ...metaTable([
          ['Matière',  matiere  || '—'],
          ['Niveau',   niveauL  || '—'],
          ['Type',     typeL    || '—'],
          ['Date',     date],
          ['Version',  'Aménagements Universels — toute la classe'],
        ]),

        spacer(),

        sectionTitle('Document avec aménagements universels'),
        ...auParagraphs,

        spacer(),

        new Paragraph({
          children: [new TextRun({
            text: [
              'Aménagements Universels (CUA) — Sources RISS : Rusconi (2025) W4414205903 · Alvarez (2024) W4402615917',
              hasPictos ? `  |  ${ARASAAC_ATTRIBUTION}` : '',
            ].join(''),
            size: 16, color: GRAY_TEXT, italics: true,
          })],
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' } },
          spacing: { before: 400 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `DiffActif_AU_universel_${matiere || 'cours'}_${new Date().toISOString().split('T')[0]}.docx`)
}

// ──────────────────────────────────────────
// Export document par profil (AU + AR spécifiques)
// ──────────────────────────────────────────

// Profils qui reçoivent un QR audio
const PROFILS_AUDIO = ['dyslexie', 'allophone', 'decrocheur']
// Profils qui reçoivent des pictos Arasaac
const PROFILS_PICTOS = ['allophone']

export async function exportProfilDocx({
  profil,         // value du profil (ex: 'dyslexie')
  arTexte,        // adaptation AR pour ce profil
  auTexte,        // document AU universel (base)
  pictos = [],    // [{ keyword, base64 }] — Arasaac
  matiere, niveau, typeEnseignement,
  withVerbPictos = false,
}) {
  const profilDef = PROFILS.find(p => p.value === profil)
  const profilLabel = profilDef?.label ?? profil
  const date    = new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
  const niveauL = NIVEAUX.find(n => n.value === niveau)?.label ?? niveau ?? ''
  const typeL   = TYPES_ENSEIGNEMENT.find(t => t.value === typeEnseignement)?.label ?? typeEnseignement ?? ''

  const withAudio = PROFILS_AUDIO.includes(profil)
  const withPictos = PROFILS_PICTOS.includes(profil) && pictos.length > 0

  // Pré-chargement pictos AU + verbes + QR par consigne (audio profiles)
  const [pictoMap, verbPictoMap, consigneQrMap] = await Promise.all([
    fetchPictoMap(auTexte),
    withVerbPictos ? fetchVerbPictoMap(auTexte) : Promise.resolve({}),
    withAudio && auTexte ? generateConsigneQrMap(auTexte) : Promise.resolve({}),
  ])
  const mergedPictoMap = { ...pictoMap, ...verbPictoMap }

  const auParagraphs = parseAuText(auTexte, mergedPictoMap, withVerbPictos, consigneQrMap)
  const hasPictos = withPictos || Object.keys(mergedPictoMap).length > 0

  const children = [
    new Paragraph({
      text: `${matiere || 'Activité'} — Version ${profilLabel}`,
      heading: HeadingLevel.TITLE,
      spacing: { after: 160 },
      run: { color: BRAND_TEAL, bold: true, size: 36 },
    }),

    ...metaTable([
      ['Matière',  matiere  || '—'],
      ['Niveau',   niveauL  || '—'],
      ['Type',     typeL    || '—'],
      ['Profil',   profilLabel],
      ['Date',     date],
      ['Version',  'Aménagements Universels + Aménagements Raisonnables'],
    ]),

    spacer(),

    // Pictos vocabulaire (allophone)
    ...(withPictos ? [
      sectionTitle('Vocabulaire illustré'),
      new Paragraph({
        children: pictos.flatMap(({ keyword, base64 }) => [
          new ImageRun({ data: base64, transformation: { width: 70, height: 70 }, type: 'png' }),
          new TextRun({ text: `  ${keyword}     `, size: 18 }),
        ]),
        spacing: { after: 280 },
      }),
    ] : []),

    // Document AU — base de la version profil (Même Plan garanti)
    sectionTitle('Document avec aménagements universels'),
    ...auParagraphs,

    spacer(),

    new Paragraph({ text: '', pageBreakBefore: true }),
    sectionTitle('Adaptations spécifiques — ' + profilLabel),
    ...parseAdaptations(arTexte),

    spacer(),

    new Paragraph({
      children: [new TextRun({
        text: [
          'Sources RISS : Fournier (2024) dumas-04562654 · Mahi Haddad & Beaud (2025) dumas-05106961',
          hasPictos ? `  |  ${ARASAAC_ATTRIBUTION}` : '',
        ].join(''),
        size: 16, color: GRAY_TEXT, italics: true,
      })],
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' } },
      spacing: { before: 400 },
    }),
  ]

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 850, bottom: 720, left: 850 }, // identique AU universel
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'DiffActif — PLAI', bold: true, color: BRAND_TEAL, size: 18 }),
              new TextRun({ text: `  |  Version ${profilLabel}  |  ${date}`, color: GRAY_TEXT, size: 18 }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_TEAL } },
          })],
        }),
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const slug = profil.replace(/[^a-z]/g, '')
  saveAs(blob, `DiffActif_${slug}_${matiere || 'cours'}_${new Date().toISOString().split('T')[0]}.docx`)
}

// ──────────────────────────────────────────
// Règle "Même Plan" (AU fondamental FWB — non négociable)
// Consigne + tâche TOUJOURS sur la même page.
// keepNext: true → colle ce paragraphe au suivant (Word respecte cette contrainte)
// keepLines: true → ne coupe pas un paragraphe en deux pages
// pageBreakBefore: true → saut de page explicite (changement de section/matière)
// ──────────────────────────────────────────

// Retourne true si la ligne suivante non-vide est un titre ou si la prochaine est vide
function isEndOfBlock(lines, currentIndex) {
  const next = lines[currentIndex + 1]
  if (next === undefined) return true          // dernière ligne
  if (next.trim() === '') return true          // ligne vide = fin de bloc
  return false
}

// Détecte un marqueur de saut de page explicite dans le texte
function isPageBreakMarker(line) {
  return /^---\s*(page|saut|nouvelle\s*page|changement)/i.test(line.trim())
    || /^\[saut.de.page\]/i.test(line.trim())
    || /^PAGE\s+\d+$/i.test(line.trim())
}

// Détecte une ligne purement décorative (points, tirets, underscores répétés ≥ 3)
function isDecorativeLine(line) {
  return /^[.\-_…]{3,}$/.test(line.trim())
}

// Détecte une ligne contenant UNIQUEMENT des marqueurs [picto: mot] (et séparateurs |)
function isPictoOnlyLine(line) {
  const stripped = line.replace(/\[picto:\s*[^\]]+\]/gi, '').replace(/[\|\s]/g, '')
  return stripped === '' && /\[picto:/i.test(line)
}

// Bordures invisibles pour tableaux de pictos
function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: none, bottom: none, left: none, right: none, insideH: none, insideV: none }
}

// Tableau picto (ligne 1) / zone de réponse (ligne 2) — une colonne par item
function buildPictoAnswerTable(mots, answerItems, pictoMap) {
  const n = mots.length
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders(),
    rows: [
      // Ligne 1 : pictogrammes
      new TableRow({
        cantSplit: true,
        children: mots.map(mot => new TableCell({
          borders: noBorders(),
          children: [new Paragraph({
            children: (() => {
              const b64 = pictoMap[mot]
              return b64
                ? [new ImageRun({ data: b64, transformation: { width: 80, height: 80 }, type: 'png' })]
                : [new TextRun({ text: `[${mot}]`, italics: true, color: GRAY_TEXT, size: 18 })]
            })(),
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          })],
        })),
      }),
      // Ligne 2 : zones de réponse correspondantes
      new TableRow({
        cantSplit: true,
        children: Array.from({ length: n }, (_, idx) => new TableCell({
          borders: noBorders(),
          children: [new Paragraph({
            children: [new TextRun({ text: answerItems[idx]?.trim() ?? '', size: 22 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          })],
        })),
      }),
    ],
  })
}

// Génère un QR code par consigne d'exercice → { 'Exercice 1 — Complète...' : base64 }
async function generateConsigneQrMap(text) {
  const exerciceLines = text.split('\n')
    .map(l => l.trim())
    .filter(l => /^(Exercice|Séance|Étape)\s+\d+/i.test(l))
  const map = {}
  await Promise.all(exerciceLines.map(async line => {
    const key = line.replace(/\*\*/g, '').replace(/\u2014/g, ' - ')
    try {
      const url = `${window.location.origin}/lire?t=${btoa(unescape(encodeURIComponent(key)))}&titre=${btoa(unescape(encodeURIComponent('Consigne')))}`
      const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'L', scale: 5, margin: 1 })
      map[key] = qrDataUrl.split(',')[1]
    } catch { /* QR optionnel */ }
  }))
  return map
}

// Cherche et pré-charge les pictos Arasaac pour les verbes **verb** dans les titres d'exercice
async function fetchVerbPictoMap(text) {
  const verbMatches = [...text.matchAll(/^(?:Exercice|Séance|Étape)[^\n]*\*\*([^*]+)\*\*/gim)]
  if (verbMatches.length === 0) return {}
  const verbs = [...new Set(verbMatches.map(m => m[1].trim().toLowerCase()))]
  const entries = await Promise.all(
    verbs.map(async verb => {
      const found = await searchArasaac(verb)
      if (!found) return [`verb:${verb}`, null]
      const base64 = await pictoToBase64(found.url)
      return [`verb:${verb}`, base64]
    })
  )
  return Object.fromEntries(entries.filter(([, b64]) => b64 !== null))
}

// Rendu d'une ligne de titre (Exercice N — **Verbe** consigne)
// Verbe en orange bold, reste en teal bold — picto optionnel avant le verbe
function renderTitle(text, pictoMap = {}, withVerbPictos = false) {
  const cleanText = text.replace(/^#+\s*/, '')
  const tokens = cleanText.split(/(\*\*[^*]+\*\*)/g)
  const children = []
  for (const tok of tokens) {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      const verbText = tok.slice(2, -2)
      const verbKey = `verb:${verbText.toLowerCase()}`
      if (withVerbPictos && pictoMap[verbKey]) {
        children.push(new ImageRun({ data: pictoMap[verbKey], transformation: { width: 26, height: 26 }, type: 'png' }))
        children.push(new TextRun({ text: ' ', size: 24 }))
      }
      children.push(new TextRun({ text: verbText, bold: true, size: 24, color: 'f97316' })) // orange accent
    } else if (tok) {
      children.push(new TextRun({ text: tok, bold: true, size: 24, color: BRAND_TEAL }))
    }
  }
  return children.length > 0 ? children : [new TextRun({ text: cleanText, bold: true, size: 24, color: BRAND_TEAL })]
}

// Convertit un segment de texte (avec **bold** et [picto: mot]) en TextRun/ImageRun
function renderInline(segment, pictoMap = {}) {
  const tokens = segment.split(/(\[picto:\s*[^\]]+\]|\*\*[^*]+\*\*)/gi)
  return tokens.flatMap(tok => {
    if (/^\[picto:/i.test(tok)) {
      const mot = tok.match(/\[picto:\s*([^\]]+)\]/i)?.[1]?.trim().toLowerCase()
      const b64 = pictoMap[mot]
      if (b64) return [new ImageRun({ data: b64, transformation: { width: 60, height: 60 }, type: 'png' })]
      return [new TextRun({ text: `[${mot ?? '?'}]`, italics: true, color: GRAY_TEXT, size: 20 })]
    }
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return [new TextRun({ text: tok.slice(2, -2), bold: true, size: 22 })]
    }
    return tok ? [new TextRun({ text: tok, size: 22 })] : []
  })
}

// Parse le texte AU (bold sur **verbe**, pictos en tableau, règle Même Plan)
function parseAuText(text, pictoMap = {}, withVerbPictos = false, consigneQrMap = {}) {
  if (!text) return [new Paragraph({ text: '—' })]

  const paragraphs = []
  const lines = text.split('\n')
  let lastWasPageBreak = false
  let lastWasTitle = false  // pour propager keepNext à travers le spacer suivant un titre

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    if (!trimmed) { paragraphs.push(spacer(lastWasTitle)); continue }

    // Ligne décorative → ignorée
    if (isDecorativeLine(trimmed)) { lastWasTitle = false; continue }

    if (isPageBreakMarker(trimmed)) {
      if (!lastWasPageBreak) {
        paragraphs.push(new Paragraph({ text: '', pageBreakBefore: true }))
        lastWasPageBreak = true
      }
      lastWasTitle = false
      continue
    }
    lastWasPageBreak = false

    // Ligne picto uniquement → tableau picto + zones réponse
    if (isPictoOnlyLine(trimmed)) {
      lastWasTitle = false
      const pictoMots = [...trimmed.matchAll(/\[picto:\s*([^\]]+)\]/gi)]
        .map(m => m[1].trim().toLowerCase())

      // Cherche la prochaine ligne non-vide pour les zones de réponse
      let nextIdx = i + 1
      while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx++
      const nextLine = lines[nextIdx]?.trim() ?? ''

      // Si la ligne suivante est un titre, ne pas la consommer — picto inline uniquement
      const nextIsTitle = /^(Exercice|Séance|Étape|Section|Partie)\s+\d*/i.test(nextLine)
        || /^#{1,3}\s/.test(nextLine)

      // Découpe la ligne de réponse : pipe, double-espace, ou articles
      let answerItems = nextLine.split(/\s*\|\s*/).filter(Boolean)
      if (answerItems.length < pictoMots.length) {
        answerItems = nextLine.split(/\s{2,}/).filter(Boolean)
      }
      if (answerItems.length < pictoMots.length) {
        answerItems = nextLine.split(/\s+(?=(?:un[e]?|le|la|les|du|des|l')\s)/i).filter(Boolean)
      }

      // Tableau uniquement si N pictos = N zones réponse (correspondance exacte) et suivant non-titre
      if (pictoMots.length > 0 && answerItems.length === pictoMots.length && !nextIsTitle) {
        i = nextIdx  // consomme la ligne de réponse
        // Bridge paragraph : keepNext ne chaîne pas avec Table en OOXML — ce paragraphe force le collage
        paragraphs.push(new Paragraph({ text: '', spacing: { before: 0, after: 0 }, keepNext: true }))
        paragraphs.push(buildPictoAnswerTable(pictoMots, answerItems, pictoMap))
      } else {
        // Fallback : pictos inline
        paragraphs.push(new Paragraph({
          children: pictoMots.flatMap(mot => {
            const b64 = pictoMap[mot]
            return b64
              ? [new ImageRun({ data: b64, transformation: { width: 60, height: 60 }, type: 'png' }),
                 new TextRun({ text: '  ' })]
              : [new TextRun({ text: `[${mot}]  `, italics: true, color: GRAY_TEXT, size: 20 })]
          }),
          spacing: { after: 100 },
          keepNext: true,
        }))
      }
      continue
    }

    const isTitle = /^#{1,3}\s/.test(trimmed) || /^(Exercice|Séance|Étape|Section|Partie)\s+\d*/i.test(trimmed)
    const endOfBlock = isEndOfBlock(lines, i)

    if (isTitle) {
      lastWasTitle = true
      const titleKey = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\u2014/g, ' - ')
      const consigneQr = consigneQrMap[titleKey]
      paragraphs.push(new Paragraph({
        children: [
          ...renderTitle(trimmed, pictoMap, withVerbPictos),
          ...(consigneQr ? [
            new TextRun({ text: '   ' }),
            new ImageRun({ data: consigneQr, transformation: { width: 60, height: 60 }, type: 'png' }),
            new TextRun({ text: ' écouter', size: 16, color: GRAY_TEXT, italics: true }),
          ] : []),
        ],
        spacing: { before: 200, after: 60 },
        keepNext: true,
        keepLines: true,
      }))
    } else {
      lastWasTitle = false
      paragraphs.push(new Paragraph({
        children: renderInline(trimmed, pictoMap),
        spacing: { after: 100 },
        keepLines: true,
        keepNext: !endOfBlock,
      }))
    }
  }
  return paragraphs
}

// Parse le texte des adaptations (séparé par profil via "[PROFIL] —")
function parseAdaptations(text) {
  if (!text) return [new Paragraph({ text: '—' })]

  const paragraphs = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) { paragraphs.push(spacer()); continue }

    const endOfBlock = isEndOfBlock(lines, i)

    // En-tête de profil (ex: "[DYSLEXIE] —" ou "DYSLEXIE —")
    const isProfileHeader = /^[\[A-ZÀÂÉÈÊËÎÏÔÙÛÜ\s\/]+[\]—\-:]/.test(trimmed) && trimmed.length < 80
    if (isProfileHeader) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 24, color: BRAND_TEAL })],
        spacing: { before: 240, after: 80 },
        keepNext: true,   // garde l'en-tête avec le contenu qui suit
        keepLines: true,
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 80 },
        indent: { left: 360 },
        keepLines: true,
        keepNext: !endOfBlock,
      }))
    }
  }
  return paragraphs
}

// Parse le texte de séquence (étapes numérotées, règle Même Plan)
function parseSequence(text) {
  if (!text) return [new Paragraph({ text: '—' })]

  const paragraphs = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) { paragraphs.push(spacer()); continue }

    if (isPageBreakMarker(trimmed)) {
      paragraphs.push(new Paragraph({ text: '', pageBreakBefore: true }))
      continue
    }

    const endOfBlock = isEndOfBlock(lines, i)
    const isStep = /^(Étape|Séance|Step|\d+[.):])\s/i.test(trimmed)

    if (isStep) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 24, color: BRAND_TEAL })],
        spacing: { before: 280, after: 80 },
        keepNext: true,
        keepLines: true,
      }))
    } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 60 },
        indent: { left: 360 },
        keepLines: true,
        keepNext: !endOfBlock,
      }))
    } else {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 80 },
        keepLines: true,
        keepNext: !endOfBlock,
      }))
    }
  }
  return paragraphs
}
