import { PAGE_NOT_FOUND } from '@/lib/messages'

export const metadata = { title: 'Aviso' }

export default function NotFound() {
  return (
    <main className="aviso">
      <h1 className="titulo">No pudimos mostrar <strong>esto</strong></h1>
      <p>{PAGE_NOT_FOUND}</p>
      <a className="boton boton--auto" href="/">Volver</a>
    </main>
  )
}
