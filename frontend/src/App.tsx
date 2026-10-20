import { useEffect, useState } from 'react'
import { ChartNoAxesCombined, Dumbbell, House, ListChecks, CalendarDays, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import HomePage from './pages/HomePage'
import ExercisePage from './pages/ExercisePage'
import RoutinesPage from './pages/RoutinesPages'
import WorkoutPage from './pages/WorkoutPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import StatusMessage from './components/StatusMessage'
import { getMe, logout } from './api/auth'
import type { User } from './api/auth'
import { AUTH_EXPIRED, getToken, setToken } from './auth'
import { applyTheme, loadTheme, saveTheme } from './theme'
import type { ThemeSettings } from './theme'
import './App.css'
import './workouts.css'

const pages = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'train', label: 'Entrenar', icon: Dumbbell },
  { id: 'progress', label: 'Progreso', icon: ChartNoAxesCombined },
  { id: 'routines', label: 'Rutinas', icon: CalendarDays },
  { id: 'exercises', label: 'Ejercicios', icon: ListChecks },
] as const
type Page = typeof pages[number]['id'] | 'settings'
const SIDEBAR_KEY = 'gym-tracker:sidebar-collapsed'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [theme, setTheme] = useState<ThemeSettings>(loadTheme)
  const [autoStartDay, setAutoStartDay] = useState<number | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(() => !!getToken())
  // Menú lateral plegado (solo iconos). Se recuerda en este navegador.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false } })
  function toggleSidebar() {
    setCollapsed(current => {
      try { localStorage.setItem(SIDEBAR_KEY, current ? '0' : '1') } catch { /* Sin almacenamiento local. */ }
      return !current
    })
  }

  // Al abrir la app con un token guardado, se comprueba que siga siendo válido.
  useEffect(() => {
    if (!getToken()) return
    let active = true
    getMe().then(me => { if (active) setUser(me) }).catch(() => { if (active) setToken(null) }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const expired = () => { setToken(null); setUser(null) }
    window.addEventListener(AUTH_EXPIRED, expired)
    return () => window.removeEventListener(AUTH_EXPIRED, expired)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
    if (theme.mode !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyTheme(theme)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [theme])

  async function signOut() {
    try { await logout() } catch { /* Aunque falle la petición, se cierra la sesión en este dispositivo. */ }
    setToken(null); setUser(null); setPage('home')
  }

  function go(next: Page) {
    if (next !== 'train') setAutoStartDay(null)
    setPage(next)
  }

  if (checking) return <div className="auth-screen"><StatusMessage loading message="Comprobando tu sesión..." /></div>
  if (!user) return <AuthPage onAuth={(token, me) => { setToken(token); setUser(me); setPage('home') }} />

  const navButton = (id: Page, label: string, Icon: typeof House, extra = '') => <button key={id} type="button" className={`nav-item ${extra} ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} title={collapsed ? label : undefined} onClick={() => go(id)}><Icon size={20} /><span>{label}</span></button>

  return <div className={collapsed ? 'app-shell collapsed' : 'app-shell'}>
    <aside className="sidebar">
      <div className="sidebar-top">
        <a className="brand" href="#inicio" title={collapsed ? 'Inicio' : undefined} onClick={event => { event.preventDefault(); go('home') }}><span className="brand-icon"><Dumbbell size={20} /></span><span className="brand-name">Gym Tracker</span></a>
        <button type="button" className="icon-button collapse-toggle" aria-expanded={!collapsed} aria-label={collapsed ? 'Desplegar menú' : 'Plegar menú'} title={collapsed ? 'Desplegar menú' : 'Plegar menú'} onClick={toggleSidebar}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>
      </div>
      <span className="nav-caption">MI ENTRENAMIENTO</span>
      <nav aria-label="Principal">
        {pages.map(({ id, label, icon }) => navButton(id, label, icon))}
        {/* En el móvil, Ajustes va con el resto del menú; en pantalla grande, abajo del todo. */}
        {navButton('settings', 'Ajustes', Settings, 'mobile-only')}
      </nav>
      <div className="sidebar-bottom">
        {navButton('settings', 'Ajustes', Settings)}
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span className="greeting">{user.first_name ? `Hola, ${user.first_name}` : 'Tu espacio de entrenamiento'}</span><span className="today">{new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></header>
      <main className="page-content">
        {page === 'home' && <HomePage onStart={day => { setAutoStartDay(day); setPage('train') }} onPlan={() => go('routines')} onProgress={() => go('progress')} />}
        {page === 'exercises' && <ExercisePage />}
        {page === 'routines' && <RoutinesPage />}
        {page === 'train' && <WorkoutPage onPlan={() => go('routines')} autoStartDay={autoStartDay} onAutoStartHandled={() => setAutoStartDay(null)} />}
        {page === 'progress' && <ProgressPage />}
        {page === 'settings' && <SettingsPage theme={theme} onChange={setTheme} user={user} onUserChange={setUser} onLogout={signOut} />}
      </main>
      <footer className="page-footer">Gym Tracker<span>Un entrenamiento a la vez.</span></footer>
    </div>
  </div>
}
