import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock, MinusCircle, Pencil, RotateCcw, X } from 'lucide-react'
import type { Exercise, Routine, RoutineDay, WorkoutSession, WorkoutSet } from '../types'
import { getRoutines } from '../api/routines'
import { getExercises } from '../api/exercises'
import { getRoutineDays, weekdays } from '../api/planner'
import { getSessions, startSession, finishSession, getWorkoutSets, saveWorkoutSet, deleteWorkoutSet, getSession, completeExercise, editSessionExercise, removeSessionExercise } from '../api/workouts'
import StatusMessage from '../components/StatusMessage'
import PagedList from '../components/PagedList'
import Modal from '../components/Modal'
import WorkoutExercise from '../components/WorkoutExercise'
import { draftKey, readDraft } from '../workoutDrafts'
import MuscleGroupSelect from '../components/MuscleGroupSelect'
import ExerciseSettingsFields from '../components/ExerciseSettingsFields'
import { volumeKg } from '../exerciseSettings'
import type { WeightUnit, Equipment } from '../exerciseSettings'
import { previousSession, shortDate } from '../stats'
import SessionResult from '../components/SessionResult'
import ExerciseHistory from '../components/ExerciseHistory'
import TrainingChooser from '../components/TrainingChooser'

function SessionClock({ session }: { session: WorkoutSession }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (session.end_time) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session.end_time])
  const seconds = Math.max(0, Math.floor(((session.end_time ? Date.parse(session.end_time) : now) - Date.parse(session.start_time)) / 1000))
  return <span className="session-clock"><Clock size={18} />{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
}
export default function WorkoutPage({ onPlan, autoStartDay = null, onAutoStartHandled }: { onPlan: () => void; autoStartDay?: number | null; onAutoStartHandled?: () => void }) {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [days, setDays] = useState<RoutineDay[]>([])
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [library, setLibrary] = useState<Exercise[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [replacement, setReplacement] = useState('')
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseGroup, setExerciseGroup] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editUnit, setEditUnit] = useState<WeightUnit>('kg')
  const [editEquipment, setEditEquipment] = useState<Equipment>('other')
  const [previous, setPrevious] = useState<{ session: WorkoutSession; sets: WorkoutSet[] } | null>(null)
  const [historyFor, setHistoryFor] = useState<WorkoutSession['exercise_plan'][number] | null>(null)
  async function loadPrevious(item: WorkoutSession, list: WorkoutSession[]) {
    const before = previousSession(list, item)
    setPrevious(null)
    if (!before) return
    try { setPrevious({ session: before, sets: await getWorkoutSets(before.id) }) }
    catch { /* Sin comparación: la sesión sigue funcionando. */ }
  }
  async function load() {
    setLoading(true); setError(null)
    try {
      const [plans, schedule, history, catalog] = await Promise.all([getRoutines(), getRoutineDays(), getSessions(), getExercises()])
      setRoutines(plans); setDays(schedule); setSessions(history); setLibrary(catalog)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    Promise.all([getRoutines(), getRoutineDays(), getSessions(), getExercises()]).then(([plans, schedule, history, catalog]) => {
      if (!active) return
      setRoutines(plans); setDays(schedule); setSessions(history); setLibrary(catalog)
      // Viene de «Empezar» en Inicio: continúa la sesión abierta de ese día o empieza una nueva.
      if (autoStartDay !== null) {
        onAutoStartHandled?.()
        const open = history.find(item => !item.end_time && item.routine_day === autoStartDay)
        if (open) openSession(open, history)
        else start(autoStartDay, history)
      }
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Solo al montar: la petición de empezar llega una vez desde Inicio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  async function openSession(item: WorkoutSession, list = sessions) {
    setBusy(true); setError(null)
    try {
      const [data, fresh] = await Promise.all([getWorkoutSets(item.id), getSession(item.id)])
      setSets(data); setSession(fresh); loadPrevious(fresh, list)
      let saved: number | null = null
      try { saved = Number(localStorage.getItem('gym-tracker:current:' + item.id)) || null } catch { /* Sin almacenamiento local. */ }
      setCurrentId(fresh.exercise_plan.some(exercise => exercise.id === saved) ? saved : fresh.exercise_plan.find(exercise => !exercise.completed)?.id ?? fresh.exercise_plan[0]?.id ?? null)
    }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function start(day: number, list = sessions) {
    if (!day) return
    setBusy(true); setError(null)
    try {
      const item = await startSession(day)
      setSets([]); setSession(item); setCurrentId(item.exercise_plan[0]?.id ?? null); setSessions(current => [item, ...current])
      loadPrevious(item, list)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function save(exercise: number, weight: number, reps: number) {
    if (!session) return
    setBusy(true); setError(null)
    try { const set = await saveWorkoutSet(session.id, exercise, weight, reps); setSets(current => [...current, set]) }
    finally { setBusy(false) }
  }
  async function remove(id: number) {
    setBusy(true); setError(null)
    try { await deleteWorkoutSet(id); setSets(current => current.filter(set => set.id !== id)) }
    finally { setBusy(false) }
  }
  function confirmFinish() {
    if (!session) return
    const unsaved = session.exercise_plan.some(exercise => {
      const draft = readDraft(session.id, exercise.id)
      return draft.weight !== '' || draft.reps !== ''
    })
    if (unsaved) { setError('Hay una serie pendiente. Guárdala o vacía sus campos antes de finalizar.'); return }
    if (!sets.length) { setError('Registra al menos una serie antes de finalizar.'); return }
    setError(null); setFinishOpen(true)
  }
  async function finish() {
    if (!session) return
    setBusy(true); setError(null)
    try {
      const item = await finishSession(session.id)
      setSession(item); setSessions(current => current.map(old => old.id === item.id ? item : old)); setFinishOpen(false)
    } catch (e) { setError((e as Error).message); setFinishOpen(false) }
    finally { setBusy(false) }
  }
  function activate(id: number) {
    setCurrentId(id); setError(null)
    if (session) try { localStorage.setItem('gym-tracker:current:' + session.id, String(id)) } catch { /* Sin almacenamiento local. */ }
  }
  function updateSession(item: WorkoutSession) {
    setSession(item); setSessions(current => current.map(old => old.id === item.id ? item : old))
  }
  const currentExercise = session?.exercise_plan.find(exercise => exercise.id === currentId) ?? session?.exercise_plan[0]
  const currentIndex = session?.exercise_plan.findIndex(exercise => exercise.id === currentExercise?.id) ?? -1
  function hasDraft(id: number) {
    if (!session) return false
    const draft = readDraft(session.id, id)
    return draft.weight !== '' || draft.reps !== ''
  }
  async function completeCurrent(completed = true, target?: number) {
    if (!session || !currentExercise) return
    if (completed && hasDraft(currentExercise.id)) { setError('Guarda la serie pendiente o vacía sus valores antes de terminar el ejercicio.'); return }
    setBusy(true); setError(null)
    try {
      const updated = await completeExercise(session.id, currentExercise.id, completed)
      updateSession(updated)
      if (completed) {
        const pending = [...updated.exercise_plan.slice(currentIndex + 1), ...updated.exercise_plan.slice(0, currentIndex)].find(exercise => !exercise.completed)
        if (target) activate(target)
        else if (pending) activate(pending.id)
      }
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  function beginEdit() {
    if (!currentExercise) return
    if (hasDraft(currentExercise.id)) { setError('Guarda o vacía la serie pendiente antes de cambiar el ejercicio.'); return }
    setReplacement(String(currentExercise.id)); setExerciseName(currentExercise.name); setExerciseGroup(currentExercise.muscle_group)
    setEditUnit(currentExercise.weight_unit || 'kg'); setEditEquipment(currentExercise.equipment || 'other')
    setEditError(null); setEditOpen(true)
  }
  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !currentExercise || !replacement || !exerciseName.trim()) return
    setBusy(true); setEditError(null)
    try {
      const updated = await editSessionExercise(session.id, currentExercise.id, replacement === 'new' ? null : Number(replacement), exerciseName.trim(), exerciseGroup.trim(), editUnit, editEquipment)
      const target = replacement === 'new' ? updated.exercise_plan.find(exercise => !session.exercise_plan.some(previous => previous.id === exercise.id)) : updated.exercise_plan.find(exercise => exercise.id === Number(replacement))
      updateSession(updated)
      if (target) {
        activate(target.id)
        if (replacement === 'new') setLibrary(current => [...current, { id: target.id, name: target.name, muscle_group: target.muscle_group }])
      }
      setEditOpen(false)
      if (Number(replacement) !== currentExercise.id) try { localStorage.removeItem(draftKey(session.id, currentExercise.id)) } catch { /* Sin almacenamiento local. */ }
    } catch (e) { setEditError((e as Error).message) }
    finally { setBusy(false) }
  }
  const nextExercise = session ? [...session.exercise_plan.slice(currentIndex + 1), ...session.exercise_plan.slice(0, currentIndex)].find(exercise => !exercise.completed) : undefined
  async function goTo(id: number) {
    if (!session || !currentExercise || id === currentExercise.id) return
    const targetIndex = session.exercise_plan.findIndex(exercise => exercise.id === id)
    // Solo se da por terminado el ejercicio actual si ya tiene series; si no, simplemente se cambia de ejercicio.
    const hasSets = sets.some(set => (set.exercise_snapshot ?? set.exercise) === currentExercise.id)
    if (targetIndex > currentIndex && !currentExercise.completed && hasSets) await completeCurrent(true, id)
    else activate(id)
  }
  async function removeCurrent() {
    if (!session || !currentExercise) return
    setBusy(true); setError(null)
    try {
      const updated = await removeSessionExercise(session.id, currentExercise.id)
      try { localStorage.removeItem(draftKey(session.id, currentExercise.id)) } catch { /* Sin almacenamiento local. */ }
      updateSession(updated)
      const next = updated.exercise_plan[Math.min(currentIndex, updated.exercise_plan.length - 1)]
      const pending = [...updated.exercise_plan.slice(currentIndex), ...updated.exercise_plan.slice(0, currentIndex)].find(exercise => !exercise.completed)
      if (pending ?? next) activate((pending ?? next).id)
      setRemoveOpen(false)
    } catch (e) { setError((e as Error).message); setRemoveOpen(false) }
    finally { setBusy(false) }
  }
  if (session) {
    const previousLabel = previous ? shortDate(previous.session.start_time) : null
    const previousFor = (id: number) => previous ? previous.sets.filter(set => (set.exercise_snapshot ?? set.exercise) === id) : []
    const setsFor = (id: number) => sets.filter(set => (set.exercise_snapshot ?? set.exercise) === id)
    const todayVolume = volumeKg(sets)
    const previousVolume = previous ? volumeKg(previous.sets) : 0
    return <>
    <button className="button secondary back-button" disabled={busy} onClick={() => { setSession(null); setPrevious(null); setError(null) }}><ArrowLeft size={18} />Entrenamientos</button>
    <div className="page-heading"><div><p className="eyebrow">{session.routine_name || 'Rutina'}{previousLabel ? ` · comparando con ${previousLabel}` : ''}</p><h1>{session.day_name || 'Entrenamiento'}</h1><p>{new Date(session.start_time).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><SessionClock session={session} /></div>
    <div className="session-summary">
      <div className="stat"><span>Series</span><strong>{sets.length}</strong></div>
      <div className="stat"><span>Volumen</span><strong>{volumeKg(sets).toLocaleString('es', { maximumFractionDigits: 0 })} kg</strong></div>
      <div className="stat"><span>{previous ? 'Del volumen anterior' : 'Estado'}</span>{previous && previousVolume > 0 ? <strong className={todayVolume >= previousVolume ? 'positive' : ''}>{Math.round(todayVolume / previousVolume * 100)} %</strong> : <span className={session.end_time ? 'session-badge completed' : 'session-badge'}>{session.end_time ? 'Finalizado' : 'En curso'}</span>}</div>
      {!session.end_time && <button className="button secondary" disabled={busy} onClick={confirmFinish}><Check size={18} />Finalizar sesión</button>}
    </div>
    {error && <StatusMessage message={error} />}
    {session.end_time && <SessionResult session={session} sets={sets} previous={previous} />}
    {!session.exercise_plan.length && <StatusMessage message="Esta sesión antigua no tiene una plantilla de ejercicios guardada." />}
    {!session.end_time && <nav className="session-exercise-nav" aria-label="Ejercicios de la sesión">{session.exercise_plan.map(exercise => <button key={exercise.id} disabled={busy} className={currentExercise?.id === exercise.id ? 'selected' : ''} aria-current={currentExercise?.id === exercise.id ? 'step' : undefined} onClick={() => goTo(exercise.id)}><b>{exercise.completed && <Check size={15} />}{exercise.name}</b><small>{setsFor(exercise.id).length}{previous ? '/' + previousFor(exercise.id).length : ''} series</small></button>)}</nav>}
    {!session.end_time && currentExercise && <div className="current-exercise-toolbar"><span>Ejercicio {currentIndex + 1} de {session.exercise_plan.length}{currentExercise.completed ? ' · Terminado' : ''}</span><div className="toolbar-actions"><button className="button secondary" disabled={busy} onClick={beginEdit}><Pencil size={16} />Editar o cambiar</button><button className="button secondary" disabled={busy || session.exercise_plan.length < 2} title={session.exercise_plan.length < 2 ? 'La sesión necesita al menos un ejercicio' : 'Quitar este ejercicio solo de hoy'} onClick={() => { setError(null); setRemoveOpen(true) }}><MinusCircle size={16} />Quitar de hoy</button></div></div>}
    {(session.end_time ? session.exercise_plan : currentExercise ? [currentExercise] : []).map(exercise => <WorkoutExercise key={`${session.id}-${exercise.id}-${exercise.weight_unit || 'kg'}-${exercise.equipment || 'other'}`} exercise={exercise} session={session.id} sets={setsFor(exercise.id)} previous={previousFor(exercise.id)} previousLabel={previousLabel} completed={!!session.end_time || !!exercise.completed} busy={busy} onSave={save} onDelete={remove} onHistory={() => setHistoryFor(exercise)} />)}
    {!session.end_time && currentExercise && <div className="exercise-navigation"><button className="button secondary" disabled={busy || currentIndex <= 0} onClick={() => activate(session.exercise_plan[currentIndex - 1].id)}><ArrowLeft size={16} />Anterior</button>{currentExercise.completed && <button className="button secondary" disabled={busy} onClick={() => completeCurrent(false)}><RotateCcw size={16} />Reabrir ejercicio</button>}{(!currentExercise.completed || nextExercise) && <button className="button primary" disabled={busy} onClick={() => nextExercise && (currentExercise.completed || !sets.some(set => (set.exercise_snapshot ?? set.exercise) === currentExercise.id)) ? activate(nextExercise.id) : completeCurrent()}>{nextExercise ? <ArrowRight size={16} /> : <Check size={16} />}{nextExercise ? 'Siguiente ejercicio' : 'Terminar ejercicio'}</button>}</div>}
    {!session.end_time && session.exercise_plan.every(exercise => exercise.completed) && <div className="success-message"><Check size={18} />Todos los ejercicios están terminados. Ya puedes finalizar la sesión.</div>}
    {historyFor && <Modal titleId="exercise-history-title" onClose={() => setHistoryFor(null)}><div className="modal-heading"><h2 id="exercise-history-title">{historyFor.name}</h2><button className="icon-button" aria-label="Cerrar historial" title="Cerrar" onClick={() => setHistoryFor(null)}><X size={20} /></button></div><ExerciseHistory exercise={historyFor.id} sessions={sessions} /></Modal>}
    {editOpen && currentExercise && <Modal titleId="edit-session-exercise" busy={busy} onClose={() => setEditOpen(false)}><h2 id="edit-session-exercise">Editar ejercicio de esta sesión</h2><form className="editor-form" onSubmit={submitEdit}>{editError && <StatusMessage message={editError} />}<label>Ejercicio<select required disabled={busy} value={replacement} onChange={event => {
      setReplacement(event.target.value)
      if (event.target.value === 'new') { setExerciseName(''); setExerciseGroup(''); return }
      const selected = library.find(exercise => exercise.id === Number(event.target.value))
      if (selected) { setExerciseName(selected.name); setExerciseGroup(selected.muscle_group) }
    }}><option value="new">Crear nuevo ejercicio…</option>{!library.some(exercise => exercise.id === currentExercise.id) && <option value={currentExercise.id} disabled>{currentExercise.name} (eliminado del catálogo)</option>}{library.filter(exercise => exercise.id === currentExercise.id || !session.exercise_plan.some(item => item.id === exercise.id)).map(exercise => <option value={exercise.id} key={exercise.id}>{exercise.name}</option>)}</select></label><label>{replacement === 'new' ? 'Nombre del nuevo ejercicio' : 'Nombre en esta sesión'}<input required maxLength={100} value={exerciseName} disabled={busy} onChange={event => setExerciseName(event.target.value)} /></label><label>Grupo muscular<MuscleGroupSelect value={exerciseGroup} disabled={busy} onChange={setExerciseGroup} /></label><ExerciseSettingsFields unit={editUnit} equipment={editEquipment} onUnit={setEditUnit} onEquipment={setEditEquipment} disabled={busy} /><p className="muted">La rutina original y las series ya guardadas se conservan.</p><div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => setEditOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando...' : replacement === 'new' ? 'Crear y usar ejercicio' : 'Guardar ejercicio'}</button></div></form></Modal>}
    {removeOpen && currentExercise && <Modal variant="sheet" titleId="remove-exercise-title" busy={busy} onClose={() => setRemoveOpen(false)}><h2 id="remove-exercise-title">Quitar {currentExercise.name}</h2>{sets.some(set => (set.exercise_snapshot ?? set.exercise) === currentExercise.id) ? <p>Este ejercicio ya tiene series guardadas hoy. Bórralas primero si quieres quitarlo.</p> : <p>Se quita solo de la sesión de hoy. Tu rutina sigue igual y la próxima vez volverá a aparecer.</p>}<div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setRemoveOpen(false)}>Cancelar</button><button className="button danger" disabled={busy || sets.some(set => (set.exercise_snapshot ?? set.exercise) === currentExercise.id)} onClick={removeCurrent}>{busy ? 'Quitando…' : 'Quitar de hoy'}</button></div></Modal>}
    {finishOpen && <Modal titleId="finish-title" busy={busy} onClose={() => setFinishOpen(false)}><h2 id="finish-title">Finalizar entrenamiento</h2><p>{sets.length} series guardadas. Al finalizar, las series quedarán cerradas.</p><div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setFinishOpen(false)}>Seguir entrenando</button><button className="button primary" disabled={busy} onClick={finish}>{busy ? 'Finalizando...' : 'Finalizar y guardar'}</button></div></Modal>}
  </>
  }
  const today = (new Date().getDay() + 6) % 7
  return <>
    <div className="page-heading"><div><p className="eyebrow">HOY ES {weekdays[today].toLocaleUpperCase()}</p><h1>Entrenar</h1><p>Elige tu plan y empieza tu próxima sesión.</p></div></div>
    {loading && <StatusMessage loading message="Cargando entrenamientos..." />}
    {error && <><StatusMessage message={error} /><button className="button secondary" onClick={load}>Volver a cargar</button></>}
    {!loading && <>
      <section className="training-picker">
        <h2>¿Qué entrenas hoy?</h2>
        <p className="muted" style={{ margin: '4px 0 16px' }}>Te proponemos el que toca, pero puedes elegir cualquiera.</p>
        <TrainingChooser routines={routines} days={days} sessions={sessions} exercises={library} busy={busy} onStart={day => start(day)} onContinue={item => openSession(item)} onPlan={onPlan} />
      </section>
      <div className="section-heading"><h2>Entrenamientos finalizados</h2><span>{sessions.filter(item => !!item.end_time).length} sesiones</span></div>
      <PagedList items={sessions.filter(item => !!item.end_time)} label="entrenamientos">{page => page.map(item => <div className="session-list-row" key={item.id}><div><strong>{item.day_name || 'Entrenamiento'}</strong><p className="muted">{item.routine_name} · {new Date(item.start_time).toLocaleDateString('es')}</p></div><button className="button secondary" disabled={busy} onClick={() => openSession(item)}>Ver sesión</button></div>)}</PagedList>
      {!sessions.some(item => item.end_time) && <p className="muted">Todavía no hay entrenamientos finalizados.</p>}
    </>}
  </>
}
