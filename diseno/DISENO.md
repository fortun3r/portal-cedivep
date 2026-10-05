# Diseño v2 del portal — especificación para el paso 4

> **Para la sesión de Claude Code:** este documento manda sobre todo lo **visual** del portal.
> Reemplaza a `capturas/` y a `_referencia/public/styles.css` como objetivo del **paso 4** de
> `HANDOFF.md`. La lógica, la seguridad, las URLs y el plan siguen como dice `HANDOFF.md`.
> Si algo de acá choca con una regla de §7 de `HANDOFF.md` (seguridad), **gana §7**.

Preparado el 05/10/2026 con Luis. El diseño se aprobó sobre un prototipo navegable.

---

## 1. Qué hay en `diseno/`

```
DISENO.md            este archivo
estilos.css          CSS global listo para usar → src/app/globals.css (sin Tailwind)
capturas/            el diseño aprobado, escritorio + celular, pantalla por pantalla
prototipo/           el prototipo navegable (la fuente de verdad visual)
  Portal CEDIVEP v2.dc.html   ← EL DISEÑO APROBADO
  Portal CEDIVEP.dc.html      la referencia actual + los 4 arreglos (para comparar)
  portal-datos.js             datos de demo y flujo del prototipo
  support.js                  runtime del prototipo (no tocar)
```

**Para ver el prototipo** (necesita un servidor local, no abre con doble clic):

```bash
cd diseno/prototipo && python3 -m http.server 8080
# abrir http://localhost:8080/Portal%20CEDIVEP%20v2.dc.html
```

Muestra escritorio (1200 px) y celular (390 px) lado a lado. Los botones "Ir a" de arriba saltan a
cualquier estado. Demo: `0981 000 001`, `0981 000 002` (dos clínicas), código `185186`.

**Ojo:** el prototipo está escrito con estilos en línea. **No copies su marcado.** Es la
referencia para medir y comparar. Lo que se implementa es `estilos.css` + componentes React con
las clases de §4. Las capturas son aproximadas (en algunas los textos de los botones se parten en
dos renglones, cosa que en el navegador no pasa). Ante una duda, abrí el prototipo.

---

## 2. Idea del diseño

Toma el lenguaje del sitio del laboratorio (cedivep.com.py):

- **Rojo y negro.** Negro `#161616` para la estructura: barra, panel de ingreso, botones
  secundarios. Rojo `#c8102e` para la marca y la **acción principal** de cada pantalla.
- **Títulos en mayúscula con dos pesos**, como "Resultado de **Análisis**" en el sitio:
  `TUS <strong>PEDIDOS</strong>` (400 + 800).
- **Fuera de rango = marcador amarillo** (`#fde58c`) con ▲ y negrita. No es rojo, para no
  confundirse con la marca, y se lee de un vistazo en 50 vacas.
- **Mono** (IBM Plex Mono) para todo lo que se dicta o se compara: referencias, caravanas,
  códigos de clínica y el código de ingreso.
- Fondo cálido `#f2f1ee`, papel blanco para el informe, radios chicos (4 px).

---

## 3. Base técnica

**Fuentes con `next/font/google`.** Se descargan en el build y se sirven desde el propio
dominio: nada de pedidos a Google desde el celular, y la CSP con nonce no se complica.

```tsx
// src/app/layout.tsx
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
const texto = Archivo({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--f-texto' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500','600'], variable: '--f-mono' })
// <html lang="es" className={`${texto.variable} ${mono.variable}`}>
```

- `estilos.css` va como `src/app/globals.css`. Ya trae el celular (`max-width: 640px`) y la
  impresión (`@media print`, A4).
- **Logo:** por ahora la marca es texto (`CEDIVEP` + `S.R.L.`, clase `.marca`). El logo
  oficial es rojo y negro (está en el sitio: `logo-hor-rojo_negro-copia.png`, 168×45, muy chico).
  Pedile a Luis un SVG o un PNG grande y reemplazá `.marca` en la barra, el panel de ingreso y el
  encabezado del informe.
