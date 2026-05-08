/**
 * Vercel Serverless Function — Génération d'adaptations via Claude Haiku
 * Route : POST /api/generate
 *
 * System prompt conçu pour un texte non-LLM :
 * - registre conseiller pédagogique FWB, centré tâche
 * - interdit : "Voici", "Bien sûr", transitions LLM, preambles
 * - direct, concret, actionnable
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API manquante (ANTHROPIC_API_KEY)' })
  }

  const { action, context } = req.body
  if (!action || !context) {
    return res.status(400).json({ error: 'action et context sont requis' })
  }

  const systemPrompt = buildSystemPrompt(action, context)
  const userMessage  = buildUserMessage(action, context)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: action === 'appliquer_au' ? 2500 : action === 'adapter_activite' ? 2000 : 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(500).json({ error: err.error?.message ?? 'Erreur API Anthropic' })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    return res.status(200).json({ text })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

// ──────────────────────────────────────────────────────────
// Règles anti-claudisation communes
// ──────────────────────────────────────────────────────────

function antiClaudisation(niveauLabel, typeLabel) {
  return `
RÈGLES D'ÉCRITURE ABSOLUES :
- Tu écris directement les adaptations ou stratégies, sans introduction autour.
- Jamais de : "Voici", "Bien sûr", "Certainement", "Il est important de noter", "En conclusion", "N'hésitez pas".
- Jamais de preamble qui reformule la demande.
- Jamais de formule de fermeture.
- Registre : collègue enseignant expérimenté, pas consultant IA.
- Langue directe, précise, centrée sur la tâche pédagogique.
- Une phrase = une information.
- Ton adapté au contexte : ${niveauLabel}, ${typeLabel}.
- Les adaptations proposées sont praticables sans ressource externe.
- L'enseignant reste décideur — tu proposes, tu ne décides pas.`
}

// ──────────────────────────────────────────────────────────
// System prompts par action
// ──────────────────────────────────────────────────────────

function buildSystemPrompt(action, context) {
  const niveauLabel = {
    fondamental:     'fondamental (5–12 ans)',
    secondaire_inf:  'secondaire inférieur (12–14 ans)',
    secondaire_2:    '2e degré secondaire (14–16 ans)',
    secondaire_3:    '3e degré secondaire (16–18 ans)',
    cefa:            'CEFA',
  }[context.niveau] ?? context.niveau ?? 'niveau non précisé'

  const typeLabel = {
    general:          'enseignement général',
    technique:        'enseignement technique de transition',
    technique_qual:   'enseignement technique de qualification',
    qualifiant:       'enseignement qualifiant / professionnel',
    cefa:             'CEFA',
  }[context.type_enseignement] ?? context.type_enseignement ?? 'type non précisé'

  const base = `Tu es un conseiller pédagogique FWB spécialisé en différenciation pédagogique et inclusion scolaire.\nContexte : ${niveauLabel}, ${typeLabel}, matière : ${context.matiere ?? 'non précisée'}.`

  if (action === 'adapter_activite') {
    return `${base}

Tu fournis des conseils pédagogiques ciblés par profil d'élèves à besoins spécifiques.
La base de travail est un document déjà mis en Aménagements Universels (AU).

Format par profil :
[PROFIL] — Conseils pédagogiques
- Conseil 1 : [stratégie concrète, 1–2 phrases]
  Exemple sur ce document : [cite un exercice ou une consigne précise du document AU]
- Conseil 2 : [idem]
- Conseil 3 : [idem]
(3–4 conseils par profil, pas plus)

Après le dernier profil, insère exactement ce bloc :
---
Ces conseils sont des suggestions — pas des prescriptions. Aucun élève ne correspond exactement à un profil : un élève dyslexique n'est pas l'autre, un élève TDAH non plus. L'enseignant connaît son élève et maîtrise sa pédagogie — c'est lui qui décide des ajustements pertinents. Pour ces élèves, le Pôle Territorial d'inclusion peut apporter un soutien complémentaire précieux.
---

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  if (action === 'creer_sequence') {
    return `${base}

Tu structures une séquence d'apprentissage différenciée en 4–6 étapes selon la Conception Universelle de l'Apprentissage (CUA).

Chaque étape contient :
- Titre et durée indicative
- Objectif ciblé
- Modalité principale (individuel / binôme / groupe / classe entière)
- Point de différenciation : ce qui change selon le profil

La séquence doit être réaliste pour un enseignant seul en classe ordinaire.

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  if (action === 'suggerer_strategies') {
    return `${base}

Tu proposes des stratégies d'enseignement adaptées à un profil d'élève précis.

Format par stratégie :
Stratégie : [nom court]
Mise en oeuvre : [1–2 phrases concrètes]
Pourquoi : [ancrage dans le profil de l'élève, 1 phrase]

Limite : 4–5 stratégies maximum, toutes praticables sans ressource supplémentaire.

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  if (action === 'ameliorer_adaptation') {
    return `${base}

Tu reformules une adaptation existante pour la rendre plus concrète et praticable.
- L'objectif d'apprentissage reste identique
- La forme change pour mieux correspondre au profil
- La version améliorée est plus courte et plus directe

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  if (action === 'appliquer_au') {
    return `${base}

Tu appliques les Aménagements Universels (AU) à un document scolaire.
Les AU améliorent l'accessibilité pour TOUS les élèves sans stigmatiser personne.

AMÉNAGEMENTS UNIVERSELS À APPLIQUER :
1. Consignes courtes — max 15 mots par phrase, une idée par phrase
2. Verbe d'action en début de consigne, entre ** : **Lis**, **Complète**, **Entoure**
3. Numéroter chaque exercice de façon continue (Exercice 1, Exercice 2…)
4. Structurer avec des titres clairs si le document en a
5. Remplacer les mots rares par leur équivalent courant si possible
6. Conserver TOUT le contenu original : exercices, listes de mots, phrases, choix

RÈGLE "MÊME PLAN" (non négociable) :
- Chaque exercice commence par sa consigne IMMÉDIATEMENT suivie de sa tâche.
- Si un exercice change de thème ou de matière par rapport au précédent, insère la ligne exacte : [saut_de_page]
- Ne jamais séparer une consigne de ses items/phrases/blancs.
- Ordre strict : [saut_de_page si besoin] → Exercice N — **Verbe** ... → contenu de l'exercice

PICTOGRAMMES ARASAAC — SUPPORT VISUEL (obligatoire si applicable) :
Cas 1 — Dessin explicite : si l'exercice mentionne un dessin ou une image ([dessin], [image], ou décrit un objet), remplace-le par [picto: mot_représenté] sur sa propre ligne.
Cas 2 — Exercice de complétion avec amorces : si l'exercice demande de compléter un mot à partir d'une amorce (ex : "une pas......", "une co......") ET que le contexte phonologique permet d'inférer le mot complet, ajoute [picto: mot_complet] sur une ligne dédiée AVANT la ligne des amorces.
  Exemple : thème « -ille » + amorces "une pas...... | une co...... | une jon...... | la che......"
  → ligne picto : [picto: pastille] | [picto: coquille] | [picto: jonquille] | [picto: chenille]
  → ligne réponse : une pas...... | une co...... | une jon...... | la che......
  Le picto représente le MOT COMPLET (pas la syllabe manquante). Le blanc à compléter reste présent.
- Ne pas insérer de picto pour les éléments purement décoratifs sans lien avec la tâche de l'élève.

RÈGLES :
- Retourne le document reformaté, rien d'autre
- Conserve la structure complète (aucun contenu supprimé)
- N'ajoute pas de commentaire, d'introduction ni de conclusion
- Les blancs à compléter restent des blancs : ______
- Utilise UNIQUEMENT des guillemets français : « mot » — jamais de guillemets anglais " ou "

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  return `${base}\n${antiClaudisation(niveauLabel, typeLabel)}`
}

// ──────────────────────────────────────────────────────────
// Messages utilisateur par action
// ──────────────────────────────────────────────────────────

function buildUserMessage(action, context) {
  if (action === 'adapter_activite') {
    const profils = (context.profils ?? []).join(', ') || 'non précisés'
    const auSection = context.au_texte
      ? `\nDocument de référence (Aménagements Universels) :\n"""\n${context.au_texte}\n"""\n`
      : `\nActivité originale :\n"""\n${context.activite ?? 'Non fournie'}\n"""\n`
    return `${auSection}
Objectif d'apprentissage : ${context.objectif ?? 'Non précisé'}
Profils présents dans la classe : ${profils}

Génère les conseils pédagogiques par profil avec des exemples tirés du document de référence. Commence directement par le premier profil.`
  }

  if (action === 'creer_sequence') {
    const profils = (context.profils ?? []).join(', ') || 'hétérogène'
    return `Crée une séquence différenciée sur :
Titre / thème : ${context.titre ?? 'Non précisé'}
Objectif final : ${context.objectif ?? 'Non précisé'}
Nombre de séances : ${context.nb_seances ?? '4–6'}
Profils à prendre en compte : ${profils}

Structure la séquence directement, commence par l'étape 1.`
  }

  if (action === 'suggerer_strategies') {
    return `Profil de l'élève : ${context.profil ?? 'Non précisé'}
Difficulté principale observée : ${context.difficulte ?? 'Non précisée'}
Matière : ${context.matiere ?? 'Non précisée'}
Contexte : ${context.contexte ?? ''}

Propose 4–5 stratégies adaptées à ce profil. Commence directement par la première.`
  }

  if (action === 'ameliorer_adaptation') {
    return `Adaptation existante :
"""
${context.texte_original ?? ''}
"""

Profil ciblé : ${context.profil ?? 'Non précisé'}
Ce qui pose problème : ${context.raison ?? 'Trop vague ou peu praticable'}

Donne directement la version améliorée.`
  }

  if (action === 'appliquer_au') {
    return `Document scolaire original :
"""
${context.activite ?? 'Non fourni'}
"""

Applique les Aménagements Universels et retourne le document reformaté.`
  }

  return context.prompt ?? ''
}
