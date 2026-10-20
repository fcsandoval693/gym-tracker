export const draftKey = (session: number, exercise: number) => `gym-tracker:session:${session}:exercise:${exercise}`

export function readDraft(session: number, exercise: number): { weight: string; reps: string } {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey(session, exercise)) || 'null')
    return value && typeof value.weight === 'string' && typeof value.reps === 'string' ? value : { weight: '', reps: '' }
  } catch { return { weight: '', reps: '' } }
}
