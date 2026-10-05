/**
 * Las páginas, en HTML del lado del servidor. Sin framework de frontend: el
 * portal tiene que abrir rápido en el celular del veterinario, que lo va a
 * abrir desde WhatsApp. Todo pensado también para teclado (ADR-0007).
 *
 * La vista del informe es además la futura plantilla PDF (ADR-0005): las
 * reglas @media print de styles.css la dejan lista para imprimir.
 */
import { config } from './config.js'
import type { Clinica, Informe, InformeAnimal, ResumenPedido } from './types.js'

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function fmtFecha(iso: string | null | undefined) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function page(titulo: string, cuerpo: string) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titulo)} · ${esc(config.lab.nombre)}</title>
<link rel="stylesheet" href="/styles.css">
<script src="/app.js" defer></script>
</head>
<body>
${cuerpo}
</body>
</html>`
}

function marca() {
  return `<div class="marca">
    <div class="marca-nombre">${esc(config.lab.nombre)}</div>
    <div class="marca-sub">${esc(config.lab.subtitulo)}</div>
  </div>`
}

function barra(clinica: Clinica, extra = '', variasClinicas = false) {
  return `<header class="barra no-print">
  <a class="barra-marca" href="/pedidos">${esc(config.lab.nombre)}</a>
  <span class="barra-acciones">
    ${extra}
    <span class="barra-clinica" title="Clínica">${esc(clinica.nombre)}</span>
    ${variasClinicas ? `<a href="/elegir">Cambiar</a>` : ''}
    <form method="POST" action="/salir" class="en-linea"><button type="submit" class="link">Salir</button></form>
  </span>
</header>`
}

// ───────────────────────────────────────────── ingreso

export function paginaIngreso(error?: string, valor = '') {
  return page('Ingresar', `
<main class="acceso">
  ${marca()}
  <form method="POST" action="/ingresar" class="tarjeta" autocomplete="on">
    <h1>Resultados para clínicas</h1>
    <p class="ayuda">Escribí el celular o el correo que tiene registrado tu clínica en el laboratorio.
      Te vamos a mandar un código para entrar.</p>

    <label for="contacto">Celular o correo</label>
    <input id="contacto" name="contacto" type="text" class="campo" required autofocus
           value="${esc(valor)}" inputmode="email" autocomplete="username"
           spellcheck="false" autocapitalize="off" placeholder="0981 123 456">

    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}

    <button type="submit">Recibir código <span class="kbd">Enter</span></button>
  </form>
  <p class="pie">¿Tu clínica no tiene un celular o correo registrado? Comunicate con el laboratorio.</p>
</main>`)
}

export function paginaCodigo(opts: { destino: string; error?: string; codigoDemo?: string }) {
  return page('Código de ingreso', `
<main class="acceso">
  ${marca()}
  <form method="POST" action="/verificar" class="tarjeta" autocomplete="off">
    <h1>Ingresá el código</h1>
    <p class="ayuda">Si <strong>${esc(opts.destino)}</strong> está registrado en el laboratorio,
      te enviamos un código de 6 dígitos. Vence en ${config.auth.codigoMinutos} minutos.</p>

    ${opts.codigoDemo ? `<p class="demo" role="note">Modo demostración — no se envían mensajes.
      Tu código es <strong class="mono">${esc(opts.codigoDemo)}</strong></p>` : ''}

    <label for="codigo">Código</label>
    <input id="codigo" name="codigo" type="text" class="campo codigo" required autofocus
           inputmode="numeric" pattern="[0-9 ]{6,7}" maxlength="7" autocomplete="one-time-code"
           placeholder="000000">

    ${opts.error ? `<p class="error" role="alert">${esc(opts.error)}</p>` : ''}

    <button type="submit">Entrar <span class="kbd">Enter</span></button>
    <p class="secundario"><a href="/">Usar otro celular o correo</a></p>
  </form>
</main>`)
}

export function paginaElegir(clinicas: Clinica[]) {
  return page('Elegir clínica', `
<main class="acceso">
  ${marca()}
  <div class="tarjeta">
    <h1>¿Con qué clínica querés entrar?</h1>
    <p class="ayuda">Tu contacto está registrado en más de una clínica.</p>
    <form method="POST" action="/elegir" class="lista-clinicas">
      ${clinicas.map((c, i) => `
      <button type="submit" name="clinica" value="${c.codigo}" ${i === 0 ? 'autofocus' : ''}>
        ${esc(c.nombre)}
      </button>`).join('')}
    </form>
  </div>
