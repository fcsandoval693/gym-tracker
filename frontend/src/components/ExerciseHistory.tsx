import { useEffect, useState } from 'react'
import type { WorkoutSession, WorkoutSet } from '../types'
import { getWorkoutSets } from '../api/workouts'
import StatusMessage from './StatusMessage'
import { volumeKg } from '../exerciseSettings'
import { bestSet, exerciseOf, formatNumber, setLabel, shortDate, toKg } from '../stats'

/** Historial de un ejercicio en las sesiones finalizadas: mejor serie, progreso y series de cada día. */
export default function ExerciseHistory({ exercise, sessions }: { exercise: number; sessions: WorkoutSession[] }) {
  const [sets, setSets] = useState<WorkoutSet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getWorkoutSets().then(data => { if (active) setSets(data) }).catch(e => { if (active) setError((e as Error).message) })
    return () => { active = false }
  }, [])
  if (error) return <StatusMessage message={error} />
  if (!sets) return <StatusMessage loading message="Cargando historial..." />

  const finished = sessions.filter(item => item.end_time).sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))
  const days = finished.map(session => ({ session, sets: sets.filter(set => set.workout_session === session.id && exerciseOf(set) === exercise) })).filter(day => day.sets.length)
  if (!days.length) return <p className="muted">Todavía no hay sesiones finalizadas con este ejercicio.</p>

  const all = days.flatMap(day => day.sets)
  const best = bestSet(all)!
  const recent = days.slice(0, 6).reverse()
  const bests = recent.map(day => bestSet(day.sets)!)
  const weights = bests.map(toKg)
  const max = Math.max(...weights), min = Math.min(...weights)
  const first = bests[0], last = bests[bests.length - 1]
  const change = toKg(last) - toKg(first)

  return <>
    <div className="history-stats">
      <div><span>Mejor serie</span><strong>{formatNumber(best.weight)} {best.weight_unit} × {best.reps}</strong></div>
      <div><span>Últimas {recent.length}</span><strong className={change > 0 ? 'positive' : ''}>{change >= 0 ? '+' : ''}{formatNumber(change, 1)} kg</strong></div>
      <div><span>Sesiones</span><strong>{days.length}</strong></div>
    </div>
    <p className="muted">Peso de la mejor serie en cada sesión</p>
    <div className="bar-chart" style={{ height: 120, marginTop: 8 }}>{bests.map((set, index) => <div key={recent[index].session.id} className={index === bests.length - 1 ? 'current' : ''}>
      <span>{formatNumber(set.weight)}</span>
      <i style={{ height: `${Math.round(20 + (max > min ? (toKg(set) - min) / (max - min) : 1) * 50)}px` }} />
      <small>{shortDate(recent[index].session.start_time).replace(/^\w+\.?,?\s*/, '')}</small>
    </div>)}</div>
    <ul className="history-list">{days.slice(0, 8).map(day => <li key={day.session.id}>
      <header><strong>{shortDate(day.session.start_time)} · {day.session.day_name}</strong><span>{formatNumber(volumeKg(day.sets), 0)} kg</span></header>
      <div className="set-chips">{day.sets.map(set => <span key={set.id}>{setLabel(set)}</span>)}</div>
    </li>)}</ul>
  </>
}
