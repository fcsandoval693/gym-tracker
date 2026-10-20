import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'

export default function StatusMessage({ message, loading = false, success = false }: { message: string; loading?: boolean; success?: boolean }) {
  const quiet = loading || success
  return <div className={`status-message ${quiet ? '' : 'status-error'}`} role={quiet ? 'status' : 'alert'}>
    {loading ? <LoaderCircle size={18} className="spin" /> : success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
    <span>{message}</span>
  </div>
}
