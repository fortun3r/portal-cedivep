# Portal de resultados CEDIVEP — Handoff para Claude Code

> **Si sos la sesión de Claude Code que arranca en esta carpeta: leé este documento entero antes
> de escribir una línea de código.** Resume semanas de trabajo previo: qué se decidió, qué se
> verificó contra la base real, qué ya está construido y probado, y el plan para seguir.
> Ante cualquier contradicción con los documentos de `docs/`, **gana este archivo** (los de `docs/`
> son la evidencia en orden cronológico; algunas conclusiones tempranas quedaron superadas).

> **Actualización 05/10/2026 — diseño v2 aprobado.** Lo visual ahora lo manda **`diseno/DISENO.md`**
> (con `diseno/estilos.css`, `diseno/capturas/` y el prototipo en `diseno/prototipo/`). Reemplaza a
> `capturas/` y a `_referencia/public/styles.css` como objetivo del paso 4. Todo lo demás de este
> archivo sigue vigente.

Preparado el 05/10/2026 por la sesión anterior de Claude (Cowork, en la nube), trabajando con
Luis Isasi. Esa sesión **no tenía acceso de red a la base**; vos, corriendo en el Mac de Luis, **sí**.

---

## 0. Para Luis: cómo usar este paquete

1. El zip ya trae la carpeta `cedivep-portal/` armada. Descomprimilo **en `~/dev/isasiluispy/`**
   (no adentro de una carpeta `cedivep-portal` que hayas creado: quedaría duplicada):
   ```bash
   cd ~/dev/isasiluispy && unzip ~/Documents/cedivep/cedivep-portal-handoff.zip
   ```
   Tiene que quedar `~/dev/isasiluispy/cedivep-portal/CLAUDE.md` y `.../HANDOFF.md`.
   Si ya habías creado la carpeta vacía, borrala antes.
2. Abrí Claude Code ahí: `cd ~/dev/isasiluispy/cedivep-portal && claude`
3. Primer mensaje: **"Leé HANDOFF.md y diseno/DISENO.md y arrancá por el paso 1 del plan (§6)."**
4. El archivo de reglas viene como `CLAUDE.template.md`. **Claude Code: si no existe `CLAUDE.md`,
   renombrá `CLAUDE.template.md` a `CLAUDE.md` antes de empezar.**

`CLAUDE.md` se carga solo en cada sesión: tiene las reglas permanentes del proyecto.
Este `HANDOFF.md` es el contexto completo para arrancar.

---

## 1. Qué es esto

**CEDIVEP** es un laboratorio de diagnóstico veterinario en Paraguay. Su sistema de gestión está
escrito en **Visual FoxPro 9** (~496.000 líneas, 232 tablas DBF) y lo mantiene **Olga Galeano**,
mamá de Luis y autora original del sistema. Luis está armando la propuesta para modernizarlo entero.

**Este repo es el primer paso y la carta de presentación de ese proyecto:** un portal web donde
**cada clínica veterinaria entra y ve los resultados de sus análisis**.

Lo que pidió Luis, en orden de importancia:

1. **Ingresar como clínica** y ver solo lo propio.
2. **Ver el informe** de cada pedido, igual al impreso.
3. **Historial** de pedidos de la clínica.
4. **Buscar** por animal o caravana.
5. **Estado del pedido** en curso (recibido / en proceso / listo).
6. Descargar el PDF firmado oficial — **fuera de alcance por ahora** (ver §10).

Lo usan veterinarios **desde el celular, abriendo un link de WhatsApp**. Eso manda en las
decisiones de diseño: tiene que cargar rápido en un teléfono y ser cómodo con el pulgar.

---

## 2. Decisiones ya tomadas — no relitigar sin un motivo nuevo

