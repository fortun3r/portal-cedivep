/**
 * Normalización de teléfonos y correos tal como están cargados en `clini_vet`.
 *
 * Los datos reales son sucios (sonda v4): '0986 441 190', '981914102',
 * '981-114.114 - 754.278' (dos números en un campo), correos con dos
 * direcciones separadas por coma, teléfonos dentro del campo de email.
 * Todo lo que se compara pasa por acá.
 */

/**
 * Separadores entre DOS números distintos dentro de un mismo campo: barra,
 * coma, ' - ' con espacios, doble espacio ('0981.409495  0343 - 420 984'), 'y', 'o'.
 * Un espacio simple NO separa: '0981 163 342' es un solo número.
 */
const ENTRE_NUMEROS = /\s*[\/,;|]\s*|\s+-\s+|\s{2,}|\s+y\s+|\s+o\s+/i

/**
 * Forma canónica de un teléfono paraguayo: solo dígitos, sin +595 ni el 0
 * inicial. Un celular queda en 9 dígitos ('981163342'), un fijo de Asunción
 * en 8 ('21123456'). Devuelve null si no parece un teléfono completo.
 */
export function canonTelefono(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00595')) d = d.slice(5)
  else if (d.startsWith('595') && d.length >= 11) d = d.slice(3)
  d = d.replace(/^0+/, '')
  if (d.length < 8 || d.length > 9) return null
  if (/^(\d)\1+$/.test(d)) return null // 999999999, 00000000…
  return d
}

/** Todos los teléfonos válidos que aparecen en un campo libre. */
export function telefonosDe(raw: string | null | undefined): string[] {
  if (!raw) return []
  const out = new Set<string>()
  for (const parte of String(raw).split(ENTRE_NUMEROS)) {
    const t = canonTelefono(parte)
    if (t) out.add(t)
  }
  return [...out]
}

const EMAIL = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi

/** Todos los correos que aparecen en un campo libre, en minúscula. */
export function correosDe(raw: string | null | undefined): string[] {
  if (!raw) return []
  return [...new Set((String(raw).match(EMAIL) ?? []).map((e) => e.toLowerCase()))]
}

/**
 * Lo que tipea el usuario en el login, llevado a la misma forma canónica.
 * Devuelve la clave de búsqueda o null si no es ni correo ni teléfono.
 */
export function claveDeContacto(entrada: string): string | null {
  const s = entrada.trim()
  if (s.includes('@')) {
    const [c] = correosDe(s)
    return c ? `mail:${c}` : null
  }
  const t = canonTelefono(s)
  return t ? `tel:${t}` : null
}

/** Para mostrar o loguear sin exponer el dato completo. */
export function enmascarar(clave: string): string {
  const [tipo, v] = clave.split(':')
  if (tipo === 'tel') return `tel:…${v.slice(-3)}`
  const [u, dom] = v.split('@')
  return `mail:${u.slice(0, 2)}…@${dom}`
}