- `config.lab` suma `telefono: '(021) 584 085'`, `correo: 'info.cedivep@cedivep.com.py'` y
  `horario: 'Lunes a viernes 7:00–18:00 · Sábado 7:00–12:00'`. Se usan en el ingreso, en la
  clínica sin pedidos y en el pie del informe. **Confirmá con Luis** que son los datos de contacto
  para las clínicas (salen del sitio).

---

## 4. Pantallas

Todo funciona **sin JS** (`<form>` → `/api/...` → 303, y filtros como enlaces GET). Lo poco
que pide JS es mejora progresiva y está marcado.

### 4.1 Acceso: `/`, `/verificar`, `/elegir` — capturas 01–05

Pantalla partida: panel negro con la marca a la izquierda y el formulario a la derecha. En el
celular el panel queda arriba, compacto, y el formulario debajo.

```html
<main class="acceso">
  <aside class="acceso-panel">
    <div><a class="marca"><span class="marca-nombre">CEDIVEP</span><span class="marca-srl">S.R.L.</span></a><div class="marca-raya"></div></div>
    <div>
      <div class="sobretitulo">Portal para clínicas</div>
      <h2>Resultados de <strong>análisis</strong></h2>
      <p class="acceso-lema">Centro de Diagnóstico Veterinario del Paraguay. Primer laboratorio privado de diagnóstico veterinario del país, desde 1989.</p>
    </div>
    <div class="acceso-habilitacion">Habilitación N° 114-SENACSA</div>
  </aside>
  <div class="acceso-cuerpo"><form class="acceso-form" method="POST" action="/api/...">…</form></div>
</main>
```

**Ingreso (`/`).** Título `Ingresá con tu <strong>clínica</strong>`. Ayuda: "Escribí el celular
o el correo que tu clínica tiene registrado en el laboratorio. Te mandamos un código de 6 dígitos
para entrar, sin contraseña." Etiqueta `.etiqueta` "Celular o correo", input `.campo` con
`name="contacto"` (mismos atributos que la referencia). Botón `.boton` "Recibir código" (la
flecha la pone el CSS). Debajo, `.acceso-contacto`: "¿Tu clínica no tiene un celular o correo
registrado? Llamá al **(021) 584 085** o escribí a info.cedivep@…", y el horario en
`.acceso-horario`. Errores en `.error`, **con los textos exactos de `server.ts`**.

**Código (`/verificar`).** Arriba, el enlace `.acceso-volver` "← Usar otro celular o correo".
Título `Ingresá el <strong>código</strong>`. Ayuda con el destino enmascarado en `<strong>`. Si
está en modo demo, `.demo`: "Modo demostración — no se envían mensajes." a la izquierda y el código
en mono, partido `185 186`, a la derecha. Botón "Entrar". Abajo, `.secundario`: "¿No te llegó?" +
**Reenviar código** (ver §5.7).

- **Las 6 casillas** son mejora progresiva. El servidor dibuja `.codigo` con el input
  `.codigo-input` (`name="codigo"`, `inputmode="numeric"`, `autocomplete="one-time-code"`), que se
  ve y funciona solo. Un componente cliente mínimo agrega `.codigo--mejorado`, dibuja 6
  `span.casilla` (`aria-hidden`), las llena con lo que se tipea y marca la activa con
  `data-activa`. El input real queda transparente encima. Si el JS no carga, sigue siendo un input
  común. Probalo con el autocompletado de SMS de iOS.

**Elegir clínica (`/elegir`).** Título `¿Con qué <strong>clínica</strong> querés entrar?`. Ayuda:
"Tu contacto está registrado en más de una clínica. Podés cambiar después desde la barra." Cada
clínica es un `<button class="clinica-opcion" name="clinica" value="…">` dentro de un solo
`<form>`, con el nombre (`.clinica-opcion-nombre`) y `Cód. 424` en mono (`.clinica-opcion-cod`).
Mostrar el código de clínica no revela nada: la persona ya entró con el código.

