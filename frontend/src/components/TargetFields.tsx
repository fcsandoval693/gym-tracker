import { Minus, Plus } from 'lucide-react'
import type { Target } from '../stats'

const limits = { sets: [1, 10], repMin: [1, 100], repMax: [1, 100] } as const
const labels = { sets: 'Series', repMin: 'Reps mín.', repMax: 'Reps máx.' } as const

/** Tres contadores para el objetivo: series, repeticiones mínimas y máximas. */
export default function TargetFields({ value, onChange, disabled }: { value: Target; onChange: (value: Target) => void; disabled?: boolean }) {
  function set(field: keyof Target, next: number) {
    const [min, max] = limits[field]
    const updated = { ...value, [field]: Math.min(max, Math.max(min, next)) }
    // El rango siempre tiene sentido: si el mínimo supera al máximo, el otro se mueve con él.
    if (field === 'repMin' && updated.repMin > updated.repMax) updated.repMax = updated.repMin
    if (field === 'repMax' && updated.repMax < updated.repMin) updated.repMin = updated.repMax
    onChange(updated)
  }
  return <fieldset className="target-fields">
    <legend>Objetivo</legend>
    <div className="target-grid">{(Object.keys(labels) as (keyof Target)[]).map(field => <div key={field} className="stepper compact">
      <button type="button" aria-label={`Restar a ${labels[field]}`} disabled={disabled} onClick={() => set(field, value[field] - 1)}><Minus size={16} /></button>
      <label><input type="number" inputMode="numeric" aria-label={labels[field]} min={limits[field][0]} max={limits[field][1]} value={value[field]} disabled={disabled} onChange={event => set(field, Number(event.target.value) || limits[field][0])} /><span>{labels[field]}</span></label>
      <button type="button" aria-label={`Sumar a ${labels[field]}`} disabled={disabled} onClick={() => set(field, value[field] + 1)}><Plus size={16} /></button>
    </div>)}</div>
    <p className="muted target-hint">Cuando hagas {value.repMax} reps en {value.sets === 1 ? 'la serie' : `las ${value.sets} series`}, la app te propondrá subir peso y volver a {value.repMin}.</p>
  </fieldset>
}