| Tema | Decisión | Por qué |
|---|---|---|
| Framework | **Next.js** (App Router), **sin Express** | Estándar de React con servidor; estructura que crece hacia el sistema grande (ADR-0004 dice React) |
| Lenguaje | **TypeScript estricto** de punta a punta | ADR-0004 del proyecto de migración |
| Renderizado | **Server Components**: al celular llega HTML, casi sin JS | Velocidad desde WhatsApp; React escapa todo solo (ver §7) |
| Formularios | **`<form>` HTML clásico → Route Handlers POST**, no Server Actions | Funcionan sin JS y se testean con HTTP plano (§6, paso 3) |
| Estilos | **`diseno/estilos.css`** (diseño v2) como CSS global + fuentes con `next/font`. **Sin Tailwind** | Diseño aprobado sobre prototipo navegable (ver `diseno/DISENO.md`) |
| Base de datos | **La MySQL de Olga, solo lectura**, vía `mysql2` | El portal no escribe una sola fila |
| Demo y tests | **SQLite** embebido (`node:sqlite`) con datos de ejemplo | Corre sin base y sin red |
| Ingreso | **Sin contraseñas**: código de 6 dígitos al celular/correo de la clínica | 4.312 clínicas; el precedente en casa es una clave `1234` compartida por todos |
| Sesión | Cookie **firmada con HMAC** (no JWT de librería, no tabla de sesiones) | Sin estado en la base; base de solo lectura |
| Runtime | **Node** en todas las rutas (nunca Edge) | `mysql2`, `node:sqlite` y `node:crypto` lo necesitan |
| Hosting (propuesta) | Servidor Windows del laboratorio + **Cloudflare Tunnel** | Permite cerrar el MySQL público. **Lo decide Luis/el laboratorio** |

Está todo justificado en `docs/ADR-0008-stack-portal.md` (va a la carpeta `_migracion/adr/` del
proyecto grande).

---

## 3. El modelo de datos — verificado contra la base real

Todo lo de esta sección se comprobó con datos reales (no se dedujo del código ni de capturas).

### 3.1 La cadena que une un resultado con una clínica

```
descres (resultados, ya desnormalizados para imprimir)
   │   (FEC_PED, NROMOV)  =  (FECHA_RECE, NRO_RECEPC)
   ▼
pedidos (cabecera del pedido) ──── CLINICA ────► clini_vet (CODIGO)
                              ├─── VETERINARI ─► doctor (CODDR)
                              └─── PROPIETARI ─► paciente (CODIGO)  ← todavía NO está en MySQL
```

Verificado el 05/10/2026 sobre la base real: **3.531 de 3.532 pedidos de `descres` encuentran su
cabecera (99,97 %)**; 90,8 % tienen clínica real; **625 clínicas distintas** tienen resultados.

**Usá siempre la clave compuesta `(FECHA_RECE, NRO_RECEPC)`.** `NUMEROID` existe en `descres` pero
**no vino en la tabla `pedidos` de MySQL**, y en el DBF viene nulo en los registros viejos.

### 3.2 La consulta del portal (verificada, 0,07 s)

```sql
SELECT d.* FROM descres d
  JOIN pedidos p ON p.FECHA_RECE = d.FEC_PED AND p.NRO_RECEPC = d.NROMOV
 WHERE p.CLINICA = ?                                   -- la clínica de la sesión
   AND COALESCE(p.ANULADO, '') <> 'S' AND COALESCE(p.BORRADO, '') <> 'S'
 ORDER BY d.UBICACION;
```

### 3.3 Cómo se lee `descres` — el bug grave del MVP original venía de acá

| Columna | Significa | Ojo |
|---|---|---|
| `TITULO` | `'S'` = fila de **título de sección** (BIOMETRIA HEMATICA, LEUCOGRAMA); `'N'` = medición | El MVP original trataba cualquier valor no vacío como título → **todo** salía como título |
| `DENTRO` | `'N'` = **fuera de rango**; `'S'` = dentro | Los títulos traen `'S'`; ignorarlos. Un `'N'` con valor vacío no es hallazgo |
| `UBICACION` | **El orden de impresión** real, único en el pedido | **No ordenar por `NROSEC`**: los análisis de un animal se entremezclan |
| `ORDEN` | **El animal** dentro del pedido (1, 2, 3…) | Un pedido puede ser un rodeo entero: hay uno real con 650 filas y 24 páginas |
| `CODANAL` | Un análisis completo | El hemograma (2423) trae dos secciones |
| `NOMANAL` | En la práctica igual a `NOMRESULTA` en cada fila | **No** es el nombre del análisis agrupador |
| `RELATIVA` + `MEDIDA` | Segundo valor (ej. `4650` `/mm3`) | `'0'` o vacío = no hay |
| `REFERENCIA`, `OBSERVA` | Rango y método | Traen **saltos de línea** adentro → `white-space: pre-line` |

