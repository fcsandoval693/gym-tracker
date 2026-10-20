import { useRef } from 'react'
import type { ReactNode } from 'react'
import { usePagination } from '../hooks/usePagination'
import Pagination from './Pagination'

/**
 * Muestra una lista por páginas. Tú decides cómo se pinta la página (children) y este
 * componente se encarga de cortar la lista y de los botones.
 * Ejemplo: <PagedList items={sesiones} label="sesiones">{pagina => pagina.map(...)}</PagedList>
 */
export default function PagedList<T>({ items, pageSize = 10, resetKey = '', label, children }: {
  items: T[]; pageSize?: number; resetKey?: string; label: string; children: (pageItems: T[]) => ReactNode
}) {
  const { page, pages, pageItems, start, total, setPage } = usePagination(items, pageSize, resetKey)
  const top = useRef<HTMLDivElement>(null)

  function change(next: number) {
    setPage(next)
    // Si el principio de la lista ha quedado por encima de la pantalla, se sube hasta él.
    const box = top.current?.getBoundingClientRect()
    if (box && box.top < 0) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <>
    <div ref={top} className="paged-anchor" />
    {children(pageItems)}
    <Pagination page={page} pages={pages} start={start} total={total} pageSize={pageSize} onChange={change} label={label} />
  </>
}
