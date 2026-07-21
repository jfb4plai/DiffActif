/**
 * Validation des mots-pictogrammes.
 *
 * Le mot d'un picto n'est jamais accepté sur la seule proposition de l'IA :
 * il doit satisfaire deux conditions vérifiables. C'est ce qui empêche
 * « colline » de s'afficher sous une amorce « co » dans un exercice sur « ill ».
 */

/** Radical d'une amorce : le dernier morceau, article et apostrophe retirés. */
export function radicalAmorce(amorce) {
  return String(amorce ?? '')
    .trim()
    .toLowerCase()
    .split(/[\s']+/)
    .filter(Boolean)
    .pop() ?? ''
}

/**
 * Un mot n'est retenu que si :
 *  (a) il commence par le radical de l'amorce ;
 *  (b) il contient le graphème du thème de la section.
 * Sans graphème (exercice non phonologique), seule (a) s'applique.
 */
export function motPictoValide(mot, amorce, grapheme) {
  const m = String(mot ?? '').trim().toLowerCase()
  if (!m) return false

  const radical = radicalAmorce(amorce)
  if (radical && !m.startsWith(radical)) return false

  const g = String(grapheme ?? '').trim().toLowerCase()
  if (g && !m.includes(g)) return false

  return true
}

/**
 * Filtre une proposition de mots contre les items d'un exercice.
 * Retourne un tableau de même longueur : le mot validé, ou null.
 * Un seul null suffit à faire retomber l'exercice sur un rendu sans picto —
 * mieux vaut aucun picto qu'un picto qui ne correspond pas à la réponse.
 */
export function validerPictos(mots, items, grapheme) {
  return (items ?? []).map((it, i) => {
    const mot = mots?.[i]
    return motPictoValide(mot, it.amorce, grapheme) ? String(mot).trim().toLowerCase() : null
  })
}
