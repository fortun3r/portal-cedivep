import { notFound } from 'next/navigation'
import { Brand } from '@/components/Brand'
import { PrintButton } from '@/components/PrintButton'
import { FindingsSummary, HerdMatrix, PerAnimal } from '@/components/ReportParts'
import { TopBar } from '@/components/TopBar'
import { safeReturnPath } from '@/lib/auth'
import { config } from '@/lib/config'
import { formatDate, todayPy } from '@/lib/orders'
import { getReport } from '@/lib/repo'
import { herdMatrix, whatsAppText } from '@/lib/report'
import { getDb } from '@/lib/server-state'
import { first, requireClinic, type SearchParams } from '@/lib/session'

type Params = Promise<{ date: string; number: string }>

/** The title comes from the URL alone: no DB query, no notFound() during streaming metadata. */
export async function generateMetadata({ params }: { params: Params }) {
  const { date, number } = await params
  const m = /^\d{2}(\d{2})-(\d{2})-(\d{2})$/.exec(date)
  return { title: m && /^\d{1,9}$/.test(number) ? `Referencia ${m[1]}${m[2]}${m[3]}/${number}` : 'Pedido' }
}

export default async function ReportPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { date, number } = await params
  const path = `/pedidos/${date}/${number}`
  const { session, clinic } = await requireClinic(safeReturnPath(path))
  const onlyFindings = first((await searchParams).hallazgos) === '1'

  // getReport filters by the session's clinic: someone else's order and a missing one are the same 404.
  const report = await getReport(await getDb(), clinic.code, date, /^[1-9]\d{0,8}$/.test(number) ? Number(number) : NaN)
  if (!report) notFound()

  const lab = config.lab
  const hasResults = report.animals.length > 0
  const matrix = herdMatrix(report)
  const share = `https://wa.me/?text=${encodeURIComponent(whatsAppText(report, `${config.publicUrl}${path}`))}`
  return (
    <>
      <TopBar session={session} clinic={clinic} />
      <main>
        <div className="informe-acciones">
          <a href="/pedidos">← Tus pedidos</a>
          {hasResults && (
            <div className="informe-acciones-botones">
              <a className="boton-borde" href={share}>Compartir por WhatsApp</a>
              <PrintButton />
            </div>
          )}
        </div>
        <article className="informe">
          <header className="informe-cab">
            <div>
              <Brand />
              <div className="informe-sub">{lab.subtitle}</div>
            </div>
            <div className="sello">
              <div className="sello-etiqueta">Referencia</div>
              <div className="sello-ref">{report.label}</div>
              <div className="sello-habilitacion">{`Habilitación N° ${lab.accreditation}`}</div>
            </div>
          </header>
          <dl className="datos">
            <div><dt>Clínica</dt><dd>{clinic.name}</dd></div>
            <div><dt>Recepción</dt><dd>{formatDate(report.receivedOn)}</dd></div>
            {report.animals.length > 1 && <div><dt>Animales</dt><dd>{report.animals.length}</dd></div>}
            <div><dt>Consultado</dt><dd>{formatDate(todayPy())}</dd></div>
          </dl>
          {hasResults ? (
            <>
              <FindingsSummary report={report} />
              {matrix
                ? <HerdMatrix report={report} matrix={matrix} path={path} onlyFindings={onlyFindings} />
                : <PerAnimal report={report} />}
              {report.outOfRange > 0 && (
                <p className="leyenda"><span className="marcador">▲ valor</span>{' fuera del rango de referencia.'}</p>
              )}
            </>
          ) : (
            <div className="vacio"><strong>Este pedido todavía no tiene resultados cargados.</strong></div>
          )}
          <footer className="pie-informe">
            <span>{`Consulta en línea de un resultado emitido por ${lab.name} No reemplaza al informe firmado.`}</span>
            <span>{`${lab.phone} · ${lab.email}`}</span>
          </footer>
        </article>
      </main>
    </>
  )
}
