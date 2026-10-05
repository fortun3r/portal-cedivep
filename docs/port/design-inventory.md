> Working notes from the planning session (2026-10-05). Where they differ, the plan and CLAUDE.md win. Identifiers here are often the Spanish reference names; the code uses the English glossary.

A. SCREEN-BY-SCREEN INVENTORY (Server Components; class names exactly as in estilos.css)

Source keys:
- [D§x] = diseno/DISENO.md section
- [C:n] = diseno/estilos.css line
- [P] = "Portal CEDIVEP v2.dc.html"
- [PD:n] = portal-datos.js line
- [S:n] = _referencia/src/server.ts line
- [R:n] = render.ts line
- [I] = informe.ts
- [F] = seed/fixture.ts
- [T] = test/portal.test.ts
- [K nn] = diseno/capturas/nn-*.jpg
- [B] = VERIFIED by rendering the real estilos.css in Chrome (390x844 mobile and 1200x800) with markup written as in this report. This was done in an in-memory document; no files were written.

General rule [D§1]: do not copy the prototype markup, which uses inline styles. Implement estilos.css plus the classes below. Wherever a text differs between DISENO.md and the prototype, it is noted. server.ts error strings are always verbatim [D§6, HANDOFF §6 paso 3].

A0. Shell (all pages)
- `<html lang="es" className={texto.variable + mono.variable}>`. next/font: Archivo with weights 400/500/600/700/800 as `--f-texto`; IBM_Plex_Mono with weights 500/600 as `--f-mono` [D§3, VERIFIED]. estilos.css `:root` also defines `--f-texto`/`--f-mono` with fallback stacks [C:27-28]. The next/font class on `<html>` overrides them, so keep `:root`'s values only as a fallback.
- The reference adds `<meta name="robots" content="noindex, nofollow">`. Its titles are "Ingresar", "Código de ingreso", "Elegir clínica", "Mis pedidos", "Referencia {ref}", "Aviso", each followed by " · CEDIVEP S.R.L." [R:22-36]. DISENO.md says nothing about titles. INFERRED: keep them.
- Marca (text logo until the official SVG arrives, [D§3]): `a.marca > span.marca-nombre "CEDIVEP" + span.marca-srl "S.R.L."`. config.lab.nombre is "CEDIVEP S.R.L." [config.ts], so split it or hardcode it.

A1. Ingreso "/" [D§4.1, K01, K02]

```
main.acceso
  aside.acceso-panel
    div
      a.marca (DISENO.md shows it with no href) > span.marca-nombre "CEDIVEP" + span.marca-srl "S.R.L."
      div.marca-raya
    div
      div.sobretitulo "Portal para clínicas"
      h2 "Resultados de <strong>análisis</strong>"
      p.acceso-lema "Centro de Diagnóstico Veterinario del Paraguay. Primer laboratorio privado de diagnóstico veterinario del país, desde 1989."
    div.acceso-habilitacion "Habilitación N° 114-SENACSA"
  div.acceso-cuerpo
    form.acceso-form[method=POST action=/api/ingresar autocomplete=on]
      h1.titulo "Ingresá con tu <strong>clínica</strong>"
      p.ayuda "Escribí el celular o el correo que tu clínica tiene registrado en el laboratorio. Te mandamos un código de 6 dígitos para entrar, sin contraseña."
      label.etiqueta[for=contacto] "Celular o correo"
      input#contacto.campo[name=contacto type=text required autofocus value={entrada} inputmode=email autocomplete=username spellcheck=false autocapitalize=off placeholder="0981 123 456"]
      p.error[role=alert] {msg}        (only on error; placed between the input and the button, per [P] and [R])
      button.boton[type=submit] "Recibir código"    (the arrow comes from CSS ::after [C:91])
      div.acceso-contacto
        "¿Tu clínica no tiene un celular o correo registrado? Llamá al <strong>(021) 584 085</strong> o escribí a <a href="mailto:info.cedivep@cedivep.com.py">info.cedivep@cedivep.com.py</a>."
        div.acceso-horario "Lunes a viernes 7:00–18:00 · Sábado 7:00–12:00"
```

- Input attributes are the same as the reference [R:70-72, D§4.1].
- On mobile (≤640) `.acceso-lema` and `.acceso-habilitacion` are hidden [C:304], and the panel is compact with a 30px h2. [K01] matches this.
- `.acceso-contacto` must stay inside the form. `.acceso-cuerpo` is a flex row with centered items, so a sibling would render side by side. INFERRED from [C:70]; the prototype also has it inside the form.
- Errors, verbatim [S:104-111]:
  - 400: "No reconocemos ese formato. Escribí un celular (0981 123 456) o un correo."
  - 429: "Pediste demasiados códigos. Esperá unos minutos y probá de nuevo."
  - The input is re-filled with what the user typed.
- The old "Enter" kbd hint and the old texts "Resultados para clínicas" / "Comunicate con el laboratorio" are dropped [R vs P].

A2. Verificar "/verificar" [D§4.1, K03, K04]

```
main.acceso  (same aside as A1)
  div.acceso-cuerpo
    div.acceso-form                      (see C1 for why this is a div and not the form)
      a.acceso-volver[href="/"] "← Usar otro celular o correo"
      h1.titulo "Ingresá el <strong>código</strong>"
      p.ayuda "Si <strong>{destino}</strong> está registrado en el laboratorio, te mandamos un código de 6 dígitos. Vence en 10 minutos."
      div.demo[role=note]  (demo only)
        span "Modo demostración — no se envían mensajes."
        strong "185 186"
      form[method=POST action=/api/verificar autocomplete=off]
        label.etiqueta[for=codigo] "Código"
        div.codigo  (client component; see C1)
        p.error[role=alert]
        button.boton[type=submit] "Entrar"
      form.secundario[method=POST action=/api/ingresar]
        "¿No te llegó? " + input[type=hidden name=contacto] + button[type=submit] "Reenviar código"
```

- Help text: the prototype says "te mandamos" [P]; the reference said "te enviamos" [R:88]. Use the prototype's. The minutes value comes from config.auth.codigoMinutos=10.
- `{destino}`:
  - Phone: "el celular terminado en 001" [S:133-136, P].
  - Email: server.ts shows the raw email with no prefix. The prototype masks it as "el correo t•••@ejemplo.com.py" [PD:27-31]. [D§4.1] says "destino enmascarado", so use the prototype's format (decision INFERRED).
- `.demo` is shown when `paso.demo` exists: on GET, and on the 'incorrecto' error, but not on 'vencido' [S:142,156]. The text "Tu código es" from the old reference is dropped. The code is shown split as `${c.slice(0,3)} ${c.slice(3)}` [PD:285]. On mobile the code wraps under the text [K03, B].
- Errors, verbatim [S:151-153]:
  - "El código no es correcto. Revisalo y probá de nuevo."
  - "El código venció o ya no es válido. Pedí uno nuevo."
