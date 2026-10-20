// Cálculos compartidos: comparar con la semana anterior, récords, volumen por semana...
import type { RoutineDay, WorkoutSession, WorkoutSet } from './types'
import { volumeKg } from './exerciseSettings'

const DAY = 24 * 60 * 60 * 1000

export const toKg = (set: Pick<WorkoutSet, 'weight' | 'weight_unit'>) => set.weight * (set.weight_unit === 'lb' ? 0.45359237 : 1)
export const formatNumber = (value: number, digits = 2) => value.toLocaleString('es', { maximumFractionDigits: digits })
export const setLabel = (set: Pick<WorkoutSet, 'weight' | 'reps'>) => set.weight === 0 ? `${set.reps} reps` : `${formatNumber(set.weight)}×${set.reps}`
export const exerciseOf = (set: WorkoutSet) => set.exercise_snapshot ?? set.exercise
export const shortDate = (iso: string) => new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))

/** Compara dos series: 1 si la nueva supera a la anterior, 0 si es igual, -1 si es peor. */
export function compareSets(now: Pick<WorkoutSet, 'weight' | 'weight_unit' | 'reps'>, before: Pick<WorkoutSet, 'weight' | 'weight_unit' | 'reps'>) {
  const a = toKg(now), b = toKg(before)
  if (Math.abs(a - b) > 0.01) return a > b ? 1 : -1
  return Math.sign(now.reps - before.reps)
}

function sameDay(a: WorkoutSession, b: WorkoutSession) {
  return a.routine_day && b.routine_day ? a.routine_day === b.routine_day : a.day_name === b.day_name && a.routine_name === b.routine_name
}

/**
 * Sesión con la que comparar: la misma sesión de rutina de la semana anterior.
 * Si ese día se repite varias veces por semana, se salta la de hace pocos días y se busca
 * la de hace al menos 6 días; si no existe, se usa la más reciente disponible.
 */
export function previousSession(sessions: WorkoutSession[], current: WorkoutSession) {
  const start = Date.parse(current.start_time)
  const candidates = sessions
    .filter(item => item.id !== current.id && item.end_time && Date.parse(item.start_time) < start && sameDay(item, current))
    .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))
  return candidates.find(item => start - Date.parse(item.start_time) >= 6 * DAY) ?? candidates[0] ?? null
}

/** Mejor serie (más peso y, a igualdad, más repeticiones). */
export function bestSet<T extends WorkoutSet>(sets: T[]) {
  return sets.reduce<T | null>((best, set) => !best || compareSets(set, best) > 0 ? set : best, null)
}

export type Target = { sets: number; repMin: number; repMax: number }

/** Objetivo guardado en la rutina (o en la sesión). Null si no tiene. */
export function targetOf(item: { target_sets?: number; rep_min?: number; rep_max?: number }): Target | null {
  return item.target_sets && item.rep_min && item.rep_max ? { sets: item.target_sets, repMin: item.rep_min, repMax: item.rep_max } : null
}
export const targetLabel = (target: Target) => `${target.sets} × ${target.repMin === target.repMax ? target.repMin : `${target.repMin}–${target.repMax}`}`

export type Goal = { weight: number; reps: number; action: 'weight' | 'reps' }

/**
 * Objetivo para hoy a partir de las series de la última vez («doble progresión»):
 * - Si en todas las series con tu peso más alto llegaste al máximo del rango → sube peso y vuelve al mínimo.
 * - Si no → mismo peso y una repetición más que tu serie más floja (sin salir del rango).
 * Sin objetivo en la rutina se propone, como antes, subir peso con las mismas repeticiones.
 */
