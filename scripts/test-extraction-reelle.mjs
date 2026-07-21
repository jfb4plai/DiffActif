/**
 * Contrôle de fidélité de la lecture, sur un vrai scan.
 * node scripts/test-extraction-reelle.mjs
 *
 * Consomme des tokens (un appel Vision). À lancer quand le prompt de lecture
 * ou le schéma changent, pas à chaque build.
 *
 * Compare la sortie de la lecture IA à la transcription de référence relevée
 * à la main. Le score de fidélité est mesuré, pas affirmé.
 */
import { readFileSync } from 'node:fs'
import { SYSTEM_LECTURE } from '../api/_lecturePrompt.js'
import { DOC_SCHEMA, validerDoc, normaliserDoc } from '../api/_docSchema.js'

const racine = new URL('../', import.meta.url)
const key = readFileSync(new URL('.env', racine), 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim()
if (!key) { console.error('ANTHROPIC_API_KEY absente de .env'); process.exit(1) }

const pdf = readFileSync(new URL('sources pour essai/feuilles cursives Rx.pdf', racine)).toString('base64')
const ref = JSON.parse(readFileSync(new URL('sources pour essai/feuilles-cursives-Rx.expected.json', racine), 'utf8'))

const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    temperature: 0,
    system: SYSTEM_LECTURE,
    output_config: { format: { type: 'json_schema', schema: DOC_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } },
        { type: 'text', text: 'Décris ce document scolaire sous forme structurée.' },
      ],
    }],
  }),
})

if (!resp.ok) {
  console.error('HTTP', resp.status, JSON.stringify(await resp.json(), null, 2))
  process.exit(1)
}
const data = await resp.json()
console.log(`stop_reason: ${data.stop_reason} · sortie: ${data.usage.output_tokens} tokens\n`)

const doc = normaliserDoc(JSON.parse(data.content.find(b => b.type === 'text').text))

// ── Anomalies structurelles ────────────────────────────────────────────
const anomalies = validerDoc(doc)
console.log(anomalies.length ? 'Anomalies :\n  ' + anomalies.join('\n  ') + '\n' : 'Aucune anomalie structurelle.\n')

// ── Comparaison à la référence ─────────────────────────────────────────
// Tout ce qui figure sur la feuille est comparé, pas seulement les items :
// un titre faux (« ou » au lieu de « eu ») rend l'exercice entier absurde et
// passait inaperçu quand seuls les items étaient contrôlés.
const applatir = d => (d.sections ?? []).flatMap((s, si) => [
  [`${si} titre`, 'section', JSON.stringify(s.titre)],
  [`${si} graphème`, 'section', JSON.stringify(s.grapheme)],
  ...(s.exercices ?? []).flatMap((e, ei) => [
    [`${si}.${ei} consigne`, 'exercice', JSON.stringify(e.consigne)],
    [`${si}.${ei} format`, 'exercice', JSON.stringify([e.type, e.disposition, e.colonnes])],
    [`${si}.${ei} banque`, 'exercice', JSON.stringify(e.banque)],
    ...(e.items ?? []).map((it, ii) => [
      `${si}.${ei}.${ii}`,
      e.type,
      JSON.stringify([it.texte, it.amorce, it.suffixe, it.avant, it.apres, it.choix]),
    ]),
  ]),
])

const refItems = applatir(ref)
const gotItems = applatir(doc)
const gotMap = new Map(gotItems.map(([k, , v]) => [k, v]))

let justes = 0
const ecarts = []
for (const [k, type, attendu] of refItems) {
  const obtenu = gotMap.get(k)
  if (obtenu === attendu) justes++
  else ecarts.push(`  ${k} (${type})\n     attendu : ${attendu}\n     obtenu  : ${obtenu ?? '— item absent —'}`)
}

const score = refItems.length ? (100 * justes / refItems.length) : 0
console.log(`Structure : ${doc.sections?.length ?? 0} section(s) / ${ref.sections.length} attendues`)
console.log(`Champs    : ${gotItems.length} lus / ${refItems.length} attendus`)
console.log(`Fidélité  : ${justes}/${refItems.length} champs identiques (${score.toFixed(1)} %)\n`)
if (ecarts.length) console.log('Écarts :\n' + ecarts.join('\n'))

// ── Régressions nommées ────────────────────────────────────────────────
const tousChoix = (doc.sections ?? []).flatMap(s => s.exercices ?? []).filter(e => e.type === 'choix').flatMap(e => e.items ?? [])
const degeneres = tousChoix.filter(it => new Set((it.choix ?? []).map(c => c.trim().toLowerCase())).size !== (it.choix ?? []).length)
console.log(`\nDistracteurs écrasés : ${degeneres.length} ${degeneres.length ? JSON.stringify(degeneres.map(d => d.choix)) : '(aucun)'}`)

const amorces = (doc.sections ?? []).flatMap(s => (s.exercices ?? []).filter(e => e.type === 'amorces').flatMap(e => (e.items ?? []).map(it => ({ a: it.amorce, g: s.grapheme }))))
const completees = amorces.filter(({ a, g }) => g && a?.toLowerCase().includes(g.toLowerCase()))
console.log(`Réponses complétées  : ${completees.length} ${completees.length ? JSON.stringify(completees.map(c => c.a)) : '(aucune)'}`)

process.exitCode = (score >= 95 && !degeneres.length && !completees.length) ? 0 : 1
