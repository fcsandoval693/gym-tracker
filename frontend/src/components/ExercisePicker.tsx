import { useState } from 'react'
import { ArrowLeft, Lock, Plus, Search } from 'lucide-react'
import type { Exercise } from '../types'
import type { Equipment, WeightUnit } from '../exerciseSettings'
import { equipmentOptions, muscleGroups } from '../exerciseSettings'
import ExerciseSettingsFields from './ExerciseSettingsFields'
import MuscleGroupSelect from './MuscleGroupSelect'
import StatusMessage from './StatusMessage'

export type PickedExercise = { exercise: Exercise; variant: string; equipment: Equipment; unit: WeightUnit }

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const equipmentLabel = (value?: Equipment) => equipmentOptions.find(option => option.value === value)?.label

/** Buscador del catálogo: eliges ejercicio, luego variante y material, y se añade al entrenamiento. */
export default function ExercisePicker({ exercises, excluded, busy, onPick, onCreate, onCancel }: {
  exercises: Exercise[]; excluded: number[]; busy: boolean
  onPick: (picked: PickedExercise) => void
  onCreate: (name: string, group: string, equipment: Equipment) => Promise<Exercise>
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [chosen, setChosen] = useState<Exercise | null>(null)
  const [variant, setVariant] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('other')
  const [unit, setUnit] = useState<WeightUnit>('kg')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [newEquipment, setNewEquipment] = useState<Equipment>('other')
  const [error, setError] = useState<string | null>(null)

  function choose(exercise: Exercise) {
    setChosen(exercise); setVariant(exercise.variants?.[0] ?? ''); setEquipment(exercise.equipment ?? 'other'); setUnit('kg')
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newName.trim()) return
    setError(null)
    try { choose(await onCreate(newName.trim(), newGroup, newEquipment)); setCreating(false) }
    catch (e) { setError((e as Error).message) }
  }

  if (chosen) return <div className="picker">
    <button type="button" className="link-button" onClick={() => setChosen(null)}><ArrowLeft size={16} />Otro ejercicio</button>
    <h3 className="picker-title">{chosen.name}</h3>
    <p className="muted">{[chosen.muscle_group, equipmentLabel(chosen.equipment)].filter(Boolean).join(' · ')}</p>
    {!!chosen.variants?.length && <fieldset className="chip-field">
      <legend>{chosen.variant_label || 'Variante'}</legend>
      <div className="chips">{chosen.variants.map(option => <button key={option} type="button" className="chip" aria-pressed={variant === option} onClick={() => setVariant(option)}>{option}</button>)}</div>
    </fieldset>}
    <ExerciseSettingsFields unit={unit} equipment={equipment} onUnit={setUnit} onEquipment={setEquipment} disabled={busy} />
    <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="button primary" disabled={busy} onClick={() => onPick({ exercise: chosen, variant, equipment, unit })}><Plus size={18} />{busy ? 'Añadiendo...' : 'Añadir'}</button></div>
  </div>

  if (creating) return <form className="picker editor-form" onSubmit={create}>
    <button type="button" className="link-button" onClick={() => setCreating(false)}><ArrowLeft size={16} />Volver al catálogo</button>
    <h3 className="picker-title">Ejercicio propio</h3>
    <p className="muted">Solo para los movimientos que no estén en el catálogo.</p>
    {error && <StatusMessage message={error} />}
    <label>Nombre<input required maxLength={100} value={newName} disabled={busy} onChange={event => setNewName(event.target.value)} placeholder="Ej. Remo Meadows" /></label>
    <label>Grupo muscular<MuscleGroupSelect value={newGroup} disabled={busy} onChange={setNewGroup} /></label>
    <label>Material<select value={newEquipment} disabled={busy} onChange={event => setNewEquipment(event.target.value as Equipment)}>{equipmentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <div className="form-actions"><button className="button primary" disabled={busy}>Crear y elegir</button></div>
  </form>

  const groups = muscleGroups.filter(item => exercises.some(exercise => exercise.muscle_group === item))
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const results = exercises
    .filter(exercise => !excluded.includes(exercise.id))
    .filter(exercise => !group || exercise.muscle_group === group)
    .filter(exercise => words.every(word => normalize(`${exercise.name} ${exercise.muscle_group} ${(exercise.variants ?? []).join(' ')}`).includes(word)))
    .sort((a, b) => Number(!!b.is_builtin) - Number(!!a.is_builtin) || a.name.localeCompare(b.name, 'es'))

  return <div className="picker">
    <label className="search-field"><Search size={18} /><input aria-label="Buscar ejercicio" placeholder="Buscar: remo, polea, supino..." value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="chips scroll" role="group" aria-label="Grupo muscular">
      <button type="button" className="chip" aria-pressed={group === ''} onClick={() => setGroup('')}>Todos</button>
      {groups.map(item => <button key={item} type="button" className="chip" aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
    </div>
    <ul className="picker-list">
      {results.map(exercise => <li key={exercise.id}><button type="button" onClick={() => choose(exercise)}>
        <span><strong>{exercise.name}</strong><small>{[exercise.muscle_group, equipmentLabel(exercise.equipment), exercise.variants?.length ? `${exercise.variants.length} variantes` : null].filter(Boolean).join(' · ')}</small></span>
        {exercise.is_builtin ? <Lock size={14} aria-label="Del catálogo" /> : <span className="own-tag">Tuyo</span>}
      </button></li>)}
      {!results.length && <li className="muted picker-empty">No hay ejercicios con esa búsqueda.</li>}
    </ul>
    <button type="button" className="button secondary picker-create" onClick={() => { setCreating(true); setNewName(query); setNewGroup(group) }}><Plus size={18} />Crear ejercicio propio</button>
  </div>
}
