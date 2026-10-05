> Working notes from the planning session (2026-10-05). Where they differ, the plan and CLAUDE.md win. Identifiers here are often the Spanish reference names; the code uses the English glossary.

CEDIVEP NEXT.JS PORT: LOGIC AND TEST PORT MAP
(Research only. No files were created. The only write was extracting 3 JPGs into scratchpad/capt/.)
Tags: [V] = VERIFIED (source cited); [I] = INFERRED; [U] = UNVERIFIED.
Zip paths are relative to cedivep-portal/ (R = _referencia/).

======================================================================
0. CRITICAL FINDINGS (read first)
======================================================================
C1 [V] A single shared `next start` trips the rate limits, even with only the original 24 tests. tel:981000001 is used for 4 logins across the groups and the limit is 3 per 15 min. Spawn one server per describe (§2.3).

C2 [V] Express `res.cookie maxAge` is in milliseconds. Next `cookies.set maxAge` is in seconds (nextjs.org/docs/app/api-reference/functions/cookies, "Sets the cookie's lifespan in seconds"). Copying `minutos*60_000` as-is makes the session cookie last about 83 years. Use `minutos*60`.

C3 [V] `redirect()` returns 307 outside Server Actions (redirect docs). If a Route Handler calls it after a POST, the browser re-POSTs to the page. Route Handlers must build the 303 by hand:
  `new NextResponse(null,{status:303,headers:{Location:path}})`
  Use a relative Location. Don't use `NextResponse.redirect`: it needs an absolute URL, and request.url can carry the wrong host behind Cloudflare/nginx [I].

C4 [V] `notFound()` and `redirect()` keep their real 404/307 status only if streaming hasn't started (notFound docs: "the response has already begun streaming as a 200"; redirect docs: streaming inserts a meta tag). So:
  - no `loading.tsx` and no `<Suspense>` around auth or lookups on authenticated routes;
  - do not enable cacheComponents ("every dynamic route streams a static shell first");
  - `redirect()`/`notFound()` must be outside try/catch (docs). The reference wraps everything in `try{...}catch(e){next(e)}`; porting that literally swallows NEXT_REDIRECT/NEXT_NOT_FOUND.

C5 [I, strong] The ephemeral `sessionSecret = randomBytes(32)` at config.ts module scope breaks in Next:
  - HMR re-evaluates the module, so a new secret invalidates the paso cookie and Paso 2's acceptance check ("el código sigue sirviendo") fails even if Codigos is on globalThis;
  - route bundles and proxy.ts can each evaluate config.ts separately, so different secrets give a login loop in demo mode.
  Keep the secret on globalThis too (§5).

C6 [V] node:sqlite works unflagged on this Mac (Node v22.13.1, `new DatabaseSync(':memory:')` ran fine) but prints an ExperimentalWarning. `require('module').builtinModules` does NOT list 'sqlite' (isBuiltin('node:sqlite') = true). Turbopack resolution of `node:sqlite` is [U]. Fallback that skips the bundler: `process.getBuiltinModule('node:sqlite')` (present on 22.13.1 [V]).

C7 [V] React 19.2.3 SSR (renderToString, run locally from ~/dev/isasiluispy/mentora):
  - adjacent text nodes get `<!-- -->` between them: `▲ <!-- -->22,5 %`;
  - `colSpan` is emitted camelCase (`colSpan="3"`, not `colspan`);
  - `'` becomes `&#x27;`.
  Next also inlines the RSC payload in `<script>self.__next_f.push(...)</script>`, so every visible text appears twice in the HTML. Naive regexes break; helpers in §2.2.

C8 [V] Enumeration leak in the reference (R/src/server.ts:149-157 + R/src/auth.ts:97-115). Registered contact + wrong code gives "no es correcto". Unknown/comodín/HABILITA=N contact + any code gives `sin_codigo`, shown as "venció o ya no es válido". This contradicts HANDOFF §6/§7 ("iguales exista o no el contacto"). No reference test catches it. Fix in §7.

C9 [V] /health publishes `db.label = "mysql host:port/db"` (R/src/db.ts:58, server.ts:216) to anyone, unauthenticated. That's the public lab MySQL, still on admin creds (HANDOFF §8). Restrict the label to demo mode.

C10 [V] Turbopack does not resolve `import './config.js'` to config.ts. github.com/vercel/next.js/issues/82945 is open (PR #95426 open). Use extensionless imports (§6).

======================================================================
1. TEST COUNTS [V] (grep -cE '^\s*test\(' on each file)
======================================================================
- R/test/contacto.test.ts: 5
- R/test/informe.test.ts: 12. Note a mid-file `import { formatoNumero, matrizRodeo }` at line 102; merge it into the top import when porting.
- R/test/portal.test.ts: 24 = ingreso 10, "varias clínicas" 1, "autorización" 7, "listado e informe" 6.
- Total 41 = 17 unit + 24 e2e, matching HANDOFF §6 paso 1 and README.

======================================================================
2. E2E PORT MAP (R/test/portal.test.ts against `next start` in a child process)
======================================================================
2.1 Harness
- `conServidorPropio(envExtra)`. Steps:
  1. In before(): get a free port with `net.createServer().listen(0)`, then close it.
  2. `spawn(process.execPath, ['node_modules/next/dist/bin/next','start','-p',port,'-H','127.0.0.1'], {env:{...process.env, ...ENV_TEST, ...envExtra}, stdio:['ignore','pipe','inherit']})`.
  3. Poll GET /health until 200 (30 s timeout).
  4. Collect child stdout lines into an array (optional log assertions, §2.4 T6).
  5. In after(): SIGTERM and await 'exit'.
  [I] bin path. `next build` must run first (`"test:e2e": "next build && node --conditions=react-server --import tsx --test test/portal.test.ts"`).
- ENV_TEST must pin every behaviour variable. process.env wins over .env files ([V] environment-variables docs, load order "process.env first"), and Luis's .env.local for step 6 would otherwise switch the driver or flags:
  CEDIVEP_DRIVER=sqlite, CEDIVEP_DEMO=1, COOKIE_SECURE=false, TRUST_PROXY=false, BLOQUEAR_MOROSOS=false, BLOQUEAR_DESHABILITADAS=true, SESSION_HORAS=12.
  - BLOQUEAR_MOROSOS must be false or AGROVET 77 disappears and the "elegir" test fails. 77 is MOROSO='S' (R/src/seed/fixture.ts:43-44).
- SESSION_SECRET:
  - Leave it unset for most groups so the demo default (ephemeral secret) is exercised. The login tests then prove that the secret, Codigos and the directorio are shared across separate route bundles (/api/ingresar emits, /api/verificar verifies, the page reads the session).
  - Set an explicit value only in the "nuevo" group, which has to sign a cookie.
  - Caveat [U]: whether `SESSION_SECRET=''` in process.env blocks a value from .env.local.
- Optional single-URL mode (CEDIVEP_TEST_URL, HANDOFF paso 5 "base URL por variable") is only safe for running one describe at a time (see 2.3).

2.2 Navegador and helpers
- Keep the reference class (R/test/portal.test.ts:40-69), with these changes:
  a) POST paths become /api/ingresar|verificar|elegir|salir.
  b) Treat a Set-Cookie with an empty value OR `Max-Age=0` OR an Expires in the past as delete. Today only an empty value deletes, so a `set(name,'x',{maxAge:0})` would survive.
  c) `codigoDemo()`:
     ```
     const {html}=await this.ir('/verificar');
     const m=/class="demo"[\s\S]*?<strong[^>]*>\s*(\d{3})\s?(\d{3})\s*</.exec(visible(html));
     return m?m[1]+m[2]:null
     ```
  d) `entrar(contacto, volver?)` = POST /api/ingresar (assert destino '/verificar'), then codigoDemo() (assert non-null), then POST /api/verificar.
  e) `pasoDe()` = `JSON.parse(Buffer.from(cookie.split('.')[0],'base64url'))`. The paso cookie is signed, not encrypted; use this for extra assertions such as "no demo field".
