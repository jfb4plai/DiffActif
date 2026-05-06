import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LogoPlai from './LogoPlai'

const NAV_ITEMS = [
  { to: '/dashboard',    icon: '🏠', label: 'Tableau de bord' },
  { to: '/adapter',      icon: '✨', label: 'Adapter',    badge: 'IA' },
  { to: '/profils',      icon: '👥', label: 'Profils classe' },
  { to: '/sequence',     icon: '📋', label: 'Séquence CUA' },
  { to: '/bibliotheque', icon: '📚', label: 'Bibliothèque' },
  { to: '/progression',  icon: '🎯', label: 'Ma progression' },
  { to: '/references',   icon: '🔬', label: 'Références' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col fixed h-full z-10 shadow-sm">
        {/* Logo + titre */}
        <div className="p-4 border-b border-gray-100">
          <LogoPlai size="sm" />
          <div className="mt-2">
            <div className="font-bold text-brand-900 text-sm">DiffActif</div>
            <div className="text-xs text-gray-400">Différenciation pédagogique — PLAI</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-accent-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Profil utilisateur */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
              <span className="text-brand-700 text-sm font-semibold">
                {profile?.prenom?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {profile?.prenom ?? 'Mon profil'}
              </div>
              <div className="text-xs text-gray-400 truncate">{profile?.matiere ?? ''}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full mt-1 text-xs text-gray-400 hover:text-red-500 py-1.5 transition-colors text-left px-3"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 ml-64">
        <div className="max-w-5xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
