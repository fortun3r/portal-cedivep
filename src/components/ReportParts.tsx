import { commonProfile, findings, findingsTitle, profile, type Matrix } from '@/lib/report'
import type { AnimalReport, Report } from '@/lib/types'

const marked = (text: string) => <span className="marcador">{`▲ ${text}`}</span>

/** Summary of out-of-range values, or the all-clear. */
export function FindingsSummary({ report }: { report: Report }) {
  const list = findings(report)
  if (!list.length) {
    return <div className="todo-ok"><span className="punto punto--ok" />Todos los valores dentro del rango de referencia</div>
  }
  const several = report.animals.length > 1
  return (
    <section className="resumen">
      <div className="resumen-cab">
        <h2>Resumen de hallazgos</h2>
        <p>{findingsTitle(report)}</p>
      </div>
      <ul>
        {list.map((f, i) => (
          <li key={i}>
            {several && <span className="resumen-animal">{f.animal}</span>}
            <span className="resumen-prueba">{f.name}</span>
            {marked(f.value)}
            {f.range && <span className="resumen-rango">{`ref. ${f.range}`}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Material and method notes, deduplicated, under the table. */
export function Notes({ animals }: { animals: AnimalReport[] }) {
  const notes = [...new Set(animals.flatMap((a) => a.analyses.flatMap((an) => [
    an.material && `Material: ${an.material}`, ...an.method.split('\n'),
  ])).filter(Boolean))]
  return notes.length ? <div className="notas">{notes.map((n) => <span key={n}>{n}</span>)}</div> : null
}

function Profile({ pairs }: { pairs: [string, string][] }) {
  return pairs.length ? <dl className="ficha">{pairs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null
}

/** One table per animal; each section is a header row. */
export function ResultsTable({ animal }: { animal: AnimalReport }) {
  const rows: React.ReactNode[] = []
  animal.analyses.forEach((an, ai) => {
    // A one-line analysis without its own title would read as part of the previous section.
    if (ai > 0 && !an.lines.some((l) => l.kind === 'section')) {
      rows.push(<tr key={`${ai}-t`}><th className="seccion" colSpan={3} scope="colgroup">{an.name}</th></tr>)
    }
    an.lines.forEach((l, li) => {
      const key = `${ai}-${li}`
      if (l.kind === 'section') {
        rows.push(<tr key={key}><th className="seccion" colSpan={3} scope="colgroup">{l.name}</th></tr>)
        return
      }
      const main = [l.value || '—', l.unit].filter(Boolean).join(' ')
      rows.push(
        <tr key={key}>
          <td className="prueba">{l.name}</td>
          <td className="valor">
            {l.outOfRange ? marked(main) : main}
            {l.relative && <span className="relativo">{l.relative}</span>}
          </td>
          <td className="rango">{l.range && <span className="rango-etiqueta">REF.</span>}{l.range}</td>
        </tr>,
      )
    })
  })
  return (
    <table className="resultados">
      <thead>
        <tr><th scope="col">Prueba</th><th scope="col">Resultado</th><th scope="col">Rango de referencia</th></tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  )
}

/** Animal by animal: single animals, small groups and mixed herds. */
export function PerAnimal({ report }: { report: Report }) {
  const several = report.animals.length > 1
  return (
    <>
      {report.animals.length > 3 && (
        <nav className="indice no-print" aria-label="Animales">
          <strong>{`${report.animals.length} animales:`}</strong>
          {report.animals.map((a) => (
            <a key={a.order} href={`#animal-${a.order}`} className={a.outOfRange ? 'con-alerta' : undefined}>{a.id}</a>
          ))}
        </nav>
      )}
      {report.animals.map((a) => (
        <section className="animal" id={`animal-${a.order}`} key={a.order}>
          {several && <h2 className="animal-titulo">{a.id}{a.outOfRange > 0 && marked(String(a.outOfRange))}</h2>}
          <Profile pairs={[['Identificación', a.id], ...profile(a)]} />
          <ResultsTable animal={a} />
          <Notes animals={[a]} />
        </section>
      ))}
    </>
  )
}

/** A herd as a matrix: one row per animal, one column per test. */
export function HerdMatrix({ report, matrix, path, onlyFindings }: {
  report: Report; matrix: Matrix; path: string; onlyFindings: boolean
}) {
  const withFindings = matrix.rows.filter((r) => r.outOfRange > 0)
  const filtered = onlyFindings && withFindings.length > 0
  const rows = filtered ? withFindings : matrix.rows
  // Consecutive columns of the same section share a group header; one-test analyses have none.
  const groups: { section: string; span: number }[] = []
  for (const c of matrix.columns) {
    const last = groups.at(-1)
    if (last && c.section && last.section === c.section) last.span++
    else groups.push({ section: c.section, span: 1 })
  }
  return (
    <section className="animal">
      <div className="matriz-cab">
        <Profile pairs={commonProfile(report)} />
        {withFindings.length > 0 && (
          <a className="interruptor" role="switch" aria-checked={filtered} href={filtered ? path : `${path}?hallazgos=1`}>
            {`Solo animales con hallazgos (${withFindings.length})`}
          </a>
        )}
      </div>
      <div className="matriz-scroll">
        <table className="matriz">
          <thead>
            {matrix.columns.some((c) => c.section) && (
              <tr>
                <th />
                {groups.map((g, i) => g.section
                  ? <th key={i} className="grupo-col" colSpan={g.span} scope="colgroup">{g.section}</th>
                  : <th key={i} />)}
              </tr>
            )}
            <tr>
              <th scope="col">Animal</th>
              {matrix.columns.map((c, i) => (
                <th key={i} scope="col">{c.name}{c.range && <span className="col-rango">{`ref. ${c.range}`}</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.order}>
                <th scope="row">{r.animal}</th>
                {r.cells.map((c, i) => <td key={i}>{c.outOfRange ? marked(c.value) : c.value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matriz-pie">
        <span>{filtered ? `${rows.length} de ${matrix.rows.length} animales · solo con hallazgos` : `${matrix.rows.length} animales`}</span>
        <span className="matriz-desliza">Deslizá la tabla para ver todas las pruebas →</span>
      </div>
      <Notes animals={report.animals} />
    </section>
  )
}