- The prototype shows a toast "Te mandamos un código nuevo." after Reenviar [PD:302]. No CSS exists for it and DISENO.md doesn't ask for it, so drop it (INFERRED).

A3. Elegir "/elegir" [D§4.1, K05]

```
main.acceso  (same aside)
  div.acceso-cuerpo
    div.acceso-form
      h1.titulo "¿Con qué <strong>clínica</strong> querés entrar?"
      p.ayuda "Tu contacto está registrado en más de una clínica. Podés cambiar después desde la barra."
      form.lista-clinicas[method=POST action=/api/elegir]
        button.clinica-opcion[type=submit name=clinica value=424 autofocus(first only, as in R)]
          span.clinica-opcion-texto
            span.clinica-opcion-nombre "VETERINARIA SAN ROQUE"
            span.clinica-opcion-cod "Cód. 424"
        (the red arrow comes from ::after [C:130])
```

- `.clinica-opcion-texto` and `.lista-clinicas` exist in the CSS but not in DISENO.md (see B2).
- POST error 403, verbatim [S:177]: "Esa clínica no está asociada a tu contacto." The back link goes to /elegir.

A4. Barra and subbarra (every authenticated page) [D§4.2]

```
header.barra
  div.barra-fila
    a.marca[href=/pedidos] > span.marca-nombre "CEDIVEP" + span.marca-srl "S.R.L."
    span.barra-acciones
      span.barra-clinica
        span.barra-clinica-nombre "CLÍNICA TACUARY"
        span.barra-clinica-cod "Cód. 2646"
      a.barra-cambiar[href=/elegir] "Cambiar"          (only if habilitadas.length > 1)
      form[method=POST action=/api/salir] > button.barra-salir[type=submit] "Salir"
div.subbarra   (visible only ≤640 [C:148,309])
  name + "Cód. 2646"   (see the bug below)
  a[href=/elegir] "Cambiar"    (only if several clínicas)
```

- The barra is sticky. The subbarra scrolls away; the prototype does the same.
- On mobile `.barra-clinica` and `.barra-cambiar` are hidden [C:308].
- "Imprimir / PDF" no longer lives in the barra [D§4.2].
- BUG, VERIFIED [B]: DISENO.md's subbarra markup nests `.barra-clinica-cod` inside `.barra-clinica-nombre`. Rendered, that gives one line, glued, uppercased: "VETERINARIA SAN ROQUECÓD. 424". The cod inherits uppercase and .06em letter-spacing, and nowrap keeps it on the name's line. The prototype and [K06]/[K08] show two lines: the name, then "Cód. 2646" in gray mono 11px with no uppercase. Fix: in the subbarra, make the cod a block-level sibling, e.g. `span(flex:1;min-width:0) > span.barra-clinica-nombre + span.barra-clinica-cod`. The CSS also needs `.subbarra .barra-clinica-cod{display:block;text-transform:none;letter-spacing:0}`, and `.subbarra .barra-clinica-nombre` must not carry `flex:1` once it has a wrapper.

A5. Pedidos "/pedidos?q=&estado=" [D§4.3, D§5.1-5.3, K06-K08]

```
(barra + subbarra)
main.contenedor
  div.pagina-cab
    h1.titulo "Tus <strong>pedidos</strong>"        (40px desktop, 30px mobile [C:153,315])
    div.pagina-meta
      span "Resultados en línea del 22/07 al 24/07/2026"
      span.pagina-nuevos  (only if nuevos > 0)
        span.punto.punto--marca
        "2 pedidos nuevos desde tu última visita"
  (only when the clinic has at least one pedido, before search; [P] tieneTotal, [K08] confirms it is hidden otherwise:)
  form.buscar[method=GET action=/pedidos role=search]
    label.oculto[for=q] "Buscar"
    input#q.campo[type=search name=q value={q} placeholder="Buscar animal, caravana o análisis"]
    (if q) a.buscar-limpiar[href=/pedidos aria-label="Borrar búsqueda"] "×"
    (if a filter is active, INFERRED) input[type=hidden name=estado]
  nav.filtros[aria-label=...]
    a.filtro[href][aria-current="true" on the active one] "Todos " span.filtro-n "5"
    … "Disponibles" / "En proceso" / "No en línea"
  then one of: div.grupos | div.vacio
```

Pagina-meta texts:
- "Resultados en línea del 22/07 al 24/07/2026". `desde` is dd/mm only and `hasta` is dd/mm/yyyy [PD:322]. If there is no ventana, hide it (INFERRED).
- `nuevosTxt` is "1 pedido nuevo" or "N pedidos nuevos", followed by " desde tu última visita" [PD:324].
- The count is taken over ALL the clinic's pedidos, not the searched list [PD:221].

Search:
- No search button; Enter submits [D§4.3].
- The reference's autofocus is absent in the prototype. INFERRED: drop it, because on mobile it would pop the keyboard.

Filters:
- Labels and order come from the prototype only; DISENO.md lists no labels [PD:218]: Todos | Disponibles | En proceso | No en línea.
- hrefs: `/pedidos?q=…` for Todos, otherwise `/pedidos?estado=disponible|en_proceso|fuera_de_ventana&q=…`.
- Counts are computed after the search [D§5.1].
- An unknown estado means "todos".

Groups:

```
div.grupos
  section.grupo
    h2.grupo-titulo "Viernes 24 de julio" + span.grupo-fecha "24/07/2026"   (CSS uppercases the text and draws the rule via ::after with order:1; .grupo-fecha has order:2 [C:182-184])
    ul.pedidos
      li > a.pedido | div.pedido.pedido--inactivo
```

Available pedido:

```
li > a.pedido[href=/pedidos/2026-07-24/5]
  div.pedido-cuerpo
    div.pedido-cab
      span.ref "260724/  5"
      span.etiqueta-nuevo "NUEVO"        (only if nuevo)
      span.estado.estado--ok > span.punto.punto--ok + "Resultados disponibles"
    div.pedido-animales "154983, 151667, 126" + span.pedido-mas "y 47 más"   (pedido-mas only if > 3)
    div.pedido-analisis "LEPTOSPIROSIS · INFORME DE BRUCELOSIS · IBR (ELISA) · DVB (ELISA)"
    span.marcador "▲ 1 valor fuera de rango" | "▲ 8 valores fuera de rango"   (only if fueraDeRango > 0)
  (the red arrow comes from a.pedido::after [C:189])
```

- The `.ref` has white-space:pre, so the padded spaces in "260728/ 40" are kept [C:193].
- `.pedido` goes on the a/div inside the li, not on the li, because `.pedido` is the flex container [C:187]. INFERRED.

En proceso:

```
li > div.pedido.pedido--inactivo
  div.pedido-cab
    span.ref
    span.etiqueta-urgente "URGENTE"
    span.estado.estado--proceso > span.punto.punto--proceso + "En proceso"
  div.pedido-entrega "Entrega prevista: 31/07/2026"    (only if fechaEntrega)
```

