// Pruebas automáticas de los cálculos de stats.ts.
// Cada `it(...)` es una prueba: prepara unos datos, llama a una función y comprueba
// con `expect(...)` que el resultado es el que esperamos. Se ejecutan con: npm test
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoutineDay, WorkoutSession, WorkoutSet } from './types'
import {
  bestSet, compareSets, isoWeek, nextGoal, previousSession, recommendDay,
  setLabel, targetLabel, targetOf, toKg, weekStart, weekStreak,
} from './stats'

// --- Pequeñas "fábricas" para crear datos de prueba sin repetir todos los campos ---

function set(weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return { id: 1, exercise: 1, exercise_name: 'Press de banca', exercise_snapshot: 1, workout_session: 1, weight, weight_unit: 'kg', reps, ...extra }
}

let nextId = 1
function session(start: string, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: nextId++, routine_day: 1, start_time: start, end_time: start, routine_name: 'PPL', day_name: 'Push',
    exercise_plan: [], status: 'completed', ...extra,
  }
}

function day(id: number, name: string, weekdays: number[]): RoutineDay {
  return { id, name, routine: 1, weekdays }
}

afterEach(() => { vi.useRealTimers() })

// --- Pruebas ---

describe('toKg', () => {
  it('deja los kilos igual', () => {
    expect(toKg({ weight: 50, weight_unit: 'kg' })).toBe(50)
  })
  it('convierte libras a kilos', () => {
    expect(toKg({ weight: 100, weight_unit: 'lb' })).toBeCloseTo(45.36, 2)
  })
})

describe('setLabel', () => {
  it('muestra peso × repeticiones', () => {
    expect(setLabel({ weight: 42.5, reps: 8 })).toBe('42,5×8')
  })
  it('sin peso (peso corporal) muestra solo las repeticiones', () => {
    expect(setLabel({ weight: 0, reps: 12 })).toBe('12 reps')
  })
})

describe('compareSets', () => {
  it('más peso gana aunque haya menos repeticiones', () => {
    expect(compareSets(set(42.5, 6), set(40, 10))).toBe(1)
  })
  it('con el mismo peso, gana quien hace más repeticiones', () => {
    expect(compareSets(set(40, 9), set(40, 8))).toBe(1)
    expect(compareSets(set(40, 7), set(40, 8))).toBe(-1)
  })
  it('misma serie = empate', () => {
    expect(compareSets(set(40, 8), set(40, 8))).toBe(0)
  })
  it('compara bien kilos con libras', () => {
    // 100 lb son unos 45,4 kg: más que 45 kg.
    expect(compareSets(set(100, 5, { weight_unit: 'lb' }), set(45, 5))).toBe(1)
  })
})

describe('bestSet', () => {
  it('devuelve la serie con más peso', () => {
    const best = bestSet([set(40, 10), set(45, 5), set(42.5, 8)])
    expect(best?.weight).toBe(45)
  })
  it('devuelve null si no hay series', () => {
    expect(bestSet([])).toBeNull()
  })
})

describe('objetivo de la rutina', () => {
  it('targetOf lee los campos de la rutina', () => {
    expect(targetOf({ target_sets: 4, rep_min: 8, rep_max: 10 })).toEqual({ sets: 4, repMin: 8, repMax: 10 })
  })
  it('targetOf devuelve null si faltan datos (sesiones antiguas)', () => {
    expect(targetOf({})).toBeNull()
  })
  it('targetLabel escribe el rango, o un solo número si mínimo y máximo coinciden', () => {
    expect(targetLabel({ sets: 4, repMin: 8, repMax: 12 })).toBe('4 × 8–12')
    expect(targetLabel({ sets: 5, repMin: 5, repMax: 5 })).toBe('5 × 5')
  })
})

describe('nextGoal (doble progresión)', () => {
  const target = { sets: 3, repMin: 8, repMax: 12 }

  it('sin series anteriores no propone nada', () => {
    expect(nextGoal([], target, 2.5)).toBeNull()
  })
  it('si no llegaste al máximo: mismo peso y una repetición más que tu serie más floja', () => {
    expect(nextGoal([set(40, 10), set(40, 9), set(40, 9)], target, 2.5)).toEqual({ weight: 40, reps: 10, action: 'reps' })
  })
  it('si llegaste al máximo en todas las series: sube peso y vuelve al mínimo', () => {
    expect(nextGoal([set(40, 12), set(40, 12), set(40, 12)], target, 2.5)).toEqual({ weight: 42.5, reps: 8, action: 'weight' })
  })
  it('no sube peso si te falta alguna serie del objetivo', () => {
    // Solo hiciste 2 de 3 series, aunque fueran de 12.
    expect(nextGoal([set(40, 12), set(40, 12)], target, 2.5)?.action).toBe('reps')
  })
  it('nunca propone menos que el mínimo ni más que el máximo', () => {
    expect(nextGoal([set(40, 5), set(40, 5), set(40, 5)], target, 2.5)?.reps).toBe(8)
    expect(nextGoal([set(40, 12), set(40, 11), set(40, 12)], target, 2.5)?.reps).toBe(12)
  })
  it('solo cuentan las series con tu peso más alto', () => {
    // La serie de calentamiento de 20 kg no cuenta.
    expect(nextGoal([set(20, 15), set(40, 12), set(40, 12), set(40, 12)], target, 2.5)?.action).toBe('weight')
  })
  it('peso corporal: siempre una repetición más', () => {
    expect(nextGoal([set(0, 10), set(0, 8)], target, 2.5)).toEqual({ weight: 0, reps: 11, action: 'reps' })
  })
  it('sin objetivo en la rutina: sube peso con las mismas repeticiones (comportamiento antiguo)', () => {
    expect(nextGoal([set(40, 8)], null, 2.5)).toEqual({ weight: 42.5, reps: 8, action: 'weight' })
  })
})

