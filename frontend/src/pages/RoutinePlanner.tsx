import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowDown, ArrowUp, Check, Moon, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import type { Exercise, Routine, RoutineDay, RoutineExercise } from '../types'
import { createExercise, getExercises } from '../api/exercises'
import { weekdays, getRoutineDays, saveRoutineDay, deleteRoutineDay, getRoutineExercises, addRoutineExercise, removeRoutineExercise, moveRoutineExercise, updateRoutineExercise } from '../api/planner'
import StatusMessage from '../components/StatusMessage'
import Modal from '../components/Modal'
import ExerciseSettingsFields from '../components/ExerciseSettingsFields'
import ExercisePicker from '../components/ExercisePicker'
import TargetFields from '../components/TargetFields'
import type { PickedExercise } from '../components/ExercisePicker'
import { equipmentOptions } from '../exerciseSettings'
import type { WeightUnit, Equipment } from '../exerciseSettings'
import { targetLabel } from '../stats'
import type { Target } from '../stats'

// Plantillas para dividir una rutina nueva en entrenamientos (los días se cambian después).
const templates = [
  { name: 'Push Pull Legs', days: [['Push', [0, 3]], ['Pull', [1, 4]], ['Legs', [2]]] },
  { name: 'Torso / Pierna', days: [['Torso', [0, 3]], ['Pierna', [1, 4]]] },
  { name: 'Cuerpo completo', days: [['Cuerpo completo', [0, 2, 4]]] },
] as const

