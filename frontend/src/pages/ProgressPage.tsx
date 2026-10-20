import { useEffect, useMemo, useState } from 'react'
import { getSessions, getWorkoutSets } from '../api/workouts'
import type { WorkoutSession, WorkoutSet } from '../types'
import StatusMessage from '../components/StatusMessage'
import ProgressLineChart from '../components/ProgressLineChart'
import { volumeKg } from '../exerciseSettings'
import { bestSet, exerciseOf, formatNumber, setLabel, shortDate, toKg, weekStart } from '../stats'

const periods = [
  { id: '4w', label: '4 semanas', days: 28 },
  { id: '3m', label: '3 meses', days: 91 },
  { id: '6m', label: '6 meses', days: 182 },
  { id: 'all', label: 'Todo', days: null },
] as const
type PeriodId = typeof periods[number]['id']

const DAY = 24 * 60 * 60 * 1000
const minutesOf = (session: WorkoutSession) => session.end_time ? Math.round((Date.parse(session.end_time) - Date.parse(session.start_time)) / 60000) : 0
const weekLabel = (date: Date) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(date)

export default function ProgressPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodId>('3m')
  const [exerciseId, setExerciseId] = useState<number | null>(null)
  const [hoverWeek, setHoverWeek] = useState<number | null>(null)
  const [now] = useState(() => Date.now())
  const [shown, setShown] = useState(10)

  useEffect(() => {
    let active = true
    Promise.all([getSessions(), getWorkoutSets()]).then(([history, data]) => {
      if (active) { setSessions(history.filter(session => !!session.end_time)); setSets(data) }
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const view = useMemo(() => {
    const days = periods.find(item => item.id === period)!.days
    const from = days ? now - days * DAY : 0
    const inPeriod = sessions.filter(item => Date.parse(item.start_time) >= from).sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))
    const ids = new Set(inPeriod.map(item => item.id))
    const periodSets = sets.filter(set => ids.has(set.workout_session))
    const bySession = new Map<number, WorkoutSet[]>()
    for (const set of periodSets) bySession.set(set.workout_session, [...(bySession.get(set.workout_session) ?? []), set])

    // Semanas del periodo (como mucho las últimas 26 para que el gráfico se lea).
    const firstDate = inPeriod.length ? new Date(inPeriod[inPeriod.length - 1].start_time) : new Date()
    const current = weekStart(new Date())
    const firstWeek = weekStart(days ? new Date(from) : firstDate)
    const weekCount = Math.min(26, Math.max(1, Math.round((current.getTime() - firstWeek.getTime()) / (7 * DAY)) + 1))
    const weeks = Array.from({ length: weekCount }, (_, index) => {
      const start = new Date(current); start.setDate(start.getDate() - (weekCount - 1 - index) * 7)
      const end = new Date(start); end.setDate(end.getDate() + 7)
      const list = inPeriod.filter(item => new Date(item.start_time) >= start && new Date(item.start_time) < end)
      return { start, sessions: list.length, volume: list.reduce((sum, item) => sum + volumeKg(bySession.get(item.id) ?? []), 0) }
    })
    const weeksElapsed = Math.max(1, (now - (days ? from : firstDate.getTime())) / (7 * DAY))

    // Ejercicios con datos en el periodo, del más al menos hecho.
    const counts = new Map<number, { id: number; name: string; sessions: Set<number>; volume: number }>()
    for (const set of periodSets) {
      const id = exerciseOf(set)
      if (id === null) continue
      const entry = counts.get(id) ?? { id, name: set.exercise_name || 'Ejercicio', sessions: new Set<number>(), volume: 0 }
      entry.sessions.add(set.workout_session)
      entry.volume += toKg(set) * set.reps
      counts.set(id, entry)
    }
    const exercises = [...counts.values()].sort((a, b) => b.sessions.size - a.sessions.size || b.volume - a.volume)

    // Series por grupo muscular (sale de la copia del plan guardada en cada sesión).
    const groups = new Map<string, number>()
    for (const session of inPeriod) for (const item of session.exercise_plan) {
      const done = (bySession.get(session.id) ?? []).filter(set => exerciseOf(set) === item.id).length
      if (done) groups.set(item.muscle_group || 'Sin grupo', (groups.get(item.muscle_group || 'Sin grupo') ?? 0) + done)
    }

    const totalVolume = periodSets.reduce((sum, set) => sum + toKg(set) * set.reps, 0)
    return {
      inPeriod, bySession, weeks, exercises,
      groups: [...groups.entries()].sort((a, b) => b[1] - a[1]),
      totalSets: periodSets.length,
      perWeek: inPeriod.length / weeksElapsed,
      avgVolume: inPeriod.length ? totalVolume / inPeriod.length : 0,
      avgMinutes: inPeriod.length ? Math.round(inPeriod.reduce((sum, item) => sum + minutesOf(item), 0) / inPeriod.length) : 0,
    }
  }, [sessions, sets, period, now])

  const selected = view.exercises.find(item => item.id === exerciseId) ?? view.exercises[0]
  const exerciseView = useMemo(() => {
    if (!selected) return null
    const points = view.inPeriod.slice().reverse().map(session => {
      const list = (view.bySession.get(session.id) ?? []).filter(set => exerciseOf(set) === selected.id)
      const best = bestSet(list)
      return best ? { session, best, list } : null
    }).filter((item): item is NonNullable<typeof item> => item !== null)
    const bodyweight = points.every(point => point.best.weight === 0)
    const value = (set: WorkoutSet) => bodyweight ? set.reps : toKg(set)
    const first = points[0], last = points[points.length - 1]
    // 1RM estimado (fórmula de Epley): una forma de comparar series con distinto peso y repeticiones.
    const e1rm = (set: WorkoutSet) => toKg(set) * (1 + set.reps / 30)
    return {
      bodyweight, points,
      chart: points.map(point => ({ label: shortDate(point.session.start_time), value: value(point.best), detail: setLabel(point.best) })),
      change: first && last ? value(last.best) - value(first.best) : 0,
      best: bestSet(points.map(point => point.best)),
      e1rm: last && !bodyweight ? e1rm(last.best) : null,
    }
  }, [selected, view])

  if (loading) return <StatusMessage loading message="Cargando progreso..." />
  if (error) return <StatusMessage message={error} />
  const maxWeek = Math.max(1, ...view.weeks.map(week => week.volume))
  const maxGroup = Math.max(1, ...view.groups.map(([, count]) => count))
  const hovered = hoverWeek === null ? null : view.weeks[hoverWeek]

  return <>
    <div className="page-heading"><div><p className="eyebrow">Tus entrenamientos</p><h1>Progreso</h1><p>Cómo evolucionas con el tiempo.</p></div></div>
    <div className="chips period-filter" role="group" aria-label="Periodo">{periods.map(item => <button key={item.id} type="button" className="chip" aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}</div>

    {!view.inPeriod.length ? <section className="empty-state"><h2>Sin sesiones en este periodo</h2><p>Finaliza un entrenamiento o elige un periodo más largo.</p></section> : <>
      <section className="stat-row" aria-label="Resumen del periodo">
        <div className="stat-tile"><span>Sesiones</span><strong>{view.inPeriod.length}</strong><small>{formatNumber(view.perWeek, 1)} por semana</small></div>
        <div className="stat-tile"><span>Series</span><strong>{view.totalSets}</strong><small>{formatNumber(view.totalSets / view.inPeriod.length, 0)} por sesión</small></div>
        <div className="stat-tile"><span>Kilos por sesión</span><strong>{formatNumber(view.avgVolume, 0)}</strong><small>de media</small></div>
        <div className="stat-tile"><span>Duración</span><strong>{view.avgMinutes} min</strong><small>de media</small></div>
      </section>
      <p className="muted explain">«Kilos por sesión» suma peso × repeticiones de todas las series. Por ejemplo, 4 series de 10 repeticiones con 60 kg son 2.400 kg; una sesión de 16 series ronda fácilmente los 4.000 kg.</p>

      <div className="progress-grid">
        <section className="card" aria-labelledby="exercise-progress-title">
          <div className="card-heading"><h2 id="exercise-progress-title">Progreso por ejercicio</h2></div>
          <label className="visually-hidden" htmlFor="exercise-select">Ejercicio</label>
          <select id="exercise-select" className="exercise-select" value={selected?.id ?? ''} onChange={event => setExerciseId(Number(event.target.value))}>
            {view.exercises.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sessions.size})</option>)}
          </select>
          {exerciseView && <>
            <div className="mini-stats">
              <div><span>Mejor serie</span><strong>{exerciseView.best ? setLabel(exerciseView.best) : '—'}</strong></div>
              <div><span>En el periodo</span><strong className={exerciseView.change > 0 ? 'positive' : exerciseView.change < 0 ? 'negative' : ''}>{exerciseView.change > 0 ? '+' : ''}{formatNumber(exerciseView.change, 1)} {exerciseView.bodyweight ? 'reps' : 'kg'}</strong></div>
              {exerciseView.e1rm !== null && <div><span title="Peso que podrías levantar una vez, estimado con la fórmula de Epley">1RM estimado</span><strong>{formatNumber(exerciseView.e1rm, 0)} kg</strong></div>}
            </div>
            <ProgressLineChart points={exerciseView.chart} unit={exerciseView.bodyweight ? 'reps' : 'kg'} title={`${exerciseView.bodyweight ? 'Repeticiones' : 'Peso'} de la mejor serie en cada sesión`} />
          </>}
        </section>

        <section className="card" aria-labelledby="weekly-title">
          <div className="card-heading"><h2 id="weekly-title">Kilos por semana</h2><span>{hovered ? `Semana del ${weekLabel(hovered.start)}: ${formatNumber(hovered.volume, 0)} kg · ${hovered.sessions} ${hovered.sessions === 1 ? 'sesión' : 'sesiones'}` : 'Pasa por encima de una barra'}</span></div>
          <div className="bar-chart weekly" onMouseLeave={() => setHoverWeek(null)}>
            {view.weeks.map((week, index) => <div key={week.start.getTime()} className={index === hoverWeek ? 'current' : ''} onMouseEnter={() => setHoverWeek(index)} onFocus={() => setHoverWeek(index)} tabIndex={0} aria-label={`Semana del ${weekLabel(week.start)}: ${formatNumber(week.volume, 0)} kilos en ${week.sessions} sesiones`}>
              <i style={{ height: `${Math.max(2, Math.round(week.volume / maxWeek * 120))}px` }} />
              <small>{index % Math.ceil(view.weeks.length / 4) === 0 ? weekLabel(week.start) : ''}</small>
            </div>)}
          </div>
        </section>

        <section className="card" aria-labelledby="groups-title">
          <div className="card-heading"><h2 id="groups-title">Series por grupo muscular</h2></div>
          <ul className="group-bars">{view.groups.map(([group, count]) => <li key={group}>
            <span>{group}</span><div><i style={{ width: `${Math.round(count / maxGroup * 100)}%` }} /></div><strong>{count}</strong>
          </li>)}</ul>
        </section>
      </div>

      <section className="history-section" aria-labelledby="history-title">
        <div className="section-heading"><h2 id="history-title">Historial</h2><span>{view.inPeriod.length} sesiones</span></div>
        {view.inPeriod.slice(0, shown).map(session => {
          const list = view.bySession.get(session.id) ?? []
          return <details className="session-details" key={session.id}>
            <summary><div><strong>{session.day_name || 'Entrenamiento'}</strong><span className="muted">{shortDate(session.start_time)} · {session.routine_name}</span></div><span className="summary-stats">{list.length} series · {formatNumber(volumeKg(list), 0)} kg · {minutesOf(session)} min</span></summary>
            <ul>{session.exercise_plan.map(item => {
              const done = list.filter(set => exerciseOf(set) === item.id)
              return done.length ? <li key={item.id}><span>{item.name}</span><div className="set-chips">{done.map(set => <span key={set.id}>{setLabel(set)}</span>)}</div></li> : null
            })}</ul>
          </details>
        })}
        {view.inPeriod.length > shown && <button type="button" className="button secondary show-more" onClick={() => setShown(count => count + 20)}>Ver más sesiones ({view.inPeriod.length - shown})</button>}
      </section>
    </>}
  </>
}
