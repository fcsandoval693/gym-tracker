import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import ExerciseForm from '../components/ExerciseForm'
import ExerciseList from '../components/ExerciseList'
import StatusMessage from '../components/StatusMessage'
import Modal from '../components/Modal'
import type { Exercise } from '../types'
import type { Equipment } from '../exerciseSettings'
import { getExercises, createExercise, deleteExercise, updateExercise } from '../api/exercises'

export default function ExercisePage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('other')
  const [source, setSource] = useState<'all' | 'catalog' | 'own'>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  function load() {
    setLoading(true)
    setError(null)
    getExercises().then(setExercises).catch(() => setError('No se pudieron cargar los ejercicios. Comprueba que Django esté encendido.')).finally(() => setLoading(false))
  }
  useEffect(() => {
    let active = true
    getExercises().then(data => { if (active) setExercises(data) }).catch(() => { if (active) setError('No se pudieron cargar los ejercicios. Comprueba que Django esté encendido.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  function closeForm() {
    setFormOpen(false); setEditingId(null); setName(''); setMuscleGroup(''); setEquipment('other'); setFormError(null)
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) { setFormError('El nombre del ejercicio es obligatorio'); return }
    setSaving(true); setFormError(null)
    try {
      const exercise: Exercise = editingId === null ? await createExercise(name.trim(), muscleGroup.trim(), equipment) : await updateExercise(editingId, name.trim(), muscleGroup.trim(), equipment)
      setExercises(current => editingId === null ? [...current, exercise] : current.map(item => item.id === exercise.id ? exercise : item))
      closeForm()
    } catch (e) { setFormError((e as Error).message || 'No se pudo guardar el ejercicio. Vuelve a intentarlo.') }
    finally { setSaving(false) }
  }
  async function remove() {
    if (deletingId === null) return
    setSaving(true); setError(null)
    try { await deleteExercise(deletingId); setExercises(current => current.filter(item => item.id !== deletingId)); setDeletingId(null) }
    catch { setError('No se pudo borrar el ejercicio. Puede estar asociado a una rutina o sesión.'); setDeletingId(null) }
    finally { setSaving(false) }
  }
  const groups = [...new Set(exercises.map(item => item.muscle_group).filter(Boolean))].sort()
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const filtered = exercises
    .filter(item => words.every(word => normalize(`${item.name} ${item.muscle_group} ${(item.variants ?? []).join(' ')}`).includes(word)) && (!group || item.muscle_group === group))
    .filter(item => source === 'all' || (source === 'catalog') === !!item.is_builtin)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const ownCount = exercises.filter(item => !item.is_builtin).length
  return <>
    <div className="page-heading"><div><p className="eyebrow">TU BIBLIOTECA</p><h1>Ejercicios</h1><p>Un catálogo con {exercises.length - ownCount} ejercicios y sus variantes. Si te falta alguno, créalo.</p></div><button className="button primary" onClick={() => { closeForm(); setFormOpen(true) }}><Plus size={18} />Ejercicio propio</button></div>
    <div className="list-toolbar"><label className="search-field"><Search size={18} /><input aria-label="Buscar ejercicios" placeholder="Buscar un ejercicio..." value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filtrar por grupo muscular" value={group} onChange={event => setGroup(event.target.value)}><option value="">Todos los grupos</option>{groups.map(item => <option key={item}>{item}</option>)}</select><span className="result-count">{filtered.length} ejercicios</span></div>
    <div className="chips source-filter" role="group" aria-label="Origen">{([['all', 'Todos'], ['catalog', 'Catálogo'], ['own', `Míos (${ownCount})`]] as const).map(([id, label]) => <button key={id} type="button" className="chip" aria-pressed={source === id} onClick={() => setSource(id)}>{label}</button>)}</div>
    {loading && <StatusMessage message="Cargando ejercicios..." loading />}
    {error && <><StatusMessage message={error} /><button className="button secondary" onClick={load}>Volver a cargar</button></>}
    {!loading && !error && <ExerciseList exercises={filtered} resetKey={`${query}|${group}|${source}`} onEdit={exercise => { setEditingId(exercise.id); setName(exercise.name); setMuscleGroup(exercise.muscle_group); setEquipment(exercise.equipment ?? 'other'); setFormError(null); setFormOpen(true) }} onDelete={setDeletingId} />}
    {formOpen && <Modal titleId="exercise-form-title" onClose={closeForm} busy={saving}><div className="modal-heading"><h2 id="exercise-form-title">{editingId === null ? 'Nuevo ejercicio propio' : 'Editar ejercicio'}</h2><button className="icon-button" title="Cerrar" aria-label="Cerrar" disabled={saving} onClick={closeForm}><X size={20} /></button></div><ExerciseForm name={name} muscleGroup={muscleGroup} equipment={equipment} onEquipmentChange={setEquipment} formError={formError} isEditing={editingId !== null} onNameChange={setName} onMuscleGroupChange={setMuscleGroup} onSubmit={submit} onCancelEdit={closeForm} saving={saving} /></Modal>}
    {deletingId !== null && <Modal titleId="delete-title" onClose={() => setDeletingId(null)} busy={saving}><h2 id="delete-title">Borrar ejercicio</h2><p>Se eliminará «{exercises.find(item => item.id === deletingId)?.name}». Esta acción no se puede deshacer.</p><div className="form-actions"><button className="button secondary" disabled={saving} onClick={() => setDeletingId(null)}>Cancelar</button><button className="button danger" disabled={saving} onClick={remove}>{saving ? 'Borrando...' : 'Borrar ejercicio'}</button></div></Modal>}
  </>
}
