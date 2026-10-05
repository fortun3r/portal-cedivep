'use client'
import { UNEXPECTED_ERROR } from '@/lib/messages'

export default function ErrorPage() {
  return (
    <main className="aviso">
      <h1 className="titulo">No pudimos mostrar <strong>esto</strong></h1>
      <p>{UNEXPECTED_ERROR}</p>
      <a className="boton boton--auto" href="/">Volver</a>
    </main>
  )
}
