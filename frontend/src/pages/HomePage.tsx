import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Play, X } from 'lucide-react'
import type { Exercise, Routine, RoutineDay, RoutineExercise, WorkoutSession, WorkoutSet } from '../types'
import { getRoutines } from '../api/routines'
import { getExercises } from '../api/exercises'
import { getRoutineDays, getRoutineExercises, weekdays } from '../api/planner'
import { getSessions, getWorkoutSets } from '../api/workouts'
import StatusMessage from '../components/StatusMessage'
import Modal from '../components/Modal'
import TrainingChooser from '../components/TrainingChooser'
import { weightStep } from '../exerciseSettings'
import { bestSet, compareSets, exerciseOf, formatNumber, nextGoal, recommendDay, setLabel, shortDate, targetLabel, targetOf, toKg, weekStreak, weeklyVolume } from '../stats'
import type { Recommendation } from '../stats'

type Data = { routines: Routine[]; days: RoutineDay[]; sessions: WorkoutSession[]; sets: WorkoutSet[]; exercises: Exercise[] }

/** La rutina de hoy: la que tiene algo asignado hoy o, si no, la primera con entrenamientos. */
function suggestion(days: RoutineDay[], sessions: WorkoutSession[], todayIndex: number): Recommendation | null {
  const routineId = days.find(day => day.weekdays.includes(todayIndex))?.routine ?? [...days].sort((a, b) => a.id - b.id)[0]?.routine
  return routineId === undefined ? null : recommendDay(days.filter(day => day.routine === routineId), sessions)
}

