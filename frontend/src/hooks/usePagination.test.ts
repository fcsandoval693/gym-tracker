import { describe, expect, it } from 'vitest'
import { pageNumbers } from './usePagination'

describe('pageNumbers', () => {
  it('con pocas páginas las muestra todas', () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3])
  })
  it('con muchas: la primera, la última y las de alrededor de la actual, con … en los huecos', () => {
    expect(pageNumbers(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10])
  })
  it('al principio y al final no repite números', () => {
    expect(pageNumbers(1, 8)).toEqual([1, 2, '…', 8])
    expect(pageNumbers(8, 8)).toEqual([1, '…', 7, 8])
  })
})
