import { useEffect, useState } from 'react'
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Routine } from '../types'
import { getRoutines, createRoutine, deleteRoutine, updateRoutine } from '../api/routines'
import StatusMessage from '../components/StatusMessage'
import Modal from '../components/Modal'
import RoutinePlanner from './RoutinePlanner'

export default function RoutinesPage() {
  const [planning, setPlanning] = useState<Routine | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Routine | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    getRoutines().then(data => { if (active) setRoutines(data) }).catch(() => { if (active) setError('No se pudieron cargar las rutinas. Comprueba la conexión con Django.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  function close() { setOpen(false); setName(''); setEditingId(null); setFormError(null) }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) { setFormError('Escribe un nombre para la rutina'); return }
    setSaving(true); setFormError(null)
    try {
      const routine: Routine = editingId === null ? await createRoutine(name.trim()) : await updateRoutine(editingId, name.trim())
      setRoutines(current => editingId === null ? [...current, routine] : current.map(item => item.id === routine.id ? routine : item))
      close()
    } catch { setFormError('No se pudo guardar la rutina. Vuelve a intentarlo.') }
    finally { setSaving(false) }
  }
  async function remove() {
    if (!deleting) return
    setSaving(true); setError(null)
    try { await deleteRoutine(deleting.id); setRoutines(current => current.filter(item => item.id !== deleting.id)); setDeleting(null) }
    catch { setError('No se pudo borrar la rutina. Vuelve a intentarlo.'); setDeleting(null) }
    finally { setSaving(false) }
  }
  async function retry() {
    setLoading(true); setError(null)
    try { setRoutines(await getRoutines()) }
    catch { setError('No se pudieron cargar las rutinas. Comprueba la conexión con Django.') }
    finally { setLoading(false) }
  }
  if (planning) return <RoutinePlanner routine={planning} onBack={() => setPlanning(null)} />
  return <>
    <div className="page-heading"><div><p className="eyebrow">TU PLAN</p><h1>Mis rutinas</h1><p>El punto de partida de cada entrenamiento.</p></div><button className="button primary" onClick={() => { close(); setOpen(true) }}><Plus size={18} />Nueva rutina</button></div>
    <div className="section-heading"><h2>Rutinas guardadas</h2><span>{routines.length} rutinas</span></div>
    {loading && <StatusMessage loading message="Cargando rutinas..." />}
    {error && <><StatusMessage message={error} /><button className="button secondary" onClick={retry}>Volver a cargar</button></>}
    {!loading && !error && !routines.length && <section className="empty-state"><CalendarDays size={38} /><h2>Tu primera rutina empieza aquí</h2><p>Ponle nombre a tu plan de entrenamiento.</p><button className="button primary" onClick={() => setOpen(true)}><Plus size={18} />Crear rutina</button></section>}
    <div className="routine-grid">{routines.map((routine, index) => <article className="routine-card" key={routine.id}><div className="routine-card-top"><span className={`routine-symbol tone-${index % 3}`}><CalendarDays size={23} /></span><div className="row-actions"><button className="icon-button" title={`Editar ${routine.name}`} aria-label={`Editar ${routine.name}`} onClick={() => { setEditingId(routine.id); setName(routine.name); setFormError(null); setOpen(true) }}><Pencil size={17} /></button><button className="icon-button delete-button" title={`Borrar ${routine.name}`} aria-label={`Borrar ${routine.name}`} onClick={() => setDeleting(routine)}><Trash2 size={17} /></button></div></div><span className="routine-label">RUTINA {String(index + 1).padStart(2, '0')}</span><h2>{routine.name}</h2><p>Plan de entrenamiento</p><button className="button secondary routine-open" onClick={() => setPlanning(routine)}>Organizar semana</button></article>)}</div>
    {open && <Modal titleId="routine-title" onClose={close} busy={saving}><div className="modal-heading"><h2 id="routine-title">{editingId === null ? 'Nueva rutina' : 'Editar rutina'}</h2><button className="icon-button" title="Cerrar" aria-label="Cerrar" disabled={saving} onClick={close}><X size={20} /></button></div><form className="editor-form" onSubmit={submit}>{formError && <StatusMessage message={formError} />}<label htmlFor="routine-name">Nombre de la rutina<input id="routine-name" autoFocus required maxLength={100} placeholder="Ej. Push Pull Legs" value={name} disabled={saving} onChange={event => setName(event.target.value)} /></label><div className="form-actions"><button className="button secondary" type="button" disabled={saving} onClick={close}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Guardando...' : editingId === null ? 'Crear rutina' : 'Guardar cambios'}</button></div></form></Modal>}
    {deleting && <Modal titleId="delete-routine-title" onClose={() => setDeleting(null)} busy={saving}><h2 id="delete-routine-title">Borrar rutina</h2><p>Se eliminará «{deleting.name}» y sus días asociados. Esta acción no se puede deshacer.</p><div className="form-actions"><button className="button secondary" disabled={saving} onClick={() => setDeleting(null)}>Cancelar</button><button className="button danger" disabled={saving} onClick={remove}>{saving ? 'Borrando...' : 'Borrar rutina'}</button></div></Modal>}
  </>
}