- Helpers:
  ```
  visible(html) = html.replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<!--[\s\S]*?-->/g,'')
  texto(html)   = visible(html).replace(/<[^>]+>/g,' ')
                    .replace(/&(amp|lt|gt|quot|#x27|#39);/g, decode)
                    .replace(/\s+/g,' ').trim()
  elementos(html, tag, clase?) -> inner HTML of each <tag> whose class attribute contains `clase`
    (match class with (^|\s)clase(\s|$) so 'estado' doesn't match 'estado--ok');
    leaf elements and tables only, no nested same tag.
  ```
  - Make attribute regexes order-agnostic: `<th\b[^>]*class="seccion"[^>]*>`. Use the /i flag wherever colspan/colSpan appears.
  - Scope every assertion to its block (`table.resultados`, `table.matriz`, `ul.pedidos`, `nav.filtros`, `section.resumen`). Filter labels such as "En proceso" and the resumen/leyenda `▲` would otherwise give false positives.
  - Component tip: render composite text as one JS string (`{`▲ ${valor}`}`, `{[l.valor||'—',l.unidad].filter(Boolean).join(' ')}`, `{`Entrega prevista: ${fmtFecha(f)}`}`) to avoid separators.
  - Keep `className="prueba"` on the first td (no CSS uses it; it's a stable hook).

2.3 Rate limits: counts and server strategy
Rules [V] (R/src/auth.ts:79-83):
- `admitir` calls porIp first, and that records the event even when porContacto then rejects. Limits: 20 per IP and 3 per contact key per 15 min (R/src/config.ts:56-58).
- The format error returns before admitir, so it records 0 events.
- Keys are canonical: '+595 981-000-001' is tel:981000001.
- All test traffic comes from one IP. Next fills `x-forwarded-for` with the socket address only when it's absent ([V] next.js base-server.ts: `req.headers['x-forwarded-for'] ??= originalRequest?.socket?.remoteAddress`).

POST /api/ingresar events, per describe (contacts):

| Group | IP events | Contacts |
|---|---|---|
| A ingreso | 13 (15 with N22) | tel:981000001 ×2, mail:admin ×1, mail:tacuary ×1 (×2 in the original T4), tel:971000003 ×1, tel:985999888 ×1, tel:981000999 ×1, tel:981000009 ×1, tel:985111222 ×4 (4th rejected, intended), formato 0 |
| B varias | 1 | tel:981000002 |
| C autorización | 1 | tel:981000001 |
| D listado | 2 | tel:981000001; tel:985999888 (for /verificar Cache-Control) |
| E volver (new) | 3 | tel:981000001 ×2, tel:981000002 ×1 |
| F reenviar (new) | 6 | mail:sanroque ×2, mail:admin ×4 (4th rejected, intended) |
| G nuevo (new) | 1 | mail:tacuary |

Single-server totals:
- Original suite: 16 IP events (under 20), but tel:981000001 = 4, so group D's before() login gets the limit error.
- Full new suite: 27-29 IP events (over 20) and tel:981000001 = 6.

Recommendation: one `next start -p <free>` per describe (7 sequential spawns; node:test runs a file's describes sequentially [I]). This is the closest equivalent to conServidorPropio and needs no production code changes. Rejected alternatives:
- env-tunable limits (weakens the limit tests);
- a test reset endpoint (attack surface in production);
- a different X-Forwarded-For per group (builds tests on the spoofable header, §7.17).
Cost: one server boot per group ([U] timing).

2.4 Per-test changes. PRG proposal: errors become 303 + whitelisted ?error=; message map in 2.5.

Group A "ingreso":
- T1 celular registrado: r1 303 '/verificar' (unchanged). Code from codigoDemo(). r2 destino '/pedidos'. r3 200 and texto has CLÍNICA TACUARY.
- T2 mismo celular distinto: entrar('+595 981-000-001') goes to '/pedidos'. Unchanged.
- T3 por correo: entrar('ADMIN@ejemplo.com.py') goes to '/pedidos'. Unchanged.
- T4 código usado: the reference test is effectively a no-op [V]. After a successful verify the paso cookie is cleared (server.ts:159), so `otro` sends an empty cedivep_paso. It only proves that a NEW code replaces the old one. Rewrite:
  1. Capture the paso cookie before verifying.
  2. Log in with code c.
  3. On a fresh Navegador, set the captured paso and POST /api/verificar {codigo:c}.
  4. Assert destino '/verificar?error=vencido' (sin_codigo) and that no cedivep_sesion was set.
  Uses mail:tacuary once.
- T5 código incorrecto:
  - 4× POST: assert destino '/verificar?error=incorrecto' (was 400). Optionally GET it and match "no es correcto" plus the demo still shown.
  - 5th: '/verificar?error=vencido'; GET shows "venció o ya no es válido".
  - The good code: '/verificar?error=vencido' and no session.
- T6 contacto desconocido: 303 '/verificar' (unchanged).
  - Replace `enviados` with: GET /verificar returns 200, no "Modo demostración" block, text "terminado en 888", and `pasoDe()` has no `demo`.
  - Optional stronger check: wait for the stdout line `[ingreso] sin acceso tel:…888 (sin_coincidencia)` (server.ts:123) and assert there is no `[ingreso] código \d{6} para tel:…888` line. Masks don't collide in this suite: …888, …999, …009.
- T7 comodín (0981 000 999, only clinic 1, skipped at index build, repo.ts:125): no demo block. Add: POST /api/verificar {codigo:'000000'} gives no session.
- T8 HABILITA=N (0981 000 009, clinic 900): same as T7 (repo.ts:126).
- T9 formato inválido: 400 becomes 303 '/?error=formato'. GET '/?error=formato' shows "No reconocemos ese formato…". If the flash cookie (2.5) is adopted, also assert the input value "hola".
- T10 límite: [303,303,303,429] becomes all 303 with destinos ['/verificar','/verificar','/verificar','/?error=limite'].

Group B "varias":
- T11: entrar('0981 000 002') goes to '/elegir'. GET /elegir lists VETERINARIA SAN ROQUE and AGROVET PARAGUARÍ (order [424,77] [V], from clini_vet row order).
- Intruder POST /api/elegir {clinica:'2646'}: recommended to keep a bare 403 (`new Response('Esa clínica no está asociada a tu contacto.',{status:403})`). Only a tampered form reaches it, so no designed page is needed, and the assertion stays as-is. Alternative: 303 '/elegir?error=clinica' plus "no Set-Cookie cedivep_sesion" plus GET /pedidos still 307 to '/elegir'.
- ok goes to '/pedidos', which matches VETERINARIA SAN ROQUE.

Group C "autorización" (before: entrar tacuary):
- T12 200 + SHAKIRA, unchanged.
- T13 404 + doesNotMatch LOLA, unchanged.
- T14 404, unchanged.
- T15 unchanged.
- T16 three junk paths return 404 via notFound(): Number("1' OR 1=1") is NaN and obtenerInforme returns null (repo.ts:79).
- T17 cookie manipulada: 302 becomes 307, destino '/'. /pedidos (the list) doesn't start with '/pedidos/', so no volver.
- T18 sin sesión: destino becomes '/?volver=%2Fpedidos%2F2026-07-24%2F5'. Assert with `new URL(destino, base)`: pathname '/' and `searchParams.get('volver') === '/pedidos/2026-07-24/5'`.
- [V] Next keeps the Location relative: app-render.tsx `setHeader('location', addPathPrefix(getURLFromRedirectError(err), basePath))`.

Group D "listado" (before: entrar tacuary):
- T19 estados:
  - Search inside `elementos(html,'ul','pedidos')`.
  - 'Urgente' becomes the literal 'URGENTE' (.etiqueta-urgente has no text-transform [V] diseno/estilos.css:196). Better to assert `class="etiqueta-urgente"`.
  - 'Entrega prevista: 31/07/2026' via texto().
  - States via class: estado--ok, estado--proceso, and "No disponible en línea".
- T20, T21: unchanged on visible(). T21 never tests an accent (no accented searchable data in the fixture); add the reverse case to unit U12.
- T22 SHAKIRA:
  ```
  const [t]=elementos(html,'table','resultados'); assert one table (fix 1)
  secciones = [...t.matchAll(/<th\b[^>]*class="seccion"[^>]*>([^<]*)<\/th>/g)]
    -> ['BIOMETRIA HEMATICA','LEUCOGRAMA']
  rows = elementos(t,'tr').filter(tr=>/class="prueba"/.test(tr))
  fuera = rows.filter(tr=>/class="marcador"/.test(tr)).map(prueba) -> ['R.D.W.']
  texto(R.D.W. row) matches /▲ 22,5 %/
  rows.map(prueba).slice(0,3) -> ['Hemoglobina','Hematócrito','Glóbulos Rojos']
  ```
- T23 rodeo (MUST be rewritten). [V] matrizRodeo is non-null for 219: 4 animals = RODEO_DESDE; each has the same columns LEPTOSPIROSIS|Grippotyphosa, LEPTOSPIROSIS|Hardjo, LEPTOSPIROSIS|Pomona, |INFORME DE BRUCELOSIS, |IBR (ELISA), |DVB (ELISA); the Lepto ranges are all 'Negativo' so they're kept.
  ```
  const [m]=elementos(html,'table','matriz');
  [...m.matchAll(/<th\b[^>]*scope="row"[^>]*>([^<]*)<\/th>/g)] -> ['154983','151667','126','105']
  rows with marcador -> [false,true,false,false]
  th.grupo-col LEPTOSPIROSIS (colSpan 3, /i)
  no <nav class="indice"
  no class="animal-titulo"
  texto(div.matriz-pie) matches /4 animales/
  ```
  The fallback path (index + per-animal sections) has no fixture. Optionally add a mixed rodeo of 4+ animals to clinic 424 so Tacuary's counts stay the same.
- T24 cache:
  ```
  assert cache-control matches /\bprivate\b/ and /\bno-store\b/
    ([V] dynamic pages send 'private, no-cache, no-store, max-age=0, must-revalidate')
  CSP: /script-src[^;]*'nonce-([^']+)'/ and no 'unsafe-inline' in script-src
  [I] every <script> in the page carries nonce="<same>"
  ```

2.5 Errors: Post/Redirect/Get
- Why: a Route Handler can't render the designed RSC page. Pages can't set 400/429 (only notFound/redirect/forbidden). Rendering React to a string inside a route handler isn't a supported path [I].
- Map (messages verbatim from R/src/server.ts):
  ```
  formato    (server.ts:105) 'No reconocemos ese formato. Escribí un celular (0981 123 456) o un correo.'  -> '/?error=formato'
  limite     (server.ts:111) 'Pediste demasiados códigos. Esperá unos minutos y probá de nuevo.'  -> '/?error=limite'; from reenviar: '/verificar?error=limite'
  incorrecto (server.ts:152) 'El código no es correcto. Revisalo y probá de nuevo.'  -> '/verificar?error=incorrecto'
  vencido    (server.ts:153) 'El código venció o ya no es válido. Pedí uno nuevo.'  (vencido|agotado|sin_codigo) -> '/verificar?error=vencido'
  clinica    (server.ts:177) 'Esa clínica no está asociada a tu contacto.'  (403 body, or '/elegir?error=clinica')
  404 pedido (server.ts:208) 'No encontramos ese pedido entre los de tu clínica.'  -> pedidos/[fecha]/[nro]/not-found.tsx
  404 genérico (server.ts:222) 'Esa página no existe.'  -> app/not-found.tsx
  500        (server.ts:225) 'Ocurrió un error inesperado. Intentá de nuevo.'  -> error.tsx
  ```
  Lookup: `mensajeDe(e) = typeof e==='string' && Object.hasOwn(MENSAJES,e) ? MENSAJES[e] : undefined`. This blocks '__proto__' and 'toString'.
- Demo-code visibility after errors: the reference shows the demo code only on 'incorrecto' (server.ts:156). In /api/verificar, on a non-incorrecto failure re-sign paso as {clave, volver} without `demo`. The page then just shows `paso.demo` if present.
- Keeping the typed value (capture 02 shows "clinica tacuary" kept [V]): use a 60-s httpOnly `cedivep_flash` cookie {contacto} set by /api/ingresar on formato/limite. That keeps phone numbers out of query strings and access logs. It can't be cleared by the page; a reload within 60 s re-shows the value. Cheaper fallback: drop value retention.
- Assertions that change: T5 (400 → 303 ×6), T9 (400 → 303), T10 (429 → 303), T4 (400 → 303); T11 only if the 403 isn't kept.
- Conflict to flag: HANDOFF paso 5, DISENO §5.7 and §8 literally say "→ 429". If a literal 429 is needed, the route handler can return `429` with body `<meta http-equiv="refresh" content="0;url=/?error=limite">` (works without JS; CSP doesn't block meta refresh [I]). Recommendation: 303, and confirm with Luis.

======================================================================
3. NEW E2E TESTS (names, setup, assertions)
======================================================================
Group D additions (reuse D's login):
- N1 'filtro: ?estado=en_proceso muestra solo ese y los números son del total'. GET /pedidos?estado=en_proceso. `.ref` in ul.pedidos = ['260728/ 40']. nav.filtros label→n = {Todos:5, Disponibles:3, 'En proceso':1, 'No en línea':1}. aria-current="true" on the estado=en_proceso link.
- N2 'los números de los filtros se cuentan después de buscar'. /pedidos?q=151667: counts {1,1,0,0}; every filter href keeps q=151667; refs ['260722/219'].
- N3 'estado desconocido = todos'. For e in ['xyz', '', '__proto__', 'constructor', 'DISPONIBLE']: 5 refs and aria-current on Todos. Also decide and test `?estado=a&estado=b` (searchParams may be string[]).
- N4 'agrupa por fecha, de la más nueva a la más vieja'. h2.grupo-titulo texts start with: Martes 28 de julio, Viernes 24 de julio, Miércoles 22 de julio, Viernes 10 de julio. Weekdays [V] by Date.UTC. The 24th group has refs [5, 2] in that order.
- N5 'resumen de hallazgos (1 animal)'. SHAKIRA: section.resumen text has "1 valor fuera de rango", "R.D.W.", "▲ 22,5 %", "ref. 17,0 - 20,0 %"; p.leyenda present.
- N6 '?hallazgos=1 filtra la matriz pero el resumen y los conteos quedan completos'. 219?hallazgos=1:
  - matrix rows ['151667']; matriz-pie "1 de 4 animales";
  - a.interruptor aria-checked="true", text "Solo animales con hallazgos (1)", href without hallazgos;
  - the resumen still lists 151667 / "LEPTOSPIROSIS · Hardjo" / 1/400 and the title "1 valor fuera de rango";
  - dl.datos ANIMALES 4;
  - common ficha has NELORE, Hembra, 2.00 Años and no "Especie".
- N7 'interruptor apagado por defecto'. 219 and 219?hallazgos=0|true|x: 4 rows, aria-checked="false", href '/pedidos/2026-07-22/219?hallazgos=1'. SHAKIRA ?hallazgos=1 has no effect.
- N8 'las páginas autenticadas responden Cache-Control: private, no-store'. Assert /\bprivate\b/ and /\bno-store\b/ on:
  - /pedidos, /pedidos?estado=disponible, /pedidos/2026-07-24/5, /pedidos/2026-07-22/219?hallazgos=1, /elegir (renders for a 1-clinic session, as the reference does);
  - /verificar via a second Navegador after POST /api/ingresar {contacto:'0985 999 888'} (+1 IP event);
  - optionally the 404 /pedidos/2026-07-23/12.

Group B addition:
- N10 'informe sin hallazgos: .todo-ok'. After choosing 424, GET /pedidos/2026-07-23/12: .todo-ok "Todos los valores dentro del rango de referencia", no section.resumen, no leyenda. LOLA's R.D.W. 13,1 is outside 17-20 but DENTRO='S', so it's not marked ("no interpreta").

Group E "volver tras el ingreso" (own server):
- N11 = T18. Optionally also `?hallazgos=1` is preserved inside volver.
- N12 'después de entrar, volver lleva al informe':
  1. GET /?volver=%2Fpedidos%2F2026-07-24%2F5: html has `name="volver"` with that value.
  2. entrar('0981 000 001','/pedidos/2026-07-24/5'): /api/verificar answers 303 Location '/pedidos/2026-07-24/5'.
  3. GET it: 200, SHAKIRA.
- N13 'volver externo o raro se ignora':
  - For each bad vector (U14 list), GET /?volver=<encodeURIComponent(v)>: no volver input, no 'evil' in visible().
  - One full login with the form field volver='//evil.com': destino '/pedidos'.
- N14 'con varias clínicas, volver sobrevive a /elegir'. entrar('0981 000 002','/pedidos/2026-07-23/12') gives '/elegir?volver=%2Fpedidos%2F2026-07-23%2F12'. POST /api/elegir {clinica:'424', volver} gives '/pedidos/2026-07-23/12', which is 200 LOLA.
- N15 'con sesión, / redirige a volver si es válido'. GET /?volver=%2Fpedidos%2F2026-07-24%2F2 gives 307 there; /?volver=%2F%2Fevil.com gives 307 '/pedidos'.

Group F "reenviar código" (own server). Form: hidden `reenviar=1`. The server takes the clave from the verified paso cookie and ignores `contacto`.
- N16 'reenviar usa el contacto de la cookie, no el del formulario'.
  1. POST /api/ingresar {contacto:'sanroque@ejemplo.com.py'}: c1.
  2. POST /api/ingresar {reenviar:'1', contacto:'0981 000 001'}: 303 '/verificar'.
  3. Check: pasoDe().clave === 'mail:sanroque@ejemplo.com.py'; the demo code changed (c2); /verificar shows the sanroque destination (not "terminado en 001").
  4. c1 gives error=incorrecto (if c1≠c2); c2 gives '/pedidos' (424 only).
- N17 'el 4.º código en 15 minutos (reenvíos incluidos) se rechaza'. With admin@ejemplo.com.py: ingresar, then reenviar ×2 → three 303 '/verificar'; 4th reenviar → 303 '/verificar?error=limite'; GET shows the limite message; the last issued code still logs in.
- N18 'reenviar sin cookie de paso vuelve al ingreso'. POST {reenviar:'1'} with no paso: 303 '/'. No admitir call.

Group G "nuevo desde la última visita" (own server, SESSION_SECRET pinned):
- N19 'la primera visita no marca nada y guarda la cookie'. entrar(tacuary mail). GET /pedidos: no .etiqueta-nuevo, no .pagina-nuevos; Set-Cookie cedivep_visita present, HttpOnly, value "x.y".
- N20 'con visita anterior marca los disponibles posteriores, estable en el día'.
  - Set cedivep_visita = firmarTest(SECRET, {fechas:{'2646':['','2026-07-23']}}) (shape from U10).
  - GET /pedidos: NUEVO only on 260724/  5 and 260724/  2 (not 219 = 07-22, not 40 = en_proceso); text "2 pedidos nuevos desde tu última visita".
  - Second GET with the updated cookie: still 2.
  - The test HMAC is ~6 lines replicating firmar (R/src/auth.ts:127-133) with node:crypto.
- N21 'cookie de visita manipulada se ignora'. A bad signature gives no NUEVO and the cookie is replaced.

Group A addition (if the C8 fix is adopted):
- N22 'un código equivocado da el mismo error exista o no el contacto'. Unknown 0985 999 777 and known 0981 000 002 each POST '000000': same destino '/verificar?error=incorrecto'.

======================================================================
4. NEW PURE FUNCTIONS (src/lib, no server-only) + UNIT TESTS
======================================================================
Fixture loader for unit tests (pure, no DB):
```
const filas=(t)=>SEED.find(s=>s.tabla===t)!.filas as any[]
const inf=(f,n)=>armarInforme(
  filas('pedidos').find(p=>p.FECHA_RECE===f&&p.NRO_RECEPC===n),
  filas('descres').filter(d=>d.FEC_PED===f&&d.NROMOV===n))
```

4.1 `hallazgos(inf: Informe): Hallazgo[]`, with `Hallazgo = {animal, prueba, valor, rango}`. Lives in informe.ts.
```
const varios=inf.animales.length>1
for each animal, for each analisis { let seccion=''           // reset per analysis, same as matrizRodeo (informe.ts:211-213)
  for l of lineas: seccion line -> seccion=l.prueba; else if l.fuera ->
    push({animal:a.identificacion,
          prueba: varios&&seccion ? `${seccion} · ${l.prueba}` : l.prueba,
          valor:[l.valor,l.unidad].filter(Boolean).join(' '),   // same as matriz celdas (informe.ts:232)
          rango:l.rango}) }
```
- Prefixing the section only when `varios` matches the prototype in both cases ([V] diseno/prototipo/portal-datos.js:132-139): the animal case gives just the prueba; the rodeo gives grupo · prueba.
- The UI hides the animal when there's 1 animal.
- Animals with findings = `inf.animales.filter(a=>a.fueraDeRango>0).length` (don't dedupe by name).
- Title: `${n} ${n===1?'valor':'valores'} fuera de rango${k>1?` en ${k} animales`:''}` ([V] portal-datos.js:250-251).
Expected on the fixture [V, derived from R/src/seed/fixture.ts]:
- 260724/5 SHAKIRA → [{SHAKIRA, 'R.D.W.', '22,5 %', '17,0 - 20,0 %'}]
- 260722/219 → [{'151667', 'LEPTOSPIROSIS · Hardjo', '1/400', 'Negativo'}]. IBR '79% - POSITIVO' (DENTRO=S) is excluded.
- 260724/2 ROCKY → [{ROCKY, 'Toxoplasma gondii', 'POSITIVO', 'Negativo'}]
- 260723/12 LOLA → []
CASING FLAG [V]: data sections are 'LEPTOSPIROSIS'. The design/prototype shows 'Leptospirosis · Hardjo' (capture 13 [V]) and the matrix header shows "Brucelosis" for 'INFORME DE BRUCELOSIS'. .resumen-prueba has no text-transform (estilos.css:243), so the data renders 'LEPTOSPIROSIS · Hardjo'. th.grupo-col is uppercased by CSS anyway. Recommendation: keep data casing (matches the printed report); Luis decides. Tests assert 'LEPTOSPIROSIS · Hardjo'.

4.2 `fichaComun(inf): [etiqueta, valor][]`
- Fields in reference order minus Identificación (render.ts:194-197): Especie, Raza, Sexo, Edad, Pelaje. Keep those that are non-empty and equal across all animals.
- Fixture 219 → [['Raza','NELORE'],['Sexo','Hembra'],['Edad','2.00 Años']]. ESPECIE '' and PELAJE 'SIN PELAJE' are cleaned to '' by limpio. This matches the prototype exactly (portal-datos.js:111).
- Tests: change one cow's EDAD and Edad drops out; empty informe → [].

4.3 `fechaLarga(iso)`, `agruparPorFecha(rs): {fecha, titulo, pedidos}[]`
- Use DIAS/MESES arrays and `new Date(Date.UTC(y,m-1,d)).getUTCDay()`. Group with a Map (insertion order), sort keys descending, keep the within-group order. If `!fecha(iso)`, titulo = iso.
- [V] Weekdays: 07-28 Martes, 07-24 Viernes, 07-23 Jueves, 07-22 Miércoles, 07-10 Viernes, 2026-01-01 Jueves, 2026-12-31 Jueves.
- [V] Pitfall shown locally: with TZ=America/Asuncion, Node 22.13.1 gives `new Date('2026-07-24').getDay()` = Jueves (wrong) and getTimezoneOffset 240, i.e. UTC-4. This build's tzdata still uses old Paraguay rules; Paraguay has been permanently UTC-3 since Oct 2024 [I]. Test with process.env.TZ in 'America/Asuncion', 'Pacific/Kiritimati' and 'Pacific/Pago_Pago' (restore it after). `.grupo-fecha` = fmtFecha(fecha).

4.4 "nuevo"
- `esNuevo(p, anterior: string|null) = p.estado==='disponible' && !!anterior && p.fecPed > anterior`
- `contarNuevos(todos, anterior)` counts the UNFILTERED list ([V] portal-datos.js:221).
- `registrarVisita(v, codigo, hoy) -> {visitas, anterior}` with `v[codigo]=[anterior, ultima]`. If ultima !== hoy then anterior=ultima and ultima=hoy; otherwise keep both.
- Why the pair: the design's single date (DISENO §5.3) is overwritten on the first GET /pedidos. Every filter or search click is also a GET /pedidos, so NUEVO would vanish on the first click. Design gap, fixed by the pair.
- Cap at about 10 clinic entries. Wrap as `{fechas:{...}}`, because firmar spreads an `exp` key into the data (auth.ts:131).
- Tests: ('2026-07-24' disponible, '2026-07-23') → true; equal date → false; en_proceso → false; anterior null → false; registrarVisita transitions (first, same day, next day); fixture with anterior '2026-07-23' → 2.
- `hoyPy(now=Date.now()) = new Date(now-3*3_600_000).toISOString().slice(0,10)`. Tests: 2026-10-05T02:59Z → '2026-10-04'; 03:00Z → '2026-10-05'. Also fixes the reference "Consultado" date, which uses the UTC date (render.ts:259) and shows tomorrow after 21:00 local.

4.5 Filter
- `ESTADOS = ['disponible','en_proceso','fuera_de_ventana'] as const`
- `estadoDe(v: unknown): EstadoPedido|null` via ESTADOS.includes. Never use `in` or a Record lookup: '__proto__' and 'constructor' would pass.
- `filtrarPedidos(todos, q, estado) -> {pedidos, conteos:{todos, disponible, en_proceso, fuera_de_ventana}}`. Counts are computed on `buscados` (after q) [V] portal-datos.js:217-218.
- Fixture (Tacuary, no q): 5/3/1/1. q=151667: 1/1/0/0.
- Note: if DISENO §5.9's 50-animal pedido is added to 2646, every Tacuary count and N-test number changes. If it reuses caravana 151667 (prototype rodeo() starts with those 4 [V]), q=151667 matches two pedidos. Decide the fixture before freezing numbers, or put extra fixtures in clinic 424.

4.6 Search (moved out of R/src/server.ts:40-47)
- `plano`, `coincide(p,q)` move to src/lib/buscar.ts. Write the regex escaped as `/[\u0300-\u036f]/g`; the reference has literal combining characters in the source.
- Optional improvement from the prototype (portal-datos.js:191): add `p.referencia.replace(/\s/g,'')` to the text so '260724/5' finds '260724/  5'.
- U12 tests: '24/07/2026', '2026-07-24', 'shakira', 'BIOMETRÍA' (accented query vs plain data) match; multi-term AND ('shakira serologia' → false).

4.7 `fmtFecha` (moved from R/src/render.ts:16-20)
- Tests: '2026-07-24' → '24/07/2026'; null → ''; 'basura' → 'basura'.
- Window text: `Resultados en línea del ${fmtFecha(desde).slice(0,5)} al ${fmtFecha(hasta)}`, giving "…del 22/07 al 24/07/2026" for the fixture (desde 07-22, hasta 07-24).

4.8 `validarVolver(v: unknown): string|null`
```
typeof v==='string' && /^\/pedidos\/\d{4}-\d{2}-\d{2}\/[1-9]\d{0,8}(\?hallazgos=1)?$/.test(v) ? v : null
```
- JS `\d` is ASCII-only and `$` without the m flag doesn't match before "\n" [V].
- Accept: '/pedidos/2026-07-24/5', '/pedidos/2026-07-22/219?hallazgos=1'.
- Reject: null, 1, ['/pedidos/…'], '', '/pedidos', '/pedidos/', '/pedidos/2026-07-24/5/', '/pedidos/2026-07-24/0', '/pedidos/2026-07-24/-1', '//evil.com', '///evil.com', '/\evil.com', '\\evil.com', 'https://evil.com', 'http:/evil.com', 'javascript:alert(1)', '/pedidos/../elegir', '/pedidos/2026-07-24/5/../../x', '/pedidos/%2e%2e/x', '%2Fpedidos%2F2026-07-24%2F5', '/pedidos/2026-07-24/5\r\nSet-Cookie: x=1', '/pedidos/2026-07-24/5#x', '/pedidos/2026-07-24/5?hallazgos=1&x=//e', ' /pedidos/2026-07-24/5', '/PEDIDOS/2026-07-24/5', '/pedidos/2026-07-24/5@evil.com', full-width digits.
- Use it at every hop (§7.10).

4.9 Also pure, with tests:
- `MENSAJES`/`mensajeDe` (U15).
- `destinoVisible`, moved from server.ts:133-136. The reference shows the FULL email; v2 masks it (`el correo t•••@dominio`, portal-datos.js:29, DISENO §4.1). Flag.
- Optional `mensajeWhatsApp(inf, url)`. Test that it contains no values ('22,5', '▲') per DISENO §5.6. Base URL from config (e.g. URL_PUBLICA), never the Host header.

======================================================================
5. MODULE SINGLETONS → globalThis (src/lib/servidor.ts, server-only)
======================================================================
Express dependencies in the reference [V]:
- crearApp builds directorio, codigos and the notifier from deps (server.ts:49-53).
- setInterval cleanup every 5 min, unref'd (server.ts:228-229).
- main(): openDb, directorio.cargar() and the startup log (server.ts:234-252).
- Module-scope `let ventana` in repo.ts:32.
- `sessionSecret` randomBytes in config.ts:50.
- `req.ip` with trust proxy (server.ts:56,107). Next has no request ip (NextRequest.ip was removed in v15 [V, upgrading docs]).

```ts
type Estado={db?:Promise<Db>; directorio?:Promise<DirectorioClinicas>; codigos?:Codigos}
const g=globalThis as typeof globalThis&{__cedivep?:Estado}
const e=(g.__cedivep??={})
export const getDb=()=>(e.db??=openDb().catch(err=>{e.db=undefined;throw err}))   // don't cache a rejection
export const getDirectorio=()=>(e.directorio??=getDb().then(db=>new DirectorioClinicas(db)))
export function getCodigos(){ if(!e.codigos){ e.codigos=new Codigos(); setInterval(()=>e.codigos!.limpiar(),5*60_000).unref() } return e.codigos }
// config.ts:
sessionSecret: secretFromEnv || ((globalThis as any).__cedivepSecreto ??= randomBytes(32).toString('hex'))
```
- Lazy init needs no explicit cargar: DirectorioClinicas.buscar loads when leido=0 (repo.ts:148) [V]. Lazy init also keeps `next build` from connecting to MySQL.
- `ventana` can stay module-scope (a duplicate per module instance only costs one extra query every 10 min); move it later if you want consistency.
- Concurrency: two first requests may both call cargar(); harmless.
- With `next start`, all of this assumes routes, instrumentation and the Node-runtime proxy share one process [I]. The e2e login tests prove that cross-bundle sharing works.
- Startup log and checks go in src/instrumentation.ts:
  ```
  export async function register(){
    if(process.env.NEXT_RUNTIME!=='nodejs')return
    if(process.env.NEXT_PHASE==='phase-production-build')return    // [U] whether register runs at build
    const {arrancar}=await import('./lib/arranque')
    await arrancar().catch(e=>console.error('[arranque]',e))
  }
  ```
  - [V] register is "called once when a new Next.js server instance is initiated, and must complete before the server is ready"; NEXT_RUNTIME targeting is documented.
  - `arrancar` prints the main() lines: `clínicas · contactos · N contactos compartidos bloqueados`, needed for step 6.
  - Warnings: demo with mysql; `!demo && !SESSION_SECRET` should fail fast per HANDOFF §7.6. [U] whether a throw in register stops the server, so test it.
- Dev HMR: globalThis survives module re-evaluation [I, standard pattern]. Old class instances persist after editing auth.ts, which is fine.
- Proxy docs warn not to rely on shared globals between proxy and app [V]. The proxy only needs the secret (env or globalThis) to verify the session and sign cedivep_visita.

======================================================================
6. IMPORTS, server-only, TOOLING
======================================================================
- Drop the `.js` extensions; use extensionless relative imports in src/lib and tests. That works with Turbopack (C10), TypeScript `moduleResolution: bundler`, and tsx in CJS or ESM [I: tsx resolves extensionless and .js→.ts]. No `"type":"module"` needed; avoid top-level await in tests (use before()).
- Next 16 builds with Turbopack by default [I]. The webpack-only `extensionAlias` doesn't help there.
- [I] Next's default tsconfig includes `**/*.ts`, so `next build` type-checks `_referencia/src/server.ts` (express isn't installed) and fails. Add `"exclude": ["node_modules","_referencia"]`.
- server-only [V]: installing it is optional in Next (docs: "contents … not used by Next.js"). Its package exports are react-server → empty.js and default → index.js, which throws. Locally: plain node throws; `node --conditions=react-server` passes for both CJS and ESM.
  - Recommendation: `npm i server-only`, put it in db.ts, repo.ts, auth.ts and servidor.ts (config.ts optional), and change the test script to `node --conditions=react-server --import tsx --test test/*.test.ts`.
  - If the package isn't installed, any test importing those modules fails with ERR_MODULE_NOT_FOUND.
  - Keep the new pure modules (buscar, fechas, volver, mensajes, hallazgos in informe) importable without the flag where possible. informe.ts imports config.
- next.config.ts:
  - `serverExternalPackages: ['mysql2']`: mysql2 is NOT in Next's auto-external list [V], so add it now.
  - `poweredByHeader: false` (the reference disabled x-powered-by).
  - `headers()` for X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy no-referrer.
  - Cache-Control already arrives on dynamic pages; Next doesn't override one set via config ([V] send-payload.ts).
- node:sqlite: see C6. Keep the static import; if the build fails, switch to `process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')`.
- Use plain `<a>`, not next/link. No RSC prefetch of clinic data into the client Router Cache, which would otherwise survive a clinic switch. Behaviour stays identical with and without JS. The proxy matcher skips prefetches anyway.

======================================================================
7. SECURITY REVIEW (what the port could break)
======================================================================
1. Comodín (0,1): excluded only when the index is built (repo.ts:125). Add defense in depth in `requireClinica()`: reject a session whose `actual.codigo` is in clinicasComodin. Never accept a clinic from the URL, query or form except via the `habilitadas.find` in /api/elegir (server.ts:176).
2. HABILITA / MOROSO: applied only at the 10-min index refresh. Sessions (12 h) and pending codes (10 min) outlive a deactivation. Acceptable; note it. The harness pins both flags.
3. `CLINICA=?`: listarPedidos (repo.ts:53,64) and obtenerInforme (repo.ts:83) are correct, and the second descres query is keyed by (fec,nro) after the clinic-filtered pedido is found.
   - [U] Uniqueness of (FECHA_RECE, NRO_RECEPC) in MySQL `pedidos` was never verified (sql/indices.sql creates a non-unique index). A duplicate pair across two clinics would leak descres rows. Run in step 6: `SELECT FECHA_RECE,NRO_RECEPC,COUNT(*) FROM pedidos GROUP BY 1,2 HAVING COUNT(*)>1`.
   - Never wrap these queries in 'use cache', unstable_cache or ISR. React `cache()` (per request) is fine.
4. Cookies: httpOnly, SameSite=lax, Secure via COOKIE_SECURE, path '/', maxAge in SECONDS (C2). Delete with value '' (Navegador). Optional: the `__Host-` prefix when secure.
5. Timing-safe compares are correct: sha256 of `clave|codigo` with equal lengths (auth.ts:106); HMAC length check, then timingSafeEqual (auth.ts:141). Proxy runs on Node by default in v16 and can't be set to edge [V], so node:crypto is fine everywhere.
6. The paso cookie carries `demo` (the code) in readable base64 JSON (signed, not encrypted). It's only set when config.demo (server.ts:120). Re-sign without demo after terminal failures (2.5). Warn at startup if demo && mysql.
7. leerFirmado:
   - No purpose separation: one HMAC for paso, sesion and visita, and `datos as T` is unchecked. Swapping cookies mostly fails closed (`!s?.habilitadas?.length`).
   - But a sesion value placed in cedivep_paso makes `destinoVisible(paso.clave)` call `.split` on undefined, which is a 500 (server.ts:142). Self-inflicted.
   - Fix: validate shape (`typeof paso?.clave==='string'`), or add a `t` purpose field to firmar/leerFirmado (a small logic change; flag).
   - Plus C5 (secret on globalThis).
   - Enumeration (C8). Fix: always `emitir` a pending code, even with no clinics (`clinicas:[]`), and treat a successful verify with empty clinicas as 'incorrecto'. Attempts and agotado then behave identically. Demo still shows the code only when clinics exist.
   - Residual timing oracles: the forced directorio reload on a miss (repo.ts:151, at most once per minute), and a future WhatsApp notifier awaited only for known contacts. Don't await the real notifier.
8. Session size: habilitadas is capped by maxClinicasPorContacto=5 (config.ts:72; contacts above that are blocked, repo.ts:138-141), so the cookie stays around 1 KB or less [V by construction]. Stateless sessions can't be revoked; logout only clears the cookie.
9. Reenviar: take the clave only from the verified paso cookie; ignore `contacto` when reenviar=1; same `admitir(clave, ip)`; keep volver; new demo code; same 303 for unknown contacts. Never put the full contact in a hidden field: it would end up in the HTML and the RSC payload.
10. Open redirect:
    - `redirect()` accepts absolute URLs by design [V redirect docs], so validate before every redirect/Location.
    - Use the strict regex (4.8) at each hop: query → hidden input → paso cookie → 303 → /elegir?volver → /api/elegir.
    - Emit exactly the validated string; never normalize then emit (normalizing can produce '//evil.com').
    - React escapes the hidden input value.
11. cedivep_visita:
    - Signed; holds only dates per clinic code; at most 10 entries; httpOnly/lax/secure, long maxAge. Tampering only affects your own NUEVO.
    - The proxy must verify cedivep_sesion with leerFirmado (never decode it unverified).
    - Always overwrite or delete any client-sent `x-cedivep-visita` request header before setting it.
    - It persists across logout. On a shared PC it reveals which clinic codes were used (minor).
    - The proxy matcher must cover /pedidos and exclude prefetches.
12. CSRF:
    - Explicit SameSite=Lax means Lax cookies aren't sent on cross-site POST (no 2-min exemption with an explicit attribute [I]). That blocks /api/verificar, elegir and salir CSRF and login CSRF. CSP `form-action 'self'` helps too.
    - Route Handlers have no Origin check (only Server Actions do). Optionally reject a mismatched Origin.
13. CSP: nonce recipe in proxy.ts [V].
    - 'strict-dynamic' requires the nonce on all scripts.
    - style-src with a nonce blocks `style=""` attributes, so no inline style props.
    - Dev needs 'unsafe-eval' and 'unsafe-inline' for styles [V].
    - Include `upgrade-insecure-requests` only when COOKIE_SECURE (LAN/http use) [U].
    - The matcher excludes /api (303s, no body).
14. Body size: Express capped bodies at 2 KB (server.ts:69); Route Handlers have no cap. Return 413 when content-length > 2048; keep the field slices (200/20).
15. /health: C9. Add `export const dynamic='force-dynamic'` [I].
16. Cache: dynamic pages are private/no-store by default [V]. Keep everything dynamic (cookies() or the nonce headers()); no ISR/cacheComponents; no loading.tsx (C4).
17. Client IP: XFF is client-controlled unless a proxy appends (Next only fills it when absent [V]). Use the rightmost XFF entry. That's correct behind Cloudflare, which appends the visitor IP [I], but spoofable if exposed directly. The per-contact and per-code limits still hold. Document this ceiling.
18. Paraguay time: use a fixed -3 offset, not Intl/TZ (4.3/4.4).
19. Logs: keep enmascarar. The IP is logged on limit hits (server.ts:109).

======================================================================
8. DECISIONS FOR LUIS
======================================================================
- 303 + ?error vs a literal 400/429 (2.5).
- Keep 403 for elegir (recommended) vs PRG.
- Section casing in hallazgos and matrix headers (4.1).
- Single-date "nuevo" vs the date pair (4.4).
- Email masking on /verificar (4.9).
- Search by reference without spaces (4.6).
- Enumeration fix (C8/7.7).
- Restrict /health (C9).
- Where the 50-animal fixture goes (4.5).
- Literal 429 wording in HANDOFF/DISENO.

Sources: https://nextjs.org/docs/app/api-reference/functions/redirect · https://nextjs.org/docs/app/api-reference/functions/not-found · https://nextjs.org/docs/app/guides/content-security-policy · https://nextjs.org/docs/app/api-reference/file-conventions/proxy · https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation · https://nextjs.org/docs/app/api-reference/functions/cookies · https://nextjs.org/docs/app/guides/environment-variables · https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages · https://nextjs.org/docs/app/getting-started/server-and-client-components · https://github.com/vercel/next.js/issues/82945 · next.js source via Context7 (packages/next/src/server/lib/cache-control.ts, server/base-server.ts, server/app-render/app-render.tsx, server/send-payload.ts)