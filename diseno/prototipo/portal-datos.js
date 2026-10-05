// Datos de demo y flujo del prototipo. Misma forma y reglas que _referencia/src (fixture + informe + server).
export const LAB = {
  nombre: 'CEDIVEP S.R.L.', subtitulo: 'Centro de Diagnóstico Veterinario del Paraguay',
  habilitacion: '114-SENACSA', telefono: '(021) 584 085', correo: 'info.cedivep@cedivep.com.py',
  horario: 'Lunes a viernes 7:00–18:00 · Sábado 7:00–12:00',
}
export const CODIGO_DEMO = '185186'
const HOY = '2026-10-05'
const VENTANA = { desde: '2026-07-22', hasta: '2026-07-24' }
const ULTIMA_VISITA = '2026-07-23'
const DOMINIO = 'resultados.cedivep.com.py'

const CLINICAS = { 2646: 'CLÍNICA TACUARY', 424: 'VETERINARIA SAN ROQUE', 77: 'AGROVET PARAGUARÍ' }
const CONTACTOS = {
  '981000001': [2646], 'tacuary@ejemplo.com.py': [2646],
  '981000002': [424, 77], '971000003': [424], 'sanroque@ejemplo.com.py': [424], 'admin@ejemplo.com.py': [424],
}

export function claveDeContacto(v) {
  const t = String(v || '').trim().toLowerCase()
  if (/^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/.test(t)) return t
  let d = t.replace(/\D/g, '')
  if (d.startsWith('595')) d = d.slice(3)
  d = d.replace(/^0+/, '')
  return /^9\d{8}$/.test(d) ? d : null
}
const destinoVisible = (c) => {
  if (!c) return ''
  if (c.includes('@')) { const [u, dom] = c.split('@'); return `el correo ${u[0]}•••@${dom}` }
  return `el celular terminado en ${c.slice(-3)}`
}

const fmt = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const fmtLarga = (iso) => { const t = new Date(iso + 'T12:00:00'); return `${DIAS[t.getDay()]} ${t.getDate()} de ${MESES[t.getMonth()]}` }
const plano = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const refDe = (f, n) => `${f.slice(2, 4)}${f.slice(5, 7)}${f.slice(8, 10)}/${String(n).padStart(3, ' ')}`

// ───────────────────────── informes
const S = (prueba) => ({ tipo: 's', prueba })
const M = (prueba, valor, rango, fuera = false, relativo = '') => ({ tipo: 'm', prueba, valor, rango, fuera, relativo })
const hemograma = (rdw, rdwFuera) => [
  S('BIOMETRIA HEMATICA'),
  M('Hemoglobina', '11,6 g/dL', '10,0 - 18,0 g/dL'),
  M('Hematócrito', '32 %', '31 - 45 %'),
  M('Glóbulos Rojos', '7.826.000 mm3', '(6 - 10) x 10^6 / mm3'),
  M('V.C.M.', '41 fl', '39 - 50 fl'),
  M('H.C.M.', '14,8 pg', '14,0 - 19,0 pg'),
  M('C.H.C.M.', '36,3 g/dL', '31,0 - 37,0 g/dL'),
  M('R.D.W.', `${rdw} %`, '17,0 - 20,0 %', rdwFuera),
  S('LEUCOGRAMA'),
  M('Glóbulos Blancos', '7.500 mm3', '(5.5 - 14) x 10^3 / mm3'),
  M('Neutrofilos en banda', '00 %', '0 - 2 %'),
  M('Neutrofilos segmentados', '62 %', '58 - 78 %', false, '4.650 /mm3'),
]
const NOTAS_HS = ['Material: SANGRE', 'Método utilizado: SGC-PROTEC-HS-01']

const animal = (id, ficha, analisis, filas, notas) => ({
  tipo: 'animal', animales: [id], analisis, filas, notas,
  ficha: [['Identificación', id], ...ficha],
})
const SHAKIRA = animal('SHAKIRA', [['Especie', 'EQUINA'], ['Raza', 'MESTIZA'], ['Sexo', 'Hembra'], ['Edad', '4.00 Años'], ['Pelaje', 'ZAINA']],
  ['BIOMETRIA HEMATICA'], hemograma('22,5', true), NOTAS_HS)
