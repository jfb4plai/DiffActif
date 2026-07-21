/**
 * Schéma du document scolaire structuré.
 *
 * Le point de ce schéma n'est pas de décrire le document : c'est de rendre
 * certaines fautes INEXPRIMABLES.
 *  - Un espace-réponse n'est pas une chaîne, c'est l'absence de champ :
 *    une amorce a `amorce` + `suffixe`, jamais de « réponse ». Le modèle
 *    n'a nulle part où écrire « pastille ».
 *  - Un exercice à choix a un tableau `choix`. Deux options identiques se
 *    détectent en une comparaison, pas en relisant de la prose.
 *  - La mise en page (numérotation, sauts de page, gras, colonnes) n'est
 *    pas dans le schéma : elle est calculée en JS. Le modèle ne la produit pas,
 *    donc il ne peut pas la rater.
 *
 * Contraintes du sous-ensemble JSON Schema accepté par l'API :
 * `additionalProperties: false` partout, tous les champs `required`
 * (les champs non pertinents valent "" / [] / false), pas de récursivité.
 */

const ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['texte', 'amorce', 'suffixe', 'avant', 'apres', 'choix', 'dessin'],
  properties: {
    texte:   { type: 'string', description: 'Mot ou expression complète (type "liste"). Sinon "".' },
    amorce:  { type: 'string', description: 'Lettres AVANT l\'espace-réponse (type "amorces"). Ex : "une pas". Sinon "".' },
    suffixe: { type: 'string', description: 'Lettres APRÈS l\'espace-réponse. Ex : "un b......f" → suffixe "f". Sinon "".' },
    avant:   { type: 'string', description: 'Texte avant le trou ou le choix (types "phrases_a_trous" et "choix"). Sinon "".' },
    apres:   { type: 'string', description: 'Texte après le trou ou le choix. Sinon "".' },
    choix:   { type: 'array', items: { type: 'string' }, description: 'Options du type "choix", dans l\'ordre du document. Sinon [].' },
    dessin:  { type: 'boolean', description: 'true si un dessin ou une image accompagne cet item dans le document original.' },
  },
}

const EXERCICE = {
  type: 'object',
  additionalProperties: false,
  required: ['consigne', 'type', 'disposition', 'colonnes', 'banque', 'items'],
  properties: {
    consigne: { type: 'string', description: 'La consigne, sans son numéro. Ex : "Lis ces mots."' },
    type: {
      type: 'string',
      enum: ['liste', 'amorces', 'phrases_a_trous', 'choix', 'libre'],
      description: 'liste = mots à lire/observer · amorces = mot à compléter à partir de ses premières lettres · phrases_a_trous = phrase avec un blanc · choix = "( a – b )" · libre = autre',
    },
    disposition: {
      type: 'string',
      enum: ['colonnes', 'lignes', 'inline'],
      description: 'colonnes = grille · lignes = un item par ligne · inline = items enchaînés séparés par des tirets',
    },
    colonnes: { type: 'integer', description: 'Nombre de colonnes si disposition="colonnes", sinon 0.' },
    banque:   { type: 'array', items: { type: 'string' }, description: 'Liste de mots fournie à l\'élève pour compléter (ex : "fleurs – œuf – heure…"). Sinon [].' },
    items:    { type: 'array', items: ITEM },
  },
}

export const DOC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sections'],
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titre', 'grapheme', 'exercices'],
        properties: {
          titre:    { type: 'string', description: 'Titre de la feuille ou de la section. Ex : "Le son « ill »".' },
          grapheme: { type: 'string', description: 'Pour un exercice de phonologie : le graphème traité, en minuscules, sans guillemets. Ex : "ill". Sinon "".' },
          exercices: { type: 'array', items: EXERCICE },
        },
      },
    },
  },
}

/**
 * Nettoyages typographiques déterministes appliqués après lecture.
 * Ce ne sont pas des corrections de contenu : aucun mot n'est ajouté,
 * supprimé ni remplacé. Uniquement des espaces mal placés.
 *
 * Ce passage fait aussi office d'absorbeur de variation : `temperature: 0`
 * rend la lecture quasi-déterministe, pas strictement — le résidu observé
 * porte uniquement sur des espaces. Les normaliser rend deux lectures du même
 * scan identiques au caractère près.
 */
