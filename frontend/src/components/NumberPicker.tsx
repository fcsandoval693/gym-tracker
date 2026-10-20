import { useState } from 'react'
import { List } from 'lucide-react'
import { weightSuggestions } from '../exerciseSettings'
import type { WeightUnit, Equipment } from '../exerciseSettings'

export default function NumberPicker({ label, value, onChange, disabled, kind, unit = 'kg', equipment = 'other' }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean; kind: 'weight' | 'reps'; unit?: WeightUnit; equipment?: Equipment
}) {
  const [custom, setCustom] = useState(false)
  const options = kind === 'weight' ? weightSuggestions(unit, equipment) : Array.from({ length: 100 }, (_, i) => i + 1)
  const extra = value !== '' && !options.includes(Number(value))
  if (custom) return <div className="custom-number"><input aria-label={label} type="number" inputMode={kind === 'weight' ? 'decimal' : 'numeric'} min={kind === 'weight' ? 0 : 1} max={10000} step={kind === 'weight' ? 'any' : 1} value={value} required disabled={disabled} onChange={event => onChange(event.target.value)} /><button type="button" className="icon-button" disabled={disabled} title="Volver al desplegable" aria-label={`Volver al desplegable de ${label}`} onClick={() => setCustom(false)}><List size={16} /></button></div>
  return <select aria-label={label} value={value} disabled={disabled} required onChange={event => event.target.value === 'custom' ? setCustom(true) : onChange(event.target.value)}>
    <option value="">{kind === 'weight' ? unit : 'Reps'}</option>
    <option value="custom">Otro valor…</option>
    {extra && <option value={value}>{Number(value).toLocaleString('es')}{kind === 'weight' ? ' ' + unit : ''}</option>}
    {options.map(option => <option key={option} value={String(option)}>{option.toLocaleString('es')}{kind === 'weight' ? ' ' + unit : ''}</option>)}
  </select>
}
