# CEDIVEP — results portal for clinics

Web portal where each veterinary clinic logs in with a one-time code and sees its own lab results.
CEDIVEP is a veterinary diagnostic lab in Paraguay. Data: the lab's MySQL, **read-only**.

- Full context, decisions and the verified data model: `HANDOFF.md` (Spanish). Evidence about the DB: `docs/`.
- **Approved design (wins on anything visual): `diseno/DISENO.md`** + `diseno/estilos.css` + `diseno/prototipo/`.
- Working notes from the port (markup/copy inventory, test port map, Next 16 facts): `docs/port/`.
- Express reference implementation (working, 41 tests): `_referencia/`. Logic was ported from there.

## Stack

Next.js 16 (App Router) · strict TypeScript · React Server Components · `mysql2` · `node:sqlite` for the
demo and tests · Node runtime everywhere (never Edge) · own CSS (`src/app/globals.css`, from
`diseno/estilos.css`), no Tailwind · Archivo + IBM Plex Mono via `next/font`.

## Commands

- `npm run dev`: development. With `CEDIVEP_DRIVER=sqlite` (the default) it needs no DB or network.
- `npm test`: unit tests (Node test runner + tsx).
- `npm run test:e2e`: `next build`, then the end-to-end suite against `next start` (one server per describe).
- `npm run lint` · `npx tsc --noEmit`
- Demo login: phone `0981 000 001`. The code shows on screen in demo mode. `0981 000 002` belongs to two clinics.

## Rules that never break

1. **The portal never writes to the DB.** No INSERT/UPDATE/DELETE.
2. **Every order/report query filters by `p.CLINICA = ?` with the session's clinic.** Someone else's order and a
   nonexistent order both give 404, indistinguishably. Tests check this; keep them green.
3. **Clinics 0 and 1 are wildcards** (1 = private owners). They can never be a session.
4. **Never `dangerouslySetInnerHTML`.**
5. **Authenticated pages are dynamic and respond `Cache-Control: private, no-store`.** No per-clinic caching:
   no `use cache`, ISR, `cacheComponents`, `loading.tsx` or `<Suspense>` on authenticated routes.
6. **No secrets in the repo.** Credentials go in `.env.local`. Never use the `root`/admin DB user for the portal.
7. **Forms: HTML `<form>` → `POST` Route Handlers under `/api/…`, which answer 303** (Post/Redirect/Get; errors
   go back as `?error=` and the page shows the message).
8. Login messages are identical whether or not the contact exists. Never reveal who is registered.
9. Plain `<a href>` links, no `next/link` (no RSC prefetch, no client router cache across clinic switches).
10. No `style={{}}` props (the nonce CSP blocks inline styles).

## Data (verified against the real DB; details in HANDOFF.md §3)

- Join: `descres (FEC_PED, NROMOV) = pedidos (FECHA_RECE, NRO_RECEPC)` → `pedidos.CLINICA` → `clini_vet.CODIGO`.
- `TITULO='S'` = section title. `DENTRO='N'` = out of range.
- **Print order: `UBICACION`.** `ORDEN` = the animal (an order can be a whole herd).
- `mysql2` with `dateStrings: true` (otherwise dates shift a day in UTC-3). DECIMAL arrives as a string.
- Filler values to hide: `'0000-00-00'`, `'SIN PELAJE'`, `'SS'`, `'0'`.

## Conventions

- **Language:** code, identifiers, comments, file names, tests, logs, commits and PRs are in **English**.
  **Spanish** is for UI copy (rioplatense voseo: "ingresá", "probá") and everything visible in the address bar:
  page paths (`/pedidos`, `/verificar`, `/elegir`) and query params (`q`, `estado`, `hallazgos`, `volver`, `error`).
  DB column names stay as they are.
- Domain glossary: pedido→order, informe→report, clínica→clinic, rodeo→herd, hallazgos→findings,
  caravana→tag, ficha→profile, ventana→resultsWindow.
- Domain logic lives in `src/lib/`, as pure functions where possible, each with its test.
- Small commits, one per green step, with the why. Never push without asking.