</main>`)
}

// ───────────────────────────────────────────── listado de pedidos

const ESTADO: Record<ResumenPedido['estado'], [string, string]> = {
  disponible: ['Resultados disponibles', 'ok'],
  en_proceso: ['En proceso', 'proceso'],
  fuera_de_ventana: ['No disponible en línea', 'gris'],
}

export function paginaPedidos(opts: {
  clinica: Clinica
  variasClinicas: boolean
  pedidos: ResumenPedido[]
  total: number
  q: string
  ventana: { desde: string | null; hasta: string | null }
}) {
  const { pedidos, q } = opts
  const filas = pedidos.map((p) => {
    const [txt, cls] = ESTADO[p.estado]
    const href = `/pedidos/${p.fecPed}/${p.nroMov}`
    const link = p.estado === 'disponible'
    const anim = p.animales.length > 3
      ? `${esc(p.animales.slice(0, 3).join(', '))} <span class="mas">y ${p.animales.length - 3} más</span>`
      : esc(p.animales.join(', '))
    return `<li class="pedido${link ? ' con-link' : ''}">
      ${link ? `<a href="${href}" class="pedido-link">` : '<div class="pedido-link">'}
        <div class="pedido-cab">
          <span class="ref mono">${esc(p.referencia)}</span>
          <span class="fecha">${esc(fmtFecha(p.fecPed))}</span>
          ${p.urgente ? '<span class="chip urgente">Urgente</span>' : ''}
          <span class="chip ${cls}">${txt}</span>
        </div>
        ${p.animales.length ? `<div class="pedido-animales">${anim}</div>` : ''}
        ${p.analisis.length ? `<div class="pedido-analisis">${esc(p.analisis.join(' · '))}</div>` : ''}
        ${p.estado === 'en_proceso' && p.fechaEntrega
          ? `<div class="pedido-nota">Entrega prevista: ${esc(fmtFecha(p.fechaEntrega))}</div>` : ''}
        ${p.fueraDeRango
          ? `<div class="pedido-nota alerta">▲ ${p.fueraDeRango} ${p.fueraDeRango === 1 ? 'valor' : 'valores'} fuera de rango</div>` : ''}
      ${link ? '</a>' : '</div>'}
    </li>`
  }).join('\n')

  const vacio = q
    ? `<p class="vacio">Ningún pedido coincide con “${esc(q)}”. <a href="/pedidos">Ver todos</a></p>`
    : `<p class="vacio">Todavía no hay pedidos de tu clínica en el portal.</p>`

  const { desde, hasta } = opts.ventana
  return page('Mis pedidos', `
${barra(opts.clinica, '', opts.variasClinicas)}
<main class="contenedor">
  <div class="titulo-pagina">
    <h1>Pedidos</h1>
    <form method="GET" action="/pedidos" class="buscar" role="search">
      <label for="q" class="oculto">Buscar</label>
      <input id="q" name="q" type="search" value="${esc(q)}" class="campo"
             placeholder="Buscar animal, caravana, análisis o referencia" autofocus>
      <button type="submit">Buscar</button>
    </form>
  </div>
  <p class="contexto">
    ${q ? `${pedidos.length} de ${opts.total} pedidos` : `${opts.total} ${opts.total === 1 ? 'pedido' : 'pedidos'}`}
    ${desde && hasta ? ` · resultados en línea del ${esc(fmtFecha(desde))} al ${esc(fmtFecha(hasta))}` : ''}
  </p>
  ${pedidos.length ? `<ul class="pedidos">${filas}</ul>` : vacio}
