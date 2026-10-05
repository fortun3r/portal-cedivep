import { redirect } from 'next/navigation'
import { AccessShell } from '@/components/AccessShell'
import { safeReturnPath } from '@/lib/auth'
import { first, readSession, type SearchParams } from '@/lib/session'

export const metadata = { title: 'Elegir clínica' }

export default async function ChooseClinicPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await readSession()
  if (!session) redirect('/')
  const volver = safeReturnPath(first((await searchParams).volver))
  return (
    <AccessShell>
      <div className="acceso-form">
        <h1 className="titulo">¿Con qué <strong>clínica</strong> querés entrar?</h1>
        <p className="ayuda">Tu contacto está registrado en más de una clínica. Podés cambiar después desde la barra.</p>
        <form className="lista-clinicas" method="POST" action="/api/choose-clinic">
          {volver && <input type="hidden" name="returnTo" value={volver} />}
          {session.allowedClinics.map((c, i) => (
            <button key={c.code} className="clinica-opcion" type="submit" name="clinic" value={c.code} autoFocus={i === 0}>
              <span className="clinica-opcion-texto">
                <span className="clinica-opcion-nombre">{c.name}</span>
                <span className="clinica-opcion-cod">{`Cód. ${c.code}`}</span>
              </span>
            </button>
          ))}
        </form>
      </div>
    </AccessShell>
  )
}
