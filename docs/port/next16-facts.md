> Working notes from the planning session (2026-10-05). Where they differ, the plan and CLAUDE.md win. Identifiers here are often the Spanish reference names; the code uses the English glossary.

NEXT.JS 16.3.8 FACT CHECK FOR THE CEDIVEP PORT (research only, no files written)

Sources and how to read the citations
- I read the docs and source straight from the v16.3.8 git tag, not the live website.
  - `docs@` means https://github.com/vercel/next.js/blob/v16.3.8/docs/01-app/...
  - `src@` means https://github.com/vercel/next.js/blob/v16.3.8/... (line numbers are approximate, from my fetch).
- `npm view next` shows latest = 16.3.8, engines node >=20.9.0. `16.4.0-canary.60` is the canary.
- I also ran three things on this machine's Node v22.13.1 (Node only, nothing written).
- Labels: VERIFIED = seen in docs, source or a local run. INFERRED = strong reasoning from source but not run. UNVERIFIED = needs a spike.
- After `npm install`, version-matched docs ship in `node_modules/next/dist/docs/` (VERIFIED: `src@packages/next/src/server/lib/generate-agent-files.ts`).

======================================================================
1. middleware.ts renamed to proxy.ts
======================================================================
- VERIFIED. File is `proxy.ts` at the project root, or `src/proxy.ts` when using src/ (same level as app/).
  - Export either a named `proxy` function or a default export; docs recommend naming it `proxy` either way.
  - Optional `export const config = { matcher }`.
  - Source: `docs@03-api-reference/03-file-conventions/proxy.mdx` "Exports"; `docs@02-guides/upgrading/version-16.mdx` "middleware to proxy".
- VERIFIED. Runtime is Node.js only and cannot be configured.
  - Setting `runtime` in proxy throws an error.
  - Edge is not supported in proxy. The deprecated `middleware.ts` still works if you need Edge.
  - Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- VERIFIED. Matcher values must be static constants.
  - Matcher accepts a string, an array, or objects `{source, has, missing, locale}`.
  - Without a matcher, proxy runs on everything, including `_next/static`, `_next/image` and `public/`.
- VERIFIED. Proxy can read cookies (`request.cookies.get/getAll/has`) and set response cookies (`response.cookies.set`).
- VERIFIED. Proxy can pass values to Server Components through modified request headers: `NextResponse.next({ request: { headers } })`. The page then reads them with `(await headers()).get('x-...')`.
  - Do not use `NextResponse.next({ headers })`; that sends the headers to the client.
  - Source: proxy.mdx "Setting Headers"; the CSP guide reads `x-nonce` this way.
- VERIFIED. If proxy runs `NextResponse.redirect(absoluteUrl)` and the URL has the same origin as the server's own URL, router-server rewrites Location to a relative path (`src@packages/next/src/server/lib/router-utils/resolve-routes.ts` ~L759-771).
- VERIFIED. Headers proxy sets on the response are copied onto `res` before the page renders (resolve-routes ~L726, router-server ~L546).

