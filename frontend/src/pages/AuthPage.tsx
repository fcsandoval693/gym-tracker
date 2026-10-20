import { useState } from 'react'
import { Dumbbell, LogIn, UserPlus } from 'lucide-react'
import { login, register } from '../api/auth'
import type { User } from '../api/auth'
import StatusMessage from '../components/StatusMessage'

/** Pantalla de acceso: iniciar sesión o crear una cuenta. */
export default function AuthPage({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (mode === 'register' && password !== repeat) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true)
    try {
      const result = mode === 'login' ? await login(email.trim(), password) : await register(email.trim(), password, name.trim())
      onAuth(result.token, result.user)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  function switchMode(next: 'login' | 'register') {
    setMode(next); setError(null); setPassword(''); setRepeat('')
  }

  return <div className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="brand"><span className="brand-icon"><Dumbbell size={20} /></span>Gym Tracker</div>
      <div className="mode-switch auth-tabs" role="tablist" aria-label="Acceso">
        <button type="button" role="tab" aria-selected={mode === 'login'} aria-checked={mode === 'login'} onClick={() => switchMode('login')}>Iniciar sesión</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} aria-checked={mode === 'register'} onClick={() => switchMode('register')}>Crear cuenta</button>
      </div>
      <h1 id="auth-title">{mode === 'login' ? 'Bienvenido de nuevo' : 'Empieza a entrenar'}</h1>
      <p className="muted">{mode === 'login' ? 'Entra para ver tus rutinas y tu progreso.' : 'Tus rutinas, sesiones y récords quedan guardados en tu cuenta.'}</p>
      <form className="editor-form" onSubmit={submit}>
        {error && <StatusMessage message={error} />}
        {mode === 'register' && <label>Nombre (opcional)<input autoComplete="given-name" maxLength={150} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>}
        <label>Email<input type="email" required autoComplete="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
        <label>Contraseña<input type="password" required minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
        {mode === 'register' && <>
          <label>Repite la contraseña<input type="password" required autoComplete="new-password" value={repeat} disabled={busy} onChange={event => setRepeat(event.target.value)} /></label>
          <p className="muted">Mínimo 8 caracteres, que no sea solo números ni una contraseña muy común.</p>
        </>}
        <button className="button primary large" disabled={busy}>{mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}{busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
    </section>
  </div>
}
