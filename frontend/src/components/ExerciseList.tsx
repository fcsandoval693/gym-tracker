import { Dumbbell, Lock, Pencil, Trash2 } from 'lucide-react'
import type { Exercise } from '../types'
import { equipmentOptions } from '../exerciseSettings'
import PagedList from './PagedList'
type ExerciseListProps = { exercises: Exercise[]; resetKey?: string; onEdit: (exercise: Exercise) => void; onDelete: (exerciseId: number) => void }
export default function ExerciseList({ exercises, resetKey, onEdit, onDelete }: ExerciseListProps) {
  if (!exercises.length) return <section className="empty-state"><Dumbbell size={34} /><h2>No hay ejercicios</h2><p>Cambia la búsqueda o crea un ejercicio propio.</p></section>
  return <div className="exercise-table"><div className="table-heading"><span>EJERCICIO</span><span>GRUPO MUSCULAR</span><span>ORIGEN</span></div><PagedList items={exercises} resetKey={resetKey} label="ejercicios">{page => <ul>{page.map(exercise => <li key={exercise.id}>
    <div className="exercise-name"><span className="exercise-symbol"><Dumbbell size={20} /></span><div><strong>{exercise.name}</strong><small className="routine-equipment">{[equipmentOptions.find(option => option.value === exercise.equipment)?.label, exercise.variants?.length ? `${exercise.variant_label || 'Variantes'}: ${exercise.variants.join(', ')}` : null].filter(Boolean).join(' · ')}</small></div></div>
    <span className="muscle-tag">{exercise.muscle_group || 'Sin grupo'}</span>
    {exercise.is_builtin ? <div className="row-actions"><span className="catalog-tag" title="Viene con la app: no se puede editar ni borrar"><Lock size={12} />Catálogo</span></div>
      : <div className="row-actions"><button className="icon-button" title={`Editar ${exercise.name}`} aria-label={`Editar ${exercise.name}`} onClick={() => onEdit(exercise)}><Pencil size={18} /></button><button className="icon-button delete-button" title={`Borrar ${exercise.name}`} aria-label={`Borrar ${exercise.name}`} onClick={() => onDelete(exercise.id)}><Trash2 size={18} /></button></div>}
  </li>)}</ul>}</PagedList></div>
}
