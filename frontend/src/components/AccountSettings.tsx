import { useState } from 'react'
import { KeyRound, LogOut, Save } from 'lucide-react'
import { changePassword, updateMe } from '../api/auth'
import type { User } from '../api/auth'
import { setToken } from '../auth'
import StatusMessage from './StatusMessage'

type Message = { text: string; ok: boolean } | null

/** Datos de la cuenta: nombre, contraseña y cerrar sesión. */
export default function AccountSettings({ user, onUserChange, onLogout }: { user: User; onUserChange: (user: User) => void; onLogout: () => void }) {
  const [name, setName] = useState(user.first_name)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameMessage, setNameMessage] = useState<Message>(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [passMessage, setPassMessage] = useState<Message>(null)

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNameBusy(true); setNameMessage(null)
    try {
      onUserChange(await updateMe(name.trim()))
      setNameMessage({ text: 'Nombre guardado.', ok: true })
    } catch (e) { setNameMessage({ text: (e as Error).message, ok: false }) }
    finally { setNameBusy(false) }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPassMessage(null)
    // Esta comprobación se hace aquí, sin preguntar al servidor: si no coinciden, no hace falta enviar nada.
    if (next !== repeat) { setPassMessage({ text: 'Las contraseñas nuevas no coinciden.', ok: false }); return }
    setPassBusy(true)
    try {
      const result = await changePassword(current, next)
      setToken(result.token)
      setCurrent(''); setNext(''); setRepeat('')
      setPassMessage({ text: 'Contraseña cambiada. En otros dispositivos tendrás que volver a iniciar sesión.', ok: true })
    } catch (e) { setPassMessage({ text: (e as Error).message, ok: false }) }
    finally { setPassBusy(false) }
  }

  const nameChanged = name.trim() !== user.first_name

  return <section className="settings-section" aria-labelledby="account-title">
    <div className="section-heading"><h2 id="account-title">Cuenta</h2></div>
    <div className="account-grid">
      <form className="card editor-form" onSubmit={saveName}>
        <h3>Perfil</h3>
        <label>Nombre<input autoComplete="given-name" maxLength={150} value={name} placeholder="Cómo quieres que te salude la app" disabled={nameBusy} onChange={event => { setName(event.target.value); setNameMessage(null) }} /></label>
        <label>Email<input type="email" value={user.email} readOnly disabled /></label>
        {nameMessage && <StatusMessage message={nameMessage.text} success={nameMessage.ok} />}
        <div className="form-actions"><button className="button primary" disabled={nameBusy || !nameChanged}><Save size={18} />{nameBusy ? 'Guardando…' : 'Guardar nombre'}</button></div>
      </form>

      <form className="card editor-form" onSubmit={savePassword}>
        <h3>Contraseña</h3>
        <label>Contraseña actual<input type="password" required autoComplete="current-password" value={current} disabled={passBusy} onChange={event => setCurrent(event.target.value)} /></label>
        <label>Nueva contraseña<input type="password" required minLength={8} autoComplete="new-password" value={next} disabled={passBusy} onChange={event => setNext(event.target.value)} /></label>
        <label>Repite la nueva contraseña<input type="password" required autoComplete="new-password" value={repeat} disabled={passBusy} onChange={event => setRepeat(event.target.value)} /></label>
        <p className="muted">Mínimo 8 caracteres, que no sea solo números ni una contraseña muy común.</p>
        {passMessage && <StatusMessage message={passMessage.text} success={passMessage.ok} />}
        <div className="form-actions"><button className="button primary" disabled={passBusy}><KeyRound size={18} />{passBusy ? 'Cambiando…' : 'Cambiar contraseña'}</button></div>
      </form>
    </div>
    <div className="card account-card">
      <div><strong>Cerrar sesión</strong><span className="muted">Tus datos quedan guardados en tu cuenta.</span></div>
      <button type="button" className="button secondary" onClick={onLogout}><LogOut size={18} />Cerrar sesión</button>
    </div>
  </section>
}