### 4.2 Barra superior — en todas las páginas autenticadas

```html
<header class="barra">
  <div class="barra-fila">
    <a class="marca" href="/pedidos">…</a>
    <span class="barra-acciones">
      <span class="barra-clinica"><span class="barra-clinica-nombre">CLÍNICA TACUARY</span><span class="barra-clinica-cod">Cód. 2646</span></span>
      <a class="barra-cambiar" href="/elegir">Cambiar</a>   <!-- solo si hay varias clínicas -->
      <form method="POST" action="/api/salir"><button class="barra-salir">Salir</button></form>
    </span>
  </div>
</header>
<div class="subbarra">  <!-- solo se ve en el celular: la clínica en su propio renglón -->
  <span class="barra-clinica-nombre">…<span class="barra-clinica-cod">Cód. 2646</span></span>
  <a href="/elegir">Cambiar</a>
</div>
```

Esto resuelve el **arreglo 3** (en el celular, "Salir" quedaba cortado): la barra negra queda con
marca + Salir, y la clínica baja a la subbarra blanca. "Imprimir / PDF" ya **no** va en la barra:
pasa a las acciones del informe.

### 4.3 Pedidos: `/pedidos?q=&estado=` — capturas 06–08

1. `.pagina-cab`: título `Tus <strong>pedidos</strong>` y, en `.pagina-meta`: "Resultados en línea
   del 22/07 al 24/07/2026" + (si hay) `.pagina-nuevos` con un `.punto--marca` y "2 pedidos nuevos
   desde tu última visita".
2. Búsqueda: `<form method="GET" class="buscar">` con `input.campo[type=search][name=q]`.
   Placeholder **"Buscar animal, caravana o análisis"** (arreglo 4). Si hay `q`, se muestra
   `a.buscar-limpiar` (×) que lleva a `/pedidos`. Sin botón "Buscar": se envía con Enter. Lo que
   se tipea se mantiene en los filtros (`q` viaja en sus enlaces).
3. Filtros (§5.1): `nav.filtros` con 4 enlaces `.filtro`, cada uno con su número en `.filtro-n`. El
   activo lleva `aria-current="true"`.
