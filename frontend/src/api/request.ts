import { AUTH_EXPIRED, getToken } from '../auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`
  let response: Response
  try {
    response = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch { throw new Error('No se pudo conectar con Django. Comprueba que el servidor esté encendido.') }
  if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    window.dispatchEvent(new Event(AUTH_EXPIRED))
    throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const messages = data && typeof data === 'object' ? Object.values(data).flat().filter(value => typeof value === 'string') : []
    throw new Error(messages.join(' ') || 'No se pudo completar la operación.')
  }
  return response.status === 204 ? undefined as T : response.json()
}