export default function RoutinePlanner({ routine, onBack }: { routine: Routine; onBack: () => void }) {
  const [days, setDays] = useState<RoutineDay[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [items, setItems] = useState<RoutineExercise[]>([])
  const [loadedDay, setLoadedDay] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | undefined>()
  const [name, setName] = useState('')
  const [week, setWeek] = useState<number[]>([])
  const [deleting, setDeleting] = useState<RoutineDay | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [weekdaySheet, setWeekdaySheet] = useState<number | null>(null)
  const [preferences, setPreferences] = useState<RoutineExercise | null>(null)
  const [prefUnit, setPrefUnit] = useState<WeightUnit>('kg')
  const [prefEquipment, setPrefEquipment] = useState<Equipment>('other')
  const [prefVariant, setPrefVariant] = useState('')
  const [prefTarget, setPrefTarget] = useState<Target>({ sets: 3, repMin: 8, repMax: 12 })

  useEffect(() => {
    let active = true
    Promise.all([getRoutineDays(routine.id), getExercises()]).then(([data, library]) => {
      if (active) { setDays(data); setExercises(library); setSelected(data[0]?.id ?? null) }
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [routine.id])
  useEffect(() => {
    let active = true
    if (selected !== null) getRoutineExercises(selected).then(data => { if (active) { setItems(data); setLoadedDay(selected) } }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [selected])

  function edit(day?: RoutineDay, weekday?: number) {
    setEditing(day?.id); setName(day?.name || ''); setWeek(day?.weekdays || (weekday === undefined ? [] : [weekday])); setError(null); setOpen(true)
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) { setError('Escribe el nombre del entrenamiento.'); return }
    setBusy(true); setError(null)
    try {
      // Si un día ya lo tenía otro entrenamiento, primero se le quita (cada día tiene un solo entrenamiento).
      const taken = days.filter(day => day.id !== editing && day.weekdays.some(value => week.includes(value)))
      const freed = await Promise.all(taken.map(day => saveRoutineDay({ routine: routine.id, name: day.name, weekdays: day.weekdays.filter(value => !week.includes(value)) }, day.id)))
      const saved = await saveRoutineDay({ routine: routine.id, name: name.trim(), weekdays: [...week].sort() }, editing)
      setDays(current => {
        const updated = current.map(day => freed.find(item => item.id === day.id) ?? day)
        return editing ? updated.map(item => item.id === saved.id ? saved : item) : [...updated, saved]
      })
      setSelected(saved.id); setOpen(false); setWeekdaySheet(null)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function applyTemplate(template: typeof templates[number]) {
    setBusy(true); setError(null)
    try {
      const created: RoutineDay[] = []
      for (const [dayName, dayWeekdays] of template.days) created.push(await saveRoutineDay({ routine: routine.id, name: dayName, weekdays: [...dayWeekdays] }))
      setDays(created); setSelected(created[0]?.id ?? null)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  /** Asigna un entrenamiento (o descanso, si target es null) a un día de la semana. */
  async function assign(weekday: number, target: number | null) {
    const current = days.find(day => day.weekdays.includes(weekday))
    if ((current?.id ?? null) === target) { setWeekdaySheet(null); return }
    setBusy(true); setError(null)
    try {
      const changes: RoutineDay[] = []
      if (current) changes.push(await saveRoutineDay({ routine: routine.id, name: current.name, weekdays: current.weekdays.filter(value => value !== weekday) }, current.id))
      const next = days.find(day => day.id === target)
      if (next) changes.push(await saveRoutineDay({ routine: routine.id, name: next.name, weekdays: [...next.weekdays, weekday].sort() }, next.id))
      setDays(all => all.map(day => changes.find(item => item.id === day.id) ?? day))
      setWeekdaySheet(null)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function add(picked: PickedExercise) {
    if (selected === null || loadedDay !== selected) return
    setBusy(true); setError(null)
    try {
      const position = items.length ? Math.max(...items.map(item => item.position)) + 1 : 0
      const item = await addRoutineExercise(selected, picked.exercise.id, position, picked.unit, picked.equipment, picked.variant)
      setItems(current => [...current, item]); setPickerOpen(false)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function createOwn(exerciseName: string, group: string, equipment: Equipment) {
    const exercise = await createExercise(exerciseName, group, equipment)
    setExercises(current => [...current, exercise])
    return exercise
  }
  async function removeItem(id: number) {
    setBusy(true); setError(null)
    try { await removeRoutineExercise(id); setItems(current => current.filter(item => item.id !== id)) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function move(index: number, direction: number) {
    const reordered = [...items]
    ;[reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]]
    setBusy(true); setError(null)
    try {
      const saved = await Promise.all(reordered.map((item, position) => moveRoutineExercise(item.id, position)))
      setItems(saved)
    } catch (e) {
      setError((e as Error).message)
      if (selected !== null) setItems(await getRoutineExercises(selected).catch(() => items))
    } finally { setBusy(false) }
  }
  async function removeDay() {
    if (!deleting) return
    setBusy(true); setError(null)
    try {
      await deleteRoutineDay(deleting.id)
      const remaining = days.filter(day => day.id !== deleting.id)
      setDays(remaining); if (selected === deleting.id) setSelected(remaining[0]?.id ?? null)
      setDeleting(null)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preferences) return
    setBusy(true); setError(null)
    try {
      const updated = await updateRoutineExercise(preferences.id, { weight_unit: prefUnit, equipment: prefEquipment, variant: prefVariant, target_sets: prefTarget.sets, rep_min: prefTarget.repMin, rep_max: prefTarget.repMax })
      setItems(current => current.map(item => item.id === updated.id ? updated : item)); setPreferences(null)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const day = days.find(item => item.id === selected)
  const sheetDay = weekdaySheet === null ? undefined : days.find(item => item.weekdays.includes(weekdaySheet))
  const prefExercise = preferences ? exercises.find(exercise => exercise.id === preferences.exercise) : undefined
  return <>
    <button className="button secondary back-button" disabled={busy} onClick={onBack}><ArrowLeft size={18} />Mis rutinas</button>
    <div className="page-heading"><div><p className="eyebrow">Plan semanal</p><h1>{routine.name}</h1><p>Toca un día para elegir qué entrenas.</p></div>{days.length > 0 && <button className="button secondary" onClick={() => edit()}><Plus size={18} />Nuevo entrenamiento</button>}</div>
    {error && !open && !pickerOpen && weekdaySheet === null && <StatusMessage message={error} />}
    {loading ? <StatusMessage loading message="Cargando el plan..." /> : !days.length ? <section className="empty-state">
      <h2>Divide tu rutina</h2>
      <p>Elige cómo repartes los entrenamientos. Después podrás cambiar qué haces cada día.</p>
      <div className="template-list">{templates.map(template => <button key={template.name} className="template-option" disabled={busy} onClick={() => applyTemplate(template)}><strong>{template.name}</strong><small>{template.days.map(([dayName]) => dayName).join(' · ')}</small></button>)}</div>
      <button className="button secondary" disabled={busy} onClick={() => edit()}><Plus size={18} />Crear entrenamiento a mano</button>
    </section> : <>
      <div className="week-grid planner-week">{weekdays.map((label, index) => {
        const assigned = days.find(item => item.weekdays.includes(index))
        return <button className={assigned ? (selected === assigned.id ? 'week-day selected' : 'week-day') : 'week-day rest-day'} key={label} disabled={busy} aria-haspopup="dialog" onClick={() => { setError(null); setWeekdaySheet(index) }}><span>{label}</span><strong>{assigned?.name || 'Descanso'}</strong></button>
      })}</div>
      <div className="day-tabs" role="tablist" aria-label="Entrenamientos de la rutina">{days.map(item => <button role="tab" disabled={busy} aria-selected={selected === item.id} className={selected === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelected(item.id)}>{item.name}<small>{item.weekdays.length ? item.weekdays.map(value => weekdays[value].slice(0, 3)).join(' · ') : 'Sin día'}</small></button>)}</div>
      {day && <section className="routine-detail"><div className="section-heading"><h2>Ejercicios de {day.name}</h2><div className="row-actions"><button className="icon-button" aria-label="Editar entrenamiento" title="Editar entrenamiento" onClick={() => edit(day)}><Pencil size={18} /></button><button className="icon-button delete-button" aria-label="Borrar entrenamiento" title="Borrar entrenamiento" onClick={() => setDeleting(day)}><Trash2 size={18} /></button></div></div>
        <ol className="plan-exercises">{(loadedDay === selected ? items : []).map((item, index) => <li key={item.id}><span className="item-number">{String(index + 1).padStart(2, '0')}</span><strong>{exercises.find(exercise => exercise.id === item.exercise)?.name || 'Ejercicio eliminado'}<small className="routine-equipment">{[targetLabel({ sets: item.target_sets, repMin: item.rep_min, repMax: item.rep_max }), item.variant, equipmentOptions.find(option => option.value === item.equipment)?.label || 'Otro', item.weight_unit || 'kg'].filter(Boolean).join(' · ')}</small></strong><div className="row-actions"><button className="icon-button" disabled={busy} title="Objetivo, variante y material" aria-label="Objetivo, variante y material" onClick={() => { setPreferences(item); setPrefTarget({ sets: item.target_sets, repMin: item.rep_min, repMax: item.rep_max }); setPrefUnit(item.weight_unit || 'kg'); setPrefEquipment(item.equipment || 'other'); setPrefVariant(item.variant || ''); setError(null) }}><SlidersHorizontal size={16} /></button><button className="icon-button" aria-label="Subir ejercicio" title="Subir ejercicio" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button className="icon-button" aria-label="Bajar ejercicio" title="Bajar ejercicio" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button className="icon-button delete-button" aria-label="Quitar ejercicio" title="Quitar de la rutina" disabled={busy} onClick={() => removeItem(item.id)}><Trash2 size={16} /></button></div></li>)}</ol>
        {loadedDay !== selected && <StatusMessage loading message="Cargando ejercicios..." />}
        {loadedDay === selected && !items.length && <p className="muted">Este entrenamiento aún no tiene ejercicios.</p>}
        <button className="button primary add-exercise" disabled={busy || loadedDay !== selected} onClick={() => { setError(null); setPickerOpen(true) }}><Plus size={18} />Añadir ejercicio</button>
      </section>}
    </>}

    {weekdaySheet !== null && <Modal variant="sheet" titleId="weekday-sheet" busy={busy} onClose={() => setWeekdaySheet(null)}>
      <div className="modal-heading"><h2 id="weekday-sheet">{weekdays[weekdaySheet]}</h2><button className="icon-button" aria-label="Cerrar" title="Cerrar" disabled={busy} onClick={() => setWeekdaySheet(null)}><X size={20} /></button></div>
      {error && <StatusMessage message={error} />}
      <div className="sheet-options" role="radiogroup" aria-labelledby="weekday-sheet">
        {days.map(item => <button key={item.id} type="button" role="radio" aria-checked={sheetDay?.id === item.id} disabled={busy} onClick={() => assign(weekdaySheet, item.id)}><span><strong>{item.name}</strong><small>{item.weekdays.filter(value => value !== weekdaySheet).length ? 'También: ' + item.weekdays.filter(value => value !== weekdaySheet).map(value => weekdays[value]).join(', ') : 'Ningún otro día'}</small></span>{sheetDay?.id === item.id && <Check size={20} />}</button>)}
        <button type="button" role="radio" aria-checked={!sheetDay} disabled={busy} onClick={() => assign(weekdaySheet, null)}><span><strong><Moon size={16} />Descanso</strong><small>No entrenas este día</small></span>{!sheetDay && <Check size={20} />}</button>
      </div>
      <div className="sheet-actions">
        {sheetDay && <button type="button" className="button secondary" disabled={busy} onClick={() => { setSelected(sheetDay.id); setWeekdaySheet(null) }}>Ver ejercicios de {sheetDay.name}</button>}
        <button type="button" className="button secondary" disabled={busy} onClick={() => { const weekday = weekdaySheet; setWeekdaySheet(null); edit(undefined, weekday) }}><Plus size={18} />Nuevo entrenamiento</button>
      </div>
    </Modal>}

    {pickerOpen && day && <Modal variant="sheet" titleId="picker-title" busy={busy} onClose={() => setPickerOpen(false)}>
      <div className="modal-heading"><h2 id="picker-title">Añadir a {day.name}</h2><button className="icon-button" aria-label="Cerrar" title="Cerrar" disabled={busy} onClick={() => setPickerOpen(false)}><X size={20} /></button></div>
      {error && <StatusMessage message={error} />}
      <ExercisePicker exercises={exercises} excluded={items.map(item => item.exercise).filter((id): id is number => id !== null)} busy={busy} onPick={add} onCreate={createOwn} onCancel={() => setPickerOpen(false)} />
    </Modal>}

    {preferences && <Modal variant="sheet" titleId="routine-preferences" busy={busy} onClose={() => setPreferences(null)}><h2 id="routine-preferences">{prefExercise?.name ?? 'Ejercicio'}</h2><form className="editor-form" onSubmit={savePreferences}>{error && <StatusMessage message={error} />}
      <TargetFields value={prefTarget} onChange={setPrefTarget} disabled={busy} />
      {!!prefExercise?.variants?.length && <fieldset className="chip-field"><legend>{prefExercise.variant_label || 'Variante'}</legend><div className="chips">{prefExercise.variants.map(option => <button key={option} type="button" className="chip" aria-pressed={prefVariant === option} onClick={() => setPrefVariant(option)}>{option}</button>)}</div></fieldset>}
      <ExerciseSettingsFields unit={prefUnit} equipment={prefEquipment} onUnit={setPrefUnit} onEquipment={setPrefEquipment} disabled={busy} /><div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setPreferences(null)}>Cancelar</button><button className="button primary" disabled={busy}>Guardar</button></div></form></Modal>}

    {open && <Modal variant="sheet" titleId="day-title" onClose={() => setOpen(false)} busy={busy}><h2 id="day-title">{editing ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}</h2><form className="editor-form" onSubmit={submit}>{error && <StatusMessage message={error} />}<label>Nombre<input autoFocus required maxLength={100} value={name} placeholder="Ej. Push" disabled={busy} onChange={event => setName(event.target.value)} /></label><fieldset className="week-picker"><legend>Días de la semana</legend>{weekdays.map((label, index) => <label key={label}><input type="checkbox" disabled={busy} checked={week.includes(index)} onChange={event => setWeek(current => event.target.checked ? [...current, index] : current.filter(value => value !== index))} /><span>{label}{!week.includes(index) || days.every(item => item.id === editing || !item.weekdays.includes(index)) ? '' : ` (en lugar de ${days.find(item => item.id !== editing && item.weekdays.includes(index))?.name})`}</span></label>)}</fieldset><div className="form-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando...' : 'Guardar entrenamiento'}</button></div></form></Modal>}
    {deleting && <Modal titleId="remove-day" onClose={() => setDeleting(null)} busy={busy}><h2 id="remove-day">Borrar {deleting.name}</h2><p>Se quitará del calendario. Las sesiones registradas se conservarán.</p><div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="button danger" disabled={busy} onClick={removeDay}>Borrar entrenamiento</button></div></Modal>}
  </>
}