const ROCKY = animal('ROCKY', [['Especie', 'CANINA'], ['Raza', 'LABRADOR'], ['Sexo', 'Macho'], ['Edad', '6.00 Años']],
  ['SEROLOGIA'], [S('SEROLOGIA'), M('Neospora caninum', 'NEGATIVO', 'Negativo'), M('Toxoplasma gondii', 'POSITIVO', 'Negativo', true)],
  ['Material: SUERO', 'METODO LABORATORIAL: ELISA'])
const LOLA = animal('LOLA', [['Raza', 'C.M'], ['Sexo', 'Hembra'], ['Edad', '3.00 Años']],
  ['BIOMETRIA HEMATICA'], hemograma('13,1', false), NOTAS_HS)

// Rodeo de 50 vacas: una fila por animal, una columna por prueba (matrizRodeo).
const COLUMNAS = [
  { grupo: 'Leptospirosis', prueba: 'Grippotyphosa', rango: 'Negativo', ancho: 88 },
  { grupo: 'Leptospirosis', prueba: 'Hardjo', rango: 'Negativo', ancho: 88 },
  { grupo: 'Leptospirosis', prueba: 'Pomona', rango: 'Negativo', ancho: 88 },
  { grupo: '', prueba: 'Informe de brucelosis', rango: '', ancho: 88 },
  { grupo: '', prueba: 'IBR (ELISA)', rango: '', ancho: 124 },
  { grupo: '', prueba: 'DVB (ELISA)', rango: '', ancho: 132 },
]
function rodeo() {
  let seed = 20260722
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const caravanas = ['154983', '151667', '126', '105']
  const usadas = new Set(caravanas)
  while (caravanas.length < 50) {
    const c = rnd() < 0.3 ? String(100 + Math.floor(rnd() * 900)) : String(150000 + Math.floor(rnd() * 9000))
    if (!usadas.has(c)) { usadas.add(c); caravanas.push(c) }
  }
  const hardjo = { 1: '1/400', 9: '1/200', 17: '1/800', 23: '1/400', 31: '1/100', 38: '1/200' }
  const pomona = { 9: '1/100', 44: '1/400' }
  const ibr0 = ['79% - POSITIVO', '100% - POSITIVO', '80% - POSITIVO', '12% - Negativo']
  const dvb0 = ['0,186 - POSITIVO', '1,674 - Negativo', '1,674 - Negativo', '1,674 - Negativo']
  const ok = (valor) => ({ valor, fuera: false })
  return caravanas.map((car, i) => {
    const pct = Math.floor(rnd() * 100)
    const r = rnd()
    const ibr = ibr0[i] || (pct >= 55 ? `${pct}% - POSITIVO` : `${pct}% - Negativo`)
    const dvb = dvb0[i] || (r < 0.08 ? `0,${100 + Math.floor(rnd() * 300)} - POSITIVO` : `${(1.2 + rnd() * 0.8).toFixed(3).replace('.', ',')} - Negativo`)
    return {
      animal: car,
      celdas: [ok('Negativo'), hardjo[i] ? { valor: hardjo[i], fuera: true } : ok('Negativo'),
        pomona[i] ? { valor: pomona[i], fuera: true } : ok('Negativo'), ok('Negativo'), ok(ibr), ok(dvb)],
    }
  })
}
const RODEO_FILAS = rodeo()
const RODEO = {
  tipo: 'rodeo', animales: RODEO_FILAS.map((f) => f.animal),
  analisis: ['LEPTOSPIROSIS', 'INFORME DE BRUCELOSIS', 'IBR (ELISA)', 'DVB (ELISA)'],
  matriz: RODEO_FILAS, columnas: COLUMNAS,
  fichaComun: [['Raza', 'NELORE'], ['Sexo', 'Hembra'], ['Edad', '2.00 Años']],
  notas: ['Material: SANGRE', 'Leptospirosis — OBSERVACION: SGC-PROTEC-M-04 Microaglutinación', 'Brucelosis, IBR y DVB — METODO LABORATORIAL: ELISA'],
}

