import { muscleGroups } from '../exerciseSettings'

export default function MuscleGroupSelect({ value, onChange, disabled, id }: { value: string; onChange: (value: string) => void; disabled?: boolean; id?: string }) {
  const options = muscleGroups.includes(value) || !value ? muscleGroups : [value, ...muscleGroups]
  return <select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}><option value="">Seleccionar grupo</option>{options.map(group => <option key={group}>{group}</option>)}</select>
}
