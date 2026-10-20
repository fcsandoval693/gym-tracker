import { Monitor, Moon, Sun } from 'lucide-react'
import AccountSettings from '../components/AccountSettings'
import type { User } from '../api/auth'
import { accents, palettes, resolveMode } from '../theme'
import type { ThemeMode, ThemeSettings } from '../theme'

const modes: { id: ThemeMode; label: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Oscuro', icon: Moon },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'system', label: 'Según el sistema', icon: Monitor },
]

export default function SettingsPage({ theme, onChange, user, onUserChange, onLogout }: { theme: ThemeSettings; onChange: (theme: ThemeSettings) => void; user: User; onUserChange: (user: User) => void; onLogout: () => void }) {
  const mode = resolveMode(theme.mode)
  return <>
    <div className="page-heading"><div><p className="eyebrow">TU APP</p><h1>Configuración</h1><p>Tu cuenta, los colores y el modo con el que entrenas.</p></div></div>

    <AccountSettings user={user} onUserChange={onUserChange} onLogout={onLogout} />

    <section className="settings-section" aria-labelledby="mode-title">
      <div className="section-heading"><h2 id="mode-title">Modo</h2></div>
      <p>Cada combinación de color tiene versión oscura y clara.</p>
      <div className="mode-switch" role="radiogroup" aria-labelledby="mode-title">
        {modes.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="radio" aria-checked={theme.mode === id} onClick={() => onChange({ ...theme, mode: id })}><Icon size={18} />{label}</button>)}
      </div>
    </section>

    <section className="settings-section" aria-labelledby="accent-title">
      <div className="section-heading"><h2 id="accent-title">Combinación de color</h2><span>Vista en modo {mode === 'dark' ? 'oscuro' : 'claro'}</span></div>
      <div className="accent-grid" role="radiogroup" aria-labelledby="accent-title">
        {accents.map(accent => {
          const tokens = palettes[accent.id][mode]
          return <button key={accent.id} type="button" role="radio" aria-checked={theme.accent === accent.id} className="accent-option" onClick={() => onChange({ ...theme, accent: accent.id })}>
            <div><strong>{accent.name}</strong><br /><small>{accent.description}</small></div>
            <span className="swatches" aria-hidden="true">{[tokens.bg, tokens.surface, tokens.accent, tokens.text].map(color => <i key={color} style={{ background: color }} />)}</span>
            <span className="accent-preview" aria-hidden="true" style={{ background: tokens.bg, padding: 8, borderRadius: 6 }}>
              <span style={{ background: tokens.accent, color: tokens.onAccent }}>Guardar</span>
              <span style={{ background: tokens.surface, color: tokens.accentText, border: `1px solid ${tokens.line2}` }}>+2,5 kg</span>
            </span>
          </button>
        })}
      </div>
    </section>
  </>
}