### 3.4 Lo que ensucia los datos (todo esto ya está resuelto en `_referencia/src/`)

- **Valores de relleno** del sistema viejo: `'0000-00-00'`, `'SIN PELAJE'`, `'SS'` (sin sexo),
  `'0'` → se ocultan.
- **Números crudos**: la base guarda `7826000` y `11.6`; el impreso dice `7.826.000` y `11,6`.
  Ver `formatoNumero()`. Los textos (`79% - POSITIVO`, `1/400`) y los ceros a la izquierda (`03`) no se tocan.
- **Teléfonos imposibles de comparar en SQL**: `'0986 441 190'`, `'+595 981-163342'`,
  `'981-114.114 - 754.278'` (dos números en un campo), `'0981.409495  0343 - 420 984'`.
  Correos de a dos separados por coma. Ver `contacto.ts`: se indexa todo en memoria.
- **`CLINICA = 1` es un comodín** (particulares, 9 % de los pedidos). **Nadie puede entrar como la
  clínica 1**: vería los resultados de todos los particulares. Ya está excluida en la referencia.
- `mysql2` devuelve **DECIMAL como string** y, sin `dateStrings: true`, **DATE como objeto `Date`**
  en la zona del servidor — en Paraguay (UTC-3) las fechas se corren un día. Mantené `dateStrings: true`.
- **`ESPECIE` viene vacía** en `descres` real. No mostrar "Especie: —".
- **`descres` en MySQL es una ventana móvil**, no la historia (12 días al 05/10). Un pedido viejo sin
  resultados no está "en proceso": quedó fuera de la ventana. La referencia distingue los tres estados.

### 3.5 Banderas de negocio en `clini_vet`

`HABILITA` (`'N'` = dada de baja → no entra), `MOROSO` (`'S'` = debe plata → **hoy entra igual**,
ver §10), `DUDOSO`, `ENVIO` (B/C/W, probablemente boleta/correo/WhatsApp).

Contactos de las 577 clínicas con resultados: **96 % tiene teléfono, 76 % email, 99 % al menos uno**.

Detalle completo del schema (13 tablas, todas las columnas): `docs/02-mapa-mysql.md`.

---

## 4. Qué hay en este paquete

```
HANDOFF.md            este archivo
CLAUDE.template.md    reglas permanentes del repo → renombrar a CLAUDE.md (Claude Code lo carga solo)
diseno/               DISEÑO v2 APROBADO: especificación, CSS listo, capturas y prototipo navegable
.env.example          variables de entorno (copiar a .env.local)
_referencia/          IMPLEMENTACIÓN DE REFERENCIA en Express — funciona, 41 tests en verde
capturas/             cómo se ve la referencia actual (superado como objetivo visual por diseno/)
docs/                 la evidencia: hallazgos sobre la base, mapa del schema, verificación, ADR-0008
sql/                  índices y usuario de solo lectura, para pasarle a Olga
```

### `_referencia/` — lo más valioso del paquete

Es el portal completo, hecho en Express + HTML del servidor, **probado contra un demo SQLite con la
forma exacta de las tablas reales**. Se decidió pasarlo a Next.js (§2), pero **la lógica no se
reescribe: se mueve**. Para levantarla y verla funcionar:

```bash
cd _referencia && npm install && npm test     # 41 tests
npm start                                      # http://localhost:3000
# ingresar con el celular 0981 000 001 → el código aparece en pantalla (modo demo)
# 0981 000 002 está en dos clínicas → pantalla para elegir
```

Commits de la referencia: MVP original (julio) → portal por clínica → tests de matriz y formato.

---

## 5. Qué se reutiliza y qué se reescribe

