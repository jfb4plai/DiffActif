import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Dimensions d'auto-évaluation de la pratique différenciée
// Fondé sur : Koubeissy & Malo (2023) W4388661634 ; Blot (2024) dumas-04638390
const DIMENSIONS = [
  {
    id: 'identification_profils',
    label: 'Identification des profils',
    description: 'Je suis capable d\'identifier les besoins spécifiques de mes élèves',
    indicateurs: [
      'Je repère les élèves en difficulté sans attendre l\'échec',
      'Je connais les caractéristiques des principaux profils DYS/TDAH',
      'Je distingue difficulté ponctuelle et besoin éducatif particulier',
    ],
  },
  {
    id: 'adaptation_contenu',
    label: 'Adaptation du contenu',
    description: 'Je modifie la forme de mes activités sans réduire les exigences',
    indicateurs: [
      'Je propose des consignes adaptées sans changer l\'objectif',
      'Je varie les supports (texte, audio, visuel)',
      'Je fragmente les tâches longues pour les élèves qui en ont besoin',
    ],
  },
  {
    id: 'cua_pratique',
    label: 'Pratique CUA',
    description: 'J\'intègre les 3 principes de la Conception Universelle',
    indicateurs: [
      'Je propose plusieurs façons de présenter l\'information',
      'Je permets plusieurs façons de démontrer les acquis',
      'Je soutiens l\'engagement de tous les élèves',
    ],
  },
  {
    id: 'memorisation_suivi',
    label: 'Mémorisation et suivi',
    description: 'Je trace et mémorise mes adaptations par élève',
    indicateurs: [
      'Je note les adaptations mises en place pour chaque élève',
      'Je vérifie l\'effet des adaptations sur les apprentissages',
      'Je fais évoluer mes stratégies selon les résultats',
    ],
  },
  {
    id: 'charge_travail',
    label: 'Efficacité (charge de travail)',
    description: 'Je différencie sans surcharge',
    indicateurs: [
      'Mes adaptations ne me demandent pas de refaire toute l\'activité',
      'J\'utilise des outils pour gagner du temps (gabarits, IA...)',
      'Je partage mes adaptations avec des collègues',
    ],
  },
]

const NIVEAUX_AUTO = [
  { value: 1, label: 'Pas encore', color: 'bg-red-100 text-red-700' },
  { value: 2, label: 'En construction', color: 'bg-orange-100 text-orange-700' },
  { value: 3, label: 'Acquis', color: 'bg-green-100 text-green-700' },
]

export default function Module5_Progression() {
  const { user } = useAuth()
  const [scores, setScores]         = useState({})
  const [commentaire, setCommentaire] = useState('')
  const [historique, setHistorique] = useState([])
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => { loadHistorique() }, [])

  async function loadHistorique() {
    const { data } = await supabase
      .from('progressions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    setHistorique(data ?? [])

    // Pré-remplir avec la dernière évaluation
    if (data && data.length > 0) {
      setScores(data[0].scores ?? {})
    }
    setLoading(false)
  }

  function setScore(dim, val) {
    setScores(prev => ({ ...prev, [dim]: val }))
    setSaved(false)
  }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('progressions').insert({
      user_id:    user.id,
      scores,
      commentaire,
      date:       new Date().toISOString().split('T')[0],
    })
    await loadHistorique()
    setSaved(true)
    setSaving(false)
  }

  const scoreTotal = Object.values(scores).reduce((a, b) => a + b, 0)
  const scoreMax   = DIMENSIONS.length * 3
  const pct        = scoreMax > 0 ? Math.round((scoreTotal / scoreMax) * 100) : 0
  const rempli     = Object.keys(scores).length === DIMENSIONS.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ma progression</h1>
        <p className="text-gray-500 text-sm mt-1">
          Auto-évaluation de votre pratique de différenciation — à remplir librement, sans jugement
        </p>
      </div>

      {/* Score global */}
      {rempli && (
        <div className="card bg-gradient-to-r from-brand-50 to-purple-50 border-brand-100">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-bold">{pct}%</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">Score global</h3>
              <p className="text-sm text-gray-600">{scoreTotal} / {scoreMax} points</p>
              <p className="text-xs text-gray-500 mt-1">
                {pct < 40 ? 'Les bases se mettent en place — chaque adaptation compte.'
                  : pct < 70 ? 'Bonne progression — la pratique se consolide.'
                  : 'Pratique solide — continuez à partager et innover.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grille d'évaluation */}
      <div className="space-y-4">
        {DIMENSIONS.map(dim => (
          <div key={dim.id} className="card">
            <div className="mb-3">
              <h3 className="font-semibold text-gray-800">{dim.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{dim.description}</p>
            </div>

            {/* Indicateurs */}
            <ul className="text-xs text-gray-600 mb-4 space-y-1">
              {dim.indicateurs.map((ind, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  <span>{ind}</span>
                </li>
              ))}
            </ul>

            {/* Choix */}
            <div className="flex gap-2">
              {NIVEAUX_AUTO.map(n => (
                <button
                  key={n.value}
                  onClick={() => setScore(dim.id, n.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                    scores[dim.id] === n.value
                      ? `${n.color} border-current`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Commentaire */}
      <div className="card">
        <label className="label">Réflexion personnelle (facultatif)</label>
        <textarea
          className="input resize-none h-24"
          value={commentaire}
          onChange={e => { setCommentaire(e.target.value); setSaved(false) }}
          placeholder="Ce que j'ai mis en place cette période, ce qui a bien fonctionné, ce que je veux développer..."
        />
      </div>

      <button
        onClick={sauvegarder}
        disabled={!rempli || saving || saved}
        className={saved ? 'btn-secondary w-full py-3' : 'btn-primary w-full py-3'}
      >
        {saved ? 'Auto-évaluation sauvegardée ✓' : saving ? 'Enregistrement...' : 'Sauvegarder cette évaluation'}
      </button>

      {!rempli && (
        <p className="text-xs text-gray-400 text-center">
          Évaluez les {DIMENSIONS.length - Object.keys(scores).length} dimension{DIMENSIONS.length - Object.keys(scores).length > 1 ? 's' : ''} restante{DIMENSIONS.length - Object.keys(scores).length > 1 ? 's' : ''} pour sauvegarder
        </p>
      )}

      {/* Historique */}
      {!loading && historique.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Historique</h2>
          <div className="space-y-2">
            {historique.map(h => {
              const total = Object.values(h.scores ?? {}).reduce((a, b) => a + b, 0)
              const p = Math.round((total / scoreMax) * 100)
              return (
                <div key={h.id} className="card py-3 px-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-700 text-sm font-bold">{p}%</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">
                      {new Date(h.date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    {h.commentaire && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{h.commentaire}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{total} / {scoreMax} pts</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card bg-gray-50 border-gray-200">
        <p className="text-xs text-gray-500">
          Grille d'auto-évaluation fondée sur : Koubeissy & Malo (2023) — corpus RISS W4388661634 ;
          Blot (2024) — dumas-04638390
        </p>
      </div>
    </div>
  )
}
