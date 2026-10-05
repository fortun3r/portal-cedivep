'use client'

export function PrintButton() {
  return <button type="button" className="boton-chico" onClick={() => window.print()}>Imprimir / PDF</button>
}