| Archivo en `_referencia/src/` | Destino en Next.js | Cambios |
|---|---|---|
| `informe.ts` — arma el informe, estados, matriz de rodeos, formato numérico | `src/lib/informe.ts` | **Ninguno.** Funciones puras |
| `contacto.ts` — normaliza teléfonos y correos | `src/lib/contacto.ts` | **Ninguno** |
| `repo.ts` — consultas, autorización, índice de contactos | `src/lib/repo.ts` | Ninguno de lógica; agregar `import 'server-only'` |
| `auth.ts` — códigos, límites de intentos, cookies firmadas | `src/lib/auth.ts` | Ninguno de lógica; `server-only` |
| `db.ts` — drivers mysql/sqlite | `src/lib/db.ts` | Instancia única en `globalThis` (ver paso 2) |
| `config.ts`, `types.ts`, `notificar.ts`, `seed/fixture.ts` | `src/lib/…` | Ninguno |
| `test/contacto.test.ts`, `test/informe.test.ts` | `test/…` | Solo rutas de import |
| `server.ts` — rutas Express | `src/app/**` | **Se reescribe** (§6) |
| `render.ts` — HTML con plantillas de texto | componentes `.tsx` | **Se reescribe** como componentes React |
| `test/portal.test.ts` — de punta a punta por HTTP | `test/portal.test.ts` | Se adapta: base URL por variable, POSTs a `/api/…` |
| `public/styles.css`, `public/app.js` | `src/app/globals.css` ← **`diseno/estilos.css`**, componentes cliente mínimos | Ver paso 4 y `diseno/DISENO.md` |

---

## 6. Plan de trabajo — en este orden

Cada paso termina con algo que se puede verificar. **No pases al siguiente con tests en rojo.**

### Paso 1 — Andamiaje y lógica portada

- `create-next-app@latest` con TypeScript, App Router, ESLint, `src/`, **sin Tailwind**.
  Ojo: no acepta una carpeta con archivos. Crealo en una carpeta temporal y mové el contenido a la
  raíz, sin pisar `CLAUDE.md`, `HANDOFF.md`, `_referencia/`, `docs/`, `sql/`, `capturas/`.
- `git init` y primer commit con el andamiaje + este material.
- Copiá los módulos de `_referencia/src/` a `src/lib/` según la tabla de §5.
- Tests unitarios con el runner de Node, como en la referencia (`node --import tsx --test`).
  Es lo que ya funciona y no suma dependencias.
- `next.config`: `serverExternalPackages: ['mysql2']` si el bundler se queja de `mysql2`.

**Terminado cuando:** `npm test` corre los tests de `contacto` e `informe` en verde (son 17 de los 41; los otros 24 son los de punta a punta del paso 5)
y `npm run build` compila.

### Paso 2 — Instancias únicas del servidor

En la referencia, la base, el almacén de códigos (`Codigos`) y el índice de contactos
(`DirectorioClinicas`) son objetos de módulo que viven lo que vive el proceso. En Next, el recargado
en caliente de desarrollo los recrea → se pierden los códigos pendientes. Guardalos en `globalThis`
(el patrón habitual de Next para el pool de la base). El índice de contactos se carga al primer uso.

**Terminado cuando:** pedís un código, guardás un archivo (recarga en caliente) y el código sigue sirviendo.

### Paso 3 — Rutas, mismas URLs que la referencia

| Ruta | Tipo | Qué hace |
|---|---|---|
| `/` | página | ingreso: celular o correo |
| `/verificar` | página | tipear el código |
| `/elegir` | página | elegir clínica si el contacto está en varias |
| `/pedidos?q=` | página | listado con búsqueda |
| `/pedidos/[fecha]/[nro]` | página | el informe |
| `/api/ingresar`, `/api/verificar`, `/api/elegir`, `/api/salir` | Route Handlers `POST` | responden **303** a la página siguiente |
| `/health` | Route Handler `GET` | diagnóstico (driver, conteos, ventana) |

- **POST en Route Handlers, no Server Actions.** En Next una carpeta no puede tener `page.tsx` y
  `route.ts` a la vez, por eso los POST van a `/api/…`. Así los formularios son `<form>` HTML
  comunes (funcionan sin JS) y los tests de punta a punta siguen siendo HTTP plano.
- Nombres de campos iguales a la referencia: `contacto`, `codigo`, `clinica`. Cookies:
  `cedivep_paso`, `cedivep_sesion`.
- Las páginas leen la sesión con `cookies()`; **solo los Route Handlers escriben cookies**.
- Copiá los mensajes de error de `server.ts` tal cual: son deliberadamente iguales exista o no el
  contacto (no revelan quién está registrado).

**Terminado cuando:** con `CEDIVEP_DRIVER=sqlite`, el flujo completo funciona en el navegador.

### Paso 4 — Pantallas como Server Components