const P = (fec, nro, estado, extra = {}) => ({ fec, nro, ref: refDe(fec, nro), estado, ...extra })
const PEDIDOS = {
  2646: [
    P('2026-07-28', 40, 'en_proceso', { entrega: '2026-07-31', urgente: true }),
    P('2026-07-24', 5, 'disponible', { informe: SHAKIRA }),
    P('2026-07-24', 2, 'disponible', { informe: ROCKY }),
    P('2026-07-22', 219, 'disponible', { informe: RODEO }),
    P('2026-07-10', 3, 'fuera_de_ventana'),
  ],
  424: [P('2026-07-23', 12, 'disponible', { informe: LOLA })],
  77: [],
}
const keyDe = (p) => `${p.fec}/${p.nro}`
const fueraDe = (inf) => !inf ? 0 : inf.tipo === 'rodeo'
  ? inf.matriz.reduce((s, f) => s + f.celdas.filter((c) => c.fuera).length, 0)
  : inf.filas.filter((f) => f.fuera).length

function hallazgosDe(inf) {
  if (!inf) return []
  if (inf.tipo === 'animal') return inf.filas.filter((f) => f.fuera).map((f) => ({ animal: '', prueba: f.prueba, valor: f.valor, rango: f.rango }))
  const out = []
  inf.matriz.forEach((f) => f.celdas.forEach((c, i) => {
    if (c.fuera) { const col = inf.columnas[i]; out.push({ animal: f.animal, prueba: col.grupo ? `${col.grupo} · ${col.prueba}` : col.prueba, valor: c.valor, rango: col.rango }) }
  }))
  return out
}

export const estadoInicial = () => ({
  pantalla: 'ingreso', contacto: '', errorIngreso: '', clave: null, opciones: [],
  codigo: '', codigoFoco: false, errorCodigo: '', intentos: 0, invalido: false,
  clinica: null, q: '', qInput: '', filtro: 'todos', pedido: null,
  imprimir: false, compartir: false, soloHallazgos: false, errorMsg: '', toast: '',
})

const PRESETS = {
  ingreso: {},
  'ingreso-error': { contacto: 'clinica tacuary', errorIngreso: 'No reconocemos ese formato. Escribí un celular (0981 123 456) o un correo.' },
  codigo: { pantalla: 'codigo', contacto: '0981 000 001', clave: '981000001', opciones: [2646] },
  'codigo-error': { pantalla: 'codigo', contacto: '0981 000 001', clave: '981000001', opciones: [2646], codigo: '123456', intentos: 1, errorCodigo: 'El código no es correcto. Revisalo y probá de nuevo.' },
  elegir: { pantalla: 'elegir', contacto: '0981 000 002', clave: '981000002', opciones: [424, 77] },
  pedidos: { pantalla: 'pedidos', clave: '981000001', opciones: [2646], clinica: 2646 },
  'buscar-vacio': { pantalla: 'pedidos', clave: '981000001', opciones: [2646], clinica: 2646, q: 'hardjo', qInput: 'hardjo' },
  'sin-pedidos': { pantalla: 'pedidos', clave: '981000002', opciones: [424, 77], clinica: 77 },
  'informe-animal': { pantalla: 'informe', clave: '981000001', opciones: [2646], clinica: 2646, pedido: '2026-07-24/5' },
  'informe-rodeo': { pantalla: 'informe', clave: '981000001', opciones: [2646], clinica: 2646, pedido: '2026-07-22/219' },
  imprimir: { pantalla: 'informe', clave: '981000001', opciones: [2646], clinica: 2646, pedido: '2026-07-24/5', imprimir: true },
  'no-encontrado': { pantalla: 'error', clave: '981000001', opciones: [2646], clinica: 2646, errorMsg: 'No encontramos ese pedido entre los de tu clínica.' },
}
const ATAJOS = [
  ['ingreso', 'Ingreso'], ['ingreso-error', 'Formato inválido'], ['codigo', 'Código'], ['codigo-error', 'Código incorrecto'],
  ['elegir', 'Elegir clínica'], ['pedidos', 'Pedidos'], ['buscar-vacio', 'Búsqueda sin resultados'], ['sin-pedidos', 'Clínica sin pedidos'],
  ['informe-animal', 'Informe · 1 animal'], ['informe-rodeo', 'Informe · rodeo de 50'], ['imprimir', 'Vista de impresión'], ['no-encontrado', 'Pedido ajeno (404)'],
]
function atajoActual(s, listaVacia) {
  if (s.pantalla === 'ingreso') return s.errorIngreso ? 'ingreso-error' : 'ingreso'
  if (s.pantalla === 'codigo') return s.errorCodigo ? 'codigo-error' : 'codigo'
  if (s.pantalla === 'elegir') return 'elegir'
  if (s.pantalla === 'error') return 'no-encontrado'
  if (s.pantalla === 'informe') return s.imprimir ? 'imprimir' : s.pedido === '2026-07-22/219' ? 'informe-rodeo' : 'informe-animal'
  if (s.clinica === 77) return 'sin-pedidos'
  return s.q && listaVacia ? 'buscar-vacio' : 'pedidos'
}

