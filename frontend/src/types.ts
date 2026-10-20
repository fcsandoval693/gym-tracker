import type { Equipment, WeightUnit } from './exerciseSettings'

export type Exercise = {
    id: number
    name: string
    muscle_group: string
    // Los del catálogo vienen con la app y no se pueden editar ni borrar.
    is_builtin?: boolean
    equipment?: Equipment
    variant_label?: string
    variants?: string[]
}

export type Routine = {
    id: number 
    name: string
}

export type RoutineDay = {
    id: number
    name: string
    routine: number
    weekdays: number[]
}

export type RoutineExercise = {
    id: number
    routine_day: number | null
    exercise: number | null
    position: number
    weight_unit: WeightUnit
    equipment: Equipment
    variant: string
    // Objetivo: cuántas series y en qué rango de repeticiones (ej. 4 series de 8 a 10).
    target_sets: number
    rep_min: number
    rep_max: number
}

export type WorkoutSession = {
    id: number
    routine_day: number | null
    start_time: string
    end_time: string | null
    routine_name: string
    day_name: string
    exercise_plan: (Pick<Exercise, 'id' | 'name' | 'muscle_group'> & { completed?: boolean; weight_unit?: WeightUnit; equipment?: Equipment; variant?: string; target_sets?: number; rep_min?: number; rep_max?: number })[]
    status: 'active' | 'completed'
}

export type WorkoutSet = {
    id: number
    exercise: number | null
    exercise_name: string
    exercise_snapshot: number | null
    workout_session: number
    weight: number
    weight_unit: WeightUnit
    reps: number 
}
