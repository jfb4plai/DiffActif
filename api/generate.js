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
        max_tokens: 1200,
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

Tu génères des adaptations concrètes d'une activité pour des profils d'élèves identifiés (DYS, TDAH, allophone, décrocheur, HPI).

Chaque adaptation suit ce format :
[PROFIL] — Adaptation (2–4 phrases max)
- Ce que l'enseignant modifie dans la consigne ou le support
- Ce que l'enseignant garde identique (objectif d'apprentissage)
- L'ajustement de forme (pas de fond) qui rend l'activité accessible

Principes directeurs (CUA — Alvarez 2024) :
- Représentation : varier la forme des informations transmises
- Action/expression : varier les modalités de production
- Engagement : réduire les obstacles à la participation

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

  return `${base}\n${antiClaudisation(niveauLabel, typeLabel)}`
}

// ──────────────────────────────────────────────────────────
// Messages utilisateur par action
// ──────────────────────────────────────────────────────────

function buildUserMessage(action, context) {
  if (action === 'adapter_activite') {
    const profils = (context.profils ?? []).join(', ') || 'non précisés'
    return `Activité originale :
"""
${context.activite ?? 'Non fournie'}
"""

Objectif d'apprentissage : ${context.objectif ?? 'Non précisé'}
Profils présents dans la classe : ${profils}

Génère une adaptation par profil mentionné. Commence directement par le premier profil.`
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

  return context.prompt ?? ''
}