</main>`)
}

// ───────────────────────────────────────────── el informe

function bloqueAnimal(a: InformeAnimal, varios: boolean) {
  const datos = [
    ['Identificación', a.identificacion], ['Especie', a.especie], ['Raza', a.raza],
    ['Sexo', a.sexo], ['Edad', a.edad], ['Pelaje', a.pelaje],
  ].filter(([, v]) => v)

  const tablas = a.analisis.map((an) => {
    const filas = an.lineas.map((l) => {
      if (l.tipo === 'seccion') return `<tr class="seccion"><td colspan="3">${esc(l.prueba)}</td></tr>`
      const principal = [l.valor || '—', l.unidad].filter(Boolean).map(esc).join(' ')
      const valor = l.relativo ? `${principal}<span class="relativo">${esc(l.relativo)}</span>` : principal
      return `<tr${l.fuera ? ' class="fuera"' : ''}>
        <td class="prueba">${esc(l.prueba)}</td>
        <td class="valor">${valor}${l.fuera ? '<span class="aviso" title="Fuera del rango de referencia">▲</span>' : ''}</td>
        <td class="rango">${esc(l.rango)}</td>
      </tr>`
    }).join('\n')
    const pie = [an.material && `Material: ${an.material}`, an.metodo].filter(Boolean)
    return `<table class="resultados">
      <thead><tr><th>Prueba</th><th>Resultado</th><th>Rango de referencia</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    ${pie.length ? `<p class="metodo">${pie.map(esc).join('<br>')}</p>` : ''}`
  }).join('\n')

  return `<section class="animal" id="animal-${a.orden}">
    ${varios ? `<h2 class="animal-titulo">${esc(a.identificacion)}${a.fueraDeRango
      ? ` <span class="chip alerta">▲ ${a.fueraDeRango}</span>` : ''}</h2>` : ''}
    <dl class="ficha">${datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${tablas}
  </section>`
}

export function paginaInforme(opts: { clinica: Clinica; variasClinicas: boolean; informe: Informe }) {
  const inf = opts.informe
  const varios = inf.animales.length > 1
  const indice = inf.animales.length > 3 ? `<nav class="indice no-print" aria-label="Animales">
      <strong>${inf.animales.length} animales:</strong>
      ${inf.animales.map((a) => `<a href="#animal-${a.orden}"${a.fueraDeRango ? ' class="con-alerta"' : ''}>${esc(a.identificacion)}</a>`).join('')}
    </nav>` : ''

  const imprimir = `<button type="button" data-imprimir class="chico">Imprimir / PDF</button>`

  return page(`Referencia ${inf.referencia}`, `
${barra(opts.clinica, imprimir, opts.variasClinicas)}
<p class="volver no-print"><a href="/pedidos">← Todos los pedidos</a></p>
<main class="informe">
  <header class="encabezado">
    <div class="logo">
      <div class="logo-nombre">${esc(config.lab.nombre)}</div>
      <div class="logo-sub">${esc(config.lab.subtitulo)}</div>
    </div>
    <div class="sello">
      <div class="ref-etiqueta">REFERENCIA</div>
      <div class="ref-valor">${esc(inf.referencia)}</div>
      <div class="habilitacion">Habilitación N°: ${esc(config.lab.habilitacion)}</div>
    </div>
  </header>

  <section class="datos">
    <dl>
      <dt>Clínica</dt><dd>${esc(opts.clinica.nombre)}</dd>
      <dt>Fecha de recepción</dt><dd>${esc(fmtFecha(inf.fecPed))}</dd>
    </dl>
    <dl>
      ${varios ? `<dt>Animales</dt><dd>${inf.animales.length}</dd>` : ''}
      <dt>Consultado</dt><dd>${esc(fmtFecha(new Date().toISOString().slice(0, 10)))}</dd>
    </dl>
  </section>

  ${indice}
  ${inf.animales.length ? inf.animales.map((a) => bloqueAnimal(a, varios)).join('\n')
    : '<p class="vacio">Este pedido todavía no tiene resultados cargados.</p>'}

  ${inf.fueraDeRango ? `<p class="leyenda">▲ Los valores en <strong>negrita</strong> se encuentran fuera del rango de referencia.</p>` : ''}

  <footer class="pie-informe">
    <p>Consulta en línea de un resultado emitido por ${esc(config.lab.nombre)}
       No reemplaza al informe firmado.</p>
  </footer>
</main>`)
}

// ───────────────────────────────────────────── errores

export function paginaError(mensaje: string, volver = '/') {
  return page('Aviso', `
<main class="acceso">
  ${marca()}
  <div class="tarjeta">
    <h1>No pudimos mostrar esto</h1>
    <p class="ayuda">${esc(mensaje)}</p>
    <a class="boton" href="${esc(volver)}">Volver</a>
  </div>
</main>`)
}