export function normaliserDoc(doc) {
  // Pas d'espace après une apostrophe élidée : "regarde l' ......" → "regarde l'......"
  const finApostrophe = s => String(s ?? '').replace(/(['’])\s+$/, '$1')
  // Ni avant : "...... 'heure" ne se produit pas, mais un espace double, si.
  const espaces = s => String(s ?? '').replace(/[ \t]{2,}/g, ' ')
  // Pas d'espace devant un point ou une virgule (l'usage français en met
  // devant ! ? ; : — d'où la restriction à . et , uniquement).
  const ponctuation = s => String(s ?? '').replace(/^[ \t]+([.,])/, '$1')

  // Ligature œ. Liste fermée : "oeu" n'est pas toujours "œu" (moelle, poêle),
  // donc on ne remplace que dans des mots dont l'orthographe est certaine.
  const LIGATURES = [
    'oeuf', 'oeufs', 'boeuf', 'boeufs', 'coeur', 'coeurs', 'soeur', 'soeurs',
    'noeud', 'noeuds', 'voeu', 'voeux', 'oeuvre', 'oeuvres', 'manoeuvre', 'manoeuvres',
    'oeil', 'oeillet', 'oeillets', 'choeur', 'choeurs', 'moeurs', 'oesophage',
  ]
  // Tiret de séparation entre graphies : demi-cadratin, pas trait d'union.
  // Un tiret ENTOURÉ D'ESPACES n'est jamais un mot composé — remplacement sûr.
  const tiret = s => String(s ?? '').replace(/ +- +/g, ' – ')

  const RE_LIGATURE = new RegExp(`\\b(${LIGATURES.join('|')})\\b`, 'gi')
  const ligature = s => String(s ?? '').replace(RE_LIGATURE, m => {
    const remplace = m.replace(/oe/i, m.startsWith('O') ? 'Œ' : 'œ')
    return remplace
  })

  for (const sec of doc?.sections ?? []) {
    sec.titre = tiret(ligature(espaces(sec.titre).trim()))
    for (const ex of sec.exercices ?? []) {
      ex.consigne = tiret(ligature(espaces(ex.consigne).trim()))
      ex.banque = (ex.banque ?? []).map(m => ligature(espaces(m).trim()))
      for (const it of ex.items ?? []) {
        it.avant   = ligature(finApostrophe(espaces(it.avant)))
        it.amorce  = finApostrophe(espaces(it.amorce))
        it.apres   = ligature(ponctuation(espaces(it.apres)))
        it.suffixe = espaces(it.suffixe)
        it.texte   = ligature(espaces(it.texte).trim())
        it.choix   = (it.choix ?? []).map(c => ligature(espaces(c).trim()))
      }
    }
  }
  return doc
}

/**
 * Rendu fidèle du document source, sans aucun aménagement.
 * Sert à afficher à l'enseignant ce que la lecture a compris, pour qu'il le
 * compare à son original avant de générer quoi que ce soit.
 */
export function renderSource(doc, blanc = '..........') {
  const out = []
  for (const sec of doc?.sections ?? []) {
    if (sec.titre?.trim()) out.push(sec.titre.trim(), '')
    ;(sec.exercices ?? []).forEach((ex, i) => {
      out.push(`${i + 1}. ${ex.consigne ?? ''}`)
      if (ex.banque?.length) out.push(ex.banque.join(' – '))
      for (const it of ex.items ?? []) {
        if (ex.type === 'liste') out.push(it.texte ?? '')
        else if (ex.type === 'amorces') out.push(`${it.amorce ?? ''}${blanc}${it.suffixe ?? ''}`)
        else if (ex.type === 'phrases_a_trous') out.push(`${it.avant ?? ''}${blanc}${it.apres ?? ''}`)
        else if (ex.type === 'choix') out.push(`${it.avant ?? ''}( ${(it.choix ?? []).join(' – ')} )${it.apres ?? ''}`)
        else out.push(it.texte || `${it.avant ?? ''}${it.apres ?? ''}`)
      }
      out.push('')
    })
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Contrôles structurels post-extraction. Retourne une liste d'anomalies.
 * Ce sont des faits vérifiables, pas des jugements de qualité.
 */
export function validerDoc(doc) {
  const anomalies = []
  if (!doc?.sections?.length) return ['Aucune section détectée dans le document.']

  doc.sections.forEach((sec, si) => {
    const ou = sec.titre ? `« ${sec.titre} »` : `section ${si + 1}`
    if (!sec.exercices?.length) anomalies.push(`${ou} : aucun exercice détecté.`)

    sec.exercices?.forEach((ex, ei) => {
      const oux = `${ou}, exercice ${ei + 1}`
      if (!ex.consigne?.trim()) anomalies.push(`${oux} : consigne vide.`)
      if (!ex.items?.length) anomalies.push(`${oux} : aucun item.`)

      ex.items?.forEach((it, ii) => {
        const oui = `${oux}, item ${ii + 1}`
        if (ex.type === 'choix') {
          if ((it.choix?.length ?? 0) < 2) {
            anomalies.push(`${oui} : exercice à choix avec moins de deux options.`)
          } else {
            const norm = s => s.trim().toLowerCase()
            const uniques = new Set(it.choix.map(norm))
            if (uniques.size !== it.choix.length) {
              anomalies.push(`${oui} : options identiques « ${it.choix.join(' – ')} » — le distracteur a été écrasé.`)
            }
          }
        }
        if (ex.type === 'amorces' && !it.amorce?.trim()) {
          anomalies.push(`${oui} : amorce vide.`)
        }
        if (ex.type === 'liste' && !it.texte?.trim()) {
          anomalies.push(`${oui} : mot vide.`)
        }
      })

      // Un mot complet là où le schéma attend une amorce = une réponse recopiée.
      if (ex.type === 'amorces' && sec.grapheme) {
        ex.items?.forEach((it, ii) => {
          if (it.amorce?.toLowerCase().includes(sec.grapheme.toLowerCase())) {
            anomalies.push(`${oux}, item ${ii + 1} : l'amorce « ${it.amorce} » contient déjà le graphème « ${sec.grapheme} » — la réponse a probablement été complétée.`)
          }
        })
      }
    })
  })
  return anomalies
}
