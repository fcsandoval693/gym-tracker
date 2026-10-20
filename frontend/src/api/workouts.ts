import { request } from './request'
import type { WorkoutSession, WorkoutSet } from '../types'
import type { WeightUnit, Equipment } from '../exerciseSettings'

export const getSessions = () => request<WorkoutSession[]>('/workout-sessions/')
export const startSession = (day: number) => request<WorkoutSession>('/workout-sessions/', 'POST', { routine_day: day })
export const finishSession = (id: number) => request<WorkoutSession>(`/workout-sessions/${id}/finish/`, 'POST', {})
export const getWorkoutSets = (session?: number) => request<WorkoutSet[]>(`/workout-sets/${session ? '?workout_session=' + session : ''}`)
export const saveWorkoutSet = (session: number, exercise: number, weight: number, reps: number) => request<WorkoutSet>('/workout-sets/', 'POST', { workout_session: session, exercise, weight, reps })
export const deleteWorkoutSet = (id: number) => request<void>(`/workout-sets/${id}/`, 'DELETE')
export const getSession = (id: number) => request<WorkoutSession>(`/workout-sessions/${id}/`)
export const completeExercise = (session: number, exercise: number, completed = true) => request<WorkoutSession>(`/workout-sessions/${session}/complete_exercise/`, 'POST', { exercise, completed })
export const editSessionExercise = (session: number, current: number, exercise: number | null, name: string, muscleGroup: string, weight_unit: WeightUnit, equipment: Equipment) => request<WorkoutSession>(`/workout-sessions/${session}/edit_exercise/`, 'POST', { current_exercise: current, ...(exercise === null ? { new_exercise: { name, muscle_group: muscleGroup } } : { exercise }), name, muscle_group: muscleGroup, weight_unit, equipment })
export const removeSessionExercise = (session: number, exercise: number) => request<WorkoutSession>(`/workout-sessions/${session}/remove_exercise/`, 'POST', { exercise })
