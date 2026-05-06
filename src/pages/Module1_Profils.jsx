import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROFILS } from '../lib/constants'

// Génère un code anonyme aléatoire (ex: EL-4K7)
function genererCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'EL-' + Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Module1_Profils() {
  const { user }  = useAuth()
  const [eleves, setEleves]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]   = useState(null)
  const [form, setForm] = useState({ code_anonyme: '', profils: [], notes: '' })
  const [saving, setSaving]   = useState(false)
  const [filterProfil, setFilterProfil] = useState('')

  useEffect(() => { loadEleves() }, [])

  async function loadEleves() {
    const { data } = await supabase
      .from('eleves')
      .select('*')
      .order('created_at', { ascending: false })
    setEleves(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm({ code_anonyme: genererCode(), profils: [], notes: '' })
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(eleve) {
    setForm({ code_anonyme: eleve.code_anonyme, profils: eleve.profils ?? [], notes: eleve.notes ?? '' })
    setEditId(eleve.id)
    setShowForm(true)
  }

  function toggleProfil(val) {
    setForm(prev => ({
      ...prev,
      profils: prev.profils.includes(val)
        ? prev.profils.filter(p => p !== val)
        : [...prev.profils, val],
    }))
  }

  async function handleSave() {
    setSaving(true)
    if (editId) {
      await supabase.from('eleves').update({
        code_anonyme: form.code_anonyme,
        profils: form.profils,
        notes: form.notes,
      }).eq('id', editId)
    } else {
      await supabase.from('eleves').insert({
        user_id: user.id,
        code_anonyme: form.code_anonyme,
        profils: form.profils,
        notes: form.notes,
      })
    }
    await loadEleves()
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cet élève ?')) return
    await supabase.from('eleves').delete().eq('id', id)
    setEleves(prev => prev.filter(e => e.id !== id))
  }

  const elevesFiltres = filterProfil
    ? eleves.filter(e => (e.profils ?? []).includes(filterProfil))
    : eleves

  const profilInfo = (val) => PROFILS.find(p => p.value === val)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profils classe</h1>
          <p className="text-gray-500 text-sm mt-1">
            Codes anonymes — les noms ne sont jamais stockés
          </p>
        </div>
        <button onClick={openNew} className="btn-primary">
          + Ajouter un élève
        </button>
      </div>

      {/* Filtres par profil */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterProfil('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filterProfil === '' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:border-brand-400'
          }`}
        >
          Tous ({eleves.length})
        </button>
        {PROFILS.map(p => {
          const count = eleves.filter(e => (e.profils ?? []).includes(p.value)).length
          if (count === 0) return null
          return (
            <button
              key={p.value}
              onClick={() => setFilterProfil(p.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterProfil === p.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-gray-300 text-gray-600 hover:border-brand-400'
              }`}
            >
              {p.icon} {p.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Statistiques rapides */}
      {eleves.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition des profils</h3>
          <div className="grid grid-cols-4 gap-3">
            {PROFILS.map(p => {
              const count = eleves.filter(e => (e.profils ?? []).includes(p.value)).length
              if (count === 0) return null
              return (
                <div key={p.value} className="text-center">
                  <div className="text-2xl">{p.icon}</div>
                  <div className="text-lg font-bold text-brand-700">{count}</div>
                  <div className="text-xs text-gray-500">{p.label.split('/')[0].trim()}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="card border-brand-200">
          <h3 className="font-semibold text-gray-800 mb-4">
            {editId ? 'Modifier l\'élève' : 'Nouvel élève'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Code anonyme</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={form.code_anonyme}
                  onChange={e => setForm(prev => ({ ...prev, code_anonyme: e.target.value }))}
                />
                <button
                  onClick={() => setForm(prev => ({ ...prev, code_anonyme: genererCode() }))}
                  className="btn-secondary text-sm"
                >
                  Générer
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Aucun prénom, aucun nom — code unique par élève</p>
            </div>

            <div>
              <label className="label">Profils de besoins</label>
              <div className="grid grid-cols-2 gap-2">
                {PROFILS.map(p => (
                  <label
                    key={p.value}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      form.profils.includes(p.value)
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-brand-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.profils.includes(p.value)}
                      onChange={() => toggleProfil(p.value)}
                      className="accent-brand-600"
                    />
                    <span className="text-base">{p.icon}</span>
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes (facultatif)</label>
              <textarea
                className="input resize-none h-20"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observations, aménagements en place..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} className="btn-primary" disabled={!form.code_anonyme || saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des élèves */}
      {loading ? (
        <div className="card animate-pulse h-32" />
      ) : elevesFiltres.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-gray-500 text-sm">
            {filterProfil ? 'Aucun élève avec ce profil.' : 'Aucun élève encore. Ajoutez-en un !'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {elevesFiltres.map(eleve => (
            <div
              key={eleve.id}
              className="card py-3 px-4 flex items-start gap-4"
            >
              <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-brand-700 text-xs font-bold">{eleve.code_anonyme.split('-')[1]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-gray-800">{eleve.code_anonyme}</span>
                  {(eleve.profils ?? []).length === 0 && (
                    <span className="badge bg-gray-100 text-gray-500">Sans profil identifié</span>
                  )}
                </div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {(eleve.profils ?? []).map(val => {
                    const p = profilInfo(val)
                    return p ? (
                      <span key={val} className={`badge ${p.color}`}>{p.icon} {p.label}</span>
                    ) : null
                  })}
                </div>
                {eleve.notes && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{eleve.notes}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(eleve)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(eleve.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rappel RISS */}
      <div className="card bg-gray-50 border-gray-200">
        <p className="text-xs text-gray-500">
          Stratégies adaptées par profil fondées sur : Fournier (2024) — <em>Les adaptations pédagogiques pour les élèves ayant des troubles « dys »</em> — corpus RISS dumas-04562654
        </p>
      </div>
    </div>
  )
}
