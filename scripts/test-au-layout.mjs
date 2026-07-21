/**
 * Non-régression de la mise en page AU.
 * node scripts/test-au-layout.mjs
 *
 * Rejoue la fixture « feuilles cursives Rx.pdf » à travers le rendu déterministe
 * et vérifie les invariants que le pipeline IA cassait auparavant.
 */
import { readFileSync } from 'node:fs'
import { renderAu, BLANC } from '../src/lib/auLayout.js'
import { validerDoc } from '../api/_docSchema.js'
import { motPictoValide, validerPictos } from '../src/lib/pictoGuard.js'
import { findDegenerateChoices, countBlanks } from '../api/_blanks.js'

const doc = JSON.parse(readFileSync(new URL('../sources pour essai/feuilles-cursives-Rx.expected.json', import.meta.url), 'utf8'))

let echecs = 0
const test = (nom, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : ' ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!ok) echecs++
}

// ── Le document de référence est structurellement sain ─────────────────
test('fixture sans anomalie structurelle', validerDoc(doc).length === 0, validerDoc(doc).join(' | '))

// ── Rendu ──────────────────────────────────────────────────────────────
const { texte, consignesLongues } = renderAu(doc)

const nbAmorces = doc.sections.flatMap(s => s.exercices).filter(e => e.type === 'amorces').flatMap(e => e.items).length
const nbTrous   = doc.sections.flatMap(s => s.exercices).filter(e => e.type === 'phrases_a_trous').flatMap(e => e.items).length
test('un espace-réponse par item à compléter', countBlanks(texte) === nbAmorces + nbTrous,
  `${countBlanks(texte)} rendus / ${nbAmorces + nbTrous} attendus`)

test('aucune réponse complétée (exercice 1 intact)',
  texte.includes(`un j${BLANC}`) && !/\bun jeu\b/.test(texte))

test('distracteurs préservés', findDegenerateChoices(texte).length === 0)
test('( plusieurs – monsieur ) intact', texte.includes('( plusieurs – monsieur )'))
test('( bleu – peu ) intact', texte.includes('( bleu – peu )'))
test('« vrille » non transformé en « ville »', texte.includes('une vrille') && !/\bune ville\b/.test(texte))

test('verbe d\'action en gras sur chaque consigne',
  texte.split('\n').filter(l => /^Exercice \d+/.test(l)).every(l => /—\s\*\*\S+\*\*/.test(l)))

test('numérotation redémarrée à chaque section',
  (texte.match(/^Exercice 1 —/gm) || []).length === 2)

test('changement de thème → saut de page',
  /\[saut_de_page\]\n# Le son « ill »/.test(texte))

test('aucun saut de page au milieu d\'un exercice',
  texte.split('\n').every((l, i, a) => {
    if (l.trim() !== '[saut_de_page]') return true
    const suiv = a.slice(i + 1).find(x => x.trim())?.trim() ?? ''
    return /^#\s/.test(suiv) || /^Exercice \d+/.test(suiv)
  }))

test('séparateurs de colonnes conservés', texte.includes(`une pas${BLANC} | une co${BLANC}`))
test('banque de mots conservée', texte.includes('fleurs – œuf – heure – beurre – jeu – aspirateur – queue – bleu'))
// Les 22 graphèmes doivent survivre dans l'ordre, quel que soit le retour à la ligne.
const exEntoure = doc.sections[1].exercices[1]
const attendus = exEntoure.items.map(i => i.texte)
const lignesDoc = texte.split('\n')
const debut = lignesDoc.findIndex(l => /^Exercice 2 — \*\*Entoure\*\*/.test(l))
const fin = lignesDoc.findIndex((l, i) => i > debut && /^Exercice 3 —/.test(l))
const rendus = lignesDoc
  .slice(debut + 1, fin)
  .filter(l => l.trim())
  .join(' – ')
  .split(' – ')
test('22 graphèmes de l\'exercice « Entoure » conservés, dans l\'ordre',
  rendus.join('|') === attendus.join('|'), `${rendus.length} rendus / 22`)

test('aucune consigne au-delà de 15 mots', consignesLongues.length === 0,
  consignesLongues.map(c => c.consigne).join(' | '))

// ── Déterminisme ───────────────────────────────────────────────────────
test('deux rendus identiques au caractère près', renderAu(doc).texte === texte)

// ── Garde-fou picto ────────────────────────────────────────────────────
test('« colline » rejeté sur amorce « une co » / graphème « ill »',
  motPictoValide('colline', 'une co', 'ill') === false)
test('« coquille » accepté', motPictoValide('coquille', 'une co', 'ill') === true)
test('« papillon » rejeté sur amorce « une co »', motPictoValide('papillon', 'une co', 'ill') === false)

const exPicto = doc.sections[1].exercices[2]
test('4 pictos justes validés',
  validerPictos(['pastille', 'coquille', 'jonquille', 'chenille'], exPicto.items, 'ill').every(Boolean))
const partiel = validerPictos(['pastille', 'colline', 'jonquille', 'chenille'], exPicto.items, 'ill')
test('un picto faux → l\'exercice retombe sans picto', partiel.some(m => m === null))

// ── Rendu avec pictos ──────────────────────────────────────────────────
const avecPictos = renderAu(doc, { pictos: { '1.2': ['pastille', 'coquille', 'jonquille', 'chenille'] } }).texte
test('ligne picto unique, autant de pictos que d\'amorces',
  avecPictos.includes('[picto: pastille] | [picto: coquille] | [picto: jonquille] | [picto: chenille]'))
test('les amorces restent intactes sous les pictos',
  avecPictos.includes(`une pas${BLANC} | une co${BLANC} | une jon${BLANC} | la che${BLANC}`))

// ── Détection des régressions connues ──────────────────────────────────
const corrompu = JSON.parse(JSON.stringify(doc))
corrompu.sections[0].exercices[2].items[3].choix = ['plusieurs', 'plusieurs']
test('un distracteur écrasé est détecté', validerDoc(corrompu).some(a => a.includes('options identiques')))

const complete = JSON.parse(JSON.stringify(doc))
complete.sections[1].exercices[2].items[1].amorce = 'une coquille'
test('une réponse recopiée dans l\'amorce est détectée',
  validerDoc(complete).some(a => a.includes('a probablement été complétée')))

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : echecs + ' contrôle(s) en échec.'}`)
process.exit(echecs === 0 ? 0 : 1)
