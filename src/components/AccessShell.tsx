import { config } from '@/lib/config'
import { Brand } from './Brand'

/** Split screen of the login pages: black brand panel + the form. */
export function AccessShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="acceso">
      <aside className="acceso-panel">
        <div>
          <Brand />
          <div className="marca-raya" />
        </div>
        <div>
          <div className="sobretitulo">Portal para clínicas</div>
          <h2>Resultados de <strong>análisis</strong></h2>
          <p className="acceso-lema">
            Centro de Diagnóstico Veterinario del Paraguay. Primer laboratorio privado de diagnóstico
            veterinario del país, desde 1989.
          </p>
        </div>
        <div className="acceso-habilitacion">{`Habilitación N° ${config.lab.accreditation}`}</div>
      </aside>
      <div className="acceso-cuerpo">{children}</div>
    </main>
  )
}
