import type { Session } from '@/lib/auth'
import type { Clinic } from '@/lib/types'
import { Brand } from './Brand'

/** Black bar on every authenticated page. On phones the clinic moves to the white sub-bar. */
export function TopBar({ session, clinic }: { session: Session; clinic: Clinic }) {
  const several = session.allowedClinics.length > 1
  const code = `Cód. ${clinic.code}`
  return (
    <>
      <header className="barra">
        <div className="barra-fila">
          <Brand href="/pedidos" />
          <span className="barra-acciones">
            <span className="barra-clinica">
              <span className="barra-clinica-nombre">{clinic.name}</span>
              <span className="barra-clinica-cod">{code}</span>
            </span>
            {several && <a className="barra-cambiar" href="/elegir">Cambiar</a>}
            <form method="POST" action="/api/logout">
              <button className="barra-salir" type="submit">Salir</button>
            </form>
          </span>
        </div>
      </header>
      <div className="subbarra">
        <span className="subbarra-clinica">
          <span className="barra-clinica-nombre">{clinic.name}</span>
          <span className="barra-clinica-cod">{code}</span>
        </span>
        {several && <a href="/elegir">Cambiar</a>}
      </div>
    </>
  )
}
