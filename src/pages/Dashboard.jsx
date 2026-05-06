import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PRINCIPES_CUA } from '../lib/constants'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [stats, setStats]     = useState({ eleves: 0, adaptations: 0, sequences: 0 })
  const [recentes, setRecentes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [
      { data: eleves },
      { data: adaptations },
      { data: sequences },
    ] = await Promise.all([
      supabase.from('eleves').select('id').limit(200),
      supabase.from('adaptations').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('sequences').select('id').limit(200),
    ])

    setStats({
      eleves:      (eleves      ?? []).length,
      adaptations: (adaptations ?? []).length,
      sequences:   (sequences   ?? []).length,
    })
    setRecentes(adaptations ?? [])
    setLoading(false)
  }

  const ACTIONS_RAPIDES = [
    {
      icon: '✨',
      title: 'Adapter une activité',
      desc: 'Colle une activité → variantes par profil',
      color: 'bg-brand-600 hover:bg-brand-700 text-white',
      to: '/adapter',
    },
    {
      icon: '👥',
      title: 'Gérer mes profils',
      desc: 'Cartographier les besoins de la classe',
      color: 'bg-purple-600 hover:bg-purple-700 text-white',
      to: '/profils',
    },
    {
      icon: '📋',
      title: 'Créer une séquence',
      desc: 'Séquence différenciée CUA complète',
      color: 'bg-accent-500 hover:bg-accent-600 text-white',
      to: '/sequence',
    },
    {
      icon: '📚',
      title: 'Bibliothèque',
      desc: 'Exemples validés par niveau et profil',
      color: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
      to: '/bibliotheque',
    },
  ]

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour{profile?.prenom ? `, ${profile.prenom}` : ''}&nbsp;
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile?.matiere && `${profile.matiere} • `}
          {new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Élèves (codes)', value: stats.eleves,      icon: '👥', color: 'text-purple-600' },
          { label: 'Adaptations',    value: stats.adaptations, icon: '✨', color: 'text-brand-600' },
          { label: 'Séquences',      value: stats.sequences,   icon: '📋', color: 'text-accent-500' },
        ].map(s => (
          <div key={s.label} className="card py-4">
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.icon} {s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions rapides */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Actions rapides</h2>
        <div className="grid grid-cols-2 gap-3">
          {ACTIONS_RAPIDES.map(a => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              className={`${a.color} rounded-xl p-4 text-left transition-colors shadow-sm`}
            >
              <div className="text-2xl mb-2">{a.icon}</div>
              <div className="font-semibold text-sm">{a.title}</div>
              <div className="text-xs opacity-80 mt-0.5">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Guide démarrage (si aucune adaptation) */}
      {!loading && stats.adaptations === 0 && (
        <div className="card border-brand-200 bg-gradient-to-br from-brand-50 to-white">
          <h2 className="text-sm font-semibold text-brand-700 uppercase tracking-wider mb-4">
            Par où commencer ?
          </h2>
          <div className="space-y-3">
            {[
              {
                step: 1,
                icon: '👥',
                title: 'Cartographier votre classe',
                desc: 'Ajoutez vos élèves (codes anonymes) et leurs profils de besoins.',
                to: '/profils',
                cta: 'Créer des profils',
              },
              {
                step: 2,
                icon: '✨',
                title: 'Adapter une première activité',
                desc: 'Collez une activité existante — DiffActif génère des variantes par profil (80% IA, 20% vous).',
                to: '/adapter',
                cta: 'Essayer le Adapteur',
                primary: true,
              },
              {
                step: 3,
                icon: '📋',
                title: 'Structurer une séquence CUA',
                desc: 'Planifiez une séquence complète selon les 3 principes de la Conception Universelle.',
                to: '/sequence',
                cta: 'Créer une séquence',
              },
              {
                step: 4,
                icon: '📚',
                title: 'Explorer la bibliothèque',
                desc: 'Exemples concrets validés par la recherche RISS, filtrables par profil et niveau.',
                to: '/bibliotheque',
                cta: 'Voir des exemples',
              },
            ].map(item => (
              <div
                key={item.step}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-brand-50 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span className="text-sm font-semibold text-gray-800">{item.title}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <button
                  onClick={() => navigate(item.to)}
                  className={`text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors ${
                    item.primary
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 group-hover:bg-brand-100 group-hover:text-brand-700'
                  }`}
                >
                  {item.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adaptations récentes */}
      {!loading && recentes.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Dernières adaptations
            </h2>
            <button onClick={() => navigate('/adapter')} className="text-xs text-brand-600 hover:underline">
              Voir tout
            </button>
          </div>
          <div className="space-y-2">
            {recentes.map(a => (
              <div key={a.id} className="card py-3 px-4 flex items-start gap-3 hover:shadow-md transition-shadow cursor-pointer"
                   onClick={() => navigate('/adapter')}>
                <span className="text-lg">✨</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(a.profils ?? []).map(p => (
                      <span key={p} className="badge bg-brand-100 text-brand-700">{p}</span>
                    ))}
                    {a.matiere && <span className="badge bg-gray-100 text-gray-600">{a.matiere}</span>}
                  </div>
                  <p className="text-sm text-gray-800 mt-1 line-clamp-2">
                    {a.activite_originale}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(a.created_at).toLocaleDateString('fr-BE')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="card animate-pulse h-32" />}

      {/* Principes CUA */}
      <div className="card bg-gradient-to-r from-brand-50 to-purple-50 border-brand-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Les 3 principes de la Conception Universelle de l'Apprentissage
          <span className="text-xs font-normal text-gray-400 ml-2">
            Rusconi (2025) · Alvarez (2024) — corpus RISS
          </span>
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {PRINCIPES_CUA.map(p => (
            <div key={p.id} className="bg-white rounded-lg p-3 border border-brand-100">
              <div className="text-xl mb-1">{p.icon}</div>
              <div className="text-xs font-semibold text-gray-800">{p.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
