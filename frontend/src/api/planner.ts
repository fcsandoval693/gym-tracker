import { request } from './request'
import type { RoutineDay, RoutineExercise } from '../types'
import type { WeightUnit, Equipment } from '../exerciseSettings'

export const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const getRoutineDays = (routine?: number) => request<RoutineDay[]>(`/routine-days/${routine ? '?routine=' + routine : ''}`)
export const saveRoutineDay = (day: Omit<RoutineDay, 'id'>, id?: number) => request<RoutineDay>(`/routine-days/${id ? id + '/' : ''}`, id ? 'PATCH' : 'POST', day)
export const deleteRoutineDay = (id: number) => request<void>(`/routine-days/${id}/`, 'DELETE')
export const getRoutineExercises = (day: number) => request<RoutineExercise[]>(`/routine-exercises/?routine_day=${day}`)
export const addRoutineExercise = (day: number, exercise: number, position: number, weight_unit: WeightUnit = 'kg', equipment: Equipment = 'other', variant = '') => request<RoutineExercise>('/routine-exercises/', 'POST', { routine_day: day, exercise, position, weight_unit, equipment, variant })
export const removeRoutineExercise = (id: number) => request<void>(`/routine-exercises/${id}/`, 'DELETE')
export const moveRoutineExercise = (id: number, position: number) => request<RoutineExercise>(`/routine-exercises/${id}/`, 'PATCH', { position })
// Cambia solo los campos que le pases (variante, material, unidad u objetivo).
export const updateRoutineExercise = (id: number, changes: Partial<Omit<RoutineExercise, 'id' | 'routine_day' | 'exercise'>>) => request<RoutineExercise>(`/routine-exercises/${id}/`, 'PATCH', changes)
