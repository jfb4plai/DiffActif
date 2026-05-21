import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT, PRINCIPES_CUA } from '../lib/constants'
import { exportSequenceDocx } from '../lib/exportDocx'

export default function Module3_Sequence() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const fromModule2 = location.state ?? {}

  const [form, setForm] = useState({
    titre:            fromModule2.objectif ? `Séquence — ${fromModule2.objectif.slice(0, 50)}` : '',
    matiere:          fromModule2.matiere ?? profile?.matiere ?? '',
    niveau:           fromModule2.niveau ?? profile?.niveau_enseignement ?? '',
    type_enseignement: fromModule2.typeEns ?? profile?.type_enseignement ?? '',
    objectif:         fromModule2.objectif ?? '',
    nb_seances:       '4',
    profils:          fromModule2.profils ?? [],
    activite_source:  fromModule2.activite ?? '',
  })
  const [generating, setGenerating] = useState(false)
  const [resultat, setResultat]     = useState('')
  const [texteFinal, setTexteFinal] = useState('')
  const [error, setError]           = useState('')
  const [saved, setSaved]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [exporting, setExporting]   = useState(false)

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setResultat('')
    setSaved(false)
  }

  function toggleProfil(val) {
    setForm(prev => ({
      ...prev,
      profils: prev.profils.includes(val)
        ? prev.profils.filter(p => p !== val)
        : [...prev.profils, val],
    }))
    setResultat('')
    setSaved(false)
  }

  async function generer() {
    if (!form.titre || !form.objectif) return
    setGenerating(true)
    setError('')
    setResultat('')
    setSaved(false)
    setTexteFinal('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'creer_sequence',
          context: { titre: form.titre, matiere: form.matiere, niveau: form.niveau, type_enseignement: form.type_enseignement, objectif: form.objectif, nb_seances: form.nb_seances, profils: form.profils },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setResultat(data.text)
      setTexteFinal(data.text)
    } catch (err) {
      setError(err.message)
    }
    setGenerating(false)
  }

  async function exporterDocx() {
    setExporting(true)
    await exportSequenceDocx({
      titre:             form.titre,
      matiere:           form.matiere,
      niveau:            form.niveau,
      typeEnseignement:  form.type_enseignement,
      objectif:          form.objectif,
      nbSeances:         form.nb_seances,
      profils:           form.profils,
      texteFinal,
    })
    setExporting(false)
  }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('sequences').insert({
      user_id:           user.id,
      titre:             form.titre,
      matiere:           form.matiere,
      niveau:            form.niveau,
      type_enseignement: form.type_enseignement,
      objectif:          form.objectif,
      nb_seances:        parseInt(form.nb_seances),
      profils_cibles:    form.profils,
      sequence_ia:       resultat,
      texte_final:       texteFinal,
    })
    setSaved(true)
    setSaving(false)
  }

  const canGenerate = form.titre.trim() && form.objectif.trim()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Séquence CUA</h1>
        <p className="text-gray-500 text-sm mt-1">
          Structurez une séquence différenciée selon les 3 principes de la Conception Universelle de l'Apprentissage
        </p>
      </div>

      {/* Bandeau contexte Module2 */}
      {fromModule2.activite && (
        <div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-xs text-brand-800">
          Formulaire pré-rempli depuis l'activité adaptée — vérifiez et ajustez avant de générer.
        </div>
      )}

      {/* Rappel CUA */}
      <div className="grid grid-cols-3 gap-3">
        {PRINCIPES_CUA.map(p => (
          <div key={p.id} className="card py-3 px-4 border-brand-100 bg-brand-50">
            <div className="text-xl mb-1">{p.icon}</div>
            <div className="text-xs font-semibold text-brand-800">{p.label}</div>
            <div className="text-xs text-gray-600 mt-0.5">{p.description}</div>
          </div>
        ))}
      </div>

      {/* Formulaire */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Paramètres de la séquence</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Titre de la séquence</label>
            <input className="input" value={form.titre}
              onChange={e => update('titre', e.target.value)}
              placeholder="Ex : La phrase complexe — 2e degré" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Niveau</label>
              <select className="input" value={form.niveau} onChange={e => update('niveau', e.target.value)}>
                <option value="">Choisir...</option>
                {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type d'enseignement</label>
              <select className="input" value={form.type_enseignement} onChange={e => update('type_enseignement', e.target.value)}>
                <option value="">Choisir...</option>
                {TYPES_ENSEIGNEMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Matière</label>
              <input className="input" value={form.matiere}
                onChange={e => update('matiere', e.target.value)} placeholder="Français..." />
            </div>
          </div>

          <div>
            <label className="label">Objectif final de la séquence</label>
            <textarea className="input resize-none h-20" value={form.objectif}
              onChange={e => update('objectif', e.target.value)}
              placeholder="L'élève est capable de... à la fin de la séquence." />
          </div>

          <div>
            <label className="label">Nombre de séances souhaité</label>
            <select className="input w-40" value={form.nb_seances} onChange={e => update('nb_seances', e.target.value)}>
              {['2', '3', '4', '5', '6', '8'].map(n => (
                <option key={n} value={n}>{n} séances</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Profils à prendre en compte (facultatif)</label>
            <div className="grid grid-cols-4 gap-2">
              {PROFILS.map(p => (
                <button
                  key={p.value}
                  onClick={() => toggleProfil(p.value)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-all ${
                    form.profils.includes(p.value)
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-brand-200'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span className="text-gray-700">{p.label.split('/')[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={generer}
        disabled={!canGenerate || generating}
        className="btn-accent w-full py-3 text-base font-semibold"
      >
        {generating ? 'Génération en cours...' : 'Générer la séquence CUA'}
      </button>

      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Résultat */}
      {resultat && (
        <div className="card border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Séquence générée</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">80% IA — à adapter</span>
          </div>

          <div className="bg-brand-50 rounded-xl p-4 mb-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-brand-100">
            {resultat}
          </div>

          <div>
            <label className="label">Votre version finalisée (personnalisez, ajustez)</label>
            <textarea
              className="input resize-none h-64"
              value={texteFinal}
              onChange={e => { setTexteFinal(e.target.value); setSaved(false) }}
            />
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Fondé sur : Rusconi (2025) · Alvarez (2024) — corpus RISS W4414205903, W4402615917
            </p>
            <div className="flex gap-2">
              <button
                onClick={exporterDocx}
                disabled={exporting || !texteFinal.trim()}
                className="btn-secondary text-sm"
              >
                {exporting ? 'Export...' : '⬇ DOCX'}
              </button>
              <button
                onClick={sauvegarder}
                disabled={saving || saved || !texteFinal.trim()}
                className={saved ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
              >
                {saved ? 'Sauvegardé ✓' : saving ? 'Enregistrement...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
