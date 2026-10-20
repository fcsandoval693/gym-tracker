import { equipmentOptions } from '../exerciseSettings'
import type { WeightUnit, Equipment } from '../exerciseSettings'

export default function ExerciseSettingsFields({ unit, equipment, onUnit, onEquipment, disabled }: {
  unit: WeightUnit; equipment: Equipment; onUnit: (value: WeightUnit) => void; onEquipment: (value: Equipment) => void; disabled?: boolean
}) {
  return <div className="exercise-settings-fields"><label>Unidad del peso<select value={unit} disabled={disabled} onChange={event => onUnit(event.target.value as WeightUnit)}><option value="kg">Kilogramos (kg)</option><option value="lb">Libras (lb)</option></select></label><label>Material<select value={equipment} disabled={disabled} onChange={event => onEquipment(event.target.value as Equipment)}>{equipmentOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
}
