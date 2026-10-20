import { useState } from 'react'
import { Check, History, Minus, Plus, Trash2 } from 'lucide-react'
import type { WorkoutSession, WorkoutSet } from '../types'
import StatusMessage from './StatusMessage'
import { equipmentOptions, weightStep } from '../exerciseSettings'
import { draftKey, readDraft } from '../workoutDrafts'
import { compareSets, formatNumber, setLabel, targetLabel, targetOf } from '../stats'

type Choice = 'repeat' | 'weight' | 'reps' | null

export default function WorkoutExercise({ exercise, session, sets, previous, previousLabel, completed, busy, onSave, onDelete, onHistory }: {
  exercise: WorkoutSession['exercise_plan'][number]; session: number; sets: WorkoutSet[]; completed: boolean; busy: boolean
  previous: WorkoutSet[]; previousLabel: string | null
  onSave: (exercise: number, weight: number, reps: number) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onHistory: () => void
}) {
  const [draft, setDraft] = useState(() => readDraft(session, exercise.id))
  const [choice, setChoice] = useState<Choice>(null)
  const [error, setError] = useState<string | null>(null)
  const unit = exercise.weight_unit || 'kg'
  const equipment = exercise.equipment || 'other'
  const step = weightStep(unit, equipment)
  // Serie de referencia: la misma serie de la semana pasada; si hoy haces más series, la última que hiciste entonces.
  const reference = previous[sets.length] ?? previous[previous.length - 1] ?? sets[sets.length - 1] ?? null
  const referenceIsPrevious = !!previous.length
  const target = targetOf(exercise)
  // Con objetivo: si en esta serie llegaste al máximo del rango, toca subir peso y volver al mínimo;
  // si no, intentar una repetición más.
  const atMax = !!(target && reference && reference.weight > 0 && reference.reps >= target.repMax)
  const recommended: Choice = !target || !reference ? null : reference.weight === 0 || !atMax ? 'reps' : 'weight'

  function persist(next: { weight: string; reps: string }) {
    setDraft(next)
    try {
      if (next.weight === '' && next.reps === '') localStorage.removeItem(draftKey(session, exercise.id))
      else localStorage.setItem(draftKey(session, exercise.id), JSON.stringify(next))
    } catch { /* El guardado en servidor sigue disponible. */ }
  }
  function pick(next: Choice) {
    if (!reference) return
    setChoice(next)
    const weight = reference.weight + (next === 'weight' ? step : 0)
    const reps = next === 'weight' && atMax ? target!.repMin : reference.reps + (next === 'reps' ? 1 : 0)
    persist({ weight: String(weight), reps: String(reps) })
  }
  function nudge(field: 'weight' | 'reps', direction: 1 | -1) {
    setChoice(null)
    const base = draft[field] !== '' ? Number(draft[field]) : reference ? reference[field] : 0
    const value = field === 'weight' ? Math.max(0, Math.round((base + direction * step) * 100) / 100) : Math.max(1, base + direction)
    persist({ weight: field === 'weight' ? String(value) : draft.weight !== '' ? draft.weight : reference ? String(reference.weight) : '', reps: field === 'reps' ? String(value) : draft.reps !== '' ? draft.reps : reference ? String(reference.reps) : '' })
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null)
    const weight = Number(draft.weight), reps = Number(draft.reps)
    if (draft.weight === '' || !Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 1) {
      setError('Introduce un peso válido y al menos una repetición.'); return
    }
    try {
      await onSave(exercise.id, weight, reps)
      persist({ weight: '', reps: '' }); setChoice(null)
    } catch (e) { setError((e as Error).message) }
  }

  const options: { id: Exclude<Choice, null>; label: string; weight: number; reps: number }[] = reference ? [
    { id: 'repeat', label: 'Repetir', weight: reference.weight, reps: reference.reps },
    { id: 'weight', label: `+${formatNumber(step)} ${unit}`, weight: reference.weight + step, reps: atMax ? target!.repMin : reference.reps },
    { id: 'reps', label: '+1 rep', weight: reference.weight, reps: reference.reps + 1 },
  ] : []

  const pendingWeight = draft.weight !== '' ? Number(draft.weight) : null
  const pendingReps = draft.reps !== '' ? Number(draft.reps) : null
  let delta: { text: string; tone: '' | 'up' | 'down' } | null = null
  if (reference && pendingWeight !== null && pendingReps !== null && Number.isFinite(pendingWeight)) {
    const result = compareSets({ weight: pendingWeight, weight_unit: unit, reps: pendingReps }, reference)
    const who = referenceIsPrevious ? 'la semana pasada' : 'tu serie anterior'
    const volume = pendingWeight * pendingReps - reference.weight * reference.reps
    if (result > 0) delta = { tone: 'up', text: `Superas ${who}${volume ? ` · ${volume > 0 ? '+' : ''}${formatNumber(volume)} ${unit} de volumen` : ''}` }
    else if (result === 0) delta = { tone: '', text: `Igualas ${who}.` }
    else delta = { tone: 'down', text: `Por debajo de ${who} (${setLabel(reference)}).` }
  }

  const rows = Math.max(sets.length + (completed ? 0 : 1), previous.length, completed ? 0 : target?.sets ?? 0)
  const equipmentLabel = equipmentOptions.find(option => option.value === equipment)?.label
  return <section className="workout-exercise">
    <div className="exercise-head">
      <div><h2>{exercise.name}</h2><p className="muted">{[target ? `Objetivo ${targetLabel(target)} reps` : null, exercise.muscle_group, equipmentLabel, unit].filter(Boolean).join(' · ')}</p></div>
      <button type="button" className="link-button" onClick={onHistory}><History size={16} />Historial</button>
    </div>

    <div className="compare-table" role="table" aria-label={`Series de ${exercise.name}`}>
      <div className="compare-row head" role="row"><span role="columnheader">Serie</span><span role="columnheader">{previousLabel ?? 'Anterior'}</span><span role="columnheader">Hoy</span><span role="columnheader"><span className="visually-hidden">Comparación</span></span><span role="columnheader"><span className="visually-hidden">Acciones</span></span></div>
      {Array.from({ length: rows }, (_, index) => {
        const before = previous[index], now = sets[index]
        const pending = !completed && index === sets.length
        const result = before && now ? compareSets(now, before) : null
        return <div className={pending ? 'compare-row pending' : 'compare-row'} role="row" key={now?.id ?? 'p' + index}>
          <span className="n" role="cell">{index + 1}</span>
          <span className="prev" role="cell">{before ? setLabel(before) : '—'}</span>
          <span className="now" role="cell">{now ? setLabel(now) : pending ? (pendingWeight !== null && pendingReps !== null ? setLabel({ weight: pendingWeight, reps: pendingReps }) : '…') : '—'}</span>
          <span role="cell" className={`mark ${result === null ? '' : result > 0 ? 'up' : result < 0 ? 'down' : 'same'}`}>{result === null ? '' : result > 0 ? '↑' : result < 0 ? '↓' : '='}</span>
          <span role="cell">{now && (completed ? <Check size={18} className="saved-check" aria-label="Guardada" /> : <button className="icon-button delete-button" title="Borrar serie" aria-label={`Borrar serie ${index + 1} de ${exercise.name}`} disabled={busy} onClick={() => onDelete(now.id).catch(e => setError(e.message))}><Trash2 size={16} /></button>)}</span>
        </div>
      })}
      {!rows && completed && <p className="compare-empty">No se registraron series.</p>}
    </div>

    {!completed && <form className="set-panel" onSubmit={save}>
      <div className="set-panel-head"><strong>Serie {sets.length + 1}{target && sets.length < target.sets ? ` de ${target.sets}` : ''}</strong>{target && sets.length >= target.sets ? <span className="target-done">Objetivo de {target.sets} series cumplido · puedes pasar al siguiente</span> : null}<span>{reference ? `${referenceIsPrevious ? 'Semana pasada' : 'Anterior'}: ${formatNumber(reference.weight)} ${unit} × ${reference.reps}` : 'Primera vez con este ejercicio'}</span></div>
      {!!options.length && <div className="progress-options" role="radiogroup" aria-label="Cómo superar la semana pasada">
        {options.map(option => <button key={option.id} type="button" role="radio" className={recommended === option.id ? 'recommended' : undefined} aria-checked={choice === option.id} disabled={busy} onClick={() => pick(option.id)}>{recommended === option.id && <em>Recomendado</em>}<span>{option.label}</span><strong>{setLabel(option)}</strong></button>)}
      </div>}
      <div className="set-inputs">
        <div className="stepper">
          <button type="button" aria-label={`Restar ${formatNumber(step)} ${unit}`} disabled={busy} onClick={() => nudge('weight', -1)}><Minus size={18} /></button>
          <label><input aria-label={`Peso de ${exercise.name}`} type="number" inputMode="decimal" min={0} max={10000} step="any" placeholder={reference ? formatNumber(reference.weight) : '0'} value={draft.weight} disabled={busy} onChange={event => { setChoice(null); persist({ ...draft, weight: event.target.value }) }} /><span>{unit}</span></label>
          <button type="button" aria-label={`Sumar ${formatNumber(step)} ${unit}`} disabled={busy} onClick={() => nudge('weight', 1)}><Plus size={18} /></button>
        </div>
        <div className="stepper">
          <button type="button" aria-label="Restar una repetición" disabled={busy} onClick={() => nudge('reps', -1)}><Minus size={18} /></button>
          <label><input aria-label={`Repeticiones de ${exercise.name}`} type="number" inputMode="numeric" min={1} max={10000} step={1} placeholder={reference ? String(reference.reps) : '0'} value={draft.reps} disabled={busy} onChange={event => { setChoice(null); persist({ ...draft, reps: event.target.value }) }} /><span>reps</span></label>
          <button type="button" aria-label="Sumar una repetición" disabled={busy} onClick={() => nudge('reps', 1)}><Plus size={18} /></button>
        </div>
        <button className="save-set" disabled={busy} title="Guardar serie" aria-label={`Guardar serie de ${exercise.name}`}><Check size={24} /></button>
      </div>
      {delta && <p className={`delta-text ${delta.tone}`} aria-live="polite">{delta.text}</p>}
    </form>}
    {error && <StatusMessage message={error} />}
  </section>
}