4. Lista agrupada por fecha (§5.2): `.grupos` > `section.grupo` > `h2.grupo-titulo` ("Viernes 24
   de julio" + `.grupo-fecha` "24/07/2026") > `ul.pedidos`.
5. Cada pedido:
   - **Disponible:** `<a class="pedido">`, que lleva el → al final por CSS. Adentro, `.pedido-cuerpo`:
     - `.pedido-cab` con la `.ref` (mono, `white-space: pre`, porque `260724/  5` trae espacios),
       la `.etiqueta-nuevo` "NUEVO" si corresponde (§5.3), y `.estado.estado--ok` con su
       `.punto--ok` y "Resultados disponibles";
     - `.pedido-animales`: los primeros 3, más `.pedido-mas` "y 47 más";
     - `.pedido-analisis`: los análisis separados por " · ";
     - si hay valores fuera de rango, `.marcador` "▲ 1 valor fuera de rango".
   - **En proceso:** `<div class="pedido pedido--inactivo">` con la ref, `.etiqueta-urgente`
     "URGENTE" si corresponde, y `.estado--proceso` "En proceso"; debajo, `.pedido-entrega`
     "Entrega prevista: 31/07/2026".
   - **Fuera de la ventana:** inactivo, con `.estado` gris "No disponible en línea" y
     `.pedido-nota` "Es anterior a los resultados en línea. Pedí el informe al laboratorio."
6. Vacíos (`.vacio`):
   - **búsqueda sin resultados:** "Ningún pedido coincide con “hardjo”", más "La búsqueda mira el
     nombre o la caravana del animal, el análisis y la referencia del pedido." y el botón
     `.boton-borde` "Ver todos los pedidos";
   - **filtro sin resultados:** "No hay pedidos en proceso" y el mismo botón;
   - **clínica sin pedidos** (sin búsqueda ni filtros): "Todavía no hay pedidos de tu clínica en el
     portal", más "Los resultados aparecen acá apenas el laboratorio los carga. ¿Esperabas ver
     alguno? Llamá al **(021) 584 085**."

**La búsqueda tiene que encontrar cualquier caravana del rodeo**, no solo las 3 que se ven (en la
captura 07, "hardjo" no aparece porque es una prueba, no un análisis: está bien).

### 4.4 Informe: `/pedidos/[fecha]/[nro]` — capturas 09–15

```
.informe-acciones   ← Tus pedidos ·························· [Compartir por WhatsApp] [Imprimir / PDF]
article.informe
  header.informe-cab     marca + "Centro de Diagnóstico…"  |  .sello: REFERENCIA / 260724/  5 / Habilitación N° 114-SENACSA
  dl.datos               CLÍNICA · RECEPCIÓN · (ANIMALES si >1) · CONSULTADO
  section.resumen        ← resumen de hallazgos (§5.4), o .todo-ok si no hay ninguno
  section.animal         (1 animal)  dl.ficha  +  table.resultados  +  .notas
  section.animal         (rodeo)     .matriz-cab (ficha común + interruptor)  +  .matriz-scroll > table.matriz  +  .matriz-pie  +  .notas
  p.leyenda              [▲ valor] fuera del rango de referencia.   (solo si hay hallazgos)
  footer.pie-informe     "Consulta en línea… No reemplaza al informe firmado."  |  (021) 584 085 · info.cedivep@…
```

- **Acciones.** "Compartir por WhatsApp" (`.boton-borde`, §5.6) e "Imprimir / PDF"
  (`.boton-chico`, componente cliente con `window.print()`).
- **Ficha.** Etiqueta chica arriba y valor abajo (`.ficha div > dt + dd`). Se ocultan los valores
  de relleno, como hoy, y nunca se muestra "Especie: —".
- **Una tabla por animal (arreglo 1).** Un solo `<table class="resultados">` por animal, con
  `thead` Prueba / Resultado / Rango de referencia. Cada sección es una fila
  `<tr><th class="seccion" colspan="3" scope="colgroup">LEUCOGRAMA</th></tr>`. Fuera de rango:
  `<td class="valor"><span class="marcador">▲ 22,5 %</span></td>`. El valor relativo va en
  `<span class="relativo">4.650 /mm3</span>` dentro de la celda. Las notas de material y método
  van **deduplicadas** en `.notas`, debajo de la tabla. En el celular cada fila se parte en dos
  renglones (prueba + resultado; debajo, "REF." + rango), todo resuelto en el CSS.
- **Rodeo como matriz (arreglo 2).** Usá `matrizRodeo()` tal como está. Se arma con `<table
  class="matriz">`:
  - 2 filas de `thead`. Arriba, los grupos (`th.grupo-col colspan=3` "Leptospirosis"; los análisis
    de una sola prueba no llevan grupo). Abajo, las pruebas, con el rango en `.col-rango` ("ref.
    Negativo") **solo si es igual para todos los animales**.
  - Una fila por animal, con `<th scope="row">` (la caravana, en mono y fija a la izquierda al
    deslizar) y una celda por prueba, con `.marcador` si está fuera de rango.
  - Encima, `.matriz-cab`: la **ficha común** (lo que comparten todos: Raza NELORE · Sexo Hembra ·
    Edad 2.00 Años, §5.8) y el interruptor "Solo animales con hallazgos (7)" (§5.5).
  - Debajo, `.matriz-pie`: "50 animales" o "7 de 50 animales" y, solo en el celular, "Deslizá la
    tabla para ver todas las pruebas →".
  - Si `matrizRodeo()` devuelve `null` (rodeo con pruebas distintas), va una `section.animal` por
    animal, con título y su propia tabla, y un índice de animales arriba, como en la referencia.

### 4.5 Error / 404 — captura 16

Barra normal + `.aviso`: título `No encontramos ese <strong>pedido</strong>`. El párrafo es el
mensaje de `server.ts` más "Si el enlace te lo pasó otra clínica, cada una ve solo sus propios
pedidos.", y el botón `.boton.boton--auto` "Ver tus pedidos". El 404 sigue sin distinguir entre
"no existe" y "es de otra clínica" (§7 de HANDOFF). El texto agregado vale para los dos casos.
Para los demás errores (500, página inexistente) se usa la misma `.aviso` con su mensaje.

### 4.6 Impresión — captura 15

El prototipo muestra una "vista de impresión" con su propia barra. **En producción no hace falta**:
"Imprimir / PDF" llama a `window.print()` y `@media print` deja solo `article.informe`, en A4 y sin
barra, acciones ni interruptor. La matriz se imprime entera (688 px entran en A4 vertical), con
`thead` repetido en cada página. El marcador amarillo se imprime
(`print-color-adjust: exact`). **Si "solo con hallazgos" está activo, se imprime filtrado:**
ofrecé imprimir completo o mostrá el aviso; consultalo con Luis.

---

## 5. Funciones nuevas

Todas del lado del servidor. **Ninguna escribe en la base.** Cada función pura nueva va a
`src/lib/` con su test.

### 5.1 Filtro por estado
`?estado=disponible|en_proceso|fuera_de_ventana` (sin parámetro = todos). Los números de cada
filtro se cuentan **después** de aplicar la búsqueda. Un valor desconocido = todos. Son enlaces
GET, así que funcionan sin JS y se pueden testear por HTTP.

### 5.2 Agrupar por fecha
Agrupar por `fecPed` (fecha de recepción), de la más nueva a la más vieja. El título es el día de
la semana y la fecha en español ("Viernes 24 de julio"); el año va en `.grupo-fecha`. Función pura
`agruparPorFecha(resumenes)` + test, ojo con UTC-3: armá la fecha desde el string `YYYY-MM-DD`,
nunca con `new Date(iso)` a secas.

### 5.3 "Nuevo" desde la última visita
- La base es de solo lectura, así que la última visita se guarda en una **cookie firmada**
  `cedivep_visita`, con una fecha por clínica (`{ [codigo]: 'YYYY-MM-DD' }`), firmada con el mismo
  HMAC que la sesión.
- **Las páginas no escriben cookies** (HANDOFF §6, paso 3). Opción recomendada: el middleware,
  en cada GET a `/pedidos`, pasa el valor anterior a la página en un header de la request y
  guarda la fecha de hoy en la respuesta. Si preferís otra forma, que mantenga esa regla.
- Un pedido es "nuevo" si está `disponible` y su fecha es posterior a la última visita. La primera
  vez (sin cookie) no se marca ninguno.
- **Limitación a avisarle a Luis:** `descres` no trae la fecha en que se **cargó** el resultado,
  así que se aproxima con la fecha de recepción. Un hemograma recibido antes de la última visita
  pero cargado después no se marca. Si Olga tiene esa fecha en otra columna, se cambia ahí.

### 5.4 Resumen de hallazgos
`hallazgos(informe): { animal, prueba, valor, rango }[]`, función pura en `informe.ts` + test.
Toma las líneas con `fuera`. Para los rodeos, `prueba` = "Leptospirosis · Hardjo" (sección ·
prueba). El título dice "1 valor fuera de rango" o "8 valores fuera de rango en 7 animales". Sin
hallazgos, se muestra `.todo-ok` con "Todos los valores dentro del rango de referencia".
**Solo resume lo que el laboratorio marcó con `DENTRO='N'`.** No interpreta: un "79% - POSITIVO"
con `DENTRO='S'` **no** entra (ver §7).

### 5.5 "Solo animales con hallazgos" (rodeos)
`?hallazgos=1` en la URL del informe. El interruptor es un enlace
(`<a class="interruptor" role="switch" aria-checked>`), así que funciona sin JS. Se filtran las
filas de la matriz; el resumen y los conteos quedan completos.

### 5.6 Compartir por WhatsApp
- **Mínimo (sin JS):** `<a class="boton-borde" href="https://wa.me/?text=…">`. El texto es
  `Resultados CEDIVEP · Ref. 260724/5 · SHAKIRA (BIOMETRIA HEMATICA)`, un salto de línea y la URL
  del informe.
- **El mensaje no lleva valores ni hallazgos**, solo la referencia, el animal y el análisis: el
  chat queda en el teléfono de terceros.
- El enlace **sigue pidiendo ingreso**. Quien lo abra sin sesión va a `/` y, después de entrar,
  debería volver al informe: agregá `?volver=` validado (solo rutas internas que empiecen con
  `/pedidos/`).
- **Opcional:** la hoja con vista previa del mensaje, "Abrir WhatsApp" y "Copiar enlace" (captura
  14) con `<dialog class="hoja">` en un componente cliente. Debajo del mensaje va la aclaración:
  "Para verlo hay que ingresar con el celular o el correo de tu clínica. El informe no queda
  público."

### 5.7 Reenviar código
"Reenviar código" es un `<form method="POST" action="/api/ingresar">` con el contacto en un campo
oculto (sale de la cookie `cedivep_paso`, no del cliente). Le aplican los **mismos límites**: al 4.º
código en 15 minutos responde 429, con el mensaje de `server.ts`.

### 5.8 Ficha común del rodeo
`fichaComun(informe)`: los campos de la ficha (raza, sexo, edad, especie, pelaje) que tienen **el
mismo valor no vacío en todos los animales**. Función pura + test.

### 5.9 Datos de demo
El rodeo del fixture (`260722/219`) tiene 4 vacas, y los tests de punta a punta cuentan con eso.
**No lo cambies.** Para probar la matriz con volumen, agregá **otro** pedido de la clínica 2646
con ~50 animales y las mismas 4 pruebas (como en `prototipo/portal-datos.js`, función `rodeo()`).

---

## 6. Textos

- Español rioplatense, con voseo.
- Los mensajes de error de `server.ts` **no se tocan**: son iguales exista o no el contacto.
- Los textos nuevos están en §4 y §5. Los de vacíos y avisos, tal cual como están escritos ahí.

---

## 7. Preguntas abiertas (dejalas configurables y avisale a Luis)

1. **Logo oficial** en SVG o PNG grande.
2. **Positivos sin marcar.** IBR/DVB "POSITIVO" vienen con `DENTRO='S'`, así que no se
   resaltan ni entran en el resumen. ¿El laboratorio quiere destacarlos? Es para Olga; no lo
   decidas en el código.
3. **"Nuevo"** se aproxima con la fecha de recepción (§5.3). ¿Hay una fecha de carga?
4. **Datos de contacto** del ingreso y el pie: confirmar teléfono, correo y horario.
5. **Imprimir con el filtro de hallazgos activo:** ¿completo o filtrado? (§4.6)

---

## 8. Terminado cuando (reemplaza al "Terminado cuando" del paso 4)

- [ ] Las pantallas se ven como `diseno/capturas/` y el prototipo v2, en escritorio y celular (390 px).
- [ ] Se cumplen los 4 arreglos: una tabla por animal, el rodeo como matriz con la primera columna
      fija, la clínica en la subbarra del celular y el placeholder corto.
- [ ] Funcionan filtro, agrupado, "nuevo", resumen, "solo con hallazgos", compartir y reenviar,
      **todo sin JS** salvo las 6 casillas, imprimir y la hoja opcional.
- [ ] Tests nuevos en verde para `hallazgos`, `fichaComun`, `agruparPorFecha` y el cálculo de "nuevo".
- [ ] Tests de punta a punta: `?estado=`, `?hallazgos=1`, `?volver=` (rechaza URLs externas) y
      reenvío con 429 al 4.º.
- [ ] Nada de `dangerouslySetInnerHTML`. Las páginas autenticadas siguen con
      `Cache-Control: private, no-store`.
- [ ] Imprimir un informe de 1 animal y el rodeo de 50 da un A4 limpio.