export function nextGoal(last: Pick<WorkoutSet, 'weight' | 'reps'>[], target: Target | null, step: number): Goal | null {
  if (!last.length) return null
  const top = Math.max(...last.map(set => set.weight))
  const atTop = last.filter(set => set.weight === top).map(set => set.reps)
  const best = Math.max(...atTop)
  if (top === 0) return { weight: 0, reps: best + 1, action: 'reps' }
  if (!target) return { weight: top + step, reps: best, action: 'weight' }
  if (atTop.length >= target.sets && atTop.every(reps => reps >= target.repMax)) return { weight: top + step, reps: target.repMin, action: 'weight' }
  return { weight: top, reps: Math.min(target.repMax, Math.max(target.repMin, Math.min(...atTop) + 1)), action: 'reps' }
}

export function sessionVolume(sets: WorkoutSet[], session: number) {
  return volumeKg(sets.filter(set => set.workout_session === session))
}

/** Lunes de la semana de una fecha, a medianoche. */
export function weekStart(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

export function isoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNumber + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((target.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

/** Volumen (kg) de las últimas `count` semanas, de la más antigua a la actual. */
export function weeklyVolume(sessions: WorkoutSession[], sets: WorkoutSet[], count = 8) {
  const current = weekStart(new Date())
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(current); start.setDate(start.getDate() - (count - 1 - index) * 7)
    const end = new Date(start); end.setDate(end.getDate() + 7)
    const ids = new Set(sessions.filter(item => item.end_time && new Date(item.start_time) >= start && new Date(item.start_time) < end).map(item => item.id))
    return { label: 'S' + isoWeek(start), volume: volumeKg(sets.filter(set => ids.has(set.workout_session))) }
  })
}

/** Semanas seguidas con al menos una sesión finalizada (cuenta la actual si ya tiene alguna). */
export function weekStreak(sessions: WorkoutSession[]) {
  const weeks = new Set(sessions.filter(item => item.end_time).map(item => weekStart(new Date(item.start_time)).getTime()))
  const cursor = weekStart(new Date())
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7)
  let streak = 0
  while (weeks.has(cursor.getTime())) { streak++; cursor.setDate(cursor.getDate() - 7) }
  return streak
}

export type Recommendation = { day: RoutineDay; reason: 'today' | 'pending' | 'next' | 'first'; weekday: number | null }

/**
 * Qué entrenamiento toca hoy. Primero, lo que quedó pendiente esta semana (por ejemplo, si el lunes
 * fue festivo y no entrenaste Push, el martes te propone Push). Si vas al día, lo que tienes hoy en el
 * calendario y, si hoy descansas o ya lo hiciste, el siguiente entrenamiento después del último que hiciste.
 */
export function recommendDay(days: RoutineDay[], sessions: WorkoutSession[], now = new Date()): Recommendation | null {
  if (!days.length) return null
  const ordered = [...days].sort((a, b) => a.id - b.id)
  const todayIndex = (now.getDay() + 6) % 7
  const monday = weekStart(now)
  const ids = new Set(ordered.map(day => day.id))
  const finished = sessions.filter(item => item.end_time && item.routine_day !== null && ids.has(item.routine_day))
  const doneThisWeek = new Map<number, number>()
  for (const item of finished) if (new Date(item.start_time) >= monday) doneThisWeek.set(item.routine_day!, (doneThisWeek.get(item.routine_day!) ?? 0) + 1)
  const seen = new Map<number, number>()
  for (let weekday = 0; weekday <= todayIndex; weekday++) {
    const day = ordered.find(item => item.weekdays.includes(weekday))
    if (!day) continue
    const occurrence = seen.get(day.id) ?? 0
    seen.set(day.id, occurrence + 1)
    if (occurrence >= (doneThisWeek.get(day.id) ?? 0)) return { day, reason: weekday === todayIndex ? 'today' : 'pending', weekday }
  }
  const last = finished.sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))[0]
  if (!last) return { day: ordered[0], reason: 'first', weekday: null }
  const index = ordered.findIndex(day => day.id === last.routine_day)
  return { day: ordered[(index + 1) % ordered.length], reason: 'next', weekday: null }
}