Fuera de ventana:

```
li > div.pedido.pedido--inactivo
  div.pedido-cab
    span.ref
    span.estado > span.punto + "No disponible en línea"     (plain .punto is gray [C:156])
  div.pedido-nota "Es anterior a los resultados en línea. Pedí el informe al laboratorio."
```

- NUEVO and URGENTE are literal uppercase text. `.etiqueta-*` has no text-transform [C:195-196, VERIFIED].

Empty states (`div.vacio`, with children `strong` + `p` + `a.boton-borde`; CSS styles `.vacio strong` / `.vacio p` / `.vacio .boton-borde` [C:208-215]):
- Search with no results (q present and the clinic has pedidos):
  - strong "Ningún pedido coincide con “{q}”" (typographic quotes U+201C/U+201D)
  - p "La búsqueda mira el nombre o la caravana del animal, el análisis y la referencia del pedido."
  - a.boton-borde[href=/pedidos] "Ver todos los pedidos"
- Filter with no results (no q):
  - strong "No hay pedidos {filtroTxt}", where filtroTxt is "con resultados disponibles", "en proceso", or "fuera de la ventana en línea" [PD:329]. DISENO.md gives only "No hay pedidos en proceso".
  - The same button, with no p.
- Clinic with no pedidos (total = 0):
  - strong "Todavía no hay pedidos de tu clínica en el portal"
  - p "Los resultados aparecen acá apenas el laboratorio los carga. ¿Esperabas ver alguno? Llamá al <strong>(021) 584 085</strong>."
  - No button, no search, no filters [P, K08].
- Precedence in the prototype: búsqueda if (empty and q and total>0); else filtro if (empty and no q and total>0); else clínica if total==0 [PD:325-327].

A6. Informe of one animal "/pedidos/[fecha]/[nro]" [D§4.4, K09, K10; bottom of page verified in the live prototype]

```
main  (no class)
  div.informe-acciones
    a[href=/pedidos] "← Tus pedidos"       (the reference said "← Todos los pedidos")
    div.informe-acciones-botones
      a.boton-borde[href=https://wa.me/?text=…] "Compartir por WhatsApp"
      button.boton-chico[type=button] "Imprimir / PDF"     (client component calling window.print())
  article.informe
    header.informe-cab
      div
        div.marca > span.marca-nombre "CEDIVEP" + span.marca-srl "S.R.L."    (not a link)
        div.informe-sub "Centro de Diagnóstico Veterinario del Paraguay"
      div.sello
        div.sello-etiqueta "Referencia"
        div.sello-ref "260724/  5"      (white-space:pre)
        div.sello-habilitacion "Habilitación N° 114-SENACSA"
    dl.datos
      div > dt "Clínica" + dd "CLÍNICA TACUARY"
      div > dt "Recepción" + dd "24/07/2026"
      [div > dt "Animales" + dd "50"]          (only if animales.length > 1)
      div > dt "Consultado" + dd {today, dd/mm/yyyy}
    section.resumen | div.todo-ok     (see A9)
    section.animal
      dl.ficha > div > dt "Identificación" + dd "SHAKIRA" … then Especie, Raza, Sexo, Edad, Pelaje
      table.resultados
        thead > tr > th[scope=col] "Prueba" | "Resultado" | "Rango de referencia"
        tbody
          tr > th.seccion[colspan=3 scope=colgroup] "BIOMETRIA HEMATICA"
          tr > td "Hemoglobina"
               td.valor "11,6 g/dL"
               td.rango > span.rango-etiqueta "REF." + "10,0 - 18,0 g/dL"
          tr > td "R.D.W."
               td.valor > span.marcador "▲ 22,5 %"
               td.rango …
          tr > td "Neutrofilos segmentados"
               td.valor "62 %" + span.relativo "4.650 /mm3"
               td.rango "58 - 78 %"
      div.notas > span "Material: SANGRE" + span "Método utilizado: SGC-PROTEC-HS-01"
    p.leyenda      (only if there are hallazgos; see A10)
    footer.pie-informe
```

- Labels are uppercased by CSS.
- The habilitación line has no colon after N°; the reference had one [R:248].
- In `dl.ficha`, the order matches the reference: Identificación, Especie, Raza, Sexo, Edad, Pelaje. Empty and filler values ('', '0', 'SIN PELAJE', 'SS', 'S/D') are omitted, so "Especie: —" never appears [R:194-197, D§4.4].
- The first cell of each result row must stay a `td`, not a `th`. The mobile rules target `td:first-child` [C:323]. VERIFIED.
- valor is valor + " " + unidad, or "—" if empty [R:202].
- `td.rango` is white-space:pre-line, because REFERENCIA carries \n.
- `.notas` contains the deduplicated Material/método lines (A7 explains the dedup).
- Mobile, VERIFIED [B]: the thead is hidden. Each row is two lines: the prueba plus a right-aligned value (150px box), then "REF." plus the rango. A relativo adds a line inside the value cell. The section row also picks up the 1px row border and 7px padding (see B3).

A7. Informe of a rodeo as a matrix (when `matrizRodeo()` is non-null) [D§4.4, K11-K13; matrix verified in the live prototype]

Datos and resumen are as in A6, with ANIMALES present. Then:

```
section.animal
  div.matriz-cab
    dl.ficha  (ficha común: only fields that are equal and non-empty in all animals, e.g. Raza NELORE, Sexo Hembra, Edad 2.00 Años)
    a.interruptor[role=switch aria-checked="false"|"true" href="?hallazgos=1" | href="/pedidos/2026-07-22/219"] "Solo animales con hallazgos (7)"
  div.matriz-scroll
    table.matriz
      thead
        tr (row 1, groups):
          th (empty corner)
          th.grupo-col[colspan=3 scope=colgroup] "LEPTOSPIROSIS"
          th (empty)  th (empty)  th (empty)
        tr (row 2, tests):
          th[scope=col] "Animal"
          th[scope=col] "Grippotyphosa" + span.col-rango "ref. Negativo"
          …
          th[scope=col] "INFORME DE BRUCELOSIS"
          th "IBR (ELISA)"
          th "DVB (ELISA)"
      tbody
        tr > th[scope=row] "154983" + td "Negativo" … + td > span.marcador "▲ 1/400"
  div.matriz-pie
    span "50 animales" | "7 de 50 animales"
    span.matriz-desliza "Deslizá la tabla para ver todas las pruebas →"   (visible only on mobile)
  div.notas
```

- Switch text: the prototype renders "( 7 )" with spaces, which is a templating artifact; DISENO.md says "(7)". It counts animals with at least one hallazgo, always over the full rodeo.
- Header row 1 rules: render the empty corner and empty cells as `th`, not `td`, because only `thead th` gets the background [C:273].
- Header row 2 rules:
  - "Animal" must be the first child of the last row so it gets the sticky style and the bottom border [C:274, 278-282].
  - Only `thead tr:last-child th` gets the 1.5px bottom border, so don't use rowspan.
