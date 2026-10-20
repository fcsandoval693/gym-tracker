import { request } from './request'
import type { Exercise } from '../types'
import type { Equipment } from '../exerciseSettings'

export const getExercises = () => request<Exercise[]>('/exercises/')
export const createExercise = (name: string, muscleGroup: string, equipment: Equipment = 'other') => request<Exercise>('/exercises/', 'POST', { name, muscle_group: muscleGroup, equipment })
export const updateExercise = (id: number, name: string, muscleGroup: string, equipment: Equipment = 'other') => request<Exercise>(`/exercises/${id}/`, 'PATCH', { name, muscle_group: muscleGroup, equipment })
export const deleteExercise = (id: number) => request<void>(`/exercises/${id}/`, 'DELETE')