> **Seguí `diseno/DISENO.md`.** Ahí están las pantallas del diseño v2, las clases de
> `diseno/estilos.css`, las funciones nuevas (filtro por estado, agrupado por fecha, "nuevo" desde la
> última visita, resumen de hallazgos, solo animales con hallazgos, compartir por WhatsApp,
> reenviar código) y el "Terminado cuando" que reemplaza al de abajo. Los 4 arreglos de esta
> lista siguen valiendo y el diseño v2 ya los resuelve.

- Traducí `render.ts` a componentes. **Nunca `dangerouslySetInnerHTML`** (ver §7).
- El botón "Imprimir / PDF" es lo único que necesita JS: un componente cliente mínimo.
- **CSP:** la referencia usa `script-src 'self'`, pero **Next mete scripts en línea** para sus
  datos → esa política lo rompe. Usá la receta de **CSP con nonce** de la documentación de Next.
  El resto de los encabezados de seguridad (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) van
  en `next.config`.

**Arreglos pendientes, detectados al revisar las capturas** (`capturas/`), para hacer en este paso:

1. **Una sola tabla por animal.** Hoy cada análisis de una línea repite el encabezado
   PRUEBA/RESULTADO/RANGO y su nota de método (ver `capturas/5-informe-rodeo.png`). Una tabla por
   animal; las notas de material y método, deduplicadas, debajo.
2. **Rodeos como matriz.** `matrizRodeo()` en `informe.ts` ya está hecha **y testeada** pero nunca se
   conectó a la pantalla. Con 4+ animales con las mismas pruebas: una fila por animal, una columna
   por prueba, valores fuera de rango en negrita con ▲, primera columna fija y desplazamiento
   horizontal en el celular. Si las pruebas difieren, devuelve `null` → vista por animal.
3. **Barra superior en el celular:** "Salir" queda cortado fuera de la pantalla
   (`capturas/9-movil-informe.png`). Que la barra se acomode en dos renglones.
4. Placeholder de búsqueda más corto (se corta en el celular).

**Terminado cuando:** se cumple el checklist de `diseno/DISENO.md` §8 (las pantallas se ven como
`diseno/capturas/` y el prototipo v2, con esos cuatro arreglos y las funciones nuevas).

### Paso 5 — Tests de punta a punta, adaptados

Portá `_referencia/test/portal.test.ts`: que tome la base URL de una variable de entorno y corra
contra `next build && next start` con el driver sqlite. Los POST pasan a `/api/…`.

**Son los tests más importantes del repo. Tienen que pasar todos**, en particular:

- una clínica **no** ve el pedido de otra cambiando la URL (→ 404);
- nadie entra como la clínica comodín 1; una clínica con `HABILITA='N'` tampoco;
- un código no sirve dos veces; a los 5 intentos fallidos se invalida;
- 4.º código para el mismo contacto en 15 minutos → 429;
- una cookie de sesión manipulada no sirve;
- **agregá uno nuevo:** las páginas autenticadas responden `Cache-Control: private, no-store`.
  Next cachea agresivamente; una página de una clínica cacheada para otra sería el peor bug posible.

**Terminado cuando:** todos en verde.

### Paso 6 — Contra la base real

Desde este Mac **sí hay conexión** a la MySQL (ver §8).

- `.env.local` con `CEDIVEP_DRIVER=mysql` y el usuario de solo lectura.
- Probá con la clínica **2646** y el pedido **2026-07-28 / 160**. Esperado: secciones
  BIOMETRIA HEMATICA y LEUCOGRAMA, y "Neutrofilos en banda 03 %" marcado fuera de rango.
  (La ventana de la base se mueve: si ese pedido ya no está, elegí otro de la misma clínica.)
- Mirá el log de arranque: cuántos contactos quedaron indexados y **cuántos se bloquearon por
  estar compartidos** por más de 5 clínicas. Si son muchos, avisale a Luis.
- Medí tiempos del listado y del informe. Sin índices (§9) puede ponerse lento con más datos.
- Para probar el ingreso sin WhatsApp: `CEDIVEP_DEMO=1` muestra el código en pantalla.
  **Nunca con el portal expuesto a internet.**

**Terminado cuando:** una clínica real entra y ve sus informes correctos.

### Después (no ahora)

