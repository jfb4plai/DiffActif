/**
 * Vercel Serverless Function — Génération d'adaptations via Claude Haiku
 * Route : POST /api/generate
 *
 * System prompt conçu pour un texte non-LLM :
 * - registre conseiller pédagogique FWB, centré tâche
 * - interdit : "Voici", "Bien sûr", transitions LLM, preambles
 * - direct, concret, actionnable
 */

import { requireUser } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  const user = await requireUser(req, res)
  if (!user) return

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

  // Proposition de mots-pictos : sortie JSON imposée par l'API, puis validée
  // côté client contre l'amorce et le graphème (voir src/lib/pictoGuard.js).
  const outputConfig = action === 'proposer_pictos'
    ? {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['mots'],
            properties: {
              mots: {
                type: 'array',
                items: { type: 'string' },
                description: 'Un mot par amorce, dans le même ordre. Chaîne vide si aucun mot certain.',
              },
            },
          },
        },
      }
    : null

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
        max_tokens: action === 'appliquer_au' ? 4096 : action === 'adapter_activite' ? 2000 : action === 'verifier_exercice' ? 800 : 1200,
        // temperature: 0 — sans ça, deux passages du même document divergent.
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        ...(outputConfig ? { output_config: outputConfig } : {}),
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      if (response.status === 529 || err.error?.type === 'overloaded_error') {
        return res.status(503).json({ error: 'API surchargée — réessayez dans quelques secondes.' })
      }
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
La base de travail est le document fourni — avec ou sans Aménagements Universels préalables.

Format par profil :
[PROFIL] — Conseils pédagogiques
- Conseil 1 : [stratégie concrète, 1–2 phrases] (Auteur, année si source RISS applicable)
  Exemple sur ce document : [cite un exercice ou une consigne précise du document AU]
- Conseil 2 : [idem]
- Conseil 3 : [idem]
(3–4 conseils par profil, pas plus)

Quand un conseil s'appuie directement sur une source ci-dessous, ajoute (Auteur, année) en fin de ligne — uniquement si le lien est réel.

SOURCES RISS disponibles :
Dyslexie/Dysorthographie : Pattaro (2023) dumas-04361111 · Barbe et al. (2022) dumas-03978495 · Vadant (2025) dumas-05446436
TDAH : Bourgeois (2024) dumas-04903104 · Fosseux (2014) dumas-01072147
Dyscalculie : Thibaut (2016) dumas-01488139 · Le Cam & Toussaint (2017) dumas-01549091
Allophone : Bruisse et al. (2019) dumas-02159822 · Pégon Cachard-Berger (2021) dumas-03613125
Décrocheur : Fromaget (2020) dumas-02867520 · Mons et al. (2017) hal-04622700
HPI : Masson (2024) dumas-05293977 · Cuadrado et al. (2023) hal-04108902
Dyspraxie : Brenot (2025) dumas-05410646 · Azzimani (2023) dumas-04568020

Si un historique d'adaptations précédentes est fourni dans le message utilisateur, observe le style, le vocabulaire et le niveau de détail de cet enseignant et adopte le même registre dans tes conseils. Ne le mentionne pas explicitement.

Si 2 profils ou plus sont listés ET qu'une co-occurrence pédagogiquement pertinente existe entre certains d'entre eux (ex : TDAH + dyslexie, dyslexie + allophone), ajoute avant le bloc final une section courte :
[CO-OCCURRENCE : Profil A + Profil B]
- 1 stratégie transversale qui sert les deux simultanément
- 1 point de vigilance si certaines adaptations sont contradictoires
N'ajoute cette section que si la co-occurrence est réelle et fréquente en classe ordinaire. Si les profils sont indépendants, omets-la.