describe('previousSession', () => {
  it('compara con la misma sesión de la semana anterior', () => {
    const lastWeek = session('2026-10-12T18:00:00Z')
    const twoWeeks = session('2026-10-05T18:00:00Z')
    const today = session('2026-10-19T18:00:00Z', { end_time: null, status: 'active' })
    expect(previousSession([twoWeeks, lastWeek, today], today)?.id).toBe(lastWeek.id)
  })
  it('si el día se repite en la semana, se salta la de hace pocos días', () => {
    // Push lunes y jueves: el lunes se compara con el lunes anterior, no con el jueves.
    const lastMonday = session('2026-10-12T18:00:00Z')
    const thursday = session('2026-10-15T18:00:00Z')
    const today = session('2026-10-19T18:00:00Z', { end_time: null, status: 'active' })
    expect(previousSession([lastMonday, thursday, today], today)?.id).toBe(lastMonday.id)
  })
  it('ignora otros entrenamientos y sesiones sin terminar', () => {
    const pull = session('2026-10-13T18:00:00Z', { routine_day: 2, day_name: 'Pull' })
    const unfinished = session('2026-10-12T18:00:00Z', { end_time: null, status: 'active' })
    const today = session('2026-10-19T18:00:00Z', { end_time: null, status: 'active' })
    expect(previousSession([pull, unfinished, today], today)).toBeNull()
  })
})

describe('fechas', () => {
  it('weekStart devuelve el lunes de esa semana', () => {
    const monday = weekStart(new Date(2026, 9, 22)) // jueves 22 de octubre de 2026
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(19)
  })
  it('weekStart de un domingo es el lunes anterior, no el siguiente', () => {
    expect(weekStart(new Date(2026, 9, 25)).getDate()).toBe(19)
  })
  it('isoWeek calcula el número de semana', () => {
    expect(isoWeek(new Date(2026, 9, 19))).toBe(43)
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1)
  })
})

describe('weekStreak', () => {
  it('cuenta semanas seguidas entrenando', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 21, 12)) // miércoles
    const sessions = [new Date(2026, 9, 19), new Date(2026, 9, 13), new Date(2026, 9, 6)].map(date => session(date.toISOString()))
    expect(weekStreak(sessions)).toBe(3)
  })
  it('esta semana aún no has entrenado: la racha sigue viva con las anteriores', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 19, 9)) // lunes por la mañana
    const sessions = [new Date(2026, 9, 14), new Date(2026, 9, 7)].map(date => session(date.toISOString()))
    expect(weekStreak(sessions)).toBe(2)
  })
  it('una semana sin entrenar corta la racha', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 21, 12))
    const sessions = [new Date(2026, 9, 19), new Date(2026, 8, 30)].map(date => session(date.toISOString()))
    expect(weekStreak(sessions)).toBe(1)
  })
})

describe('recommendDay', () => {
  // Push lunes y jueves, Pull martes y viernes, Legs miércoles (lunes = 0).
  const days = [day(1, 'Push', [0, 3]), day(2, 'Pull', [1, 4]), day(3, 'Legs', [2])]
  const tuesday = new Date(2026, 9, 20, 10)

  it('si vas al día, propone lo que toca hoy', () => {
    const sessions = [session(new Date(2026, 9, 19, 18).toISOString(), { routine_day: 1 })]
    expect(recommendDay(days, sessions, tuesday)).toMatchObject({ reason: 'today', day: { name: 'Pull' } })
  })
  it('si el lunes fue festivo, el martes propone el Push pendiente', () => {
    expect(recommendDay(days, [], tuesday)).toMatchObject({ reason: 'pending', day: { name: 'Push' }, weekday: 0 })
  })
  it('en un día de descanso propone el siguiente al último que hiciste', () => {
    const saturday = new Date(2026, 9, 24, 10)
    const sessions = [0, 1, 2, 3, 4].map(offset => session(new Date(2026, 9, 19 + offset, 18).toISOString(), { routine_day: [1, 2, 3, 1, 2][offset] }))
    expect(recommendDay(days, sessions, saturday)).toMatchObject({ reason: 'next', day: { name: 'Legs' } })
  })
  it('sin entrenamientos en la rutina devuelve null', () => {
    expect(recommendDay([], [], tuesday)).toBeNull()
  })
})