- Body rows: `th[scope=row]` is the caravana, in mono and sticky left. Sticky behavior was VERIFIED [B] after a 200px horizontal scroll.
- Row filter: with `?hallazgos=1`, only rows that have at least one out-of-range cell are shown; the resumen and counts stay complete [D§5.5].
- Notas: the dedup of [I] analisis material/metodo gives "Material: SANGRE", "OBSERVACION: SGC-PROTEC-M-04 Microaglutinación", "METODO LABORATORIAL: ELISA". The prototype instead shows hand-written per-analysis prefixes (see E).

A8. Per-animal fallback (`matrizRodeo()` returns null) [D§4.4]
- This applies when there are fewer than 4 animals (RODEO_DESDE=4 [I]) or when the animals have different tests. So it covers EVERY 2–3-animal pedido, not just mixed rodeos.
- Structure: `nav` index, then one `section.animal#animal-{orden}` per animal: an h2 title (identificación, plus "▲ n" if it has hallazgos), its own `dl.ficha`, a `table.resultados`, and `.notas`.
- The reference: the index shows only when there are more than 3 animals, as `nav.indice.no-print[aria-label=Animales]` with `strong` "{n} animales:" and links (`.con-alerta` when hallazgos). The title is `h2.animal-titulo` with `span.chip.alerta` "▲ n", shown when there is more than one animal [R:218-232].
- None of `.indice`, `.animal-titulo`, `.chip`, `.con-alerta` exist in estilos.css (B1). They must be added; there is no design for them (E).

A9. Resumen de hallazgos / todo-ok [D§5.4]

```
section.resumen
  div.resumen-cab
    h2 "Resumen de hallazgos"
    p {título}
  ul
    li
      span.resumen-animal "151667"      (only when animales.length > 1; the prototype hides it for a single animal)
      span.resumen-prueba "LEPTOSPIROSIS · Hardjo"
      span.marcador "▲ 1/400"
      span.resumen-rango "ref. Negativo"   (only if rango is non-empty)
```

- Title: "{n} valor|valores fuera de rango", plus " en {k} animales" only when k > 1 [PD:250-251]. Examples:
  - SHAKIRA: "1 valor fuera de rango"
  - 4-cow 219: "1 valor fuera de rango"
  - 50-cow: "8 valores fuera de rango en 7 animales"
- Order: the animal order, then the column order.
- With no hallazgos: `div.todo-ok > span.punto.punto--ok + "Todos los valores dentro del rango de referencia"`. In the fixture, only LOLA (clinic 424) shows it.

A10. Leyenda and pie
- `p.leyenda > span.marcador "▲ valor" + " fuera del rango de referencia."`, only if there are hallazgos. The old text was "▲ Los valores en negrita se encuentran fuera del rango de referencia."
- `footer.pie-informe`:
  - span "Consulta en línea de un resultado emitido por CEDIVEP S.R.L. No reemplaza al informe firmado."
  - span "(021) 584 085 · info.cedivep@cedivep.com.py"

A11. 404 / aviso [D§4.5, K16]

```
(barra + subbarra)
main.aviso
  h1.titulo "No encontramos ese <strong>pedido</strong>"
  p "No encontramos ese pedido entre los de tu clínica. Si el enlace te lo pasó otra clínica, cada una ve solo sus propios pedidos."
  a.boton.boton--auto[href=/pedidos] "Ver tus pedidos"   (arrow via ::after)
```

- Status 404, with no distinction between a missing pedido and another clinic's pedido.
- INFERRED: put this in a segment-level not-found.tsx under `pedidos/[fecha]/[nro]`, so the page-not-found copy stays separate.
- Other errors use the same `.aviso` with their message, verbatim [S:208,222,225,177]:
  - "Esa página no existe."
  - "Ocurrió un error inesperado. Intentá de nuevo."
  - "Esa clínica no está asociada a tu contacto."
  - Their h1 and button text are NOT specified (E).

A12. Error 500
- Same `.aviso`.
- INFERRED (Next behavior, not checked against the docs in this session): error.tsx must be a Client Component, so it can't read the session to render the barra with the clinic name. Decide: no barra, or a barra without the clinic (E).

A13. Print [D§4.6, K15]
- Production has no "Vista de impresión" bar. That bar, with "Vista de impresión · A4", "Imprimir", "Cerrar", exists only in the prototype.
- `@media print` hides `.barra`, `.subbarra`, `.informe-acciones`, `.interruptor`, `.matriz-desliza`, `.no-print`.
- `.informe` gets no border or padding. The matrix overflow and sticky are switched off. The marcador prints its color.
- `.resumen` and `.animal` get break-inside:avoid-page; tr gets avoid. The thead repeats. `@page` is A4 with 18mm/16mm margins [C:334-346].

A14. Optional sheet `<dialog class="hoja">` [D§5.6, K14]

```
dialog.hoja[aria-label="Compartir por WhatsApp"]
  header row: strong "Compartir por <strong>WhatsApp</strong>"  (uppercase, 400/800)
              + button[aria-label=Cerrar] "×"
  div.hoja-mensaje
    "Resultados CEDIVEP · Ref. 260724/5 · SHAKIRA (BIOMETRIA HEMATICA)"
    span.hoja-enlace "resultados.cedivep.com.py/pedidos/2026-07-24/5"
  p "Para verlo hay que ingresar con el celular o el correo de tu clínica. El informe no queda público."
  actions:
    a "Abrir WhatsApp"   (primary, red)
    button "Copiar enlace"   (bordered)
```

- On mobile it is a bottom sheet [C:330].
- The header row, close button, note, actions row and the 14px gap have NO classes in the CSS (B1).
- The prototype toasts "Enlace copiado." / "Se abriría WhatsApp con el mensaje listo." are prototype-only.

B. CSS CLASS SELECTORS IN estilos.css (VERIFIED by extracting them from the file)

