// Paletas de color de la app. Cada acento tiene una versión oscura y otra clara.
// Los nombres de los tokens se convierten en variables CSS: accentText -> --accent-text.

export type AccentId = 'lima' | 'brasa' | 'hielo' | 'neon' | 'carmin'
export type ThemeMode = 'dark' | 'light' | 'system'
export type ThemeSettings = { accent: AccentId; mode: ThemeMode }

type Tokens = {
  bg: string; surface: string; rowHi: string; chip: string; line: string; line2: string
  text: string; muted: string; faint: string
  accent: string; accentText: string; onAccent: string; accentSoft: string
  warn: string; danger: string; dangerSoft: string; overlay: string
}

export const accents: { id: AccentId; name: string; description: string }[] = [
  { id: 'lima', name: 'Lima', description: 'La paleta base de Pizarra' },
  { id: 'brasa', name: 'Brasa', description: 'Naranja cálido, con energía' },
  { id: 'hielo', name: 'Hielo', description: 'Cian frío y técnico' },
  { id: 'neon', name: 'Neón', description: 'Violeta suave y nocturno' },
  { id: 'carmin', name: 'Carmín', description: 'Rojo deportivo sobre grafito' },
]

const darkBase = { danger: '#FF8A80', dangerSoft: 'rgba(255, 138, 128, 0.12)', overlay: 'rgba(0, 0, 0, 0.6)' }
const lightBase = { danger: '#B42318', dangerSoft: '#FDECEA', overlay: 'rgba(20, 20, 20, 0.4)' }

export const palettes: Record<AccentId, Record<'dark' | 'light', Tokens>> = {
  lima: {
    dark: { ...darkBase, bg: '#0F1110', surface: '#171A18', rowHi: '#1A1E1B', chip: '#232824', line: '#252A26', line2: '#3A403B', text: '#ECEFEA', muted: '#9AA39C', faint: '#6E776F', accent: '#C6F432', accentText: '#C6F432', onAccent: '#0F1110', accentSoft: 'rgba(198, 244, 50, 0.12)', warn: '#F0A07A' },
    light: { ...lightBase, bg: '#F2F3EF', surface: '#FFFFFF', rowHi: '#F7F8F4', chip: '#E8EBE4', line: '#DDE0DA', line2: '#C4C9C1', text: '#15181A', muted: '#5D6560', faint: '#8A918C', accent: '#4C7A00', accentText: '#3F6600', onAccent: '#FFFFFF', accentSoft: 'rgba(76, 122, 0, 0.1)', warn: '#B4441B' },
  },
  brasa: {
    dark: { ...darkBase, bg: '#121010', surface: '#1B1716', rowHi: '#201A19', chip: '#2A2321', line: '#2C2523', line2: '#463B38', text: '#F1ECEA', muted: '#A89D99', faint: '#7A6F6B', accent: '#FF6A3D', accentText: '#FF8A63', onAccent: '#140C09', accentSoft: 'rgba(255, 106, 61, 0.13)', warn: '#F2C14E' },
    light: { ...lightBase, bg: '#F6F2EF', surface: '#FFFFFF', rowHi: '#FAF6F3', chip: '#EFE7E2', line: '#E5DCD6', line2: '#CDBFB7', text: '#1C1513', muted: '#6B5D57', faint: '#94867F', accent: '#C2410C', accentText: '#B23A0A', onAccent: '#FFFFFF', accentSoft: 'rgba(194, 65, 12, 0.09)', warn: '#A16207' },
  },
  hielo: {
    dark: { ...darkBase, bg: '#0D1114', surface: '#151B20', rowHi: '#182026', chip: '#1F2830', line: '#232C33', line2: '#36434D', text: '#E8EEF2', muted: '#93A1AC', faint: '#66737D', accent: '#4FD1E8', accentText: '#4FD1E8', onAccent: '#06161A', accentSoft: 'rgba(79, 209, 232, 0.12)', warn: '#F0A07A' },
    light: { ...lightBase, bg: '#EFF3F5', surface: '#FFFFFF', rowHi: '#F5F8FA', chip: '#E2EAEE', line: '#D8E1E6', line2: '#BCC9D0', text: '#0F171C', muted: '#55646D', faint: '#84939B', accent: '#0E7490', accentText: '#0B6680', onAccent: '#FFFFFF', accentSoft: 'rgba(14, 116, 144, 0.09)', warn: '#B4441B' },
  },
  neon: {
    dark: { ...darkBase, bg: '#100E14', surface: '#18151F', rowHi: '#1D1925', chip: '#26212F', line: '#2A2533', line2: '#41394F', text: '#EEEAF5', muted: '#A39BB0', faint: '#746C82', accent: '#B794FF', accentText: '#C3A6FF', onAccent: '#140D22', accentSoft: 'rgba(183, 148, 255, 0.13)', warn: '#F2C14E' },
    light: { ...lightBase, bg: '#F3F1F7', surface: '#FFFFFF', rowHi: '#F8F6FB', chip: '#E9E4F2', line: '#DFD9EA', line2: '#C6BDD6', text: '#17121F', muted: '#625A70', faint: '#8E869B', accent: '#6D28D9', accentText: '#5B21B6', onAccent: '#FFFFFF', accentSoft: 'rgba(109, 40, 217, 0.08)', warn: '#B4441B' },
  },
  carmin: {
    dark: { ...darkBase, bg: '#0E0E0F', surface: '#18181A', rowHi: '#1D1D20', chip: '#26262A', line: '#29292C', line2: '#404046', text: '#F2F2F2', muted: '#A0A0A6', faint: '#717178', accent: '#FF4D5E', accentText: '#FF6B79', onAccent: '#16070A', accentSoft: 'rgba(255, 77, 94, 0.12)', warn: '#F2C14E' },
    light: { ...lightBase, bg: '#F3F3F3', surface: '#FFFFFF', rowHi: '#F8F8F8', chip: '#E8E8EA', line: '#DEDEE1', line2: '#C5C5CA', text: '#141416', muted: '#5E5E66', faint: '#8B8B92', accent: '#BE123C', accentText: '#A30F33', onAccent: '#FFFFFF', accentSoft: 'rgba(190, 18, 60, 0.08)', warn: '#A16207' },
  },
}

const STORAGE_KEY = 'gym-tracker:theme'
export const defaultTheme: ThemeSettings = { accent: 'lima', mode: 'dark' }

export function loadTheme(): ThemeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && saved.accent in palettes && ['dark', 'light', 'system'].includes(saved.mode)) return saved
  } catch { /* Sin almacenamiento local: se usa el tema por defecto. */ }
  return defaultTheme
}

export function saveTheme(settings: ThemeSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* Sin almacenamiento local. */ }
}

export function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function resolveMode(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

const toVar = (key: string) => '--' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())

export function applyTheme(settings: ThemeSettings) {
  const mode = resolveMode(settings.mode)
  const tokens = palettes[settings.accent][mode]
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(toVar(key), value)
  root.style.colorScheme = mode
  root.dataset.theme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens.bg)
}
