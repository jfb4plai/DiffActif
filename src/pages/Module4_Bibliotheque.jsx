import { useState } from 'react'
import { PROFILS, NIVEAUX } from '../lib/constants'

// Exemples validés — ancrés dans les références RISS
const EXEMPLES = [
  {
    id: 1,
    titre: 'Consigne à niveaux pour un texte argumentatif',
    matiere: 'Français',
    niveau: 'secondaire_2',
    profils: ['dyslexie', 'allophone'],
    description: 'La même tâche est proposée en 3 versions : consigne complète (classe entière), consigne simplifiée avec mots-clés surlignés (dyslexie/allophone), et consigne décomposée en étapes numérotées.',
    adaptation: `Version A (tous) : « Rédigez un texte argumentatif d'une page sur le sujet suivant... »
Version B (DYS/allophones) : Même sujet, consigne en 3 étapes :
1. Choisis ta position (pour / contre).
2. Trouve 2 arguments. Note-les.
3. Rédige un paragraphe par argument.
Format autorisé : tablette, dictée vocale ou papier.`,
    principe_cua: 'representation',
    reference: 'Fournier (2024) — dumas-04562654',
  },
  {
    id: 2,
    titre: 'Minuteur visible et tâches fragmentées (TDAH)',
    matiere: 'Mathématiques',
    niveau: 'secondaire_inf',
    profils: ['tdah'],
    description: 'Décomposer un exercice long en micro-tâches avec minuteur visible et validation entre chaque étape. Réduit la charge attentionnelle et maintient l\'engagement.',
    adaptation: `Exercice habituel (15 min) → fragmenté en 3 blocs de 5 min :
Bloc 1 (5 min) : Lecture de l'énoncé + schéma. Stop.
Bloc 2 (5 min) : Calcul de la première partie. Stop.
Bloc 3 (5 min) : Vérification + rédaction de la réponse.
Minuteur affiché au tableau. L'élève coche chaque bloc terminé.`,
    principe_cua: 'engagement',
    reference: 'Blot (2024) — dumas-04638390',
  },
  {
    id: 3,
    titre: 'Lexique illustré pour allophones',
    matiere: 'Sciences',
    niveau: 'secondaire_inf',
    profils: ['allophone'],
    description: 'Un glossaire visuel (mot + image + phrase d\'exemple) permet à l\'élève allophone d\'accéder aux concepts sans bloquer sur le vocabulaire spécialisé.',
    adaptation: `Distribué avant l'activité :
- Cellule → image de cellule → « La cellule est l'unité de base du vivant. »
- Mitose → schéma → « La mitose est la division d'une cellule en deux cellules identiques. »
L'élève peut l'utiliser pendant tout le cours. Pas de pénalité.`,
    principe_cua: 'representation',
    reference: 'Goetchel (2025) — dumas-05353601',
  },
  {
    id: 4,
    titre: 'Production orale ou visuelle (dyspraxie)',
    matiere: 'Histoire',
    niveau: 'secondaire_2',
    profils: ['dyspraxie', 'dyslexie'],
    description: 'Permettre à l\'élève de démontrer sa maîtrise autrement qu\'à l\'écrit. Oral enregistré, carte mentale numérique, ou présentation visuelle.',
    adaptation: `Tâche habituelle : résumé écrit de 200 mots.
Alternative proposée (au choix de l'élève) :
- Résumé oral de 2 min (enregistrement voix)
- Carte mentale numérique (application libre)
- 5 diapositives avec légendes courtes
L'objectif évalué reste le même : identifier les causes de l'événement.`,
    principe_cua: 'action_expression',
    reference: 'Rousseau et al. (2017) — W2949858187',
  },
  {
    id: 5,
    titre: 'Tâche ancrée dans le vécu (décrocheur)',
    matiere: 'Économie / Sciences sociales',
    niveau: 'secondaire_3',
    profils: ['decrocheur'],
    description: 'Partir d\'une situation concrète proche du vécu de l\'élève pour accrocher l\'intérêt avant d\'aborder le concept abstrait.',
    adaptation: `Avant le concept (épargne / budget) :
« Tu veux acheter un casque de 80 €. Tu gagnes 200 € par mois de job étudiant. Combien de mois faut-il épargner si tu mets 20 % de côté chaque mois ? »
→ L'élève résout d'abord. Puis on formalise la règle d'épargne.
→ Le concept abstrait émerge du problème réel.`,
    principe_cua: 'engagement',
    reference: 'Mahi Haddad & Beaud (2025) — dumas-05106961',
  },
  {
    id: 6,
    titre: 'Enrichissement pour élève HPI',
    matiere: 'Français',
    niveau: 'secondaire_2',
    profils: ['hpi'],
    description: 'Proposer une tâche enrichie (complexité, autonomie, transfert) pour un élève qui termine avant les autres, sans le faire attendre ni le transformer en aide enseignante.',
    adaptation: `Tâche de base terminée : l'élève a identifié les figures de style du poème.
Enrichissement :
« Écris une strophe supplémentaire en respectant le schéma métrique et en utilisant au moins 2 des figures identifiées. »
ou : « Compare ce poème avec un autre du même auteur — note 3 similitudes et 2 différences. »
Résultat : présenté en 2 min à la classe ou déposé dans l'espace partagé.`,
    principe_cua: 'action_expression',
    reference: 'Goetchel (2025) — dumas-05353601',
  },
  {
    id: 7,
    titre: 'Grille de calcul et calculatrice (dyscalculie)',
    matiere: 'Mathématiques',
    niveau: 'secondaire_inf',
    profils: ['dyscalculie'],
    description: 'Permettre l\'usage d\'outils compensatoires sans réduire l\'objectif : l\'élève travaille le raisonnement, pas le calcul mental.',
    adaptation: `Aménagement permanent (pas exceptionnel) :
- Calculatrice autorisée pour tout calcul de plus de 2 opérations
- Grille de tables de multiplication disponible
- Procédure en étapes affichée au tableau (visible pour tous)
Objectif évalué : la démarche de résolution, pas le résultat numérique seul.`,
    principe_cua: 'representation',
    reference: 'Huau, Jover & Roussey (2017) — hal-01792683',
  },
]

