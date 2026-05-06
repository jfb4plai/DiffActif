import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from '../lib/constants'
import { exportAdaptationsDocx, exportUniverselDocx, exportProfilDocx } from '../lib/exportDocx'
import { extractFile } from '../lib/extractFile'
import { fetchPictosForText } from '../lib/arasaac'

export default function Module2_Adapter() {
  const { user, profile } = useAuth()

  // Formulaire
  const [activite, setActivite]   = useState('')
  const [objectif, setObjectif]   = useState('')
  const [profilsChoisis, setProfilsChoisis] = useState([])
  const [niveau, setNiveau]       = useState(profile?.niveau_enseignement ?? '')
  const [typeEns, setTypeEns]     = useState(profile?.type_enseignement ?? '')
  const [matiere, setMatiere]     = useState(profile?.matiere ?? '')

  // Import fichier
  const fileInputRef              = useRef(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedFile, setImportedFile] = useState('')
  const [dragOver, setDragOver]   = useState(false)
  const [hasDoutes, setHasDoutes] = useState(false)
  const [nbDoutes, setNbDoutes]   = useState(0)

  // Document AU universel
  const [generatingAu, setGeneratingAu] = useState(false)
  const [auTexte, setAuTexte]           = useState('')

  // Génération IA adaptations par profil
  const [generating, setGenerating] = useState(false)
  const [resultat, setResultat]     = useState('')
  const [profilSections, setProfilSections] = useState({}) // { dyslexie: "...", tdah: "..." }
  const [error, setError]           = useState('')

  // Personnalisation enseignant (20%)
  const [texteFinal, setTexteFinal] = useState('')
  const [saved, setSaved]           = useState(false)
  const [saving, setSaving]         = useState(false)

  // Export
  const [exporting, setExporting]   = useState(false)
  const [exportingProfil, setExportingProfil] = useState('') // profil en cours d'export

  // ── Import fichier ───────────────────────────────────────────

  async function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx'].includes(ext)) {
      setImportError('Format non supporté — utilisez PDF ou DOCX.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setImportError('Fichier trop lourd (max 10 Mo).')
      return
    }

    setImporting(true)
    setImportError('')
    setImportedFile(file.name)
    setResultat('')
    setSaved(false)
    setHasDoutes(false)
    setNbDoutes(0)
    setAuTexte('')
    setProfilSections({})

    try {
      const { text, hasDoutes: hd, nbDoutes: nb } = await extractFile(file)
      setActivite(text)
      setHasDoutes(hd)
      setNbDoutes(nb)
    } catch (err) {
      setImportError(err.message)
      setImportedFile('')
    }
    setImporting(false)
  }

  function onFileInput(e) { handleFile(e.target.files[0]); e.target.value = '' }
  function onDrop(e) { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }

  function toggleProfil(val) {
    setProfilsChoisis(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    )
    setResultat('')
    setSaved(false)
    setTexteFinal('')
    setProfilSections({})
  }

  // ── Document AU universel ────────────────────────────────────

  async function genererAU() {
    if (!activite.trim()) return
    setGeneratingAu(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'appliquer_au',
          context: { activite, matiere, niveau, type_enseignement: typeEns },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setAuTexte(data.text)
    } catch (err) {
      setError(err.message)
    }
    setGeneratingAu(false)
  }

  // ── Adaptations par profil ───────────────────────────────────

  function parseProfileSections(text, profiles) {
    const sections = {}
    const upperProfiles = profiles.map(p => p.toUpperCase())
    // Délimiteurs possibles après le nom de profil : ], —, -, :, espace
    const delimiter = `(?:${upperProfiles.join('|')})`
    for (const profil of profiles) {
      const upper = profil.toUpperCase()
      // Capture tout jusqu'au prochain profil ou fin
      const regex = new RegExp(
        `\\[?\\*?${upper}\\*?(?:\\s*/[A-ZÀÂÉÈÊËÎÏÔÙÛÜ\\s]+)?\\*?\\]?[\\s—\\-:]+([\\s\\S]*?)(?=\\[?\\*?(?:${upperProfiles.join('|')})\\*?[\\]—\\-: ]|$)`,
        'i'
      )
      const match = text.match(regex)
      if (match?.[1]?.trim()) sections[profil] = match[1].trim()
    }
    return sections
  }

  async function generer() {
    if (!activite.trim() || profilsChoisis.length === 0) return
    setGenerating(true)
    setError('')
    setResultat('')
    setSaved(false)
    setTexteFinal('')
    setProfilSections({})

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adapter_activite',
          context: { activite, objectif, profils: profilsChoisis, niveau, type_enseignement: typeEns, matiere },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setResultat(data.text)
      setTexteFinal(data.text)
      setProfilSections(parseProfileSections(data.text, profilsChoisis))
    } catch (err) {
      setError(err.message)
    }
    setGenerating(false)
  }

  // ── Exports ──────────────────────────────────────────────────

  async function exporterDocx() {
    setExporting(true)
    await exportAdaptationsDocx({ activiteOriginale: activite, objectif, texteFinal, profils: profilsChoisis, matiere, niveau, typeEnseignement: typeEns })
    setExporting(false)
  }

  async function exporterAuDocx() {
    if (!auTexte) return
    setExporting(true)
    await exportUniverselDocx({ auTexte, matiere, niveau, typeEnseignement: typeEns })
    setExporting(false)
  }

  async function exporterProfilDocx(profil) {
    const arTexte = profilSections[profil] || texteFinal
    setExportingProfil(profil)

    // Pictos Arasaac uniquement pour les profils concernés
    const PROFILS_PICTOS = ['allophone']
    let pictos = []
    if (PROFILS_PICTOS.includes(profil) && activite) {
      try { pictos = await fetchPictosForText(activite, 5) } catch { /* optionnel */ }
    }

    await exportProfilDocx({ profil, arTexte, auTexte: auTexte || activite, pictos, matiere, niveau, typeEnseignement: typeEns })
    setExportingProfil('')
  }

  async function sauvegarder() {
    setSaving(true)
    await supabase.from('adaptations').insert({
      user_id:           user.id,
      activite_originale: activite,
      objectif,
      profils:           profilsChoisis,
      variantes_ia:      resultat,
      texte_final:       texteFinal,
      matiere,
      niveau,
      type_enseignement: typeEns,
    })
    setSaved(true)
    setSaving(false)
  }

  const canGenerate = activite.trim().length > 20 && profilsChoisis.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Adapter une activité</h1>
        <p className="text-gray-500 text-sm mt-1">
          Collez une activité — DiffActif propose des variantes par profil (80% IA · 20% vous)
        </p>
      </div>

      {/* Étape 1 — Contexte */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">1. Contexte d'enseignement</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Niveau</label>
            <select className="input" value={niveau} onChange={e => setNiveau(e.target.value)}>
              <option value="">Choisir...</option>
              {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Type d'enseignement</label>
            <select className="input" value={typeEns} onChange={e => setTypeEns(e.target.value)}>
              <option value="">Choisir...</option>
              {TYPES_ENSEIGNEMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Matière</label>
            <input className="input" value={matiere}
              onChange={e => setMatiere(e.target.value)} placeholder="Français, Maths..." />
          </div>
        </div>
      </div>

      {/* Étape 2 — Activité */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">2. Activité à adapter</h2>
        <div className="space-y-4">

          {/* Zone d'import fichier */}
          <div>
            <label className="label">Importer un fichier (PDF ou DOCX)</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={onFileInput} />
              {importing ? (
                <p className="text-sm text-brand-600 font-medium">Extraction et analyse en cours...</p>
              ) : importedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-green-600 text-lg">✓</span>
                  <span className="text-sm text-green-700 font-medium">{importedFile}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setImportedFile(''); setActivite(''); setAuTexte(''); setProfilSections({}) }}
                    className="text-xs text-gray-400 hover:text-red-500 ml-2"
                  >✕</button>
                </div>
              ) : (
                <>
                  <div className="text-2xl mb-1">📄</div>
                  <p className="text-sm text-gray-600 font-medium">
                    Glisser-déposer un fichier ou <span className="text-brand-600 underline">parcourir</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF · DOCX — max 10 Mo</p>
                </>
              )}
            </div>
            {importError && <p className="text-xs text-red-500 mt-1">{importError}</p>}
            {importedFile && !importing && !hasDoutes && (
              <p className="text-xs text-gray-400 mt-1">Texte extrait — vérifiez avant de générer.</p>
            )}
            {importedFile && !importing && hasDoutes && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                <p className="text-xs text-amber-800">
                  <strong>{nbDoutes} passage{nbDoutes > 1 ? 's' : ''} incertain{nbDoutes > 1 ? 's' : ''}</strong> — signalés{' '}
                  <code className="bg-amber-100 px-1 rounded">[? ... ?]</code> dans le texte. Corrigez avant de générer.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou saisissez directement</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div>
            <label className="label">Consigne / activité originale</label>
            <textarea
              className="input resize-none h-36"
              value={activite}
              onChange={e => { setActivite(e.target.value); setResultat(''); setSaved(false); setAuTexte(''); setProfilSections({}) }}
              placeholder="Collez ici votre activité ou consigne telle qu'elle est destinée à l'ensemble de la classe..."
            />
            <p className="text-xs text-gray-400 mt-1">{activite.length} caractères (min. 20)</p>
          </div>

          <div>
            <label className="label">Objectif d'apprentissage (facultatif mais recommandé)</label>
            <input
              className="input"
              value={objectif}
              onChange={e => setObjectif(e.target.value)}
              placeholder="Ex : L'élève est capable d'identifier les connecteurs logiques dans un texte."
            />
          </div>
        </div>
      </div>

      {/* Étape 2b — Document AU universel */}
      {activite.trim().length > 20 && (
        <div className="card border-brand-100 bg-brand-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Document AU universel</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Applique les Aménagements Universels — version distribuée à toute la classe
              </p>
            </div>
            <button
              onClick={genererAU}
              disabled={generatingAu}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {generatingAu ? 'Génération...' : auTexte ? 'Regénérer AU' : 'Générer document AU'}
            </button>
          </div>

          {auTexte && (
            <div className="mt-4 space-y-3">
              <div className="bg-white rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-brand-100 max-h-48 overflow-y-auto">
                {auTexte}
              </div>
              <button
                onClick={exporterAuDocx}
                disabled={exporting}
                className="btn-primary text-sm"
              >
                {exporting ? 'Export...' : '⬇ Exporter document AU universel (.docx)'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Étape 3 — Profils */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-1">3. Profils à prendre en compte</h2>
        <p className="text-xs text-gray-500 mb-4">Sélectionnez les profils présents dans votre classe</p>
        <div className="grid grid-cols-2 gap-2">
          {PROFILS.map(p => (
            <button
              key={p.value}
              onClick={() => toggleProfil(p.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                profilsChoisis.includes(p.value)
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-brand-200'
              }`}
            >
              <span className="text-xl">{p.icon}</span>
              <div>
                <div className="text-sm font-medium text-gray-800">{p.label}</div>
                <div className="text-xs text-gray-500">{p.strategies_cles[0]}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bouton générer adaptations */}
      <button
        onClick={generer}
        disabled={!canGenerate || generating}
        className="btn-accent w-full py-3 text-base font-semibold"
      >
        {generating ? 'Génération en cours...' : `Générer les adaptations (${profilsChoisis.length} profil${profilsChoisis.length > 1 ? 's' : ''})`}
      </button>

      {!canGenerate && activite.length < 20 && activite.length > 0 && (
        <p className="text-xs text-gray-400 text-center">Activité trop courte (minimum 20 caractères)</p>
      )}
      {!canGenerate && profilsChoisis.length === 0 && (
        <p className="text-xs text-gray-400 text-center">Sélectionnez au moins un profil</p>
      )}

      {error && (
        <div className="card bg-red-50 border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Résultat IA + personnalisation */}
      {resultat && (
        <div className="card border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Adaptations proposées</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              80% IA — à personnaliser
            </span>
          </div>

          {/* Lecture seule : proposition IA */}
          <div className="bg-brand-50 rounded-xl p-4 mb-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-brand-100">
            {resultat}
          </div>

          {/* Zone de personnalisation — 20% enseignant */}
          <div>
            <label className="label">
              Votre version personnalisée (20% — ajustez, complétez, supprimez ce qui ne convient pas)
            </label>
            <textarea
              className="input resize-none h-48"
              value={texteFinal}
              onChange={e => { setTexteFinal(e.target.value); setSaved(false) }}
            />
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Fondé sur : Mahi Haddad & Beaud (2025) · Fournier (2024) — corpus RISS
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={exporterDocx}
                disabled={exporting || !texteFinal.trim()}
                className="btn-secondary text-sm"
              >
                {exporting ? 'Export...' : '⬇ DOCX (toutes adaptations)'}
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

          {/* Export par profil */}
          {profilsChoisis.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Documents par profil (AU + AR spécifiques)
              </p>
              <div className="flex flex-wrap gap-2">
                {profilsChoisis.map(profil => {
                  const def = PROFILS.find(p => p.value === profil)
                  const hasAudio = ['dyslexie', 'allophone', 'decrocheur'].includes(profil)
                  const hasPictos = profil === 'allophone'
                  return (
                    <button
                      key={profil}
                      onClick={() => exporterProfilDocx(profil)}
                      disabled={!!exportingProfil || !texteFinal.trim()}
                      className="btn-secondary text-xs flex items-center gap-1"
                    >
                      {exportingProfil === profil ? 'Export...' : (
                        <>
                          {def?.icon} {def?.label.split('/')[0].trim()}
                          {hasAudio && ' 🔊'}
                          {hasPictos && ' 🖼'}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                🔊 = QR code audio · 🖼 = pictogrammes Arasaac
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