Après le dernier profil (et l'éventuelle co-occurrence), insère exactement ce bloc :
---
Ces conseils sont des suggestions — pas des prescriptions. Aucun élève ne correspond exactement à un profil : un élève dyslexique n'est pas l'autre, un élève TDAH non plus. L'enseignant connaît son élève et maîtrise sa pédagogie — c'est lui qui décide des ajustements pertinents. Pour ces élèves, le Pôle Territorial d'inclusion peut apporter un soutien complémentaire précieux.
---

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  if (action === 'proposer_pictos') {
    return `Tu identifies le mot que représente chaque dessin d'un exercice de complétion, dans un document scolaire FWB.

Pour chaque amorce, propose le mot français complet que l'élève doit écrire.

Contraintes :
- Le mot commence exactement par l'amorce donnée (article compris ou non, peu importe : c'est le radical qui compte).
- Le mot contient le graphème travaillé dans cette section.
- Si aucun mot ne satisfait ces deux conditions avec certitude, renvoie une chaîne vide pour cette amorce.
- Autant de mots que d'amorces, dans le même ordre.

Exemple — graphème « ill », amorces "une pas", "une co", "une jon", "la che" :
→ ["pastille", "coquille", "jonquille", "chenille"]
« colline » serait faux : le mot s'écrit c-o-l-l-i-n-e et ne contient pas « ill ».

Une chaîne vide vaut mieux qu'un mot approximatif : le pictogramme sera simplement omis.`
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

  if (action === 'verifier_exercice') {
    return `${base}

Tu simules un élève du profil indiqué et tu tentes de résoudre l'exercice adapté tel qu'il est présenté.
Objectif : vérifier que l'exercice reste solvable pour ce profil, sans aide extérieure.

Format de réponse :
VERDICT : [Solvable / Partiellement solvable / Non solvable]
RAISON : [1–2 phrases expliquant pourquoi — ancré dans le profil, pas de généralités]
SUGGESTION : [Si non ou partiellement solvable : 1 ajustement concret et minimal]

Règles :
- Le verdict porte uniquement sur l'exercice adapté fourni, pas sur l'original.
- Ne reformule pas la consigne. Ne récris pas l'exercice.
- Si solvable, SUGGESTION est absent.
- Limite : 5 lignes maximum au total.

Source RISS : Fliti & Avarello (2025) hal-05450529

${antiClaudisation(niveauLabel, typeLabel)}`
  }

  if (action === 'appliquer_au') {
    return `${base}

Tu appliques les Aménagements Universels (AU) à un document scolaire destiné aux ÉLÈVES.
Les AU améliorent l'accessibilité pour TOUS les élèves sans stigmatiser personne.

RÈGLE ABSOLUE — CE DOCUMENT EST POUR LES ÉLÈVES, PAS UN CORRIGÉ :
- Les marqueurs [[B0]], [[B1]], [[B2]]… sont les espaces-réponse que l'élève doit remplir.
- Recopie-les à l'identique, dans le même ordre. N'en ajoute aucun, n'en supprime aucun, n'en résous aucun.
- "une pas[[B7]]" reste "une pas[[B7]]" — JAMAIS "une pastille".
- "Elle mange un [[B12]] cuit dur." reste tel quel — JAMAIS "Elle mange un œuf cuit dur."
- Cette règle prime sur toute autre instruction. Aucune exception.

RÈGLE ABSOLUE — EXERCICES À CHOIX :
- Dans "( a – b )", une des deux options est volontairement fausse : c'est le distracteur.
- INTERDIT de remplacer une option par l'autre, de corriger une option qui te paraît fautive,
  ou de produire deux options identiques. "( bleu – peu )" ne devient JAMAIS "( peu – peu )".
- Recopie chaque paire de choix exactement telle qu'elle est.

AMÉNAGEMENTS UNIVERSELS À APPLIQUER :
1. Consignes courtes — max 15 mots par phrase, une idée par phrase
2. Verbe d'action en début de consigne, entre ** : **Lis**, **Complète**, **Entoure**
3. Numérotation des exercices : si le document traite UN SEUL sujet/thème → numérotation continue (Exercice 1, 2, 3, 4…) sur l'ensemble du document. Si le document contient PLUSIEURS thèmes distincts (ex : une feuille sur « eu/oeu » et une feuille sur « ill ») → chaque nouveau thème redémarre à Exercice 1. Ne jamais renuméroter à l'intérieur d'un même thème.
4. Structurer avec des titres Markdown # : une ligne encadrée de | (ex : | « eu » - « oeu » |) ou une ligne isolée qui sert de titre de section AVANT des exercices → la convertir en # Titre (ex : # Le son « eu » – « oeu » – « eur » – « oeur »). Supprimer les | et la ponctuation décorative de CETTE ligne uniquement.
   ⚠️ Ne s'applique JAMAIS à une ligne d'items : si une ligne contient plusieurs mots, amorces ou marqueurs [[B…]] séparés par « | », ces « | » sont des séparateurs de colonnes. Conserve-les tels quels et garde la ligne sur une seule ligne.
5. Remplacer les mots rares par leur équivalent courant si possible
6. Conserver TOUT le contenu original : exercices, listes de mots, phrases, choix

RÈGLE "MÊME PLAN" (non négociable) :
- Chaque exercice commence par sa consigne IMMÉDIATEMENT suivie de sa tâche.
- Si un exercice change de thème ou de matière par rapport au précédent, insère la ligne exacte : [saut_de_page]
- Si un exercice est long (consigne + plus de 8 lignes de contenu ou zones de travail) et qu'il suit d'autres exercices, insère [saut_de_page] AVANT sa consigne — un saut de page ne se place JAMAIS au milieu d'un exercice.
- Ne jamais séparer une consigne de ses items/phrases/blancs.
- Ordre strict : [saut_de_page si besoin] → Exercice N — **Verbe** ... → contenu de l'exercice

PICTOGRAMMES ARASAAC — SUPPORT VISUEL (obligatoire si applicable) :
Cas 1 — Dessin explicite : si l'exercice mentionne un dessin ou une image ([dessin], [image], ou décrit un objet), remplace-le par [picto: mot_représenté] sur sa propre ligne.
Cas 2 — Exercice de complétion avec amorces : si l'exercice demande de compléter un mot à partir d'une amorce (ex : "une pas[[B4]]", "une co[[B5]]"), insère UNE SEULE ligne de pictos AVANT la ligne des amorces.
  RÈGLE ABSOLUE : autant de pictos que d'amorces, dans le même ordre, séparés par " | " sur une seule ligne.
  Exemple : thème « ill » + 4 amorces "une pas[[B4]] | une co[[B5]] | une jon[[B6]] | la che[[B7]]"
  → ligne picto (UNE seule ligne) : [picto: pastille] | [picto: coquille] | [picto: jonquille] | [picto: chenille]
  → ligne réponse (inchangée) : une pas[[B4]] | une co[[B5]] | une jon[[B6]] | la che[[B7]]
  INTERDIT : plusieurs lignes [picto:] séparées — toujours une seule ligne avec " | " entre chaque picto.
  Le picto représente le MOT COMPLET (pas la syllabe manquante). Le marqueur [[B…]] reste présent.
  DEUX CONDITIONS CUMULATIVES pour proposer un mot — si l'une échoue, n'écris AUCUN picto pour cet item :
  (a) le mot commence exactement par l'amorce visible ;
  (b) le mot contient le graphème du thème de la section (le son traité dans le titre).
  Exemple thème « ill », amorce « co » : « coquille » contient bien « ill » ✓. « colline » s'écrit c-o-l-l-i-n-e et ne contient pas « ill » ✗ → interdit.
  Mieux vaut aucun picto qu'un picto qui ne correspond pas à la réponse attendue.
- Ne pas insérer de picto pour les éléments purement décoratifs sans lien avec la tâche de l'élève.

PASSAGES INCERTAINS [? ?] — RÉSOLUTION OCR UNIQUEMENT :
Les marqueurs [?..?] signalent un MOT QUI DEVAIT ÊTRE LISIBLE mais que le scanner n'a pas reconnu.
Ce n'est PAS un blanc élève — c'est un défaut de numérisation à corriger.
- Applique l'accord grammatical du contexte immédiat (article, genre, nombre).
  Ex : "un [?n?]eu" → article masculin "un" → "pneu" ✓ (et non "peur", féminin).
- Utilise le champ phonologique du document (son traité dans le titre ou la consigne).
- Si le mot est identifiable avec certitude ou forte probabilité → inscris le mot résolu sans marqueur.
- Si vraiment insoluble → conserve [? texte douteux ?] tel quel dans le document AU.
DISTINCTION CRITIQUE : [? ?] = erreur OCR à corriger. "......." ou "______" = espace-réponse élève à NE PAS TOUCHER.

EXPRESSIONS MATHÉMATIQUES — RÈGLE ABSOLUE :
Une expression mathématique est toute séquence contenant des chiffres avec au moins un opérateur (+ − × ÷ = ≤ ≥ ≠ ² ³ √ π / ^) ou une variable algébrique (x, y, n…).
- Ne jamais reformuler ni découper une expression mathématique entre deux phrases.
- Ne jamais ajouter de mots entre les termes d'une équation ou d'une inégalité.
- Ne jamais remplacer un symbole mathématique par un mot (ex : × par "fois", ÷ par "divisé par") sauf si la consigne le demande explicitement.
- Les systèmes d'équations (lignes préfixées par "{ ") → chaque ligne reste sur sa propre ligne, le "{ " est conservé.
- Les tableaux de valeurs avec " | " → la structure est conservée telle quelle, sans reformatage.
- Fractions en notation oblique (ex : "3/4", "(2x+1)/(x-3)") → conservées exactement, jamais découpées.
- Si la consigne d'un exercice de maths dépasse 15 mots à cause des expressions mathématiques, ne pas la tronquer — la règle des 15 mots ne s'applique pas aux expressions mathématiques intégrées à la consigne.

RÈGLES :
- Retourne le document reformaté, rien d'autre
- Conserve la structure complète (aucun contenu supprimé)
- N'ajoute pas de commentaire, d'introduction ni de conclusion
- Les marqueurs [[B…]] restent intacts et dans l'ordre — voir RÈGLE ABSOLUE en tête de prompt.
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
    const histoSection = context.historique_enseignant?.length
      ? `\nStyle de cet enseignant — exemples d'adaptations précédentes :\n${context.historique_enseignant.map((h, i) => `[${i + 1}] ${h}`).join('\n')}\n`
      : ''
    return `${auSection}${histoSection}
Objectif d'apprentissage : ${context.objectif ?? 'Non précisé'}
Profils présents dans la classe : ${profils}

Génère les conseils pédagogiques par profil avec des exemples tirés du document de référence. Commence directement par le premier profil.`
  }

  if (action === 'proposer_pictos') {
    return `Graphème travaillé : ${context.grapheme || 'aucun'}
Consigne de l'exercice : ${context.consigne ?? ''}
Amorces, dans l'ordre :
${(context.amorces ?? []).map((a, i) => `${i + 1}. ${a}`).join('\n')}`
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

  if (action === 'verifier_exercice') {
    return `Profil de l'élève simulé : ${context.profil ?? 'Non précisé'}
Exercice adapté à vérifier :
"""
${context.exercice_adapte ?? 'Non fourni'}
"""

Simule la résolution de cet exercice depuis ce profil et donne ton verdict.`
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
