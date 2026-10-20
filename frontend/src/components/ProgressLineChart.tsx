import { useState } from 'react'
import { formatNumber } from '../stats'

type Point = { label: string; value: number; detail: string }

const W = 600, H = 220, PAD = { top: 16, right: 16, bottom: 28, left: 44 }

/** Gráfico de una sola línea con eje Y, marcadores y un cursor que muestra el valor de cada sesión. */
export default function ProgressLineChart({ points, unit, title }: { points: Point[]; unit: string; title: string }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return <p className="muted">Hace falta al menos dos sesiones con este ejercicio para ver la evolución.</p>

  const values = points.map(point => point.value)
  const rawMin = Math.min(...values), rawMax = Math.max(...values)
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.1)
  const min = Math.max(0, rawMin - span * 0.2), max = rawMax + span * 0.2
  const x = (index: number) => PAD.left + (index / (points.length - 1)) * (W - PAD.left - PAD.right)
  const y = (value: number) => PAD.top + (1 - (value - min) / (max - min)) * (H - PAD.top - PAD.bottom)
  const ticks = Array.from({ length: 4 }, (_, index) => min + (index / 3) * (max - min))
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const labelEvery = Math.ceil(points.length / 5)
  const active = hover === null ? null : points[hover]

  function move(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const position = ((event.clientX - box.left) / box.width) * W
    const index = Math.round(((position - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1))
    setHover(Math.min(points.length - 1, Math.max(0, index)))
  }

  return <figure className="line-chart">
    <figcaption className="muted">{title}</figcaption>
    <div className="chart-readout" aria-live="polite">{active ? <><strong>{active.detail}</strong> · {active.label}</> : <>Última: <strong>{points[points.length - 1].detail}</strong></>}</div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: de ${formatNumber(values[0])} a ${formatNumber(values[values.length - 1])} ${unit}`}>
      {ticks.map(tick => <g key={tick}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="grid" />
        <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="axis">{formatNumber(tick, 1)}</text>
      </g>)}
      {points.map((point, index) => (index % labelEvery === 0 && points.length - 1 - index >= labelEvery / 2) || index === points.length - 1
        ? <text key={'l' + index} x={x(index)} y={H - 8} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="axis">{point.label.replace(/^\w+\.?,?\s*/, '')}</text> : null)}
      <path d={path} className="line" />
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />}
      {points.map((point, index) => <circle key={index} cx={x(index)} cy={y(point.value)} r={index === hover ? 6 : 4} className="dot" />)}
      <rect x={PAD.left} y={0} width={W - PAD.left - PAD.right} height={H} fill="transparent" onPointerMove={move} onPointerLeave={() => setHover(null)} />
    </svg>
    <table className="visually-hidden"><caption>{title}</caption><tbody>{points.map((point, index) => <tr key={index}><th>{point.label}</th><td>{point.detail}</td></tr>)}</tbody></table>
  </figure>
}
