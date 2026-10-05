import { formatDate } from '@/lib/orders'
import type { OrderSummary } from '@/lib/types'

/** One row of the order list: a link when results are available, plain otherwise. */
export function OrderItem({ order: o, isNew }: { order: OrderSummary; isNew: boolean }) {
  if (o.status === 'in_progress') {
    return (
      <div className="pedido pedido--inactivo">
        <div className="pedido-cab">
          <span className="ref">{o.label}</span>
          {o.urgent && <span className="etiqueta-urgente">URGENTE</span>}
          <span className="estado estado--proceso"><span className="punto punto--proceso" />En proceso</span>
        </div>
        {o.deliveryDate && <div className="pedido-entrega">{`Entrega prevista: ${formatDate(o.deliveryDate)}`}</div>}
      </div>
    )
  }
  if (o.status === 'outside_window') {
    return (
      <div className="pedido pedido--inactivo">
        <div className="pedido-cab">
          <span className="ref">{o.label}</span>
          <span className="estado"><span className="punto" />No disponible en línea</span>
        </div>
        <div className="pedido-nota">Es anterior a los resultados en línea. Pedí el informe al laboratorio.</div>
      </div>
    )
  }
  return (
    <a className="pedido" href={`/pedidos/${o.receivedOn}/${o.number}`}>
      <div className="pedido-cuerpo">
        <div className="pedido-cab">
          <span className="ref">{o.label}</span>
          {isNew && <span className="etiqueta-nuevo">NUEVO</span>}
          <span className="estado estado--ok"><span className="punto punto--ok" />Resultados disponibles</span>
        </div>
        {o.animals.length > 0 && (
          <div className="pedido-animales">
            {o.animals.slice(0, 3).join(', ')}
            {o.animals.length > 3 && <span className="pedido-mas">{`y ${o.animals.length - 3} más`}</span>}
          </div>
        )}
        {o.analyses.length > 0 && <div className="pedido-analisis">{o.analyses.join(' · ')}</div>}
        {o.outOfRange > 0 && (
          <span className="marcador">{`▲ ${o.outOfRange} ${o.outOfRange === 1 ? 'valor' : 'valores'} fuera de rango`}</span>
        )}
      </div>
    </a>
  )
}
