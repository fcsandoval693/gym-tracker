import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Play, Plus } from 'lucide-react'
import type { Exercise, Routine, RoutineDay, RoutineExercise, WorkoutSession } from '../types'
import { addRoutineExercise, getRoutineExercises, weekdays } from '../api/planner'
import { createExercise } from '../api/exercises'
import type { Equipment } from '../exerciseSettings'
import { recommendDay, shortDate } from '../stats'
import ExercisePicker from './ExercisePicker'
import type { PickedExercise } from './ExercisePicker'
import StatusMessage from './StatusMessage'

/**
 * Eliges qué entrenamiento haces hoy. Se propone el que toca (o el que quedó pendiente),
 * pero puedes escoger cualquiera de la rutina. Si un entrenamiento no tiene ejercicios, los añades aquí.
 */
export default function TrainingChooser({ routines, days, sessions, exercises, busy, initialDay, onStart, onContinue, onPlan }: {
  initialDay?: number
  routines: Routine[]; days: RoutineDay[]; sessions: WorkoutSession[]; exercises: Exercise[]; busy: boolean
  onStart: (day: number) => void; onContinue: (session: WorkoutSession) => void; onPlan: () => void
}) {
  const withDays = routines.filter(routine => days.some(day => day.routine === routine.id))
  const initial = useMemo(() => {
    const given = days.find(day => day.id === initialDay)
    return given ? { day: given } : recommendDay(days.filter(day => day.routine === withDays[0]?.id), sessions)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [routineId, setRoutineId] = useState<number | null>(initial?.day.routine ?? withDays[0]?.id ?? null)
  const routineDays = days.filter(day => day.routine === routineId).sort((a, b) => a.id - b.id)
  const recommendation = recommendDay(routineDays, sessions)
  const [selected, setSelected] = useState<number | null>(initial?.day.id ?? null)
  const [plans, setPlans] = useState<Record<number, RoutineExercise[]>>({})
  const [library, setLibrary] = useState(exercises)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chosen = routineDays.find(day => day.id === selected) ?? recommendation?.day ?? null

  useEffect(() => {
    let active = true
    Promise.all(routineDays.map(day => getRoutineExercises(day.id).then(items => [day.id, items] as const)))
      .then(entries => { if (active) setPlans(Object.fromEntries(entries)) })
      .catch(e => { if (active) setError((e as Error).message) })
    return () => { active = false }
  }, [routineId]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = sessions.filter(item => !item.end_time)
  if (!withDays.length) return <div className="empty-state"><p>Tu rutina todavía no tiene entrenamientos (por ejemplo Push, Pull y Legs).</p><button className="button primary" onClick={onPlan}>Crear mis entrenamientos</button></div>

  async function add(picked: PickedExercise) {
    if (!chosen) return
    setSaving(true); setError(null)
    try {
      const current = plans[chosen.id] ?? []
      const item = await addRoutineExercise(chosen.id, picked.exercise.id, current.length, picked.unit, picked.equipment, picked.variant)
      setPlans(all => ({ ...all, [chosen.id]: [...current, item] })); setAdding(false)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }
  async function createOwn(name: string, group: string, equipment: Equipment) {
    const exercise = await createExercise(name, group, equipment)
    setLibrary(current => [...current, exercise])
    return exercise
  }
  function reasonLabel(day: RoutineDay) {
    if (recommendation?.day.id !== day.id) return null
    if (recommendation.reason === 'today') return 'Toca hoy'
    if (recommendation.reason === 'pending') return `Pendiente del ${weekdays[recommendation.weekday!].toLowerCase()}`
    return 'Recomendado'
  }

  const chosenPlan = chosen ? plans[chosen.id] : undefined
  const openForChosen = chosen ? open.find(item => item.routine_day === chosen.id) : undefined
  if (adding && chosen) return <div className="chooser">
    <button type="button" className="link-button" onClick={() => setAdding(false)}><ArrowLeft size={16} />Volver</button>
    <h3 className="picker-title">Añadir a {chosen.name}</h3>
    {error && <StatusMessage message={error} />}
    <ExercisePicker exercises={library} excluded={(chosenPlan ?? []).map(item => item.exercise).filter((id): id is number => id !== null)} busy={saving} onPick={add} onCreate={createOwn} onCancel={() => setAdding(false)} />
  </div>

  return <div className="chooser">
    {open.map(item => <div className="open-session" key={item.id}><div><strong>{item.day_name} en curso</strong><small>Empezada {shortDate(item.start_time)}</small></div><button className="button secondary" disabled={busy} onClick={() => onContinue(item)}><Play size={16} />Continuar</button></div>)}
    {withDays.length > 1 && <div className="chips" role="group" aria-label="Rutina">{withDays.map(routine => <button key={routine.id} type="button" className="chip" aria-pressed={routineId === routine.id} onClick={() => { setRoutineId(routine.id); setSelected(null) }}>{routine.name}</button>)}</div>}
    <div className="sheet-options" role="radiogroup" aria-label="Entrenamiento de hoy">
      {routineDays.map(day => {
        const count = plans[day.id]?.length
        const last = sessions.filter(item => item.end_time && item.routine_day === day.id).sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))[0]
        const label = reasonLabel(day)
        return <button key={day.id} type="button" role="radio" aria-checked={chosen?.id === day.id} onClick={() => { setSelected(day.id); setError(null) }}>
          <span><strong>{day.name}{label && <em className="reason-tag">{label}</em>}</strong>
            <small>{count === undefined ? 'Cargando…' : count ? `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'}` : 'Sin ejercicios todavía'}{last ? ` · última vez ${shortDate(last.start_time)}` : ''}</small></span>
          {chosen?.id === day.id && <Check size={20} />}
        </button>
      })}
    </div>
    {error && <StatusMessage message={error} />}
    {chosen && chosenPlan && !chosenPlan.length && <p className="muted">{chosen.name} aún no tiene ejercicios. Añade al menos uno para empezar; se guardan en tu rutina.</p>}
    <div className="sheet-actions">
      {chosen && chosenPlan && !chosenPlan.length
        ? <button type="button" className="button primary large" disabled={busy || saving} onClick={() => setAdding(true)}><Plus size={18} />Añadir ejercicios a {chosen.name}</button>
        : openForChosen
          ? <button type="button" className="button primary large" disabled={busy} onClick={() => onContinue(openForChosen)}><Play size={18} />Continuar {chosen?.name}</button>
          : <button type="button" className="button primary large" disabled={busy || !chosen || !chosenPlan} onClick={() => chosen && onStart(chosen.id)}><Play size={18} />{busy ? 'Empezando…' : `Empezar ${chosen?.name ?? ''}`}</button>}
      {chosen && !!chosenPlan?.length && <button type="button" className="button secondary" disabled={busy || saving} onClick={() => setAdding(true)}><Plus size={18} />Añadir ejercicio a {chosen.name}</button>}
    </div>
  </div>
}
