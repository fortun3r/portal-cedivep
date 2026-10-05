/**
 * User-facing error messages, copied verbatim from the reference server.ts.
 * Login errors read the same whether or not the contact is registered.
 */
const BY_CODE = {
  formato: 'No reconocemos ese formato. Escribí un celular (0981 123 456) o un correo.',
  limite: 'Pediste demasiados códigos. Esperá unos minutos y probá de nuevo.',
  incorrecto: 'El código no es correcto. Revisalo y probá de nuevo.',
  vencido: 'El código venció o ya no es válido. Pedí uno nuevo.',
} as const

/** `?error=` values; Spanish because they show in the address bar. */
export type ErrorCode = keyof typeof BY_CODE

/** The message for an `?error=` value, or undefined (own keys only: no `__proto__`). */
export function errorMessage(code: unknown): string | undefined {
  return typeof code === 'string' && Object.hasOwn(BY_CODE, code) ? BY_CODE[code as ErrorCode] : undefined
}

export const CLINIC_NOT_YOURS = 'Esa clínica no está asociada a tu contacto.'
export const ORDER_NOT_FOUND = 'No encontramos ese pedido entre los de tu clínica.'
export const PAGE_NOT_FOUND = 'Esa página no existe.'
export const UNEXPECTED_ERROR = 'Ocurrió un error inesperado. Intentá de nuevo.'