Full list:
acceso, acceso-panel, acceso-lema, acceso-habilitacion, acceso-cuerpo, acceso-form, acceso-volver, acceso-contacto, acceso-horario, animal, aviso, ayuda, barra, barra-fila, barra-acciones, barra-clinica, barra-clinica-nombre, barra-clinica-cod, barra-cambiar, barra-salir, boton, boton--auto, boton-chico, boton-borde, buscar, buscar-limpiar, campo, casilla, clinica-opcion, clinica-opcion-texto, clinica-opcion-nombre, clinica-opcion-cod, codigo, codigo--mejorado, codigo-input, codigo-casillas, col-rango, contenedor, datos, demo, error, estado, estado--ok, estado--proceso, etiqueta, etiqueta-nuevo, etiqueta-urgente, ficha, filtro, filtro-n, filtros, grupo, grupo-col, grupo-fecha, grupo-titulo, grupos, hoja, hoja-mensaje, hoja-enlace, informe, informe-acciones, informe-acciones-botones, informe-cab, informe-sub, interruptor, leyenda, lista-clinicas, marca, marca-nombre, marca-srl, marca-raya, marcador, matriz, matriz-cab, matriz-scroll, matriz-pie, matriz-desliza, mono, no-print, notas, oculto, pagina-cab, pagina-meta, pagina-nuevos, pedido, pedido--inactivo, pedido-cuerpo, pedido-cab, pedido-animales, pedido-mas, pedido-analisis, pedido-entrega, pedido-nota, pedidos, pie-informe, punto, punto--marca, punto--ok, punto--proceso, rango (td.rango), rango-etiqueta, ref, relativo, resultados, resumen, resumen-cab, resumen-animal, resumen-prueba, resumen-rango, seccion, secundario, sello, sello-etiqueta, sello-ref, sello-habilitacion, sobretitulo, subbarra, titulo, todo-ok, vacio, valor.

The CSS also styles bare elements and attributes: `.ficha div/dt/dd`, `.datos dt/dd`, `.resumen-cab h2/p`, `.resumen ul/li`, `.aviso p`, `.vacio strong/p`, `.secundario button`, `.acceso-panel h2`, `.informe-acciones > a`, `.casilla[data-activa]`, `.filtro[aria-current="true"]`, `.interruptor[aria-checked="true"]`, `table.matriz th[scope=row]`, `thead th:first-child`.

B1. Implied by DISENO.md, the reference or the prototype, but MISSING from estilos.css
- Per-animal fallback title and index: `.animal-titulo`, `.indice`, `.con-alerta`, `.chip`. DISENO.md asks for "título" and "índice" with no classes.
- Internals of the hoja: header, title, close button, note, actions; the dialog also has no flex/gap.
- A toast or confirmation (prototype only).
- An optional "printing is filtered" notice [D§4.6].
- An "informe without results" state. The reference used `.vacio`, which works.
- Nothing listed in DISENO.md is missing from the CSS. Every class DISENO.md names exists.

B2. In estilos.css but NOT named in DISENO.md (and how the prototype uses them)

| Class | Use |
|---|---|
| titulo | h1 on acceso/aviso/pedidos; the prototype's h1 is 30px / 40px |
| ayuda | help paragraphs |
| contenedor | pedidos `main` |
| mono | utility |
| oculto | visually hidden search label |
| lista-clinicas | form wrapping the clinic buttons |
| clinica-opcion-texto | span wrapping name + cod |
| codigo-casillas | grid wrapper for the 6 span.casilla |
| informe-sub | lab subtitle under the marca |
| informe-acciones-botones | wrapper for the 2 buttons |
| sello-etiqueta, sello-ref, sello-habilitacion | sello contents |
| resumen-cab, resumen-animal, resumen-prueba, resumen-rango | resumen header and rows |
| rango-etiqueta | "REF." span, mobile only |
| matriz-desliza | mobile-only hint |
| punto--proceso | blue dot |
| hoja-mensaje, hoja-enlace | WhatsApp bubble and link |
| no-print | print utility, not used by v2; useful for the fallback index |

B3. CSS that looks buggy or inconsistent with the captures and prototype

1. Subbarra cod glued to the name and uppercased. VERIFIED [B]. Details and fix in A4.

2. `.matriz-cab .ficha` keeps `.ficha`'s `margin:0 0 18px` [C:247]. VERIFIED [B] at 1200px:
   - matriz-cab is 66px tall (48 + 18) instead of 48.
   - The gap to the matrix is 30px instead of the prototype's 12px.
   - The ficha's center sits at 171 and the switch's at 179, an 8px misalignment.
   - Fix: `.matriz-cab .ficha{margin:0}`.

3. Mobile `table.resultados tr{border-bottom; padding:7px 0}` also hits the section rows. VERIFIED [B]: there is a rule under "BIOMETRIA HEMATICA", which the prototype doesn't have. Cosmetic.

4. A4 width. [D§4.6] says "688 px entran en A4". A4 minus 2×16mm is 178mm, about 673 CSS px, which is less than 688. Print sets `min-width:0`, so the fit depends on the content's min width. I measured about 679px with fixture-like values [B]. Borderline; check the print preview of the 50-cow rodeo. Whether Chrome shrinks to fit is UNVERIFIED.

5. `.animal{break-inside:avoid-page}` on a section of about 50 rows can push the whole matrix to page 2 and leave page 1 half empty, or be ignored. This depends on the browser and is UNVERIFIED. Consider limiting it to `.resumen` and `tr`.

6. Focus is invisible on dark surfaces. `:focus-visible` draws a 2px #161616 outline [C:40] on the #161616 barra and acceso panel (Salir, marca, Cambiar). VERIFIED by reading the CSS. Add `.barra :focus-visible, .acceso-panel :focus-visible{outline-color:#fff}`.

7. `td.valor` and `table.matriz td` use white-space:nowrap. A long text RESULTADO (free-text comments) would overflow on mobile. PLAUSIBLE; depends on real data, UNVERIFIED.

8. `content:"→"` in `.boton`, `.clinica-opcion` and `a.pedido` [C:91,130,189] has no `@charset`:
   - VERIFIED [B]: when the stylesheet was decoded as non-UTF-8 it rendered as "â†'". Low risk in Next, where the document is UTF-8. Safer: `content:"\2192"`.
   - Screen readers may also announce the arrow. `content:"→" / ""` avoids that.

9. `.boton` keeps `margin-top:16px` inside `.aviso` [C:86]. That gives 24 + 16 = 40px under the paragraph versus 24px in the prototype. Cosmetic.

10. `.ayuda` margin-bottom is 26px for every screen. The prototype uses 22px on código and 24px on elegir. Cosmetic.

11. CSS that is correct: VERIFIED [B] at 390px. No horizontal overflow on acceso or the informe. The `.filtros` row scrolls horizontally (452 vs 358) as in the prototype. Mobile result rows are two lines as DISENO.md describes. The sticky first column works. The 6 casillas fit (346px) under the transparent input.

12. Captures 02, 04, 06, 09-13 (mobile) show a clipped "Salir", cut content and a horizontal scrollbar. INFERRED: an artifact of the prototype frame's classic scrollbar plus a non-border-box span (prueba is 140px plus padding). [B] at a real 390px has no overflow. Don't replicate it.

C. MARKUP DETAILS THAT MATTER

C1. Código input (progressive enhancement) [D§4.1, C:111-122]

```
div.codigo
  input#codigo.codigo-input[name=codigo type=text inputmode=numeric autocomplete=one-time-code required autofocus maxlength=7 pattern="[0-9 ]{6,7}" placeholder="000000" aria-label?]
  div.codigo-casillas[aria-hidden=true] > span.casilla × 6
```

