import { TopBar } from '@/components/TopBar'
import { ORDER_NOT_FOUND } from '@/lib/messages'
import { currentClinic, readSession } from '@/lib/session'

/**
 * Same page whether the order doesn't exist or belongs to another clinic.
 * ponytail: Next 16 renders this client-side after notFound() in a page (empty
 * HTML shell, status 404 kept), so without JS the 404 is blank. Fixing that
 * would mean an authorization lookup in the proxy; not worth it for a 404.
 */
export default async function OrderNotFound() {
  const session = await readSession()
  const clinic = session && currentClinic(session)
  return (
    <>
      {session && clinic && <TopBar session={session} clinic={clinic} />}
      <main className="aviso">
        <h1 className="titulo">No encontramos ese <strong>pedido</strong></h1>
        <p>{`${ORDER_NOT_FOUND} Si el enlace te lo pasó otra clínica, cada una ve solo sus propios pedidos.`}</p>
        <a className="boton boton--auto" href="/pedidos">Ver tus pedidos</a>
      </main>
    </>
  )
}
