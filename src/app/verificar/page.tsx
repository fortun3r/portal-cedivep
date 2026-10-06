import { redirect } from 'next/navigation'
import { AccessShell } from '@/components/AccessShell'
import { CodeInput } from '@/components/CodeInput'
import { config } from '@/lib/config'
import { visibleDestination } from '@/lib/contact'
import { errorMessage } from '@/lib/messages'
import { first, readStep, volverQuery, type SearchParams } from '@/lib/session'

export const metadata = { title: 'Código de ingreso' }

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const step = await readStep()
  if (!step) redirect('/')
  const error = errorMessage(first((await searchParams).error))
  return (
    <AccessShell>
      <div className="acceso-form">
        <a className="acceso-volver" href={`/${volverQuery(step.returnTo)}`}>← Usar otro celular o correo</a>
        <h1 className="titulo">Ingresá el <strong>código</strong></h1>
        <p className="ayuda">
          Si <strong>{visibleDestination(step.key)}</strong> está registrado en el laboratorio, te mandamos un
          código de 6 dígitos. {`Vence en ${config.auth.codeMinutes} minutos.`}
        </p>
        {step.demo && (
          <div className="demo" role="note">
            <span>Modo demostración — no se envían mensajes.</span>
            <strong>{`${step.demo.slice(0, 3)} ${step.demo.slice(3)}`}</strong>
          </div>
        )}
        <form className="acceso-form" method="POST" action="/api/verify" autoComplete="off">
          <label className="etiqueta" htmlFor="code">Código</label>
          <CodeInput />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="boton" type="submit">Entrar</button>
        </form>
        <form className="secundario" method="POST" action="/api/login">
          <input type="hidden" name="resend" value="1" />
          {'¿No te llegó? '}<button type="submit">Reenviar código</button>
        </form>
      </div>
    </AccessShell>
  )
}