export default function HomePage({ onStart, onPlan, onProgress }: { onStart: (day: number) => void; onPlan: () => void; onProgress: () => void }) {
  const [chooserOpen, setChooserOpen] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [plan, setPlan] = useState<RoutineExercise[]>([])
  const [error, setError] = useState<string | null>(null)
  const todayIndex = (new Date().getDay() + 6) % 7

  useEffect(() => {
    let active = true
    Promise.all([getRoutines(), getRoutineDays(), getSessions(), getWorkoutSets(), getExercises()])
      .then(async ([routines, days, sessions, sets, exercises]) => {
        const today = suggestion(days, sessions, todayIndex)?.day
        const items = today ? await getRoutineExercises(today.id) : []
        if (active) { setData({ routines, days, sessions, sets, exercises }); setPlan(items) }
      })
      .catch(e => { if (active) setError((e as Error).message) })
    return () => { active = false }
  }, [todayIndex])

  const view = useMemo(() => {
    if (!data) return null
    const finished = data.sessions.filter(item => item.end_time)
    const finishedIds = new Set(finished.map(item => item.id))
    const finishedSets = data.sets.filter(set => finishedIds.has(set.workout_session))
    const recommendation = suggestion(data.days, data.sessions, todayIndex)
    const today = recommendation?.day ?? null
    const reason = !recommendation ? '' : recommendation.reason === 'today' ? 'Toca hoy' : recommendation.reason === 'pending' ? `Pendiente del ${weekdays[recommendation.weekday!].toLowerCase()}` : 'Siguiente en tu rutina'
    const routine = today ? data.routines.find(item => item.id === today.routine) : undefined
    const lastOfDay = today ? finished.filter(item => item.routine_day === today.id).sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))[0] : undefined
    const lastSets = lastOfDay ? finishedSets.filter(set => set.workout_session === lastOfDay.id) : []

    const planRows = plan.filter(item => item.exercise !== null).map((item, index) => {
      const exercise = data.exercises.find(entry => entry.id === item.exercise)
      const done = lastSets.filter(set => exerciseOf(set) === item.exercise)
      const best = bestSet(done)
      const step = weightStep(item.weight_unit, item.equipment)
      const goal = nextGoal(done, targetOf(item), step)
      const target = goal ? setLabel(goal).replace('×', ' × ') : '—'
      return { id: item.id, n: String(index + 1).padStart(2, '0'), name: exercise?.name ?? 'Ejercicio eliminado', group: exercise?.muscle_group, plan: targetOf(item), last: best ? setLabel(best).replace('×', ' × ') : '—', target, up: goal?.action === 'weight' && goal.weight > 0, unit: item.weight_unit }
    })

    const weeks = weeklyVolume(data.sessions, data.sets)
    const maxWeek = Math.max(1, ...weeks.map(week => week.volume))
    const [previousWeek, currentWeek] = weeks.slice(-2).map(week => week.volume)
    // La semana actual está a medias: se muestra cuánto llevas respecto al total de la anterior.
    const weekChange = previousWeek > 0 ? Math.round(currentWeek / previousWeek * 100) : null

    // Récords: la mejor serie de cada ejercicio, ordenados por la fecha en que se consiguió.
    const sessionDate = new Map(finished.map(item => [item.id, item.start_time]))
    const byExercise = new Map<number, WorkoutSet[]>()
    for (const set of finishedSets) {
      const id = exerciseOf(set)
      if (id !== null) byExercise.set(id, [...(byExercise.get(id) ?? []), set])
    }
    const records = [...byExercise.values()].map(list => {
      const best = bestSet(list)!
      const date = sessionDate.get(best.workout_session)!
      const before = bestSet(list.filter(set => Date.parse(sessionDate.get(set.workout_session)!) < Date.parse(date)))
      let delta = 'Primer registro'
      if (before && compareSets(best, before) > 0) {
        const diff = toKg(best) - toKg(before)
        delta = Math.abs(diff) > 0.01 ? `+${formatNumber(best.weight - before.weight)} ${best.weight_unit}` : `+${best.reps - before.reps} rep`
      } else if (before) delta = 'Igualado'
      return { name: best.exercise_name || 'Ejercicio', best: best.weight === 0 ? `${best.reps} reps` : `${formatNumber(best.weight)} ${best.weight_unit} × ${best.reps}`, date, delta }
    }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 4)

    // Calendario del mes actual.
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const routineDays = routine ? data.days.filter(day => day.routine === routine.id) : data.days
    const plannedWeekdays = new Set(routineDays.flatMap(day => day.weekdays))
    const trainedDays = new Set(finished.filter(item => { const date = new Date(item.start_time); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() }).map(item => new Date(item.start_time).getDate()))
    const calendar = [
      ...Array.from({ length: (first.getDay() + 6) % 7 }, (_, index) => ({ key: 'e' + index, day: 0, kind: 'empty' })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1
        const weekday = (new Date(now.getFullYear(), now.getMonth(), day).getDay() + 6) % 7
        const kind = trainedDays.has(day) ? 'done' : day > now.getDate() && plannedWeekdays.has(weekday) ? 'planned' : 'rest'
        return { key: 'd' + day, day, kind: kind + (day === now.getDate() ? ' is-today' : '') }
      }),
    ]
    const plannedThisMonth = Array.from({ length: daysInMonth }, (_, index) => (new Date(now.getFullYear(), now.getMonth(), index + 1).getDay() + 6) % 7).filter(weekday => plannedWeekdays.has(weekday)).length

    return { today, reason, routine, lastOfDay, planRows, weeks, maxWeek, weekChange, records, calendar, trainedThisMonth: trainedDays.size, plannedThisMonth, streak: weekStreak(data.sessions), monthName: new Intl.DateTimeFormat('es', { month: 'long' }).format(now) }
  }, [data, plan, todayIndex])

  if (error) return <StatusMessage message={error} />
  if (!view) return <StatusMessage loading message="Cargando tu inicio..." />
  const dateLabel = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date())

  return <>
    <section className="card today-card">
      <div className="today-intro">
        <p className="eyebrow">{dateLabel}{view.routine ? ` · ${view.routine.name}` : ''}</p>
        {view.today ? <h1>Hoy:<br /><span>{view.today.name}</span></h1> : <h1>Tu<br /><span>rutina</span></h1>}
        <p>{view.today ? `${view.reason} · ${view.planRows.length} ejercicios${view.lastOfDay ? ` · la última vez ${shortDate(view.lastOfDay.start_time)}` : ''}` : 'Crea tus entrenamientos (por ejemplo Push, Pull y Legs) para empezar.'}</p>
        {view.today ? <button className="button primary large" onClick={() => setChooserOpen(true)}><Play size={18} />Empezar</button>
          : <button className="button primary" onClick={onPlan}><CalendarDays size={18} />Organizar mi rutina</button>}
        {view.today && <small className="muted">Puedes elegir otro entrenamiento al empezar.</small>}
      </div>
      {view.today && <div className="today-plan">
        {view.planRows.length ? <table className="plan-table">
          <thead><tr><th>#</th><th>Ejercicio</th><th className="value">Última vez</th><th className="value">Objetivo hoy</th></tr></thead>
          <tbody>{view.planRows.map(row => <tr key={row.id}>
            <td className="num">{row.n}</td>
            <td><strong>{row.name}</strong><small>{[row.group, row.plan ? `${targetLabel(row.plan)} reps` : null].filter(Boolean).join(' · ')}</small></td>
            <td className="value">{row.last}</td>
            <td className="value target">{row.target}{row.up && <small className="goal-note">Sube peso</small>}</td>
          </tr>)}</tbody>
        </table> : <div className="empty-state"><p>Este entrenamiento aún no tiene ejercicios.</p><button className="button secondary" onClick={() => setChooserOpen(true)}>Añadir ejercicios</button></div>}
      </div>}
    </section>

    <div className="home-grid">
      <section className="card" aria-labelledby="volume-title">
        <div className="card-heading"><h2 id="volume-title">Volumen semanal</h2>{view.weekChange !== null && <span className={view.weekChange >= 100 ? 'positive' : ''}>Esta semana: {view.weekChange} % de la anterior</span>}</div>
        <p className="muted" style={{ marginBottom: 12 }}>Kilos levantados en las últimas 8 semanas</p>
        <div className="bar-chart">{view.weeks.map((week, index) => <div key={week.label} className={index === view.weeks.length - 1 ? 'current' : ''}>
          <span>{week.volume ? formatNumber(week.volume / 1000, 1) + 'k' : '0'}</span>
          <i style={{ height: `${Math.round(week.volume / view.maxWeek * 100)}px` }} />
          <small>{week.label}</small>
        </div>)}</div>
      </section>

      <section className="card records" aria-labelledby="records-title">
        <div className="card-heading"><h2 id="records-title">Récords</h2><button className="link-button" onClick={onProgress}>Ver progreso</button></div>
        {view.records.length ? <ul>{view.records.map(record => <li key={record.name}>
          <strong>{record.name}</strong><strong>{record.best}</strong>
          <small>{shortDate(record.date)}</small><small className={record.delta.startsWith('+') ? 'positive' : ''}>{record.delta}</small>
        </li>)}</ul> : <p className="muted">Finaliza una sesión para ver tus mejores series.</p>}
      </section>

      <section className="card" aria-labelledby="month-title">
        <div className="card-heading"><h2 id="month-title">{view.monthName}</h2><span>{view.trainedThisMonth} de {view.plannedThisMonth} sesiones</span></div>
        <div className="month-grid" role="presentation">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => <span key={day} className="dow">{day}</span>)}
          {view.calendar.map(cell => <span key={cell.key} className={`day ${cell.kind}`}>{cell.day || ''}</span>)}
        </div>
        <div className="legend"><span><i />Entrenado</span><span><i className="outline" />Planificado</span><span className="positive">Racha: {view.streak} {view.streak === 1 ? 'semana' : 'semanas'}</span></div>
      </section>
    </div>
      {chooserOpen && data && <Modal variant="sheet" titleId="chooser-title" onClose={() => setChooserOpen(false)}>
      <div className="modal-heading"><h2 id="chooser-title">¿Qué entrenas hoy?</h2><button className="icon-button" aria-label="Cerrar" title="Cerrar" onClick={() => setChooserOpen(false)}><X size={20} /></button></div>
      <TrainingChooser initialDay={view?.today?.id} routines={data.routines} days={data.days} sessions={data.sessions} exercises={data.exercises} busy={false} onStart={onStart} onContinue={session => session.routine_day !== null && onStart(session.routine_day)} onPlan={onPlan} />
    </Modal>}
  </>
}
