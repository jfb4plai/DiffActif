import { REFERENCES_RISS } from '../lib/constants'

const HORS_RISS = [
  {
    auteur: 'Tomlinson, C. A.',
    annee: 2001,
    titre: 'The Differentiated Classroom: Responding to the Needs of All Learners',
    note: 'Réel, hors corpus RISS',
    concept: 'Différenciation pédagogique',
  },
  {
    auteur: 'Przesmycki, H.',
    annee: 1991,
    titre: 'Pédagogie différenciée',
    note: 'Réel, hors corpus RISS',
    concept: 'Différenciation pédagogique',
  },
  {
    auteur: 'Sweller, J.',
    annee: 1988,
    titre: 'Cognitive load during problem solving (Cognitive Science)',
    note: 'Réel, hors corpus RISS — cité dans 4 articles RISS',
    concept: 'Charge cognitive',
  },
  {
    auteur: 'CAST',
    annee: 2018,
    titre: 'Universal Design for Learning Guidelines version 2.2',
    note: 'Réel, hors corpus RISS',
    concept: 'CUA / UDL',
  },
]

const CONCEPTS = [...new Set(REFERENCES_RISS.map(r => r.concept))]

export default function References() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Références scientifiques</h1>
        <p className="text-gray-500 text-sm mt-1">
          Toutes les références RISS ont été vérifiées dans le corpus de 522 627 articles francophones
        </p>
      </div>

      {/* Badge corpus */}
      <div className="card bg-jfb-beige border-jfb-bordure flex items-center gap-4">
        <div className="w-12 h-12 bg-jfb-noir rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xl">🔬</span>
        </div>
        <div>
          <div className="font-semibold text-jfb-noir text-sm">Corpus RISS</div>
          <div className="text-xs text-jfb-gris">
            522 627 articles scientifiques francophones — dyslexie, TDAH, inclusion, neurosciences de l'apprentissage, CUA
          </div>
        </div>
      </div>

      {/* Références RISS validées */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Validées dans le corpus RISS
        </h2>
        <div className="space-y-3">
          {REFERENCES_RISS.map(ref => (
            <div key={ref.id} className="card py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge bg-jfb-beige text-jfb-rose">RISS ✓</span>
                    <span className="badge bg-gray-100 text-gray-600">{ref.concept}</span>
                    <span className="text-xs text-gray-400">{ref.annee}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{ref.titre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ref.auteur}</p>
                  {ref.doi && (
                    <p className="text-xs text-gray-400 mt-1">DOI : {ref.doi}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="font-mono text-xs text-jfb-rose bg-jfb-subtil px-2 py-1 rounded">
                    {ref.riss_id}
                  </div>
                </div>
              </div>

              {/* Utilisation dans DiffActif */}
              {ref.utilisation && ref.utilisation.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Utilisé dans DiffActif
                  </p>
                  <div className="space-y-1.5">
                    {ref.utilisation.map((u, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="badge bg-jfb-subtil text-jfb-rose flex-shrink-0 mt-0.5">
                          {u.module}
                        </span>
                        <span className="text-xs text-gray-600">{u.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Références réelles hors RISS */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Réelles — hors corpus RISS
        </h2>
        <div className="space-y-2">
          {HORS_RISS.map((ref, i) => (
            <div key={i} className="card py-4 border-gray-200">
              <div className="flex items-start gap-3">
                <span className="badge bg-gray-100 text-gray-500 flex-shrink-0 mt-0.5">Hors RISS</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{ref.titre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ref.auteur} ({ref.annee})</p>
                  <p className="text-xs text-gray-400 mt-1 italic">{ref.note}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-gray-50 border-gray-200">
        <p className="text-xs text-gray-500">
          Politique de citation DiffActif : toute référence publiée dans l'outil est d'abord vérifiée dans le corpus RISS.
          Si elle est réelle mais absente du corpus, elle est signalée explicitement comme « hors corpus RISS ».
        </p>
      </div>
    </div>
  )
}
