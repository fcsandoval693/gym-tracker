import type { WorkoutSet } from './types'

export type WeightUnit = 'kg' | 'lb'
export type Equipment = 'dumbbell' | 'plates' | 'machine' | 'bodyweight' | 'other'
export const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: 'dumbbell', label: 'Mancuernas' },
  { value: 'plates', label: 'Barra y discos' },
  { value: 'machine', label: 'Máquina' },
  { value: 'bodyweight', label: 'Peso corporal' },
  { value: 'other', label: 'Otro' },
]
export const muscleGroups = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Abdominales', 'Piernas', 'Cuerpo completo']
export function volumeKg(sets: WorkoutSet[]) {
  return sets.reduce((total, set) => total + set.weight * (set.weight_unit === 'lb' ? 0.45359237 : 1) * set.reps, 0)
}
export function weightStep(unit: WeightUnit, equipment: Equipment): number {
  const pound = unit === 'lb'
  return equipment === 'dumbbell' ? (pound ? 2.5 : 0.5) : equipment === 'bodyweight' ? 1 : (pound ? 5 : 2.5)
}
export function weightSuggestions(unit: WeightUnit, equipment: Equipment): number[] {
  const pound = unit === 'lb'
  const step = weightStep(unit, equipment)
  const max = equipment === 'dumbbell' ? (pound ? 150 : 60) : equipment === 'bodyweight' ? (pound ? 200 : 100) : (pound ? 600 : 300)
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step)
}
