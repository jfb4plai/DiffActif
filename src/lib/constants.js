// Niveaux d'enseignement FWB
export const NIVEAUX = [
  { value: 'fondamental',    label: 'Fondamental (5–12 ans)' },
  { value: 'secondaire_inf', label: 'Secondaire inférieur (12–14 ans)' },
  { value: 'secondaire_2',   label: '2e degré secondaire (14–16 ans)' },
  { value: 'secondaire_3',   label: '3e degré secondaire (16–18 ans)' },
  { value: 'cefa',           label: 'CEFA' },
]

// Types d'enseignement FWB
export const TYPES_ENSEIGNEMENT = [
  { value: 'general',       label: 'Général' },
  { value: 'technique',     label: 'Technique de transition' },
  { value: 'technique_qual',label: 'Technique de qualification' },
  { value: 'qualifiant',    label: 'Qualifiant / professionnel' },
  { value: 'cefa',          label: 'CEFA' },
]

// Matières
export const MATIERES = [
  'Français', 'Mathématiques', 'Sciences', 'Histoire', 'Géographie',
  'Langues modernes', 'Arts plastiques', 'Éducation physique',
  'Cours philosophiques', 'Sciences économiques', 'Informatique',
  'Sciences sociales', 'Autre',
]

// Profils DYS / besoins éducatifs particuliers
export const PROFILS = [
  {
    value: 'dyslexie',
    label: 'Dyslexie / Dysorthographie',
    icon: '📖',
    color: 'bg-blue-100 text-blue-800',
    strategies_cles: ['Texte adapté (police, interligne)', 'Support audio', 'Consignes courtes et numérotées', 'Correcteur orthographique autorisé'],
  },
  {
    value: 'dyscalculie',
    label: 'Dyscalculie',
    icon: '🔢',
    color: 'bg-purple-100 text-purple-800',
    strategies_cles: ['Matériel manipulable', 'Grille de calcul', 'Calculatrice autorisée', 'Procédure en étapes visibles'],
  },
  {
    value: 'dyspraxie',
    label: 'Dyspraxie / Trouble DCD',
    icon: '✏️',
    color: 'bg-yellow-100 text-yellow-800',
    strategies_cles: ['Réduire la mise en page', 'Outil numérique pour écrire', 'Délai supplémentaire', 'Éviter la copie au tableau'],
  },
  {
    value: 'tdah',
    label: 'TDAH',
    icon: '⚡',
    color: 'bg-orange-100 text-orange-800',
    strategies_cles: ['Tâches courtes fragmentées', 'Minuteur visible', 'Place privilégiée', 'Consigne une à une'],
  },
  {
    value: 'allophone',
    label: 'Allophone',
    icon: '🌍',
    color: 'bg-green-100 text-green-800',
    strategies_cles: ['Lexique illustré', 'Consignes reformulées', 'Support visuel', 'Temps supplémentaire'],
  },
  {
    value: 'decrocheur',
    label: 'Décrocheur / désengagé',
    icon: '🔗',
    color: 'bg-red-100 text-red-800',
    strategies_cles: ['Ancrage dans le vécu', 'Tâche courte avec résultat visible', 'Choix d\'activité', 'Valorisation des acquis'],
  },
  {
    value: 'hpi',
    label: 'HPI / Haut potentiel',
    icon: '🌟',
    color: 'bg-indigo-100 text-indigo-800',
    strategies_cles: ['Enrichissement', 'Projet autonome', 'Rôle de tuteur', 'Question ouverte complexe'],
  },
]

// Principes CUA (Conception Universelle de l'Apprentissage)
// Source RISS : Rusconi (2025) W4414205903 ; Alvarez (2024) W4402615917
export const PRINCIPES_CUA = [
  {
    id: 'representation',
    label: 'Représentation',
    description: 'Varier les formes de présentation de l\'information',
    icon: '👁️',
    exemples: ['Texte + image', 'Vidéo sous-titrée', 'Schéma + texte', 'Audio'],
  },
  {
    id: 'action_expression',
    label: 'Action et expression',
    description: 'Varier les modalités de production et de démonstration',
    icon: '✋',
    exemples: ['Oral / écrit / dessin', 'Numérique / papier', 'Individuel / collectif'],
  },
  {
    id: 'engagement',
    label: 'Engagement',
    description: 'Soutenir la motivation et l\'implication',
    icon: '❤️',
    exemples: ['Ancrage dans le vécu', 'Choix d\'activité', 'Objectif explicite', 'Feedback immédiat'],
  },
]

// Niveaux de maîtrise de la différenciation (onboarding)
export const NIVEAUX_MAITRISE = [
  {
    value: 'debutant',
    label: 'Je démarre',
    icon: '🌱',
    description: 'Je connais peu la différenciation, je veux des stratégies prêtes à l\'emploi.',
  },
  {
    value: 'intermediaire',
    label: 'Je pratique',
    icon: '🌿',
    description: 'Je différencie parfois mais sans cadre systématique.',
  },
  {
    value: 'avance',
    label: 'Je maîtrise',
    icon: '🌳',
    description: 'Je différencie régulièrement et je veux structurer ou formaliser ma pratique.',
  },
]

