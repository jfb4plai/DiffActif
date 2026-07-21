import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PROFILS, NIVEAUX, TYPES_ENSEIGNEMENT } from '../lib/constants'
import { exportAdaptationsDocx, exportUniverselDocx, exportProfilDocx } from '../lib/exportDocx'
import { extractFile } from '../lib/extractFile'
import { fetchPictosForText } from '../lib/arasaac'
import { apiFetch } from '../lib/apiFetch'
import {
  protectBlanks,
  restoreBlanks,
  restoreBlanksStrict,
  countBlanks,
  findDegenerateChoices,
} from '../../api/_blanks.js'
import { renderAu } from '../lib/auLayout'
import { validerPictos, motPictoValide } from '../lib/pictoGuard'
import { pointsAVerifier } from '../../api/_docSchema.js'

// ── Validation AU (client-side) ───────────────────────────────
// `original` = le texte source avant passage IA. Les invariants se mesurent
// entre l'entrée et la sortie ; une règle qui ne compare rien ne vérifie rien.
function validateAuRules(text, original = '', edite = false) {
  const lines = text.split('\n')
  const exerciceLines = lines.filter(l => /^exercice\s+\d+/i.test(l.trim()))

  // Règle 1 : verbe d'action en gras (**Verbe**) dans les lignes d'exercice
  const avecVerbeGras = exerciceLines.filter(l => /\*\*[A-ZÀ-Ÿa-zà-ÿ]{2,}\*\*/.test(l))
  const verbeGrasOk = exerciceLines.length === 0 || avecVerbeGras.length === exerciceLines.length

  // Règle 2 : exercices numérotés
  const numerotationOk = exerciceLines.length > 0

  // Règle 3 : phrases courtes (≤ 15 mots) — contrôle sur les lignes de consigne
  const longues = exerciceLines.filter(l => l.trim().split(/\s+/).length > 16)
  const phrasesCourtesOk = longues.length === 0

  // Règle 4 : espaces-réponse préservés — comparaison entrée / sortie
  const nbBlancs = countBlanks(text)
  const nbBlancsOrig = countBlanks(original)
  const blancsOk = !original || nbBlancs === nbBlancsOrig

  // Règle 5 : "Même Plan" — un exercice ne doit jamais être coupé par un saut de page
  const nbSauts = (text.match(/\[saut_de_page\]/gi) || []).length
  const sautsOrphelins = lines.filter((l, i) => {
    if (!/^\[saut_de_page\]$/i.test(l.trim())) return false
    // Le saut doit être suivi d'un titre de section ou d'une consigne d'exercice.
    const suivante = lines.slice(i + 1).find(x => x.trim())?.trim() ?? ''
    return !(/^#{1,3}\s/.test(suivante) || /^exercice\s+\d+/i.test(suivante))
  }).length
  const memePlanOk = sautsOrphelins === 0

  // Règle 7 : distracteurs préservés — "( a – b )" avec a === b rend l'exercice insoluble
  const choixDegeneres = findDegenerateChoices(text)
  const choixOk = choixDegeneres.length === 0

  // Règle 6 : aucun marqueur [? ?] résiduel (doutes non corrigés)
  const nbDoutes = (text.match(/\[\?/g) || []).length
  const sansDoutesOk = nbDoutes === 0

  return [
    {
      id: 'verbe_gras',
      label: 'Verbe d\'action en gras dans les consignes',
      ok: verbeGrasOk,
      detail: exerciceLines.length > 0
        ? `${avecVerbeGras.length}/${exerciceLines.length} consigne(s) correctes`
        : 'Aucune ligne "Exercice N" détectée',
      warn: exerciceLines.length === 0,
    },
    {
      id: 'numerotation',
      label: 'Exercices numérotés (Exercice 1, 2…)',
      ok: numerotationOk,
      detail: numerotationOk ? `${exerciceLines.length} exercice(s)` : 'Aucun exercice numéroté trouvé',
    },
    {
      id: 'phrases_courtes',
      label: 'Consignes ≤ 15 mots',
      ok: phrasesCourtesOk,
      detail: phrasesCourtesOk ? 'Toutes les consignes sont courtes' : `${longues.length} consigne(s) trop longue(s)`,
    },
    {
      id: 'meme_plan',
      label: 'Règle "Même Plan" — aucun exercice coupé',
      ok: memePlanOk,
      blocking: true,
      detail: memePlanOk
        ? (nbSauts > 0 ? `${nbSauts} saut(s) de page, tous en début d'exercice` : 'Aucun saut (thème unique ou non requis)')
        : `${sautsOrphelins} saut(s) de page au milieu d'un exercice`,
      info: memePlanOk && nbSauts === 0,
    },
    {
      id: 'blancs',
      label: 'Espaces-réponse préservés',
      ok: blancsOk,
      // Tant que la machine seule a produit le texte, l'écart est une faute et
      // il bloque. Dès que l'enseignant a édité, c'est lui qui décide : l'écart
      // devient un signalement. Le bloquer reviendrait à lui interdire de
      // supprimer un exercice.
      blocking: !edite,
      detail: blancsOk
        ? (nbBlancs > 0 ? `${nbBlancs} espace(s)-réponse conservé(s)` : 'Aucun espace-réponse (normal si texte sans blancs)')
        : edite
          ? `${nbBlancs} espace(s)-réponse contre ${nbBlancsOrig} à l'origine — écart dû à votre édition, vérifiez qu'il est voulu`
          : `${nbBlancs} espace(s)-réponse en sortie contre ${nbBlancsOrig} dans l'original — des réponses ont été complétées`,
      info: blancsOk && nbBlancs === 0,
    },
    {
      id: 'choix_distincts',
      label: 'Exercices à choix — deux options distinctes',
      ok: choixOk,
      blocking: true,
      detail: choixOk
        ? 'Aucune paire dégénérée'
        : `Options identiques : ${choixDegeneres.join(' · ')} — le distracteur a été écrasé`,
    },
    {
      id: 'police',
      label: 'Police Arial appliquée',
      ok: true,
      detail: 'Appliquée à l\'export DOCX — non visible ici',
      info: true,
    },
    {
      id: 'sans_doutes',
      label: 'Aucun passage incertain [? ?] résiduel',
      ok: sansDoutesOk,
      blocking: true,
      detail: sansDoutesOk ? 'Texte propre' : `${nbDoutes} passage(s) incertain(s) — corrigez avant export`,
    },
  ]
}

export default function Module2_Adapter() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

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
  const [ocrWarnings, setOcrWarnings] = useState([])
  // Document structuré issu de la lecture. Sa présence active la mise en page
  // déterministe ; s'il est absent (saisie manuelle, texte collé), on retombe
  // sur la génération IA de la mise en page.
  const [doc, setDoc] = useState(null)
  const [pictosParEx, setPictosParEx]     = useState({})
  const [pointsRelecture, setPointsRelecture] = useState([])
  const [auEdite, setAuEdite]             = useState(false)
  const [relu, setRelu]                   = useState(false)
  const [pictoErreur, setPictoErreur]     = useState({})

  // Document AU universel
  const [generatingAu, setGeneratingAu]       = useState(false)
  const [auTexte, setAuTexte]                 = useState('')
  const [withVerbPictos, setWithVerbPictos]   = useState(false)

  // Génération IA adaptations par profil
  const [generating, setGenerating] = useState(false)
  const [resultat, setResultat]     = useState('')
  const [profilSections, setProfilSections] = useState({}) // { dyslexie: "...", tdah: "..." }
  const [error, setError]           = useState('')

  // Personnalisation enseignant (20%)
  const [texteFinal, setTexteFinal] = useState('')
  const [saved, setSaved]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [savedId, setSavedId]       = useState(null)
  const [feedback, setFeedback]     = useState(null) // 'positif' | 'negatif' | null

  // Validation AU
  const [auValidation, setAuValidation] = useState(null)

  // Page warning (PDF > 6 pages)
  const [pageWarning, setPageWarning] = useState(null) // { total, extracted } ou null

  // AR mode — DYS confirmé, police 14pt (RISS dumas-02535815, dumas-04347239)
  const [arMode, setArMode] = useState(false)

  // Vérification solvabilité exercice (RISS hal-05450529)
  const [verifying, setVerifying] = useState('')   // profil en cours
  const [verificationResults, setVerificationResults] = useState({}) // { profil: text }

  // Historique adaptations (mémoire style enseignant — F3)
  const [histoAdaptations, setHistoAdaptations] = useState([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('diff_adaptations')
      .select('texte_final')
      .eq('user_id', user.id)
      .not('texte_final', 'is', null)
      .neq('texte_final', '')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data?.length) {
          setHistoAdaptations(data.map(d => d.texte_final.slice(0, 250)))
        }
      })
  }, [user])

  // Export
  const [exporting, setExporting]   = useState(false)
  const [exportingProfil, setExportingProfil] = useState('') // profil en cours d'export

  // ── Import fichier ───────────────────────────────────────────

  async function handleFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setImportError('Format non supporté — utilisez PDF, DOCX ou une image (JPG, PNG, WebP).')
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
    setOcrWarnings([])
    setDoc(null)
    setPictosParEx({})
    setPointsRelecture([])
    setAuEdite(false)
    setRelu(false)
    setPageWarning(null)
    setAuTexte('')
    setProfilSections({})

    try {
      const { text, doc: d, hasDoutes: hd, nbDoutes: nb, warnings: wn, pageWarning: pw } = await extractFile(file)
      setActivite(text)
      setDoc(d ?? null)
      setHasDoutes(hd)
      setNbDoutes(nb)
      setOcrWarnings(wn ?? [])
      setPageWarning(pw ?? null)
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

  /** Recalcule le document AU depuis la structure, et remet la relecture à zéro. */
  function appliquerRendu(structure, pictos) {
    const { texte } = renderAu(structure, { pictos })
    setAuTexte(texte)
    setAuValidation(validateAuRules(texte, activite, false))
    setAuEdite(false)
    setRelu(false)
  }

  /** Édition manuelle du document AU par l'enseignant — c'est lui qui décide. */
  function editerAu(texte) {
    setAuTexte(texte)
    setAuEdite(true)
    setRelu(false)
    setAuValidation(validateAuRules(texte, activite, true))
  }

  /**
   * Change le mot d'un pictogramme. Le mot proposé est revalidé contre
   * l'amorce et le graphème : l'enseignant décide, mais pas n'importe quoi.
   * Un mot vide retire simplement le pictogramme de l'exercice.
   */
  function changerPicto(cle, index, mot) {
    const [si, ei] = cle.split('.').map(Number)
    const sec = doc.sections[si]
    const ex = sec.exercices[ei]
    const courant = pictosParEx[cle] ?? ex.items.map(() => null)
    const suivant = [...courant]
    const propre = mot.trim().toLowerCase()

    if (!propre) suivant[index] = null
    else if (motPictoValide(propre, ex.items[index].amorce, sec.grapheme)) suivant[index] = propre
    else return { ok: false, raison: `« ${mot} » ne commence pas par « ${ex.items[index].amorce.trim()} » ou ne contient pas « ${sec.grapheme} »` }

    const tous = { ...pictosParEx, [cle]: suivant }
    setPictosParEx(tous)
    appliquerRendu(doc, tous)
    return { ok: true }
  }

  /**
   * Mots-pictos pour les exercices d'amorces illustrés.
   * L'IA propose, `validerPictos` tranche : un mot qui ne commence pas par
   * l'amorce ou ne contient pas le graphème de la section est rejeté.
   */
  async function collecterPictos(structure) {
    const pictos = {}
    const demandes = []
    ;(structure.sections ?? []).forEach((sec, si) => {
      ;(sec.exercices ?? []).forEach((ex, ei) => {
        if (ex.type !== 'amorces') return
        if (!ex.items?.some(it => it.dessin)) return
        demandes.push({ cle: `${si}.${ei}`, sec, ex })
      })
    })

    await Promise.all(demandes.map(async ({ cle, sec, ex }) => {
      try {
        const res = await apiFetch('/api/generate', {
          action: 'proposer_pictos',
          context: {
            grapheme: sec.grapheme ?? '',
            consigne: ex.consigne ?? '',
            amorces: ex.items.map(it => it.amorce),
          },
        })
        if (!res.ok) return
        const { text } = await res.json()
        const mots = JSON.parse(text)?.mots ?? []
        const valides = validerPictos(mots, ex.items, sec.grapheme)
        pictos[cle] = valides
      } catch { /* pas de picto — l'exercice se rend sans, c'est acceptable */ }
    }))

    return pictos
  }

  async function genererAU() {
    if (!activite.trim()) return
    setGeneratingAu(true)

    // Chemin déterministe : la mise en page est calculée, pas générée.
    if (doc) {
      try {
        const pictos = await collecterPictos(doc)
        setPictosParEx(pictos)
        appliquerRendu(doc, pictos)
        setPointsRelecture(pointsAVerifier(doc))
      } catch (err) {
        setError(err.message)
      }
      setGeneratingAu(false)
      return
    }

    try {
      const { text: activiteProtected, map: blanksMap } = protectBlanks(activite)
      const res = await apiFetch('/api/generate', {
        action: 'appliquer_au',
        context: { activite: activiteProtected, matiere, niveau, type_enseignement: typeEns },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      // Strict : sur le document AU, chaque espace-réponse doit survivre à l'identique.
      const auTexteRestored = restoreBlanksStrict(data.text, blanksMap)
      setAuTexte(auTexteRestored)
      setAuValidation(validateAuRules(auTexteRestored, activite, false))
      setAuEdite(false)
      setRelu(false)
      setPointsRelecture([])
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
      const baseText = auTexte || activite
      const { text: baseProtected, map: blanksMap } = protectBlanks(baseText)
      const res = await apiFetch('/api/generate', {
        action: 'adapter_activite',
        context: { activite: baseProtected, objectif, profils: profilsChoisis, niveau, type_enseignement: typeEns, matiere, au_texte: auTexte ? baseProtected : null, historique_enseignant: histoAdaptations.length ? histoAdaptations : undefined },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      const resultatRestored = restoreBlanks(data.text, blanksMap)
      setResultat(resultatRestored)
      setTexteFinal(resultatRestored)
      setProfilSections(parseProfileSections(resultatRestored, profilsChoisis))
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
    await exportUniverselDocx({ auTexte, matiere, niveau, typeEnseignement: typeEns, withVerbPictos })
    setExporting(false)
  }

  async function exporterProfilDocx(profil) {
    if (!auTexte) {
      setError('Génère d\'abord le document AU universel avant d\'exporter une version profil.')
      return
    }
    const arTexte = profilSections[profil] || texteFinal
    setExportingProfil(profil)

    // Pictos Arasaac uniquement pour les profils concernés
    const PROFILS_PICTOS = ['allophone']
    let pictos = []
    if (PROFILS_PICTOS.includes(profil) && activite) {
      try { pictos = await fetchPictosForText(activite, 5) } catch { /* optionnel */ }
    }

    await exportProfilDocx({ profil, arTexte, auTexte: auTexte || activite, pictos, matiere, niveau, typeEnseignement: typeEns, withVerbPictos, arMode })
    setExportingProfil('')
  }

  async function verifierExercice(profil) {
    if (!auTexte) return
    setVerifying(profil)
    try {
      const profilLabel = PROFILS.find(p => p.value === profil)?.label ?? profil
      const res = await apiFetch('/api/generate', {
        action: 'verifier_exercice',
        context: {
          profil: profilLabel,
          exercice_adapte: auTexte,
          niveau,
          type_enseignement: typeEns,
          matiere,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setVerificationResults(prev => ({ ...prev, [profil]: data.text }))
    } catch (err) {
      setError(err.message)
    }
    setVerifying('')
  }

  async function sauvegarder() {
    setSaving(true)
    const { data } = await supabase.from('diff_adaptations').insert({
      user_id:           user.id,
      activite_originale: activite,
      objectif,
      profils:           profilsChoisis,
      variantes_ia:      resultat,
      texte_final:       texteFinal,
      matiere,
      niveau,
      type_enseignement: typeEns,
    }).select('id').single()
    if (data?.id) setSavedId(data.id)
    setFeedback(null)
    setSaved(true)
    setSaving(false)
  }

  async function envoyerFeedback(valeur) {
    if (!savedId) return
    setFeedback(valeur)
    await supabase.from('diff_adaptations').update({ feedback: valeur }).eq('id', savedId)
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
            <label className="label">Importer un fichier (PDF, DOCX ou image)</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-jfb-rose bg-jfb-beige'
                  : 'border-gray-300 hover:border-jfb-gris-cl hover:bg-gray-50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden" onChange={onFileInput} />
              {importing ? (
                <p className="text-sm text-jfb-rose font-medium">Extraction et analyse en cours...</p>
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
                    Glisser-déposer un fichier ou <span className="text-jfb-rose underline">parcourir</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF · DOCX · JPG · PNG · WebP — max 10 Mo</p>
                </>
              )}
            </div>
            {importError && <p className="text-xs text-red-500 mt-1">{importError}</p>}
            {importedFile && !importing && !hasDoutes && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                <span className="text-blue-500 text-sm mt-0.5">ℹ</span>
                <div className="text-xs text-blue-800 space-y-1">
                  <p><strong>Texte extrait — relisez avant de générer.</strong></p>
                  <p>La qualité de l'OCR dépend du document d'origine. Vérifiez particulièrement :</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    <li>Les <strong>espaces-réponse</strong> (.......) sont-ils bien présents et intacts ?</li>
                    <li>Les <strong>lettres encadrant les blancs</strong> sont-elles complètes ? (ex : <code className="bg-blue-100 px-1 rounded">un b..........f</code>, pas <code className="bg-blue-100 px-1 rounded">un b..........</code>)</li>
                    <li>Les <strong>mots courants</strong> sont-ils correctement reconnus ?</li>
                  </ul>
                  <p className="text-blue-600">Corrigez directement dans la zone de texte ci-dessous si nécessaire.</p>
                </div>
              </div>
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
            {pageWarning && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                <span className="text-orange-500 text-sm mt-0.5">⚠</span>
                <p className="text-xs text-orange-800">
                  <strong>PDF de {pageWarning.total} pages</strong> — seules les {pageWarning.extracted} premières pages ont été analysées.
                  Importez le reste du document en un second passage.
                </p>
              </div>
            )}
            {doc && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-green-600 text-sm mt-0.5">✓</span>
                <p className="text-xs text-green-800">
                  <strong>Lecture structurée</strong> — {doc.sections?.length ?? 0} feuille(s),{' '}
                  {(doc.sections ?? []).reduce((n, s) => n + (s.exercices?.length ?? 0), 0)} exercice(s).
                  La mise en page AU sera calculée, pas générée : deux passages donneront le même document.
                  Modifier le texte ci-dessous repasse en mise en page générée.
                </p>
              </div>
            )}
            {ocrWarnings.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                <span className="text-orange-500 text-sm mt-0.5">⚠</span>
                <div className="text-xs text-orange-800 space-y-1">
                  <p><strong>Contrôles de lecture</strong> — comparez ces points avec l'original avant de générer :</p>
                  <ul className="list-disc list-inside">
                    {ocrWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
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
            {/* Une édition manuelle désynchronise le document structuré :
                on l'abandonne plutôt que de mettre en page un état périmé. */}
            <textarea
              className="input resize-none h-36"
              value={activite}
              onChange={e => { setActivite(e.target.value); setDoc(null); setResultat(''); setSaved(false); setAuTexte(''); setProfilSections({}) }}
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
        <div className="card border-jfb-bordure bg-jfb-subtil">
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
              {/* Points à relire en priorité — dirige l'œil avant la relecture. */}
              {pointsRelecture.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900">
                    À vérifier en priorité sur votre original
                  </p>
                  <ul className="mt-2 space-y-1">
                    {pointsRelecture.map((p, i) => (
                      <li key={i} className="text-xs text-amber-900">
                        <span className="font-medium">« {p.extrait} »</span>
                        <span className="text-amber-700"> — {p.raison}</span>
                        <span className="text-amber-600"> · {p.ou}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-700">
                    Cette liste ne repère que ce qui est vérifiable sans dictionnaire.
                    Une lettre mal lue dans un mot plausible n'y figure pas : relisez l'ensemble.
                  </p>
                </div>
              )}

              {/* Panneau pictogrammes — l'enseignant voit le mot retenu et peut le changer. */}
              {doc && Object.keys(pictosParEx).length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Pictogrammes — vérifiez chaque mot</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Un pictogramme n'apparaît que si tous les mots de l'exercice sont renseignés.
                      Videz un champ pour le retirer. Modifier un mot recalcule le document et annule vos éditions du texte.
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(pictosParEx).map(([cle, mots]) => {
                      const [si, ei] = cle.split('.').map(Number)
                      const sec = doc.sections?.[si]
                      const ex  = sec?.exercices?.[ei]
                      if (!ex) return null
                      return (
                        <div key={cle} className="px-4 py-3">
                          <p className="text-xs text-gray-500 mb-2">
                            Exercice {ei + 1}{sec.titre ? ` — ${sec.titre}` : ''}
                            {sec.grapheme ? ` · son « ${sec.grapheme} »` : ''}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {ex.items.map((it, ii) => (
                              <div key={ii} className="w-40">
                                <label className="block text-xs text-gray-600 mb-1">
                                  {it.amorce}<span className="text-gray-400">……</span>{it.suffixe}
                                </label>
                                <input
                                  className="input text-sm py-1"
                                  defaultValue={mots[ii] ?? ''}
                                  placeholder="aucun picto"
                                  onBlur={e => {
                                    const r = changerPicto(cle, ii, e.target.value)
                                    setPictoErreur(prev => ({ ...prev, [`${cle}.${ii}`]: r.ok ? '' : r.raison }))
                                    if (!r.ok) e.target.value = mots[ii] ?? ''
                                  }}
                                />
                                {pictoErreur[`${cle}.${ii}`] && (
                                  <p className="text-xs text-red-600 mt-1">{pictoErreur[`${cle}.${ii}`]}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Document AU — éditable : l'enseignant relit et corrige avant export. */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Document AU — relisez et corrigez
                  </label>
                  {auEdite && <span className="text-xs text-orange-600">modifié par vous</span>}
                </div>
                <textarea
                  className="input resize-y h-80 font-mono text-xs leading-relaxed"
                  value={auTexte}
                  onChange={e => editerAu(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  La lecture d'une écriture manuscrite est une mesure, pas une certitude.
                  Comparez avec votre original : c'est vous qui validez ce que reçoit l'élève.
                  Les contrôles ci-dessous continuent de s'appliquer à vos corrections.
                </p>
              </div>

              {/* Validation AU */}
              {auValidation && (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Vérification des règles AU</p>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {auValidation.map(rule => (
                      <li key={rule.id} className="flex items-start gap-3 px-4 py-2">
                        <span className={`mt-0.5 text-sm font-bold shrink-0 ${
                          rule.info || rule.warn
                            ? 'text-blue-400'
                            : rule.ok
                              ? 'text-green-500'
                              : 'text-red-500'
                        }`}>
                          {rule.info ? 'ℹ' : rule.warn ? '?' : rule.ok ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className={`text-xs font-medium ${rule.ok ? 'text-gray-700' : 'text-red-700'}`}>
                            {rule.label}
                          </p>
                          <p className="text-xs text-gray-400">{rule.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={withVerbPictos}
                  onChange={e => setWithVerbPictos(e.target.checked)}
                  className="w-4 h-4 accent-jfb-rose"
                />
                <span className="text-xs text-gray-600">
                  Picto Arasaac avant chaque verbe d'action (option)
                </span>
              </label>
              {auValidation?.some(r => r.blocking && !r.ok) && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-red-500 text-sm mt-0.5">✗</span>
                  <div className="text-xs text-red-800 space-y-1">
                    <p><strong>Export bloqué</strong> — le document AU ne respecte pas un invariant :</p>
                    <ul className="list-disc list-inside">
                      {auValidation.filter(r => r.blocking && !r.ok).map(r => (
                        <li key={r.id}>{r.label} — {r.detail}</li>
                      ))}
                    </ul>
                    <p>Relancez la génération, ou corrigez le texte source avant d'exporter.</p>
                  </div>
                </div>
              )}
              {/* La relecture est un geste, pas un avertissement qu'on survole. */}
              <label className="flex items-start gap-2 cursor-pointer select-none rounded-lg border border-jfb-bordure bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={relu}
                  onChange={e => setRelu(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-jfb-rose shrink-0"
                />
                <span className="text-xs text-gray-700">
                  <strong>J'ai relu le document ci-dessus</strong> et l'ai comparé à mon original,
                  y compris les mots des pictogrammes.
                </span>
              </label>

              <button
                onClick={exporterAuDocx}
                disabled={exporting || !relu || auValidation?.some(r => r.blocking && !r.ok)}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting ? 'Export...' : '⬇ Exporter document AU universel (.docx)'}
              </button>
              {!relu && !auValidation?.some(r => r.blocking && !r.ok) && (
                <p className="text-xs text-gray-500">
                  Cochez la relecture pour débloquer l'export.
                </p>
              )}
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
                  ? 'border-jfb-rose bg-jfb-beige'
                  : 'border-gray-200 hover:border-jfb-gris-cl'
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
        {profilsChoisis.some(p => ['dyslexie', 'dyspraxie', 'dyscalculie'].includes(p)) && (
          <label className="flex items-start gap-2 cursor-pointer mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200 select-none">
            <input
              type="checkbox"
              checked={arMode}
              onChange={e => setArMode(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-jfb-rose"
            />
            <div>
              <span className="text-xs font-medium text-blue-800">
                Aménagement Raisonnable actif (AR) — police 14pt à l'export profil
              </span>
              <p className="text-xs text-blue-600 mt-0.5">
                Pour élève DYS confirmé avec AR officiel (RISS : dumas-02535815 · dumas-04347239)
              </p>
            </div>
          </label>
        )}
      </div>

      {/* Bouton générer adaptations */}
      <button
        onClick={generer}
        disabled={!canGenerate || generating}
        className="btn-accent w-full py-3 text-base font-semibold"
      >
        {generating ? 'Génération en cours...' : `Recevoir des conseils (${profilsChoisis.length} profil${profilsChoisis.length > 1 ? 's' : ''})`}
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
        <div className="card border-jfb-bordure">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Conseils pédagogiques par profil</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              80% IA — à personnaliser
            </span>
          </div>

          {/* Lecture seule : proposition IA */}
          <div className="bg-jfb-subtil rounded-xl p-4 mb-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-jfb-bordure">
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

          {/* Versions par profil — export + vérification solvabilité */}
          {auTexte && Object.keys(profilSections).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Versions par profil (AU + AR)</p>
              {profilsChoisis.map(profil => {
                const profilDef = PROFILS.find(p => p.value === profil)
                const vr = verificationResults[profil]
                const isVerif = verifying === profil
                const isExport = exportingProfil === profil
                const showAr = arMode && ['dyslexie', 'dyspraxie', 'dyscalculie'].includes(profil)
                return (
                  <div key={profil} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span>{profilDef?.icon}</span>
                        <span className="text-sm font-medium text-gray-800">{profilDef?.label}</span>
                        {showAr && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">AR 14pt</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => verifierExercice(profil)}
                          disabled={isVerif || !!vr}
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          {isVerif ? 'Vérif...' : vr ? 'Vérifié ✓' : 'Vérifier'}
                        </button>
                        <button
                          onClick={() => exporterProfilDocx(profil)}
                          disabled={isExport}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          {isExport ? 'Export...' : '⬇ Exporter'}
                        </button>
                      </div>
                    </div>
                    {vr && (
                      <div className={`px-3 py-2 text-xs whitespace-pre-wrap border-t ${
                        /non solvable|partiellement/i.test(vr)
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-green-50 text-green-800 border-green-200'
                      }`}>
                        {vr}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="text-xs text-gray-400">Vérification : Fliti & Avarello (2025) hal-05450529 · AR 14pt : Nonnenmacher (2018) dumas-02535815</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <button
              onClick={() => navigate('/sequence', { state: { activite: auTexte || activite, objectif, matiere, niveau, typeEns, profils: profilsChoisis } })}
              className="btn-secondary text-sm w-full"
            >
              Créer une séquence CUA à partir de cette activité
            </button>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Fondé sur : Mahi Haddad & Beaud (2025) · Fournier (2024) — corpus RISS
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={exporterDocx}
                disabled={exporting || !texteFinal.trim()}
                className="btn-secondary text-sm"
              >
                {exporting ? 'Export...' : '⬇ Exporter les conseils (.docx)'}
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
          {saved && !feedback && (
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Ça a fonctionné en classe ?</span>
              <button onClick={() => envoyerFeedback('positif')} className="text-xl hover:scale-110 transition-transform" title="Oui">👍</button>
              <button onClick={() => envoyerFeedback('negatif')} className="text-xl hover:scale-110 transition-transform" title="Non">👎</button>
            </div>
          )}
          {feedback && (
            <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">
              Feedback enregistré {feedback === 'positif' ? '👍' : '👎'} — merci
            </p>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