======================================================================
2. CSP with nonce (docs@02-guides/content-security-policy.mdx)
======================================================================
Official proxy recipe (VERIFIED; dev-only additions taken from the guide's "Development vs Production" section):

    // src/proxy.ts
    import { NextRequest, NextResponse } from 'next/server'
    export function proxy(request: NextRequest) {
      const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
      const isDev = process.env.NODE_ENV === 'development'
      const csp = `default-src 'self';
        script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
        style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`};
        img-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self';
        form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;`
        .replace(/\s{2,}/g, ' ').trim()
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-nonce', nonce)
      requestHeaders.set('Content-Security-Policy', csp)          // Next reads THIS one
      const response = NextResponse.next({ request: { headers: requestHeaders } })
      response.headers.set('Content-Security-Policy', csp)
      return response
    }
    export const config = { matcher: [{
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [ { type: 'header', key: 'next-router-prefetch' },
                 { type: 'header', key: 'purpose', value: 'prefetch' } ] }] }

Where Next gets the nonce
- VERIFIED. Next reads the REQUEST header `content-security-policy` (falling back to `content-security-policy-report-only`).
  - Source: `src@packages/next/src/server/app-render/app-render.tsx` ~L478.
  - It takes the first `'nonce-…'` in `script-src`, or `default-src` if there is no `script-src`.
  - Regex: `/^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/` (`src@.../app-render/get-script-nonce-from-header.tsx`).
- VERIFIED. `x-nonce` is only a convention for your own code. Next itself never reads it.

What gets the nonce automatically
- VERIFIED. Next adds it to framework scripts, page bundles, inline scripts and styles it generates (including the `self.__next_f.push` RSC payload scripts), and `<Script>` components.
- You only need to read `x-nonce` if you render your own `<script>`. The "Imprimir / PDF" client component needs nothing: its code is a normal nonce'd bundle and React attaches the click handler without inline attributes (INFERRED).

Pages must render dynamically
- VERIFIED. Static or prerendered HTML is built before any request, so it has no nonce.
  - Issue #96063 (16.2.11, Turbopack + standalone): 0 of 12 scripts had a nonce. A maintainer closed it as expected behaviour because the route was static; `await connection()` fixed it.
  - PPR / cacheComponents is incompatible with nonces.
- Recommendation: force dynamic once in the root layout, either `export const dynamic = 'force-dynamic'` or `await connection()` from `next/server`.
  - `/` (login) probably calls no cookies() and would otherwise be prerendered. Its HTML forms would still work, but hydration would be blocked by CSP.
  - A dynamic root layout also makes the not-found page get a nonce.

Styles
- VERIFIED (docs). The production recipe uses `style-src 'self' 'nonce-…'` and dev uses `'unsafe-inline'`, because dev tools and Turbopack HMR inject styles (also issue #86188).
- INFERRED. In production, global CSS and next/font CSS come out as external `/_next/static` `<link>` files, so `'self'` covers them.
  - `experimental.inlineCss` (which would inline styles) defaults to false (`src@packages/next/src/server/config-shared.ts` ~L2242).
- VERIFIED. `<link>` style nonces were fixed in Next 15 (issue #57415 maintainer comment).
- Rule for the implementation: no `style={{}}` props anywhere. Nonces never apply to style attributes, so those would be blocked.
- UNVERIFIED, low impact. The client route announcer sets `el.style.cssText` (`src@packages/next/src/client/components/app-router-announcer.tsx`). Issue #98257 reports Chromium logging a style-src violation for it on every page under a nonce CSP (console noise only). It was closed for lack of a repro.

Dev mode
- VERIFIED. `'unsafe-eval'` is needed for scripts in dev only; React uses eval for debugging.

Other notes
- The reference app's test `/script-src 'self'/` still matches `script-src 'self' 'nonce-…'`.
- UNVERIFIED. `upgrade-insecure-requests` may interfere with plain-http testing on a LAN host. Emit it only in production. Five-minute spike: `next build && next start`, then `curl -sI localhost:3000/` and compare against `grep -c 'nonce=' <(curl -s localhost:3000/)`, and check `grep -o 'style="'`.

======================================================================
3. Route Handlers
======================================================================
(a) Parsing form posts
- VERIFIED (docs route.mdx "Request Body FormData", plus a local Node run): `await request.formData()` parses `application/x-www-form-urlencoded`. `'0985+111+222'` came back as `'0985 111 222'` and `%C3%B1` as `ñ`.
- VERIFIED locally: any other Content-Type throws `TypeError: Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded"`. Wrap it in try/catch and answer 400.

(b) Redirects, relative Location and cookies
- VERIFIED. `new Response(null, {status:303, headers:{Location:'/verificar'}})` is sent unchanged.
  - Non-cached handlers go through "send response without caching if not ISR" (`src@packages/next/src/build/templates/app-route.ts` ~L383).
  - `send-response.ts` copies headers 1:1 and splits/appends each Set-Cookie.
  - Nothing rewrites or absolutizes Location for route-handler responses.
- VERIFIED. `NextResponse.redirect()` requires an absolute URL. It calls `validateURL` → `new URL(String(url))` and throws "URL is malformed … Please use only absolute URLs". Default status is 307 (`src@packages/next/src/server/web/spec-extension/response.ts` L117-126; `src@.../web/utils.ts` L141).
- VERIFIED locally. Web `Response.redirect('/x', 303)` also throws ("Failed to parse URL from /x").
- VERIFIED, and this is a trap. `request.url` / `nextUrl.origin` in handlers is built from the server's own hostname and port (e.g. `http://localhost:3000`), not the public host (`src@packages/next/src/server/next-server.ts` attachRequestMeta ~L1988; `src@.../web/spec-extension/adapters/next-request.ts` ~L96). Behind Cloudflare Tunnel, `new URL('/x', request.url)` would send users to localhost. Use relative Location.
- VERIFIED, and this is a trap. Calling `redirect()` from `next/navigation` inside a route handler gives **307** (303 only inside Server Actions). The browser would then re-POST to the page (`src@packages/next/src/server/route-modules/app-route/module.ts` ~L677-704). Do not use it in /api/*; return an explicit 303.
- Both cookie styles work:
  - `res.cookies.set(...)` on a `NextResponse` (VERIFIED).
  - `(await cookies()).set(...)` plus returning any `Response`. Next merges the mutable cookies into the returned response (module.ts ~L746 "merge the modified cookies and the returned response") (VERIFIED).

  Snippet:

      // src/app/api/verificar/route.ts
      import { cookies } from 'next/headers'
      export async function POST(request: Request) {
        let form: FormData
        try { form = await request.formData() } catch { return new Response(null, { status: 400 }) }
        // ...validate...
        ;(await cookies()).set('cedivep_sesion', valor, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
        return new Response(null, { status: 303, headers: { Location: '/pedidos' } })
      }

(c) Where cookies() can write
- VERIFIED. `cookies()` is writable in Route Handlers and Server Functions only.
- In Server Components, `.set()` / `.delete()` throws `ReadonlyRequestCookiesError`: "Cookies can only be modified in a Server Action or Route Handler…" (`src@packages/next/src/server/web/spec-extension/adapters/request-cookies.ts` L12-20; `docs@04-functions/cookies.mdx`).
- `cookies()` is async; synchronous access was removed in 16.

(d) Can a handler render the designed page?
- No, the designed React page cannot be rendered from a Route Handler.
  - VERIFIED. Next's RSC transform reports an error for `import 'react-dom/server'` in any non-node_modules file in the server graph ("render or return the content directly as a Server Component instead") (`src@crates/next-custom-transforms/src/transforms/react_server_components.rs` ~L327, ~L703).
  - VERIFIED. Under the `react-server` condition, react-dom's package exports map `./server` and `./static` to files that throw "react-dom/server is not supported in React Server Components" (react-dom@19.2.0 package.json).
  - INFERRED. route.ts handlers are compiled in that server/react-server graph.
  - Hand-written HTML strings are impractical: the stylesheet URL is a hashed `/_next/static/...` path the handler doesn't know.
  - Pages cannot set arbitrary statuses. Only `notFound()` (404) and the experimental `forbidden()`/`unauthorized()` (403/401) exist.
- Conclusion: Post/Redirect/Get is the only idiomatic way.
  - The handler answers 303 to `/?error=limite` (or `/verificar?error=codigo`); the page reads `searchParams` and shows the designed error state with status 200.
  - Do not put the phone or email in the query string. Keep the typed contact in an httpOnly short-lived cookie (handlers can write it, pages can only read it, so it lives until Max-Age).
  - A handler may still return a bare status like 403 or 429 with no body.
  - Reference tests that expect 400/429/403 with HTML, 302, and exact `no-store` all need rewriting (see §4 and §5).
- Spike: add `import { renderToStaticMarkup } from 'react-dom/server'` to a route.ts and run `next build`; it should fail.

======================================================================
4. Cache-Control on `next start`
======================================================================
- VERIFIED. A dynamic App Router page gets `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, and it does include `private`.
  - `src@packages/next/src/server/lib/cache-control.ts` (revalidate 0).
  - `src@packages/next/src/build/templates/app-page-runtime.ts` ~L1740-1746: for non-SSG pages it is set ONLY `if (!res.getHeader('Cache-Control'))`.
- VERIFIED. `next dev` sends `no-cache, must-revalidate` instead (app-page-runtime ~L1650). Header assertions must run against `next start`.
- VERIFIED. next.config `headers()` CAN override Cache-Control for dynamic pages.
  - The source comment says "If cache control is already set on the response we don't override it to allow users to customize it via next.config" (`src@packages/next/src/server/send-payload.ts` ~L58).
  - Current docs only say immutable hashed assets can't be overridden (`docs@05-config/01-next-config-js/headers.mdx` "Cache-Control"). The old "gets overwritten" warning is gone.
- INFERRED. A catch-all `source: '/:path*'` Cache-Control rule would also replace `public, max-age=31536000, immutable` on `/_next/static`. router-server applies config headers (~L546) before its static-folder `!res.getHeader('cache-control')` check (~L597). Exclude `_next/static` from any such rule.
- Recommendation: keep Next's default (it contains `no-store`) and change the reference assertion from exact `'no-store'` to a match on `/no-store/`.
- VERIFIED. Route Handler (non-ISR) responses get NO default Cache-Control. Set `no-store` yourself where it matters, e.g. /health.
- 404 responses:
  - VERIFIED. `notFound()` in a dynamic page takes the same non-SSG branch, so it is no-store.
  - VERIFIED. Unmatched URLs: router-server sets `private, no-cache, no-store, max-age=0, must-revalidate` before rendering `/_not-found`, with status 404 (`src@packages/next/src/server/lib/router-server.ts` ~L709-786).
  - VERIFIED. Missing `/_next/static/*`, or 404s for requests whose `sec-fetch-dest` is image/font etc., return a plain-text "Not Found".
- VERIFIED. `cacheComponents` defaults to false (`config-shared.ts` ~L2114 `cacheComponents: false`).
  - In 16, PPR exists only through `cacheComponents`; `experimental.ppr` and `experimental_ppr` were removed (version-16.mdx "Partial Prerendering").
  - `export const dynamic` / `revalidate` / `fetchCache` still work while cacheComponents is off; they are removed only when it is enabled (`docs@.../route-segment-config/index.mdx` version table).

======================================================================
5. redirect() and notFound() during a full-page GET
======================================================================
- VERIFIED. `redirect()` thrown before streaming starts (no Suspense around it) returns **307**.
  - `Location` is exactly the string you passed, with basePath prefixed. A relative path stays relative (`app-render.tsx` ~L4123-4140).
  - Use `permanentRedirect` for 308.
  - The reference test expecting 302 for a forged session must change to 307.
- Layout vs page: the same code path applies (errors during shell render), so it is also 307 (INFERRED from source).
  - `loading.tsx` wraps the page and nested layouts in its folder and below, but not the layout in the same folder (`docs@.../loading.mdx`). So a redirect in the root layout is always pre-stream.
- VERIFIED (docs authentication.mdx "Layouts and auth checks"). Layouts and pages render in parallel, and a layout does not stop the page from running. Do the session check in each page or in a cached `verifySession()` data-access helper, not only in the layout.
- VERIFIED. `notFound()` without `loading.tsx` or Suspense returns a real 404 (`res.statusCode = 404`, app-render ~L4119).
- VERIFIED. Inside a streamed boundary (a `loading.tsx` above it, or a component suspended under Suspense), the status is already **200**.
  - Next only injects `<meta name="robots" content="noindex">` (`docs@04-functions/not-found.mdx` "Calling notFound() after streaming has started"; `loading.mdx` "Status Codes").
  - A redirect in that situation becomes a meta-refresh tag (`docs@04-functions/redirect.mdx`).
- Rules for the plan:
  - No `app/loading.tsx` at the root or above `/pedidos/...`, otherwise every 404 and redirect becomes 200.
  - Call `notFound()` before any Suspense or suspending await.
- INFERRED. Streaming metadata can send the shell before an async `generateMetadata` finishes, so a `notFound()` inside `generateMetadata` may not produce a 404 for normal browsers. Do validation and `notFound()` in the page, and keep metadata static (or render `<title>` in the page).
- INFERRED. A thrown error outside any Suspense returns 500 (app-render shell-error path, ~L4142). Under Suspense it would be 200.

======================================================================
6. node:sqlite and mysql2 under Turbopack
======================================================================
- VERIFIED. Turbopack is the default for both `next dev` and `next build` in 16; `--webpack` opts out (version-16.mdx "Turbopack by default").
- INFERRED, high confidence. A bare `import { DatabaseSync } from 'node:sqlite'` will likely fail under Turbopack.
  - Turbopack externalizes only a hardcoded 68-name list of Node builtins (with and without the `node:` prefix). `sqlite`, `test` and `sea` are not in it, at v16.3.8 or on canary (`src@crates/next-taskless/src/constants.rs` NODE_EXTERNALS; used by `src@turbopack/crates/turbopack-resolve/src/resolve.rs` L41-50).
  - Precedent: issue #90765 (16.1.6), `stream/consumers` missing from that list failed with "Can't resolve", and with the `node:` prefix "Cannot find module 'node:stream/consumers': Unsupported external type Url for commonjs reference". It was fixed by adding the name to the list (PR #90819); no generic fix.
  - I found no issue specifically about `node:sqlite`.
- Workarounds, best first:
  1. VERIFIED locally plus typings. `process.getBuiltinModule('node:sqlite')`. The bundler never sees it (no reference to `getBuiltinModule` found in the repo by code search). @types/node 22 types it exactly: `BuiltInModule['node:sqlite']` (`@types/node@22/process.d.ts` L79, L1065).

         import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite' // type-only, erased
         const { DatabaseSync } = process.getBuiltinModule('node:sqlite')

     This works the same under tsx/node --test. The create-next-app template ships `@types/node ^20`, which has NO sqlite.d.ts (unpkg 404). Bump to `@types/node@^22`.
  2. UNVERIFIED but used by the community. `serverExternalPackages: ['node:sqlite']` appears in several public repos on next 16.2.6, 16.2.12 and ^16.3.1 (e.g. tornikedzidzishvili/Stocker, arush15june/adversarial-system-of-record).
  3. `createRequire`. Turbopack analyzes require patterns, so this is less safe than option 1 (INFERRED).
- VERIFIED locally. `node:sqlite` is unflagged on Node 22.13.1.
  - `require`/`import` work without `--experimental-sqlite` and print "ExperimentalWarning: SQLite is an experimental feature…".
  - Rows come back as `[Object: null prototype]`, so `assert.deepStrictEqual` against `{…}` literals fails on the prototype. Spread rows or compare fields.
- VERIFIED. mysql2 is NOT in Next's default server-external list (`src@packages/next/src/lib/server-external-packages.jsonc` has pg, sqlite3, better-sqlite3, prisma, and no mysql).
  - I found no Next issue about bundling mysql2 (searched).
  - Recommend adding `serverExternalPackages: ['mysql2']` anyway. It costs nothing with `next start` plus node_modules.
  - Related fixes, both in 16.1+ (from search results / the PR list): Windows junction points for external packages (PR #87606, merged 2025-12-22) and standalone output omitting serverExternalPackages (issue #88844).
- Spike: in a scratch project, a route.ts with a static `import 'node:sqlite'`, then `next build`. Then try options 1 and 2.

======================================================================
7. The server-only package
======================================================================
- VERIFIED (unpkg server-only@0.0.1). Its exports are `{"react-server": "./empty.js", "default": "./index.js"}`, and index.js throws at import: "This module cannot be imported from a Client Component module…".
  - So plain `node --import tsx --test` (no react-server condition) THROWS when importing any module that does `import 'server-only'`.
  - If the package isn't installed at all, you get a module-not-found error instead.
- VERIFIED (`docs@01-getting-started/05-server-and-client-components.mdx`). Inside Next, installing it is optional: Next aliases it to its own copy (`src@crates/next-core/src/next_import_map.rs` ~L215) and ships its own types.
- Workarounds:
  - (a) Don't import server-only in modules that unit tests import (contacto/informe are pure logic). Put it only in db/session/env modules.
  - (b) INFERRED. `node --conditions=react-server --import tsx --test`. Node's `--conditions` applies to both ESM and CJS, so it resolves to empty.js. Side effect: `react` resolves to its server build too.
  - Prefer (a).
  - The end-to-end tests talk HTTP to a running Next server, so they never import server-only.

======================================================================
8. Versions
======================================================================
- VERIFIED. Node >= 20.9.0 (npm engines; version-16.mdx table). Local v22.13.1 is fine.
- VERIFIED. TypeScript >= 5.1.0.
- VERIFIED. The App Router uses Next's bundled React `19.3.0-canary-cbb046ab-20260731` (next@16.3.8 `dist/compiled/react` and `react-dom`), no matter which react is installed.
  - create-next-app@16.3.8 installs react/react-dom 19.2.8 (`src@packages/create-next-app/templates/index.ts` L21). npm latest react is 19.3.0.
  - Template devDependencies: typescript ^5, @types/react ^19, @types/react-dom ^19, @types/node ^20 (bump to 22, see §6).

======================================================================
9. Fonts with next/font/google
======================================================================
- VERIFIED (`src@packages/font/src/google/font-data.json` and index.ts):
  - `Archivo` is a variable font: wght 100-900, plus a wdth axis 62-125 via `axes: ['wdth']`. `weight` is optional; weights 100-900 or 'variable'; subsets latin, latin-ext, vietnamese.
  - `IBM_Plex_Mono` is not variable, so `weight` is REQUIRED (100-700; '500' and '600' exist).
- VERIFIED (`docs@02-components/font.mdx`). CSS and font files download at build time and are self-hosted; the browser sends no requests to Google.
- VERIFIED (`src@packages/font/src/google/loader.ts`). `next build` FAILS ("Failed to fetch `Archivo` from Google Fonts") if Google is unreachable at build time; `next dev` falls back to system fonts. Build where there is internet.

  Code:

      import { Archivo, IBM_Plex_Mono } from 'next/font/google'
      const archivo = Archivo({ subsets: ['latin'], variable: '--f-archivo', display: 'swap' })   // no weight = one variable file
      const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--f-plex', display: 'swap' })
      // <html lang="es" className={`${archivo.variable} ${plexMono.variable}`}>

- Design collision (found in the design zip):
  - DISENO.md §3 sets `variable: '--f-texto'` and `'--f-mono'`.
  - estilos.css also declares `:root { --f-texto: 'Archivo', …; --f-mono: 'IBM Plex Mono', … }`.
  - Both land on `<html>` with equal specificity (0,1,0), so CSS order decides.
  - INFERRED: next/font uses hashed family names, so if `:root` wins, the real font is silently lost.
  - Fix: use different variable names (`--f-archivo`, `--f-plex`) and in estilos.css write `--f-texto: var(--f-archivo), -apple-system, 'Segoe UI', sans-serif`, or delete those two `:root` lines.
  - Latin covers Spanish characters (á, ñ).

======================================================================
10. create-next-app@16.3.8
======================================================================
- VERIFIED. Any `--…` flag skips ALL prompts and uses "recommended defaults" for anything not passed. Those defaults include **tailwind: true**, **agentsMd: true** and srcDir false.
  - `--no-tailwind` must be explicit.
  - `--yes` and CI also skip prompts.
  - Source: `src@packages/create-next-app/index.ts` ~L232-328.
- Command (in the currently EMPTY `/Users/luisisasi/dev/isasiluispy/portal-cedivep`):

      npx create-next-app@latest . --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm --no-react-compiler --no-agents-md --disable-git

  - `--turbopack` is already the default; the generated scripts are `next dev` / `next build` / `next start` / `lint: eslint`.
  - React Compiler defaults to off; the flag is `--no-react-compiler`.
- VERIFIED. Non-empty folder check (`helpers/is-folder-empty.ts`):
  - Allowed: `.claude .cursor .DS_Store .git .gitattributes .gitignore .gitlab-ci.yml .hg .hgcheck .hgignore .idea .npmignore .travis.yml .vscode .zed LICENSE Thumbs.db docs mkdocs.yml npm-debug.log yarn-debug.log yarn-error.log yarnrc.yml .yarn *.iml`.
  - Anything else (CLAUDE.md, HANDOFF.md, `_referencia/`, `sql/`, `capturas/`) makes it exit 1.
  - Scaffold first, then unzip the material.
- VERIFIED. Git: it runs `git init`, `checkout -b main` and a commit "Initial commit from Create Next App", unless `--disable-git` is passed or you are already inside a git/hg repo (`helpers/git.ts`).
  - The user's global rules say no commits without asking, hence `--disable-git`.
- VERIFIED. Generated files (TS app template plus src/): `src/app/{layout.tsx,page.tsx,page.module.css,globals.css,favicon.ico}`, `public/*.svg` (5), `eslint.config.mjs` (flat config), `next.config.ts`, `next-env.d.ts`, `tsconfig.json` (strict, moduleResolution bundler, paths `@/*` → `./src/*`), `.gitignore`, `README.md`, `.env.example`.
  - Plus `AGENTS.md` and `CLAUDE.md` (containing `@AGENTS.md`) unless `--no-agents-md`.
  - No `.github/`.
- VERIFIED, and this matters here. `next dev` itself writes these files: when it detects an AI agent such as Claude Code (via @vercel/detect-agent), it creates AGENTS.md + CLAUDE.md, or inserts its managed block into an existing AGENTS.md, or into CLAUDE.md if only that exists.
  - The project CLAUDE.md from the handoff WILL be modified.
  - Opt out with `agentRules: false` in next.config (`config-shared.ts` ~L1969-1977; `src@packages/next/src/server/lib/app-info-log.ts` ensureAgentRulesForDev; `generate-agent-files.ts`).

======================================================================
11. Client IP for rate limiting
======================================================================
- VERIFIED. There is no `request.ip` (removed in v15.0.0, `docs@04-functions/next-request.mdx`).
- VERIFIED. Next fills in `x-forwarded-for` from the socket only when it's missing (`src@packages/next/src/server/base-server.ts` ~L1085-1092): `req.headers['x-forwarded-for'] ??= originalRequest?.socket?.remoteAddress`.
  - Same pattern for x-forwarded-host, -port and -proto.
  - A client-sent X-Forwarded-For is KEPT, so it is spoofable.
  - The value reaches route handlers' `request.headers` and `headers()` (the NextRequest is built from those headers).
- VERIFIED. `next start` binds to 0.0.0.0 by default (`docs@06-cli/next.mdx`). Behind the tunnel, run `next start -H 127.0.0.1 -p 3000` so only cloudflared can connect. That is what makes trusting Cloudflare headers safe.
- Cloudflare (VERIFIED in developers.cloudflare.com/fundamentals/reference/http-headers):
  - `CF-Connecting-IP` is the client IP as Cloudflare saw it.
  - X-Forwarded-For is APPENDED to, so its first entry is client-controlled.
  - INFERRED: Cloudflare overwrites any client-sent CF-Connecting-IP.
- Recommendation:

      export function ipCliente(h: Headers): string {
        // ponytail: only trustworthy if next binds 127.0.0.1 behind cloudflared
        return h.get('cf-connecting-ip')?.trim()
          || h.get('x-forwarded-for')?.split(',')[0]?.trim()   // locally: socket addr set by Next, e.g. ::1 / ::ffff:127.0.0.1
          || 'desconocido'
      }

  - Normalize the `::ffff:` prefix.
  - Locally, without a proxy, the IP is spoofable no matter what (Next gives no access to the raw socket short of a custom server). Keep the per-contact limit as the primary control; it doesn't depend on IP.

======================================================================
12. Other surprises when porting from Express
======================================================================
Async APIs and route config
- VERIFIED. Synchronous access is removed in 16: `params` and `searchParams` are Promises, and `cookies()`, `headers()`, `draftMode()` must be awaited.
  - Global type helpers from `next typegen`: `PageProps<'/pedidos/[fecha]/[nro]'>`, `RouteContext<'/…'>`.
  - `searchParams.q` can be `string | string[] | undefined`, so normalize it.
- VERIFIED. `runtime` defaults to 'nodejs' and 'edge' is deprecated. Don't export `runtime` at all.

Route handler behaviour
- VERIFIED. route.ts and page.tsx cannot share a segment, hence `/api/*`.
- VERIFIED. HEAD is derived from GET, OPTIONS is automatic, and other methods get 405 with an empty body (`src@.../app-route/helpers/auto-implement-methods.ts`).
- VERIFIED (`docs@02-guides/data-security.mdx`). Route Handlers get NO CSRF/Origin check (only Server Actions do). Check `Origin`/`Sec-Fetch-Site` yourself and use `SameSite=Lax` cookies.

Not-found, errors and layouts
- VERIFIED. Unmatched URLs render `app/not-found.tsx` inside the root layout with 404 and no-store.
- VERIFIED. `error.tsx` must be `'use client'`; its props are `{ error, retry, reset }` (`retry` stable since 16.3.0).
- VERIFIED. `global-error.tsx` must render its own `<html><body>` and does not include global styles, so import estilos.css in it.
- VERIFIED. In production, Server Component error messages are replaced by a `digest`.
- VERIFIED. Layouts don't re-render on client navigation (`<Link>`). With plain `<a>` and full page loads it doesn't matter, but still check auth per page.

Server process and singletons
- VERIFIED. `poweredByHeader` sends `X-Powered-By: Next.js` by default; set `poweredByHeader: false` (send-payload.ts).
- VERIFIED. `next lint` is removed and `next build` no longer lints. INFERRED: build still type-checks.
- VERIFIED. Dev output goes to `.next/dev`, so dev and build can run at the same time. Turbopack's filesystem cache is on by default for dev and build.
- INFERRED. `next build` imports route modules ("Collecting page data"). Don't connect to MySQL or read required env vars at import time; initialize lazily.
- UNVERIFIED. Module instances may not be shared across route bundles and layers, and dev HMR recreates them. Keep every process-wide object (DB pool, the pending-codes store `Codigos`, rate-limit counters, `DirectorioClinicas`) on `globalThis` under a `Symbol.for(...)` key, as the handoff already plans.
  - Spike: log an instance id from `/api/ingresar` and `/api/verificar`, and log `process.pid`.

Testing and deployment
- Express-style dependency injection (`crearApp({notificador})`) has no equivalent. Pick fakes by env var.
- End-to-end tests need a real server: either `next build` plus spawning `next start` in `before()`, or in-process `next({ dev: false })` + `app.prepare()` + `getRequestHandler()` on `http.createServer` (`docs@02-guides/custom-server.mdx`).
- Reference assertions to change:
  - 400/429/403 with HTML → 303 plus Location (or a bare status).
  - 302 → 307.
  - exact `'no-store'` → `/no-store/`.
- Windows server: Turbopack builds on Windows; Windows junction fix for external packages is in 16.1+ (PR #87606).
- VERIFIED. If `output: 'standalone'` is used later, a custom server is not traced (custom-server.mdx). Plain `next start` with node_modules is simplest.

Five-minute spikes for the UNVERIFIED and INFERRED items (one scratch app)
1. A route.ts that statically imports `node:sqlite` → `next build`; then try `process.getBuiltinModule` and `serverExternalPackages`.
2. `curl -sI` on a dynamic page, a `notFound()` page and an unknown URL under `next start`, to confirm the Cache-Control and status values above.
3. Grep the nonce count and any `<style>` / `style="` in the HTML.
4. `react-dom/server` imported in a route.ts → build error.
5. Log a singleton id from two route handlers plus a page.