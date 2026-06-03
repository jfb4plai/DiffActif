/**
 * Page /lire — Lecteur audio public (sans authentification)
 * Lit à voix haute le texte passé en paramètre ?t=base64
 * Usage : accessible via QR code depuis les documents DOCX par profil
 */

import { useState, useEffect, useRef } from 'react'

export default function Lire() {
  const [texte, setTexte]       = useState('')
  const [titre, setTitre]       = useState('')
  const [lecture, setLecture]   = useState(false)
  const [pause, setPause]       = useState(false)
  const [vitesse, setVitesse]   = useState(0.85)
  const [voix, setVoix]         = useState(null)
  const [voixDispo, setVoixDispo] = useState([])
  const utterRef = useRef(null)

  // Décode les paramètres URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('t')
    const ti = params.get('titre')
    if (t) {
      try { setTexte(atob(t)) } catch { setTexte('Texte non lisible.') }
    }
    if (ti) {
      try { setTitre(atob(ti)) } catch { setTitre('') }
    }
  }, [])

  // Charge les voix disponibles
  useEffect(() => {
    function chargerVoix() {
      const voixSys = window.speechSynthesis.getVoices()
      const fr = voixSys.filter(v => v.lang.startsWith('fr'))
      setVoixDispo(fr)
      // Priorité : fr-BE > fr-FR > première fr disponible
      const preferred = fr.find(v => v.lang === 'fr-BE')
        || fr.find(v => v.lang === 'fr-FR')
        || fr[0]
        || null
      setVoix(preferred)
    }
    chargerVoix()
    window.speechSynthesis.onvoiceschanged = chargerVoix
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  function lire() {
    if (!texte) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(texte)
    utter.lang = 'fr-BE'
    utter.rate = vitesse
    if (voix) utter.voice = voix
    utter.onend = () => { setLecture(false); setPause(false) }
    utterRef.current = utter
    window.speechSynthesis.speak(utter)
    setLecture(true)
    setPause(false)
  }

  function pauseReprendre() {
    if (pause) {
      window.speechSynthesis.resume()
      setPause(false)
    } else {
      window.speechSynthesis.pause()
      setPause(true)
    }
  }

  function arreter() {
    window.speechSynthesis.cancel()
    setLecture(false)
    setPause(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-10">
      {/* En-tête PLAI */}
      <div className="mb-8 text-center">
        <div className="w-12 h-12 bg-jfb-noir rounded-2xl flex items-center justify-center mx-auto mb-3">
          <span className="text-white text-xl font-bold">DA</span>
        </div>
        <p className="text-xs text-gray-400">DiffActif — PLAI</p>
      </div>

      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        {titre && (
          <h1 className="text-lg font-bold text-gray-900 text-center">{titre}</h1>
        )}

        {/* Texte à lire */}
        {texte ? (
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-gray-100">
            {texte}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center">Aucun texte à lire.</p>
        )}

        {/* Contrôles */}
        {texte && (
          <div className="space-y-4">
            {/* Vitesse */}
            <div>
              <label className="text-xs text-gray-500 flex justify-between mb-1">
                <span>Vitesse de lecture</span>
                <span>{Math.round(vitesse * 100)}%</span>
              </label>
              <input
                type="range" min="0.5" max="1.5" step="0.05"
                value={vitesse}
                onChange={e => setVitesse(parseFloat(e.target.value))}
                className="w-full accent-jfb-rose"
              />
            </div>

            {/* Voix */}
            {voixDispo.length > 1 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Voix</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={voix?.name ?? ''}
                  onChange={e => setVoix(voixDispo.find(v => v.name === e.target.value) ?? null)}
                >
                  {voixDispo.map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3">
              {!lecture ? (
                <button
                  onClick={lire}
                  className="flex-1 bg-jfb-noir hover:bg-jfb-noir-doux text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  Écouter
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseReprendre}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                  >
                    {pause ? 'Reprendre' : 'Pause'}
                  </button>
                  <button
                    onClick={arreter}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-xl text-sm transition-colors"
                  >
                    Arrêter
                  </button>
                </>
              )}
            </div>

            {/* Relire depuis le début */}
            {lecture && (
              <button
                onClick={lire}
                className="w-full text-xs text-gray-400 hover:text-jfb-rose underline"
              >
                Recommencer depuis le début
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-300 mt-6">
        DiffActif — Pôle Liégeois d'Accompagnement vers une École Inclusive
      </p>
    </div>
  )
}