// Références scientifiques RISS validées
export const REFERENCES_RISS = [
  {
    id: 'rusconi_2025',
    auteur: 'Rusconi, L.',
    annee: 2025,
    titre: 'La conception universelle de l\'apprentissage (CUA) dans la formation des enseignants',
    riss_id: 'W4414205903',
    doi: '10.51363/unifr.lth.2025.045',
    concept: 'CUA / UDL',
    utilisation: [
      { module: 'Module 3 — Séquence', detail: 'Structure des séquences différenciées selon les 3 principes CUA' },
      { module: 'Tableau de bord', detail: 'Rappel des 3 principes CUA affiché à chaque connexion' },
    ],
  },
  {
    id: 'alvarez_2024',
    auteur: 'Alvarez, L.',
    annee: 2024,
    titre: 'La conception universelle de l\'apprentissage',
    riss_id: 'W4402615917',
    doi: '10.57161/r2024-03-01',
    concept: 'CUA / UDL',
    utilisation: [
      { module: 'Module 2 — Adapter', detail: 'Les 3 axes (représentation, action/expression, engagement) guident la génération IA' },
      { module: 'Module 4 — Bibliothèque', detail: 'Filtre par principe CUA sur les exemples' },
    ],
  },
  {
    id: 'fournier_2024',
    auteur: 'Fournier, M.',
    annee: 2024,
    titre: 'Les adaptations pédagogiques de l\'enseignant pour les élèves ayant des troubles « dys »',
    riss_id: 'dumas-04562654',
    concept: 'DYS — adaptations',
    utilisation: [
      { module: 'Module 1 — Profils', detail: 'Stratégies-clés affichées pour chaque profil DYS' },
      { module: 'Module 2 — Adapter', detail: 'Ancrage scientifique des variantes générées pour les profils dyslexie/dyspraxie/dyscalculie' },
      { module: 'Module 4 — Bibliothèque', detail: 'Source des exemples d\'adaptations DYS' },
    ],
  },
  {
    id: 'blot_2024',
    auteur: 'Blot, T.',
    annee: 2024,
    titre: 'Pratiques enseignantes dans le secondaire : analyse de la différenciation en cours de langues',
    riss_id: 'dumas-04638390',
    concept: 'Différenciation — secondaire',
    utilisation: [
      { module: 'Module 5 — Progression', detail: 'Indicateurs de la dimension "Adaptation du contenu" de la grille d\'auto-évaluation' },
      { module: 'Module 4 — Bibliothèque', detail: 'Source de l\'exemple "Minuteur et tâches fragmentées" (TDAH)' },
    ],
  },
  {
    id: 'goetchel_2025',
    auteur: 'Goetchel, E-M.',
    annee: 2025,
    titre: 'Diversité des profils, unité dans l\'apprentissage : la différenciation pédagogique',
    riss_id: 'dumas-05353601',
    concept: 'Différenciation — profils',
    utilisation: [
      { module: 'Module 5 — Progression', detail: 'Grille d\'auto-évaluation de la pratique différenciée (5 dimensions)' },
      { module: 'Module 4 — Bibliothèque', detail: 'Source des exemples "Consigne à niveaux" et "Enrichissement HPI"' },
    ],
  },
  {
    id: 'mahi_haddad_2025',
    auteur: 'Mahi Haddad, S. & Beaud, M.',
    annee: 2025,
    titre: 'L\'IA au service de la différenciation pédagogique dans l\'enseignement des mathématiques',
    riss_id: 'dumas-05106961',
    concept: 'IA + différenciation',
    utilisation: [
      { module: 'Module 2 — Adapter', detail: 'Justification du modèle 80% IA / 20% enseignant et de l\'anonymat des codes élèves' },
      { module: 'Module 4 — Bibliothèque', detail: 'Source de l\'exemple "Tâche ancrée dans le vécu" (décrocheur)' },
    ],
  },
  {
    id: 'huau_2017',
    auteur: 'Huau, A., Jover, M. & Roussey, J-Y.',
    annee: 2017,
    titre: 'Difficultés associées et scolarisation des enfants dyslexiques',
    riss_id: 'hal-01792683',
    doi: '10.3917/nras.077.0169',
    concept: 'Dyslexie — scolarisation',
    utilisation: [
      { module: 'Module 1 — Profils', detail: 'Caractéristiques du profil Dyslexie/Dysorthographie et stratégies-clés associées' },
      { module: 'Module 4 — Bibliothèque', detail: 'Source de l\'exemple "Grille de calcul et calculatrice" (dyscalculie)' },
    ],
  },
  {
    id: 'rousseau_2017',
    auteur: 'Rousseau, N. et al.',
    annee: 2017,
    titre: 'Les apports et les limites liés aux pratiques inclusives : une métasynthèse',
    riss_id: 'W2949858187',
    doi: '10.24452/sjer.39.1.4997',
    concept: 'Inclusion — métasynthèse',
    utilisation: [
      { module: 'Module 4 — Bibliothèque', detail: 'Source de l\'exemple "Production orale ou visuelle" (dyspraxie)' },
      { module: 'Module 5 — Progression', detail: 'Indicateurs de la dimension "Pratiques inclusives / collaboration"' },
    ],
  },
]