export default function Module4_Bibliotheque() {
  const [filterProfil, setFilterProfil] = useState('')
  const [filterNiveau, setFilterNiveau] = useState('')
  const [filterCua, setFilterCua]       = useState('')
  const [search, setSearch]             = useState('')
  const [ouvert, setOuvert]             = useState(null)

  const exemplesFiltres = EXEMPLES.filter(ex => {
    if (filterProfil && !ex.profils.includes(filterProfil)) return false
    if (filterNiveau && ex.niveau !== filterNiveau) return false
    if (filterCua && ex.principe_cua !== filterCua) return false
    if (search && !ex.titre.toLowerCase().includes(search.toLowerCase()) &&
        !ex.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const profilInfo = (val) => PROFILS.find(p => p.value === val)
  const niveauLabel = (val) => NIVEAUX.find(n => n.value === val)?.label ?? val
  const cuaInfo = (val) => ({
    representation:   { label: 'Représentation', icon: '👁️', color: 'bg-blue-100 text-blue-800' },
    action_expression: { label: 'Action/expression', icon: '✋', color: 'bg-purple-100 text-purple-800' },
    engagement:       { label: 'Engagement', icon: '❤️', color: 'bg-orange-100 text-orange-800' },
  }[val] ?? { label: val, icon: '•', color: 'bg-gray-100 text-gray-600' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bibliothèque</h1>
        <p className="text-gray-500 text-sm mt-1">
          Exemples d'adaptations validés par la recherche RISS — filtrables par profil, niveau, principe CUA
        </p>
      </div>

      {/* Filtres */}
      <div className="card space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Profil</label>
            <select className="input" value={filterProfil} onChange={e => setFilterProfil(e.target.value)}>
              <option value="">Tous les profils</option>
              {PROFILS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Niveau</label>
            <select className="input" value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}>
              <option value="">Tous les niveaux</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Principe CUA</label>
            <select className="input" value={filterCua} onChange={e => setFilterCua(e.target.value)}>
              <option value="">Tous les principes</option>
              <option value="representation">👁️ Représentation</option>
              <option value="action_expression">✋ Action/expression</option>
              <option value="engagement">❤️ Engagement</option>
            </select>
          </div>
        </div>
        <input
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher dans les titres et descriptions..."
        />
      </div>

      {/* Résultats */}
      <p className="text-sm text-gray-500">{exemplesFiltres.length} exemple{exemplesFiltres.length > 1 ? 's' : ''}</p>

      {exemplesFiltres.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-gray-500 text-sm">Aucun exemple ne correspond à ces filtres.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exemplesFiltres.map(ex => {
            const cua = cuaInfo(ex.principe_cua)
            const isOpen = ouvert === ex.id
            return (
              <div key={ex.id} className="card">
                <div
                  className="flex items-start gap-4 cursor-pointer"
                  onClick={() => setOuvert(isOpen ? null : ex.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`badge ${cua.color}`}>{cua.icon} {cua.label}</span>
                      {ex.profils.map(val => {
                        const p = profilInfo(val)
                        return p ? <span key={val} className={`badge ${p.color}`}>{p.icon} {p.label}</span> : null
                      })}
                      <span className="badge bg-gray-100 text-gray-600">{ex.matiere}</span>
                      <span className="badge bg-gray-100 text-gray-600">{niveauLabel(ex.niveau)}</span>
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">{ex.titre}</h3>
                    <p className="text-xs text-gray-500 mt-1">{ex.description}</p>
                  </div>
                  <span className="text-gray-400 text-lg flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Adaptation concrète
                    </h4>
                    <div className="bg-brand-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-brand-100">
                      {ex.adaptation}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Source RISS : {ex.reference}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="card bg-gray-50 border-gray-200">
        <p className="text-xs text-gray-500">
          Tous les exemples sont ancrés dans des références validées par le corpus RISS (522 627 articles francophones).
          Les références complètes sont disponibles dans la section <strong>Références</strong>.
        </p>
      </div>
    </div>
  )
}
