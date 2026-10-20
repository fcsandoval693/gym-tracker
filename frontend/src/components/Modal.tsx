import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

// variant="sheet": en el móvil sube desde abajo (panel inferior); en pantallas grandes se ve como un diálogo.
export default function Modal({ children, titleId, onClose, busy = false, variant = 'dialog' }: { children: ReactNode; titleId: string; onClose: () => void; busy?: boolean; variant?: 'dialog' | 'sheet' }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])
  return <dialog ref={ref} className={variant === 'sheet' ? 'modal sheet' : 'modal'} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    onClick={event => { if (event.target === ref.current && !busy) onClose() }}>
    <div className="modal-inner">
      {variant === 'sheet' && <span className="sheet-handle" aria-hidden="true" />}
      {children}
    </div>
  </dialog>
}
