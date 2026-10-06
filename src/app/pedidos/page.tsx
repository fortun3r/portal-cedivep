import { OrderItem } from '@/components/OrderItem'
import { TopBar } from '@/components/TopBar'
import { config } from '@/lib/config'
import {
  countNew, filterOrders, formatDate, groupByDate, isNew, pageOf, recordVisit, STATUS_PARAM, statusParam, todayPy,
  windowText, type StatusParam,
} from '@/lib/orders'
import { getResultsWindow, listOrders, MAX_LISTED } from '@/lib/repo'
import { getDb } from '@/lib/server-state'
import { first, readVisits, requireClinic, withQuery, type SearchParams } from '@/lib/session'

export const metadata = { title: 'Mis pedidos' }

const FILTERS: { param: StatusParam | null; label: string }[] = [
  { param: null, label: 'Todos' },
  { param: 'disponible', label: 'Disponibles' },
  { param: 'en_proceso', label: 'En proceso' },
  { param: 'fuera_de_ventana', label: 'No en línea' },
]

const EMPTY_FILTER: Record<StatusParam, string> = {
  disponible: 'con resultados disponibles',
  en_proceso: 'en proceso',
  fuera_de_ventana: 'fuera de la ventana en línea',
}

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { session, clinic } = await requireClinic()
  const sp = await searchParams
  const q = (first(sp.q) ?? '').trim().slice(0, 80)
  const estado = statusParam(first(sp.estado))

  const db = await getDb()
  const all = await listOrders(db, clinic.code)
  const window = await getResultsWindow(db)
  const { orders, counts } = filterOrders(all, q, estado && STATUS_PARAM[estado])
  const shown = pageOf(orders, first(sp.pagina))
  // Exactly MAX_LISTED orders also shows the notes; still true.
  const capped = all.length >= MAX_LISTED
  // The proxy stores today's visit; recordVisit is idempotent, so this reads the same day either way.
  const previous = recordVisit(await readVisits(), clinic.code, todayPy()).previous
  const newCount = countNew(all, previous)
  const href = (param: StatusParam | null) => withQuery('/pedidos', { estado: param, q })
  const pageHref = (n: number) => withQuery('/pedidos', { estado, q, pagina: n > 1 ? String(n) : null })

  return (
    <>
      <TopBar session={session} clinic={clinic} />
      <main className="contenedor">
        <div className="pagina-cab">
          <h1 className="titulo">Tus <strong>pedidos</strong></h1>
          <div className="pagina-meta">
            {window.start && window.end && <span>{windowText(window.start, window.end)}</span>}
            {newCount > 0 && (
              <a className="pagina-nuevos" href="/pedidos?estado=disponible">
                <span className="punto punto--marca" />
                {`${newCount} ${newCount === 1 ? 'pedido nuevo' : 'pedidos nuevos'} desde tu última visita`}
              </a>
            )}
          </div>
        </div>

        {all.length > 0 && (
          <>
            <form method="GET" action="/pedidos" className="buscar" role="search">
              <label htmlFor="q" className="oculto">Buscar</label>
              <input id="q" name="q" type="search" defaultValue={q} className="campo"
                placeholder="Buscar animal, caravana o análisis" />
              {estado && <input type="hidden" name="estado" value={estado} />}
              {q && <a className="buscar-limpiar" href="/pedidos" aria-label="Borrar búsqueda">×</a>}
            </form>
            <nav className="filtros" aria-label="Filtrar por estado">
              {FILTERS.map(({ param, label }) => (
                <a key={label} className="filtro" href={href(param)} aria-current={param === estado ? 'true' : undefined}>
                  {`${label} `}
                  <span className="filtro-n">{param ? counts[STATUS_PARAM[param]] : counts.all}</span>
                </a>
              ))}
            </nav>
          </>
        )}

        {orders.length > 0 ? (
          <div className="grupos">
            {groupByDate(shown.items).map((g) => (
              <section className="grupo" key={g.date}>
                <h2 className="grupo-titulo">{g.title}<span className="grupo-fecha">{formatDate(g.date)}</span></h2>
                <ul className="pedidos">
                  {g.orders.map((o) => (
                    <li key={`${o.receivedOn}/${o.number}`}><OrderItem order={o} isNew={isNew(o, previous)} /></li>
                  ))}
                </ul>
              </section>
            ))}
            {shown.pages > 1 && (
              <nav className="paginas no-print" aria-label="Páginas">
                {shown.page > 1 && (
                  <a className="boton-borde" rel="prev" href={pageHref(shown.page - 1)}>
                    <span aria-hidden="true">←</span>Más recientes
                  </a>
                )}
                <span>{`${shown.from}–${shown.from + shown.items.length - 1} de ${orders.length}`}</span>
                {shown.page < shown.pages && (
                  <a className="boton-borde" rel="next" href={pageHref(shown.page + 1)}>
                    Más antiguos<span aria-hidden="true">→</span>
                  </a>
                )}
              </nav>
            )}
            {capped && !q && !estado && shown.page === shown.pages && (
              <p className="secundario">
                {`Se muestran los ${MAX_LISTED} pedidos más recientes. Si buscás uno anterior, llamá al ${config.lab.phone}.`}
              </p>
            )}
          </div>
        ) : all.length === 0 ? (
          <div className="vacio">
            <strong>Todavía no hay pedidos de tu clínica en el portal</strong>
            <p>
              Los resultados aparecen acá apenas el laboratorio los carga. ¿Esperabas ver alguno? Llamá
              al <strong>{config.lab.phone}</strong>.
            </p>
          </div>
        ) : q ? (
          <div className="vacio">
            <strong>{`Ningún pedido coincide con “${q}”`}</strong>
            <p>La búsqueda mira el nombre o la caravana del animal, el análisis y la referencia del pedido.</p>
            {capped && <p>{`Solo se buscan los ${MAX_LISTED} pedidos más recientes.`}</p>}
            <a className="boton-borde" href="/pedidos">Ver todos los pedidos</a>
          </div>
        ) : (
          <div className="vacio">
            <strong>{`No hay pedidos ${estado ? EMPTY_FILTER[estado] : ''}`}</strong>
            <a className="boton-borde" href="/pedidos">Ver todos los pedidos</a>
          </div>
        )}
      </main>
    </>
  )
}
