import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AccessShell } from '@/components/AccessShell'
import { COOKIE, safeReturnPath } from '@/lib/auth'
import { config } from '@/lib/config'
import { errorMessage } from '@/lib/messages'
import { currentClinic, first, readSession, volverQuery, type SearchParams } from '@/lib/session'

export const metadata = { title: 'Ingresar' }

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const volver = safeReturnPath(first(sp.volver))
  const session = await readSession()
  if (session && currentClinic(session)) redirect(volver ?? '/pedidos')
  if (session && !session.currentClinic && volver) redirect(`/elegir${volverQuery(volver)}`)

  const error = errorMessage(first(sp.error))
  // What the user typed, kept in a short-lived cookie so it never goes in the URL.
  const typed = error ? (await cookies()).get(COOKIE.flash)?.value ?? '' : ''
  const lab = config.lab
  return (
    <AccessShell>
      <form className="acceso-form" method="POST" action="/api/login" autoComplete="on">
        <h1 className="titulo">Ingresá con tu <strong>clínica</strong></h1>
        <p className="ayuda">
          Escribí el celular o el correo que tu clínica tiene registrado en el laboratorio. Te mandamos un
          código de 6 dígitos para entrar, sin contraseña.
        </p>
        <label className="etiqueta" htmlFor="contact">Celular o correo</label>
        <input
          id="contact" name="contact" type="text" className="campo" required autoFocus defaultValue={typed}
          inputMode="email" autoComplete="username" spellCheck={false} autoCapitalize="off" placeholder="0981 123 456"
        />
        {volver && <input type="hidden" name="returnTo" value={volver} />}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="boton" type="submit">Recibir código</button>
        <div className="acceso-contacto">
          ¿Tu clínica no tiene un celular o correo registrado? Llamá al <strong>{lab.phone}</strong> o escribí
          a <a href={`mailto:${lab.email}`}>{lab.email}</a>.
          <div className="acceso-horario">{lab.hours}</div>
        </div>
      </form>
    </AccessShell>
  )
}
