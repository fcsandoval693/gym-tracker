import type { WorkoutSession, WorkoutSet } from '../types'
import { volumeKg } from '../exerciseSettings'
import { bestSet, compareSets, exerciseOf, formatNumber, setLabel, shortDate } from '../stats'

/** Resumen al terminar: cuánto has superado la misma sesión de la semana anterior. */
export default function SessionResult({ session, sets, previous }: { session: WorkoutSession; sets: WorkoutSet[]; previous: { session: WorkoutSession; sets: WorkoutSet[] } | null }) {
  const minutes = session.end_time ? Math.max(1, Math.round((Date.parse(session.end_time) - Date.parse(session.start_time)) / 60000)) : null
  const volume = volumeKg(sets)
  const before = previous ? volumeKg(previous.sets) : 0
  const rows = session.exercise_plan.map(exercise => {
    const today = sets.filter(set => exerciseOf(set) === exercise.id)
    const past = previous ? previous.sets.filter(set => exerciseOf(set) === exercise.id) : []
    const beaten = today.filter((set, index) => past[index] && compareSets(set, past[index]) > 0).length
    const both = [...today, ...past]
    const bodyweight = both.length > 0 && both.every(set => set.weight === 0)
    const value = bodyweight ? today.reduce((sum, set) => sum + set.reps, 0) : volumeKg(today)
    const pastValue = bodyweight ? past.reduce((sum, set) => sum + set.reps, 0) : volumeKg(past)
    const best = bestSet(today)
    return { id: exercise.id, name: exercise.name, best: best ? setLabel(best) : '—', bodyweight, skipped: !today.length, value, diff: past.length && today.length ? value - pastValue : null, beaten, compared: Math.min(today.length, past.length) }
  })
  const beaten = rows.reduce((sum, row) => sum + row.beaten, 0)
  const compared = rows.reduce((sum, row) => sum + row.compared, 0)
  const diff = volume - before

  return <section className="session-result" aria-label="Resumen de la sesión">
    {previous ? <div className={diff >= 0 ? 'result-banner' : 'result-banner neutral'}>
      <strong>{diff >= 0 ? '+' : ''}{formatNumber(diff, 1)} kg vs. {shortDate(previous.session.start_time)}</strong>
      <span>{beaten ? `Superaste la sesión anterior en ${beaten} de ${compared} series` : 'Hoy no superaste ninguna serie de la sesión anterior'}{minutes ? ` · ${minutes} min` : ''}</span>
    </div> : <div className="result-banner neutral"><strong>Sesión guardada</strong><span>La próxima vez podrás compararla con esta{minutes ? ` · ${minutes} min` : ''}.</span></div>}
    <table className="result-table">
      <thead><tr><th>Ejercicio</th><th>Hoy</th><th>{previous ? 'Diferencia' : ''}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td><strong>{row.name}</strong><small>{row.skipped ? 'Sin series hoy' : `Mejor serie ${row.best}`}</small></td>
        <td className="num">{row.skipped ? '—' : `${formatNumber(row.value, 1)} ${row.bodyweight ? 'reps' : 'kg'}`}</td>
        <td className={`num ${row.diff === null ? '' : row.diff >= 0 ? 'positive' : 'negative'}`}>{row.diff === null ? '—' : `${row.diff >= 0 ? '+' : ''}${formatNumber(row.diff, 1)}`}</td>
      </tr>)}</tbody>
    </table>
  </section>
}