- Reference attributes are from [R:95-97]; the prototype uses maxlength 6 and aria-label "Código de 6 dígitos".
- Without JS: the casillas are display:none and the input is big, centered mono with .5em letter-spacing.
- With JS: the client component adds `codigo--mejorado` after mount (useEffect). The input becomes absolute, inset 0, opacity 0, 16px font (avoids iOS zoom).
  - Each casilla shows a digit from `value.replace(/\D/g,'')`; strip the space SMS autofill can insert in "185 186".
  - `data-activa` goes on casilla index `min(len,5)` while the input is focused [PD:288].
- Layout (INFERRED, checked [B]): the verificar page's `.acceso-form` should be a `div` holding the back link, heading, help, demo, the main `<form>` and a second sibling `<form class="secundario">` for Reenviar. Forms can't nest. `.acceso-volver` needs a flex-column parent for align-self, and `.acceso-cuerpo` is a flex row, so a sibling form outside `.acceso-form` would sit side by side.
  - Alternative, VERIFIED working [B]: keep `form.acceso-form` and use `<p class="secundario">¿No te llegó? <button form="reenviar">Reenviar código</button></p>` with `<form id="reenviar" hidden …>` outside it.

C2. Demo block
- `div.demo[role=note] > span "Modo demostración — no se envían mensajes." + strong "185 186"`.
- `.demo strong` is mono 17px with .14em letter-spacing [C:107].
- The demo code is 185186 in the prototype; in the real demo it is random per paso.

C3. Reenviar código [D§5.7]
- POST to /api/ingresar with `input[type=hidden name=contacto]`. The value comes from the `cedivep_paso` cookie on the server.
- INFERRED: render `clave.split(':')[1]` ('981000001' or 'x@y.com'), not 'tel:…'. Both forms go back through `claveDeContacto` correctly. A 429 answer renders the INGRESO page with that value pre-filled [S:110-111], so 'tel:981000001' would show in the input.
- Same limits apply: the 4th code in 15 minutes gets 429 with "Pediste demasiados códigos. Esperá unos minutos y probá de nuevo."

C4. WhatsApp link [D§5.6, PD:252-253]
- `href = "https://wa.me/?text=" + encodeURIComponent(msg + "\n" + url)`.
- msg = `Resultados CEDIVEP · Ref. ${referencia.replace(/\s/g,'')} · ${animales.length===1 ? identificacion : `${n} animales`} (${analysisNames.join(', ')})`. The list is joined with ", ", not " · ".
- Fixture results:
  - "Resultados CEDIVEP · Ref. 260724/5 · SHAKIRA (BIOMETRIA HEMATICA)"
  - "… Ref. 260724/2 · ROCKY (SEROLOGIA)"
  - "… Ref. 260722/219 · 4 animales (LEPTOSPIROSIS, INFORME DE BRUCELOSIS, IBR (ELISA), DVB (ELISA))"
- analysisNames = distinct `Analisis.nombre` across animals in print order.
- url = absolute `https://{PUBLIC host}/pedidos/2026-07-24/5`. The prototype displays "resultados.cedivep.com.py/…", which is a prototype assumption and UNVERIFIED.
- INFERRED: take the host from config, never the Host header. The URL carries no query (drop `?hallazgos`).
- No values and no hallazgos go in the message. The link still requires login. `?volver=` must accept only paths starting with `/pedidos/`.

C5. Interruptor
- It is a link, `a.interruptor[role=switch][aria-checked="true|false"]`. The CSS draws the toggle via ::before [C:268-270].
- Off: href = `?hallazgos=1`. On: href = the bare informe URL.
- Text: "Solo animales con hallazgos ({k})".
- Hidden in print.
- a11y note: a link activates with Enter, not Space. `role=switch` on `a[href]` is allowed by ARIA-in-HTML.

C6. Filtros
- `nav.filtros > a.filtro`, with `aria-current="true"` (the string "true", which the CSS matches [C:177]) on the active one.
- Each link holds the label text + " " + `span.filtro-n` with its count.
- Counts after search, using the prototype's values at baseline for 2646: Todos 5, Disponibles 3, En proceso 1, No en línea 1 (K06). With the extra rodeo from D they become 6/4/1/1.

