import { useState } from 'react'

/**
 * Divide una lista en páginas. `resetKey` sirve para volver a la página 1 cuando cambian
 * los filtros (por ejemplo, la búsqueda): si cambia, se empieza de nuevo.
 */
export function usePagination<T>(items: T[], pageSize = 10, resetKey = '') {
  const [page, setPage] = useState(1)
  const [lastKey, setLastKey] = useState(resetKey)
  // Ajustar el estado durante el render (en vez de en un useEffect) es lo que recomienda React
  // para "reiniciar algo cuando cambia una prop": evita pintar una vez con la página antigua.
  if (resetKey !== lastKey) { setLastKey(resetKey); setPage(1) }

  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pages)
  const start = (current - 1) * pageSize
  return { page: current, pages, pageItems: items.slice(start, start + pageSize), start, total: items.length, pageSize, setPage }
}

/** Números de página a mostrar: siempre la primera, la última y las de alrededor de la actual. */
export function pageNumbers(page: number, pages: number): (number | '…')[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages))
  const sorted = [...wanted].sort((a, b) => a - b)
  return sorted.flatMap((n, index) => index > 0 && n - sorted[index - 1] > 1 ? ['…' as const, n] : [n])
}
