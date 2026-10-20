import { request } from './request'
import type { Routine } from '../types'

export const getRoutines = () => request<Routine[]>('/routines/')
export const createRoutine = (name: string) => request<Routine>('/routines/', 'POST', { name })
export const updateRoutine = (id: number, name: string) => request<Routine>(`/routines/${id}/`, 'PATCH', { name })
export const deleteRoutine = (id: number) => request<void>(`/routines/${id}/`, 'DELETE')
