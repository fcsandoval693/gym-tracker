import { Check, Plus } from 'lucide-react'
import StatusMessage from './StatusMessage'
import MuscleGroupSelect from './MuscleGroupSelect'
import { equipmentOptions } from '../exerciseSettings'
import type { Equipment } from '../exerciseSettings'
type ExerciseFormProps = {
  name: string
  muscleGroup: string
  equipment: Equipment
  formError: string | null
  isEditing: boolean
  saving?: boolean
  onNameChange: (name: string) => void
  onMuscleGroupChange: (muscleGroup: string) => void
  onEquipmentChange: (equipment: Equipment) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancelEdit: () => void
}
export default function ExerciseForm({ name, muscleGroup, equipment, formError, isEditing, saving, onNameChange, onMuscleGroupChange, onEquipmentChange, onSubmit, onCancelEdit }: ExerciseFormProps) {
  return <form onSubmit={onSubmit} className="editor-form">
    {formError && <StatusMessage message={formError} />}
    <label htmlFor="exercise-name">Nombre del ejercicio<input id="exercise-name" autoFocus required maxLength={100} placeholder="Ej. Remo Meadows" value={name} disabled={saving} onChange={event => onNameChange(event.target.value)} /></label>
    <label htmlFor="muscle-group">Grupo muscular<MuscleGroupSelect id="muscle-group" value={muscleGroup} disabled={saving} onChange={onMuscleGroupChange} /></label>
    <label htmlFor="exercise-equipment">Material por defecto<select id="exercise-equipment" value={equipment} disabled={saving} onChange={event => onEquipmentChange(event.target.value as Equipment)}>{equipmentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <div className="form-actions"><button className="button secondary" type="button" disabled={saving} onClick={onCancelEdit}>Cancelar</button><button className="button primary" type="submit" disabled={saving}>{isEditing ? <Check size={18} /> : <Plus size={18} />}{saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear ejercicio'}</button></div>
  </form>
}
