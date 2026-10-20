import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageNumbers } from '../hooks/usePagination'

/** Controles de paginación: Anterior · 1 2 3 … 8 · Siguiente, y "11–20 de 71". */
export default function Pagination({ page, pages, start, total, pageSize, onChange, label }: {
  page: number; pages: number; start: number; total: number; pageSize: number; onChange: (page: number) => void; label: string
}) {
  if (pages <= 1) return null
  return <nav className="pagination" aria-label={`Páginas de ${label}`}>
    <span className="pagination-count">{start + 1}–{Math.min(start + pageSize, total)} de {total}</span>
    <div className="pagination-buttons">
      <button type="button" className="icon-button" aria-label="Página anterior" disabled={page === 1} onClick={() => onChange(page - 1)}><ChevronLeft size={18} /></button>
      {pageNumbers(page, pages).map((item, index) => item === '…'
        ? <span key={'gap' + index} className="pagination-gap" aria-hidden="true">…</span>
        : <button key={item} type="button" className="pagination-page" aria-label={`Página ${item}`} aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>{item}</button>)}
      <button type="button" className="icon-button" aria-label="Página siguiente" disabled={page === pages} onClick={() => onChange(page + 1)}><ChevronRight size={18} /></button>
    </div>
  </nav>
}