const ESTADO_TXT = { disponible: 'Resultados disponibles', en_proceso: 'En proceso', fuera_de_ventana: 'No disponible en línea' }

export function vistas(c) {
  const s = c.state
  const set = (p) => c.setState(p)
  const ev = (fn) => (e) => { if (e && e.preventDefault) e.preventDefault(); fn(e) }
  const toast = (t) => { clearTimeout(c._toast); set({ toast: t }); c._toast = setTimeout(() => c.setState({ toast: '' }), 2600) }
  const entrar = (cod) => set({ pantalla: 'pedidos', clinica: cod, q: '', qInput: '', filtro: 'todos', pedido: null, imprimir: false, compartir: false })
  const abrir = (k) => set({ pantalla: 'informe', pedido: k, imprimir: false, compartir: false, soloHallazgos: false })

  // ── pedidos
  const todos = s.clinica ? PEDIDOS[s.clinica] || [] : []
  const qn = plano(s.q.trim())
  const coincide = (p) => !qn || plano([p.ref, p.ref.replace(/\s/g, ''), ...(p.informe ? [...p.informe.animales, ...p.informe.analisis] : [])].join(' ')).includes(qn)
  const buscados = todos.filter(coincide)
  const lista = s.filtro === 'todos' ? buscados : buscados.filter((p) => p.estado === s.filtro)
  const vista = (p) => {
    const inf = p.informe, an = inf ? inf.animales : [], f = fueraDe(inf), k = keyDe(p)
    const disp = p.estado === 'disponible'
    return {
      key: k, referencia: p.ref, fecha: fmt(p.fec), urgente: !!p.urgente,
      estadoTxt: ESTADO_TXT[p.estado], esDisponible: disp, esProceso: p.estado === 'en_proceso', esFueraVentana: p.estado === 'fuera_de_ventana', noDisponible: !disp,
      animalesTxt: an.slice(0, 3).join(', '), masTxt: an.length > 3 ? `y ${an.length - 3} más` : '', tieneMas: an.length > 3, tieneAnimales: an.length > 0,
      conteoAnimales: an.length > 1 ? `${an.length} animales` : '', esRodeo: an.length > 1,
      analisisTxt: inf ? inf.analisis.join(' · ') : '', tieneAnalisis: !!inf,
      entregaTxt: p.estado === 'en_proceso' && p.entrega ? `Entrega prevista: ${fmt(p.entrega)}` : '', tieneEntrega: p.estado === 'en_proceso' && !!p.entrega,
      fueraTxt: f ? `${f} ${f === 1 ? 'valor' : 'valores'} fuera de rango` : '', tieneFuera: f > 0, fueraN: f,
      nuevo: disp && p.fec > ULTIMA_VISITA,
      abrir: ev(() => { if (disp) abrir(k) }),
    }
  }
  const pedidos = lista.map(vista)
  const grupos = []
  pedidos.forEach((v, i) => {
    const fec = lista[i].fec
    let g = grupos[grupos.length - 1]
    if (!g || g.fec !== fec) { g = { fec, titulo: fmtLarga(fec), fecha: fmt(fec), pedidos: [] }; grupos.push(g) }
    g.pedidos.push(v)
  })
  const cuenta = (e) => buscados.filter((p) => p.estado === e).length
  const filtros = [['todos', 'Todos', buscados.length], ['disponible', 'Disponibles', cuenta('disponible')], ['en_proceso', 'En proceso', cuenta('en_proceso')], ['fuera_de_ventana', 'No en línea', cuenta('fuera_de_ventana')]]
    .map(([id, label, n]) => ({ id, label, n, activo: s.filtro === id, inactivo: s.filtro !== id, elegir: ev(() => set({ filtro: id })) }))
  const total = todos.length
  const nuevos = todos.filter((p) => p.estado === 'disponible' && p.fec > ULTIMA_VISITA).length
  const ventanaTxt = `resultados en línea del ${fmt(VENTANA.desde)} al ${fmt(VENTANA.hasta)}`

  // ── informe
  const pa = todos.find((p) => keyDe(p) === s.pedido)
  const ii = pa && pa.informe
  let inf = null
  if (ii) {
    const hall = hallazgosDe(ii)
    const animalesConHall = ii.tipo === 'rodeo' ? ii.matriz.filter((f) => f.celdas.some((x) => x.fuera)).length : 0
    const matriz = ii.tipo === 'rodeo' ? ii.matriz
      .filter((f) => !s.soloHallazgos || f.celdas.some((x) => x.fuera))
      .map((f) => {
        const n = f.celdas.filter((x) => x.fuera).length
        return { animal: f.animal, tieneFuera: n > 0, fueraN: n, celdas: f.celdas.map((x, i) => ({ valor: x.valor, fuera: x.fuera, normal: !x.fuera, flex: `1 0 ${ii.columnas[i].ancho}px` })) }
      }) : []
    inf = {
      referencia: pa.ref, refCorta: pa.ref.replace(/\s/g, ''), recepcion: fmt(pa.fec), consultado: fmt(HOY), clinica: CLINICAS[s.clinica],
      esAnimal: ii.tipo === 'animal', esRodeo: ii.tipo === 'rodeo', numAnimales: ii.animales.length,
      titulo: ii.tipo === 'animal' ? ii.animales[0] : `${ii.animales.length} animales`,
      analisisTxt: ii.analisis.join(' · '),
      ficha: (ii.ficha || []).map(([k, v]) => ({ k, v })),
      fichaComun: (ii.fichaComun || []).map(([k, v]) => ({ k, v })),
      filas: (ii.filas || []).map((f) => ({ esSeccion: f.tipo === 's', esMedicion: f.tipo === 'm', prueba: f.prueba, valor: f.valor, relativo: f.relativo, tieneRelativo: !!f.relativo, rango: f.rango, fuera: !!f.fuera, normal: f.tipo === 'm' && !f.fuera })),
      notas: ii.notas.map((t) => ({ t })),
      matriz, matrizConteo: s.soloHallazgos ? `${matriz.length} de ${ii.animales.length} animales` : `${ii.animales.length} animales`,
      animalesConHallazgos: animalesConHall,
      hallazgos: hall.map((h) => ({ ...h, tieneAnimal: !!h.animal, tieneRango: !!h.rango })),
      hayHallazgos: hall.length > 0, sinHallazgos: hall.length === 0,
      hallazgosTitulo: hall.length === 0 ? 'Todos los valores dentro del rango de referencia'
        : `${hall.length} ${hall.length === 1 ? 'valor' : 'valores'} fuera de rango${animalesConHall > 1 ? ` en ${animalesConHall} animales` : ''}`,
      enlace: `${DOMINIO}/pedidos/${pa.fec}/${pa.nro}`,
      mensaje: `Resultados CEDIVEP · Ref. ${pa.ref.replace(/\s/g, '')} · ${ii.tipo === 'animal' ? ii.animales[0] : `${ii.animales.length} animales`} (${ii.analisis.join(', ')})`,
    }
  }

  const listaVacia = lista.length === 0
  const actual = atajoActual(s, listaVacia)
  const imp = s.imprimir && s.pantalla === 'informe'
  const ruta = { ingreso: '/', codigo: '/verificar', elegir: '/elegir', error: '/pedidos/2026-07-30/999',
    pedidos: '/pedidos' + (s.q ? `?q=${encodeURIComponent(s.q)}` : ''), informe: `/pedidos/${s.pedido}` }[s.pantalla]

  return {
    lab: LAB,
    es: { ingreso: s.pantalla === 'ingreso', codigo: s.pantalla === 'codigo', elegir: s.pantalla === 'elegir', pedidos: s.pantalla === 'pedidos', informe: s.pantalla === 'informe', error: s.pantalla === 'error' },
    ruta: DOMINIO + ruta,
    dispositivos: [
      { id: 'esc', etiqueta: 'Escritorio', medida: '1200 × 800', esEscritorio: true, esCelular: false, esAncho: true, ancho: 1200, alto: 800, docZoom: 1 },
      { id: 'cel', etiqueta: 'Celular', medida: '390 × 844', esEscritorio: false, esCelular: true, esAncho: imp, ancho: 390, alto: 844, docZoom: imp ? 0.43 : 1 },
    ],
    atajos: ATAJOS.map(([id, label]) => ({ id, label, activo: id === actual, inactivo: id !== actual, ir: ev(() => set({ ...estadoInicial(), ...PRESETS[id] })) })),
    toast: s.toast, hayToast: !!s.toast,

    // ingreso
    contacto: s.contacto, errorIngreso: s.errorIngreso, hayErrorIngreso: !!s.errorIngreso,
    onContacto: (e) => set({ contacto: e.target.value, errorIngreso: '' }),
    ingresar: ev(() => {
      const clave = claveDeContacto(s.contacto)
      if (!clave) return set({ errorIngreso: 'No reconocemos ese formato. Escribí un celular (0981 123 456) o un correo.' })
      set({ pantalla: 'codigo', clave, opciones: CONTACTOS[clave] || [], codigo: '', errorCodigo: '', intentos: 0, invalido: false, errorIngreso: '' })
    }),

    // código
    destino: destinoVisible(s.clave), codigo: s.codigo, codigoDemo: CODIGO_DEMO,
    codigoDemoTxt: `${CODIGO_DEMO.slice(0, 3)} ${CODIGO_DEMO.slice(3)}`,
    mostrarDemo: s.opciones.length > 0 && !s.invalido,
    errorCodigo: s.errorCodigo, hayErrorCodigo: !!s.errorCodigo,
    digitos: Array.from({ length: 6 }, (_, i) => ({ d: s.codigo[i] || '', activo: s.codigoFoco && i === Math.min(s.codigo.length, 5), inactivo: !(s.codigoFoco && i === Math.min(s.codigo.length, 5)), lleno: !!s.codigo[i] })),
    onCodigo: (e) => set({ codigo: e.target.value.replace(/\D/g, '').slice(0, 6), errorCodigo: '' }),
    onCodigoFoco: () => set({ codigoFoco: true }), onCodigoBlur: () => set({ codigoFoco: false }),
    verificar: ev(() => {
      if (s.invalido) return set({ errorCodigo: 'El código venció o ya no es válido. Pedí uno nuevo.' })
      if (s.codigo === CODIGO_DEMO && s.opciones.length) {
        if (s.opciones.length === 1) return entrar(s.opciones[0])
        return set({ pantalla: 'elegir', codigo: '', errorCodigo: '' })
      }
      const intentos = s.intentos + 1
      if (intentos >= 5) return set({ intentos, invalido: true, codigo: '', errorCodigo: 'El código venció o ya no es válido. Pedí uno nuevo.' })
      set({ intentos, errorCodigo: 'El código no es correcto. Revisalo y probá de nuevo.' })
    }),
    otroContacto: ev(() => set({ pantalla: 'ingreso', codigo: '', errorCodigo: '' })),
    reenviar: ev(() => { set({ intentos: 0, invalido: false, errorCodigo: '', codigo: '' }); toast('Te mandamos un código nuevo.') }),

    // elegir
    opcionesClinicas: s.opciones.map((cod, i) => ({ codigo: cod, nombre: CLINICAS[cod], codTxt: `Cód. ${cod}`, elegir: ev(() => entrar(cod)), primera: i === 0 })),

    // barra
    clinicaNombre: CLINICAS[s.clinica] || '', clinicaCod: s.clinica ? `Cód. ${s.clinica}` : '',
    variasClinicas: s.opciones.length > 1,
    cambiar: ev(() => set({ pantalla: 'elegir', imprimir: false, compartir: false })),
    salir: ev(() => set({ ...estadoInicial() })),
    irPedidos: ev(() => set({ pantalla: 'pedidos', imprimir: false, compartir: false })),

    // pedidos
    pedidos, grupos, filtros, total, tieneTotal: total > 0, hayPedidos: pedidos.length > 0,
    qInput: s.qInput, q: s.q, hayQ: !!s.qInput,
    onQ: (e) => set({ qInput: e.target.value }),
    onQVivo: (e) => set({ qInput: e.target.value, q: e.target.value }),
    buscar: ev(() => set({ q: s.qInput })),
    limpiar: ev(() => set({ q: '', qInput: '', filtro: 'todos' })),
    contextoTxt: `${s.q ? `${pedidos.length} de ${total} pedidos` : `${total} ${total === 1 ? 'pedido' : 'pedidos'}`} · ${ventanaTxt}`,
    ventanaTxt: `Resultados en línea del ${fmt(VENTANA.desde).slice(0, 5)} al ${fmt(VENTANA.hasta)}`,
    ultimaVisitaTxt: `Última visita ${fmt(ULTIMA_VISITA)}`,
    nuevosTxt: nuevos ? `${nuevos} ${nuevos === 1 ? 'pedido nuevo' : 'pedidos nuevos'}` : '', hayNuevos: nuevos > 0,
    vacioBusqueda: listaVacia && !!s.q.trim() && total > 0,
    vacioFiltro: listaVacia && !s.q.trim() && total > 0,
    vacioClinica: total === 0,
    qTxt: s.q.trim(),
    filtroTxt: { disponible: 'con resultados disponibles', en_proceso: 'en proceso', fuera_de_ventana: 'fuera de la ventana en línea', todos: '' }[s.filtro],

    // informe
    inf, hayInforme: !!inf,
    imprimir: imp, noImprimir: !imp,
    abrirImprimir: ev(() => set({ imprimir: true, compartir: false })),
    cerrarImprimir: ev(() => set({ imprimir: false })),
    imprimirAhora: ev(() => toast('En el portal se abre el diálogo de impresión del navegador.')),
    compartir: s.compartir && s.pantalla === 'informe',
    abrirCompartir: ev(() => set({ compartir: true })),
    cerrarCompartir: ev(() => set({ compartir: false })),
    abrirWhatsApp: ev(() => { set({ compartir: false }); toast('Se abriría WhatsApp con el mensaje listo.') }),
    copiarEnlace: ev(() => { set({ compartir: false }); toast('Enlace copiado.') }),
    soloHallazgos: s.soloHallazgos, todosAnimales: !s.soloHallazgos,
    toggleHallazgos: ev(() => set({ soloHallazgos: !s.soloHallazgos })),
    errorMsg: s.errorMsg,
  }
}