- **Envío real del código por WhatsApp.** La interfaz `Notificador` ya está; falta el proveedor.
  Preguntar antes: el laboratorio ya manda resultados por WhatsApp ("mega sistema") — quizás haya
  proveedor contratado.
- Despliegue (propuesta en ADR-0008).

---

## 7. Seguridad — reglas no negociables

1. **La base es de solo lectura.** Ningún `INSERT/UPDATE/DELETE` desde el portal. Códigos y sesiones
   viven en memoria y en la cookie firmada.
2. **Toda consulta de pedidos o informes lleva `p.CLINICA = ?` con la clínica de la sesión.** Esa
   condición **es** la autorización. Pedido ajeno o inexistente → 404, sin distinguir.
3. **Las clínicas comodín (0 y 1) nunca pueden ser una sesión.**
4. **Nada de `dangerouslySetInnerHTML`.** La razón principal de pasar a React: escapa todo solo.
   La referencia escapaba a mano con `esc()`; un olvido sería un XSS servido a veterinarios
   (un nombre de animal malicioso cargado en la base).
5. **Páginas autenticadas: dinámicas y `Cache-Control: private, no-store`.** Con test (§6, paso 5).
6. **Ningún secreto en el repo.** Credenciales en `.env.local` (en `.gitignore`). `SESSION_SECRET`
   obligatorio fuera del demo.
7. **No usar `root`** para el portal. Pedir a Olga el usuario de `sql/usuario_solo_lectura.sql`.
8. **El modo demo muestra el código en pantalla**: solo con SQLite o en la máquina de desarrollo.
9. **Logs sin datos personales completos**: contactos enmascarados (`enmascarar()` en `contacto.ts`).

---

## 8. La base, desde esta máquina

- MySQL 8.0.20 en `190.128.170.42:3309`, base `cedivep`, `utf8mb4`.
- **Desde el Mac de Luis hay conexión** (verificado). Prueba rápida: `nc -vz 190.128.170.42 3309`.
- Credenciales: **pedíselas a Luis**. Hoy existe solo la cuenta de administración (está dentro de
  `~/Documents/cedivep/probe_db6.py`). Para desarrollar sirve, **pero solo en `.env.local`** y nunca
  en el código, y lo antes posible reemplazarla por el usuario de solo lectura.
- Tablas que usa el portal: `descres` (~93.000 filas), `pedidos` (~9.300), `clini_vet` (4.312).
- **Ninguna tiene índices.** El script está en `sql/indices.sql`; lo corre Olga, no nosotros.
- En `~/Documents/cedivep/` hay sondas en Python que ya funcionan (`probe_db6.py`, `dump_portal.py`
  para copiar las tablas a CSV) por si sirven para inspeccionar.

---

## 9. Pendientes del lado del laboratorio (los maneja Luis con Olga)

1. **Recargar `clini_vet`: está vieja.** 48 de las 625 clínicas con resultados no existen ahí (todas
   con código > 4.312, o sea dadas de alta después). Esas no pueden entrar.
2. **Cargar `paciente`** (propietarios), para el 9 % de pedidos de particulares.
3. **Correr `sql/indices.sql`.**
4. **Crear el usuario de solo lectura** (`sql/usuario_solo_lectura.sql`).
5. **Ampliar la ventana** de `descres`/`pedidos`: hoy hay ~1 mes, no la historia.

---

## 10. Preguntas de negocio abiertas (no las decidas vos: dejalas configurables y avisá)

- **¿Una clínica morosa ve sus resultados?** Hoy sí (`BLOQUEAR_MOROSOS=false`). El sistema viejo tiene
  un módulo de morosos y podría retener entregas. **Es la pregunta más importante para Olga.**
- ¿Las clínicas con `DUDOSO='S'` tienen alguna restricción?
- Los particulares (`CLINICA=1`): ¿entran por su teléfono vía `paciente`, o quedan fuera?
- El PDF oficial es un **documento acreditado** (SGC-PROTEC, habilitación 114-SENACSA). ¿Qué margen
  hay para regenerarlo? ¿Qué codifica su QR? Hasta saberlo, el portal dice "Consulta en línea. No
  reemplaza al informe firmado".
- ¿`FECHA_ENTR` es la fecha de entrega **prevista** o la **real**? La referencia la muestra como
  "Entrega prevista" en pedidos en proceso; confirmalo mirando datos reales.