C7. grupo-titulo
- DOM text "Viernes 24 de julio" (the CSS uppercases it) + `span.grupo-fecha` "24/07/2026".
- Days: Domingo Lunes Martes Miércoles Jueves Viernes Sábado. Months: enero…diciembre, lowercase. Format `${DIA} ${d} de ${mes}`, with no comma and no leading zero [PD:34-36].
- Build the weekday from 'YYYY-MM-DD' (Date.UTC + getUTCDay, or the prototype's `new Date(iso+'T12:00:00')`), never `new Date(iso)` [D§5.2].
- Don't use Intl 'es' either; it yields "viernes, 24 de julio".
- Fixture groups, VERIFIED by running PD: "Martes 28 de julio", "Viernes 24 de julio", "Miércoles 22 de julio", "Viernes 10 de julio".
- Order: date descending, then nro descending (the listarPedidos order).

C8. Resumen titles: "1 valor fuera de rango" and "8 valores fuera de rango en 7 animales". Row structure in A9. Values in the marcador include the unit ("▲ 22,5 %").

C9. ANIMALES in dl.datos
- Shown when `animales.length > 1` [D§4.4 "si >1", R:258]. The prototype uses tipo=rodeo instead.
- CONSULTADO is today's date as dd/mm/yyyy (the prototype hardcodes HOY=2026-10-05). The reference uses `new Date().toISOString()`, which is the UTC date; see E.

C10. Matriz thead rules
- The group row groups consecutive columns that share the same non-empty `seccion` into `th.grupo-col` with colspan=n. Columns with `seccion===''` (single-test analyses with no TITULO row: brucelosis/IBR/DVB) get an empty `th`.
- INFERRED: if no column has a seccion, omit the group row entirely.
- `.col-rango` "ref. {rango}" is rendered only when `matrizRodeo()` left a non-empty `rango`, meaning it is equal for all animals [I matrizRodeo].
- Cells show `valor + ' ' + unidad`.
- Header labels come from the data: "Grippotyphosa", "INFORME DE BRUCELOSIS". The prototype's "Brucelosis" and soft-hyphenated "Grippo­typhosa" (U+00AD, VERIFIED) are cosmetic.

C11. rango-etiqueta
- `<span class="rango-etiqueta">REF.</span>` first inside `td.rango`. Hidden on desktop; inline on mobile with a 6px right margin [C:262,326].
- With pre-line, don't put a literal newline between the span and the text in JSX output (JSX collapses it anyway).

C12. Barra details
- "Cambiar" (`.barra-cambiar` desktop; red `.subbarra a` mobile) only when there are several clinics.
- `.barra-clinica-cod` text is "Cód. 2646".

D. DEMO DATA FROM portal-datos.js (VERIFIED by running PD in Node, read-only)

Dates and constants:
- HOY 2026-10-05 (Consultado 05/10/2026)
- VENTANA 2026-07-22..2026-07-24, displayed as "Resultados en línea del 22/07 al 24/07/2026"
- ULTIMA_VISITA 2026-07-23, so NUEVO marks 260724/5 and 260724/2 and the meta reads "2 pedidos nuevos"
- DOMINIO resultados.cedivep.com.py
- CODIGO_DEMO 185186
- Contacts: 0981 000 001 maps to [2646]; 0981 000 002 maps to [424, 77] [PD:7-17]
- The fixture's ventana is MIN/MAX(FEC_PED) over descres = 07-22..07-24, which matches.

Pedidos in the prototype vs the fixture:
- 2646: 260728/40 en_proceso urgente entrega 31/07; 260724/5 SHAKIRA; 260724/2 ROCKY; 260722/219 (50 cows in the prototype); 260710/3 fuera_de_ventana.
- 424: 260723/12 LOLA.
- 77: none.
- The fixture already has every one of these, with 219 at 4 cows, plus an anulado 260725/7 and a particular 260724/9 [F]. The ONLY gap is the 50-cow rodeo. "Nuevo" is cookie-driven, not fixture data.

`rodeo()` [PD:72-105]:
- Seeded LCG, seed 20260722. It uses float math above 2^53, so copy the function verbatim (deterministic in JS) or hardcode the table below.
- The first 4 caravanas and their IBR/DVB/Hardjo values equal the fixture's 4-cow rodeo.
- Columns: Leptospirosis {Grippotyphosa, Hardjo, Pomona} (rango Negativo), Brucelosis, IBR (ELISA), DVB (ELISA).
- Grippotyphosa and Brucelosis are always "Negativo". Out of range ("!"): Hardjo at idx 1, 9, 17, 23, 31, 38; Pomona at idx 9, 44.
- IBR/DVB "POSITIVO" values are never flagged (DENTRO='S', D§7.2).

All 50 rows as idx caravana [lepto flags] IBR | DVB:

| idx | caravana | lepto flag | IBR | DVB |
|---|---|---|---|---|
| 0 | 154983 | | 79% - POSITIVO | 0,186 - POSITIVO |
| 1 | 151667 | Hardjo !1/400 | 100% - POSITIVO | 1,674 - Negativo |
| 2 | 126 | | 80% - POSITIVO | 1,674 - Negativo |
| 3 | 105 | | 12% - Negativo | 1,674 - Negativo |
| 4 | 156834 | | 50% - Negativo | 1,933 - Negativo |
| 5 | 156608 | | 79% - POSITIVO | 1,627 - Negativo |
| 6 | 150219 | | 13% - Negativo | 1,273 - Negativo |
| 7 | 152967 | | 47% - Negativo | 0,233 - POSITIVO |
| 8 | 537 | | 49% - Negativo | 1,201 - Negativo |
| 9 | 296 | Hardjo !1/200, Pomona !1/100 | 83% - POSITIVO | 0,100 - POSITIVO |
| 10 | 556 | | 38% - Negativo | 1,588 - Negativo |
| 11 | 156273 | | 35% - Negativo | 1,831 - Negativo |
| 12 | 155571 | | 84% - POSITIVO | 1,611 - Negativo |
| 13 | 152135 | | 2% - Negativo | 1,550 - Negativo |
| 14 | 303 | | 32% - Negativo | 0,317 - POSITIVO |
| 15 | 333 | | 87% - POSITIVO | 1,612 - Negativo |
| 16 | 886 | | 51% - Negativo | 1,882 - Negativo |
| 17 | 156921 | Hardjo !1/800 | 83% - POSITIVO | 1,845 - Negativo |
| 18 | 501 | | 71% - POSITIVO | 1,373 - Negativo |
| 19 | 938 | | 17% - Negativo | 0,268 - POSITIVO |
| 20 | 900 | | 90% - POSITIVO | 1,574 - Negativo |
| 21 | 150533 | | 29% - Negativo | 1,728 - Negativo |
| 22 | 158324 | | 14% - Negativo | 0,394 - POSITIVO |
| 23 | 154031 | Hardjo !1/400 | 21% - Negativo | 0,213 - POSITIVO |
| 24 | 158432 | | 99% - POSITIVO | 1,989 - Negativo |
| 25 | 154175 | | 28% - Negativo | 1,299 - Negativo |
| 26 | 441 | | 4% - Negativo | 1,897 - Negativo |
| 27 | 154086 | | 48% - Negativo | 1,935 - Negativo |
| 28 | 153 | | 14% - Negativo | 1,801 - Negativo |
| 29 | 844 | | 68% - POSITIVO | 1,651 - Negativo |
| 30 | 150653 | | 61% - POSITIVO | 1,737 - Negativo |
| 31 | 151755 | Hardjo !1/100 | 87% - POSITIVO | 1,828 - Negativo |
| 32 | 730 | | 89% - POSITIVO | 1,540 - Negativo |
| 33 | 790 | | 0% - Negativo | 0,184 - POSITIVO |
| 34 | 270 | | 5% - Negativo | 1,728 - Negativo |
| 35 | 151003 | | 26% - Negativo | 1,290 - Negativo |
| 36 | 152076 | | 68% - POSITIVO | 1,713 - Negativo |
| 37 | 157891 | | 66% - POSITIVO | 1,433 - Negativo |
| 38 | 154313 | Hardjo !1/200 | 86% - POSITIVO | 1,550 - Negativo |
| 39 | 153820 | | 10% - Negativo | 1,815 - Negativo |
| 40 | 158891 | | 9% - Negativo | 1,874 - Negativo |
| 41 | 152683 | | 66% - POSITIVO | 1,929 - Negativo |
| 42 | 152216 | | 64% - POSITIVO | 1,324 - Negativo |
| 43 | 157377 | | 47% - Negativo | 1,398 - Negativo |
| 44 | 201 | Pomona !1/400 | 93% - POSITIVO | 1,402 - Negativo |
| 45 | 151143 | | 52% - Negativo | 1,294 - Negativo |
| 46 | 154016 | | 25% - Negativo | 1,442 - Negativo |
| 47 | 157924 | | 42% - Negativo | 1,500 - Negativo |
| 48 | 155416 | | 26% - Negativo | 0,141 - POSITIVO |
| 49 | 158798 | | 75% - POSITIVO | 1,591 - Negativo |

Totals: 8 hallazgos in 7 animals, in this order: 151667 Hardjo 1/400; 296 Hardjo 1/200; 296 Pomona 1/100; 156921 Hardjo 1/800; 154031 Hardjo 1/400; 151755 Hardjo 1/100; 154313 Hardjo 1/200; 201 Pomona 1/400.

Ficha común: Raza NELORE · Sexo Hembra · Edad 2.00 Años. The fixture's `vaca()` has ESPECIE '' and PELAJE 'SIN PELAJE', which are hidden.

The list row reads "154983, 151667, 126 y 47 más" with "▲ 8 valores fuera de rango".

Port recipe into fixture.ts (INFERRED, arithmetic checked):
- Reuse the existing 4-cow loop body for 50 caravanas: CODANAL 55/49/53/51.
- Lepto UBICACION = 4 + i*16, step 2 (max 794). Brucelosis 804 + i*2 (max 902), IBR 904 + i*2 (max 1002), DVB 1004 + i*2 (max 1102). No UBICACION collisions up to 50 animals.
- DENTRO='N' only where flagged above. ORDEN = i+1.
- Use a new key inside the ventana so the ventana, the estados and the "22/07 al 24/07" text don't change, e.g. FECHA_RECE 2026-07-22, NRO 220 (ref "260722/220"), or 2026-07-23 with a free nro.
- Leave 260722/219 untouched [D§5.9].
- Existing test q=151667 will then match both rodeos, which still passes [T:255-259].

E. CONTRADICTIONS, GAPS AND OPEN VISUAL QUESTIONS

1. Captures 10 ("abajo"), 12 ("matriz") and 13 ("solo hallazgos") are visually identical to 09 and 11, the top of the page. VERIFIED by viewing them. No capture shows the matrix, the table bottom, the leyenda, the pie or the switch ON. The prototype is the only source for those; I checked it live.

2. The prototype makes 260722/219 the 50-cow rodeo, and [K11] shows it that way. DISENO.md §5.9 keeps 219 at 4 cows and asks for a separate pedido. Consequences:
   - Clinic 2646 shows 6 pedidos, not 5, and the filter counts change.
   - The 4-cow 219 now renders as a MATRIX (RODEO_DESDE=4): resumen "1 valor fuera de rango" and "Solo animales con hallazgos (1)".

3. Reference e2e tests [T] assert old markup and must be rewritten:
   - `<tr class="seccion"><td colspan="3">`, `<tr class="fuera">`, `td.prueba` (SHAKIRA test, T:266-275)
   - `h2.animal-titulo` and `nav.indice` for 219 (T:277-282); 219 is now a matrix, so check the `th[scope=row]` order instead
   - `/Urgente/`; the new literal is "URGENTE" (T:251)

4. Hand-cased prototype labels vs real data:
   - The prototype shows "Leptospirosis · Hardjo", "Brucelosis" and the soft-hyphenated header; real data gives "LEPTOSPIROSIS · Hardjo" (resumen-prueba has no text-transform) and "INFORME DE BRUCELOSIS".
   - The prototype's rodeo notas carry invented prefixes: "Leptospirosis — OBSERVACION: …" and "Brucelosis, IBR y DVB — METODO LABORATORIAL: ELISA". DISENO.md only says deduplicate.
   - Decide whether to add analysis-name prefixes. Recommendation: plain dedup.

5. Email destino masking: server.ts shows the full email, the prototype masks it, DISENO.md says masked. The design wins. It isn't an error message, so §6's verbatim rule doesn't apply.

6. The prototype uses buttons with JS state for filters, the switch and live search, a link plus toast for Reenviar, and a "Vista de impresión" bar. DISENO.md replaces all of that with GET links, form POSTs and window.print() with no special view. Follow DISENO.md.

7. "Nuevo" in the demo: the cookie stores today's date, and the first visit marks nothing [D§5.3]. Every fixture pedido is from July, so NUEVO and "2 pedidos nuevos" (K06) will never appear in dev unless a signed `cedivep_visita={"2646":"2026-07-23"}` is forged, for example in a test. "Nuevo" is also approximated with the reception date (D§7.3, ask Luis).

8. CONSULTADO: the reference uses the UTC date, so from 21:00 to 24:00 in Paraguay (UTC-3) it shows tomorrow. Use America/Asuncion. INFERRED.

9. Ventana text drops the year on "desde" (`.slice(0,5)`). That is ambiguous across a year boundary (28/12 al 05/01/2027). INFERRED: show the year when the years differ.

10. An informe with no results is reachable by URL; `obtenerInforme` returns en_proceso pedidos such as 2026-07-28/40. In v2, hallazgos=0 would show the misleading "Todos los valores dentro del rango de referencia". Show the reference's "Este pedido todavía no tiene resultados cargados." in `.vacio` instead [R:265], and hide Compartir there (INFERRED).

11. Pedidos with 2–3 animals, and mixed rodeos, use the per-animal fallback. It has no design, no CSS (B1) and no fixture case. Open: title style, whether `.resumen-animal` shows, and whether the index appears only above 3 animals (the reference rule).

12. Single-test analyses with no TITULO row (brucelosis, IBR, DVB) inside one table per animal will look as if they belong to the previous section header (e.g. under LEPTOSPIROSIS) in the fallback and in the arreglo-1 single table. There is no design decision for this.

13. When a rodeo has 0 animals with hallazgos, the prototype still shows the switch "(0)". INFERRED: hide it.

14. Search plus an active filter with no results: the prototype shows the "Ningún pedido coincide…" text even though results exist under other filters. Possibly the filter text should win.

15. Copy: "La búsqueda mira el nombre o la caravana del animal, el análisis y la referencia del pedido." But `coincide()` also matches dates (iso and dd/mm/yyyy) [S:44-45]. Minor.

16. Error pages: for "Esa página no existe.", the 500 and the 403, DISENO.md gives no h1 and no button text. The reference used "No pudimos mostrar esto" and "Volver". 500 lives in error.tsx, a client component, so it can't show the clinic barra (INFERRED).

17. Printing with "solo con hallazgos" active (D§4.6, D§7.5): print it filtered (`.matriz-pie` shows "7 de 50 animales") or the full matrix. This is for Luis to decide.

18. The hoja and toasts are optional. The plain `a.boton-borde` link satisfies the requirement. Recommendation: ship without the dialog and add it later (needs the B1 CSS).

19. Contact data (phone, email, hours) and the official logo are still pending confirmation [D§7.1, D§7.4]. Make them config values; "S.R.L." in `.marca` is text until then.

20. HANDOFF arreglo 3 asked for a two-line barra. DISENO.md solves it with the subbarra instead; consistent, and DISENO.md wins on visuals. HANDOFF also says Imprimir is the only JS; DISENO.md adds the casillas and the optional hoja.

Scratch files: extracted captures are in /private/tmp/claude-501/-Users-luisisasi-dev-isasiluispy-portal-cedivep/d36e8900-84f5-4006-9742-70e030732d88/scratchpad/capturas (v2 jpgs) and .../scratchpad/capturas-ref (old pngs). The prototype and estilos.css are in .../scratchpad/proto. The local server I used to view the prototype has been stopped.