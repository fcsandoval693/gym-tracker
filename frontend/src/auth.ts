// Guarda el token de sesión en el navegador. Si el servidor responde 401 (token caducado o borrado),
// se avisa a la app con un evento para que vuelva a la pantalla de acceso.
const KEY = 'gym-tracker:token'
export const AUTH_EXPIRED = 'gym-tracker:auth-expired'

export function getToken() {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch { /* Sin almacenamiento local: la sesión dura hasta recargar. */ }
}
