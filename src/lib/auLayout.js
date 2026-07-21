/**
 * Mise en page Aménagements Universels — déterministe.
 *
 * Prend le document structuré (voir api/_docSchema.js) et produit le texte AU.
 * Aucune génération : numérotation, sauts de page, gras, colonnes et espaces-
 * réponse sont calculés ici. Deux appels avec le même JSON donnent le même
 * texte, au caractère près. C'est ce qui supprime la variation entre deux runs.
 */

// Graphie unique de l'espace-réponse dans tout le document.
export const BLANC = '..........'

// Un exercice plus long que ça, et qui n'ouvre pas sa section, part en page suivante.
const LIGNES_EXERCICE_LONG = 8

// Largeur cible d'une ligne "inline" avant retour — évite le mur de texte (AU).
const LARGEUR_INLINE = 70

/** Met en gras le premier mot de la consigne (AU : verbe d'action en tête). */
export function consigneAvecVerbe(consigne) {
  const t = (consigne ?? '').trim()
  if (!t) return ''
  const m = t.match(/^([^\s.,;:!?]+)([\s\S]*)$/)
  if (!m) return t
  return `**${m[1]}**${m[2]}`
}

/**
 * Nombre de mots d'une consigne. Les marques typographiques isolées
 * (« », –, !) ne sont pas des mots : les compter ferait échouer la règle
 * des 15 mots sur des consignes parfaitement lisibles.
 */
export function longueurConsigne(consigne) {
  return (consigne ?? '')
    .trim()
    .split(/\s+/)
    .filter(t => /[\p{L}\p{N}]/u.test(t))
    .length
}

function rendreItem(item, type) {
  switch (type) {
    case 'liste':
      return item.texte ?? ''
    case 'amorces':
      return `${item.amorce ?? ''}${BLANC}${item.suffixe ?? ''}`
    case 'phrases_a_trous':
      return `${item.avant ?? ''}${BLANC}${item.apres ?? ''}`
    case 'choix':
      return `${item.avant ?? ''}( ${(item.choix ?? []).join(' – ')} )${item.apres ?? ''}`
    default:
      return item.texte || `${item.avant ?? ''}${item.apres ?? ''}`
  }
}

/** Regroupe des chaînes en lignes de n colonnes, séparées par " | ". */
function enColonnes(rendus, n) {
  const lignes = []
  for (let i = 0; i < rendus.length; i += n) {
    lignes.push(rendus.slice(i, i + n).join(' | '))
  }
  return lignes
}

/**
 * Enchaîne les items séparés par " – ".
 * Deux temps : on calcule d'abord combien de lignes la largeur cible impose,
 * puis on répartit les items également. Un remplissage glouton laisserait une
 * ligne veuve d'un seul item — mauvais repère visuel pour un élève dyslexique.
 */
function enInline(rendus) {
  if (!rendus.length) return []

  let nbLignes = 1
  let courante = ''
  for (const r of rendus) {
    const candidat = courante ? `${courante} – ${r}` : r
    if (courante && candidat.length > LARGEUR_INLINE) {
      nbLignes++
      courante = r
    } else {
      courante = candidat
    }
  }

  const parLigne = Math.ceil(rendus.length / nbLignes)
  const lignes = []
  for (let i = 0; i < rendus.length; i += parLigne) {
    lignes.push(rendus.slice(i, i + parLigne).join(' – '))
  }
  return lignes
}

/**
 * Corps d'un exercice : banque de mots, ligne picto éventuelle, items.
 * `pictos` = tableau de mots (un par item) déjà validé, ou null.
 */
function rendreCorps(ex, pictos) {
  const lignes = []
  const rendus = (ex.items ?? []).map(it => rendreItem(it, ex.type))

  if (ex.banque?.length) lignes.push(ex.banque.join(' – '))

  // Ligne picto : uniquement si un picto validé existe pour CHAQUE item et que
  // les items tiennent sur une seule ligne — exportDocx apparie 1 picto ↔ 1 item.
  const pictosComplets = pictos && pictos.length === rendus.length && pictos.every(Boolean)
  if (pictosComplets) {
    lignes.push(pictos.map(m => `[picto: ${m}]`).join(' | '))
    lignes.push(rendus.join(' | '))
    return lignes
  }

  if (ex.disposition === 'colonnes' && ex.colonnes > 1) {
    lignes.push(...enColonnes(rendus, ex.colonnes))
  } else if (ex.disposition === 'inline') {
    lignes.push(...enInline(rendus))
  } else {
    lignes.push(...rendus)
  }
  return lignes
}

/**
 * doc      : document structuré
 * options.pictos : { "<indexSection>.<indexExercice>": ["pastille", "coquille", …] }
 * Retourne { texte, consignesLongues } — consignesLongues liste les consignes
 * dépassant 15 mots, seul cas où une réécriture IA est nécessaire.
 */
export function renderAu(doc, options = {}) {
  const pictosParEx = options.pictos ?? {}
  const out = []
  const consignesLongues = []

  ;(doc.sections ?? []).forEach((sec, si) => {
    // Règle "Même Plan" : changement de thème → page suivante.
    if (si > 0) out.push('[saut_de_page]')
    if (sec.titre?.trim()) {
      out.push(`# ${sec.titre.trim()}`)
      out.push('')
    }

    // Numérotation continue dans la section, redémarrage à chaque section.
    ;(sec.exercices ?? []).forEach((ex, ei) => {
      const pictos = pictosParEx[`${si}.${ei}`] ?? null
      const corps = rendreCorps(ex, pictos)

      // Un saut ne se place JAMAIS au milieu d'un exercice : uniquement avant
      // sa consigne, et seulement s'il ne s'agit pas du premier de la section.
      if (ei > 0 && corps.length > LIGNES_EXERCICE_LONG) out.push('[saut_de_page]')

      if (longueurConsigne(ex.consigne) > 15) {
        consignesLongues.push({ section: si, exercice: ei, consigne: ex.consigne })
      }

      out.push(`Exercice ${ei + 1} — ${consigneAvecVerbe(ex.consigne)}`)
      out.push('')
      out.push(...corps)
      out.push('')
    })
  })

  // Normalise les lignes vides consécutives sans toucher aux marqueurs.
  const texte = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { texte, consignesLongues }
}
