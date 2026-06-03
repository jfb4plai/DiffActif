import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { NIVEAUX, TYPES_ENSEIGNEMENT, MATIERES, NIVEAUX_MAITRISE } from '../lib/constants'
import LogoPlai from '../components/LogoPlai'

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]     = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    prenom: '',
    etablissement: '',
    matiere: '',
    niveau_enseignement: '',
    type_enseignement: '',
    niveau_maitrise: 'debutant',
  })

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      ...form,
      created_at: new Date().toISOString(),
    })
    if (!error) {
      await refreshProfile()
      navigate('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-jfb-beige to-jfb-beige-dk flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <LogoPlai size="md" />
          </div>
          <h1 className="text-2xl font-bold text-jfb-noir">Bienvenue dans DiffActif</h1>
          <p className="text-jfb-rose text-sm mt-1">Quelques infos pour personnaliser votre expérience</p>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? 'bg-jfb-rose' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="card">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Votre identité</h2>
              <div>
                <label className="label">Prénom</label>
                <input className="input" value={form.prenom}
                  onChange={e => update('prenom', e.target.value)} placeholder="Marie" />
              </div>
              <div>
                <label className="label">Établissement</label>
                <input className="input" value={form.etablissement}
                  onChange={e => update('etablissement', e.target.value)}
                  placeholder="Athénée Royal de..." />
              </div>
              <div>
                <label className="label">Matière principale</label>
                <select className="input" value={form.matiere}
                  onChange={e => update('matiere', e.target.value)}>
                  <option value="">Choisir...</option>
                  {MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Votre contexte d'enseignement</h2>
              <div>
                <label className="label">Niveau(x) enseigné(s)</label>
                <select className="input" value={form.niveau_enseignement}
                  onChange={e => update('niveau_enseignement', e.target.value)}>
                  <option value="">Choisir...</option>
                  {NIVEAUX.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type d'enseignement</label>
                <select className="input" value={form.type_enseignement}
                  onChange={e => update('type_enseignement', e.target.value)}>
                  <option value="">Choisir...</option>
                  {TYPES_ENSEIGNEMENT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Votre point de départ</h2>
              <p className="text-sm text-gray-600">
                DiffActif adapte son niveau d'aide selon votre aisance avec la différenciation.
              </p>
              <div className="space-y-3">
                {NIVEAUX_MAITRISE.map(n => (
                  <label
                    key={n.value}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      form.niveau_maitrise === n.value
                        ? 'border-jfb-rose bg-jfb-beige'
                        : 'border-gray-200 hover:border-jfb-gris-cl'
                    }`}
                  >
                    <input
                      type="radio" name="niveau_maitrise" value={n.value}
                      checked={form.niveau_maitrise === n.value}
                      onChange={e => update('niveau_maitrise', e.target.value)}
                      className="mt-0.5 accent-jfb-rose"
                    />
                    <div>
                      <div className="font-medium text-gray-800">{n.icon} {n.label}</div>
                      <div className="text-sm text-gray-500">{n.description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400">Modifiable à tout moment.</p>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            {step > 1
              ? <button onClick={() => setStep(s => s - 1)} className="btn-secondary">Retour</button>
              : <div />
            }

            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="btn-primary"
                disabled={
                  (step === 1 && !form.prenom) ||
                  (step === 2 && (!form.niveau_enseignement || !form.type_enseignement))
                }
              >
                Suivant
              </button>
            ) : (
              <button onClick={handleSubmit} className="btn-primary" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Commencer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
