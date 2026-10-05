# ADR-0008 — Stack del portal de resultados para clínicas

- **Estado:** Aceptada (Luis Isasi, 05/10/2026)
- **Contexto previo:** ADR-0004 (TypeScript de punta a punta, React para la interfaz)

## Contexto

El primer entregable del proyecto de modernización es un portal donde cada clínica veterinaria
entra y ve sus resultados. Lo usan veterinarios **desde el celular, abriendo un link de WhatsApp**.
Lee de la MySQL que el laboratorio ya mantiene (tablas `descres`, `pedidos`, `clini_vet`), en modo
**solo lectura**. Es también la carta de presentación del proyecto grande.

Ya existía una implementación funcionando y testeada en Express + HTML generado con plantillas de
texto (`_referencia/`). Se evaluó si mantenerla.

## Decisión

**Next.js (App Router) + TypeScript + React Server Components, sin Express.**

- Las pantallas son Server Components: al navegador llega HTML, con JavaScript mínimo.
- Los formularios son `<form>` HTML que postean a Route Handlers (`/api/…`), no Server Actions,
  para que funcionen sin JS y se puedan testear con HTTP plano.
- Datos con `mysql2` (solo lectura); demo y tests con `node:sqlite`.
- Ingreso sin contraseñas: código de 6 dígitos al contacto de la clínica; sesión en cookie firmada.
- Runtime Node en todas las rutas.

## Alternativas consideradas

| Opción | Por qué no |
|---|---|
| **Express + plantillas de texto** (la referencia) | Funciona y tiene 41 tests. Pero cada dato hay que escaparlo a mano: un olvido es un XSS. No escala a un equipo |
| **Express + React solo en servidor** | Resuelve el escapado, pero deja el andamiaje (rutas, caché, build) armado a mano; habría que rehacerlo al crecer |
| **SPA (React en el navegador + API)** | Más JS en el celular, más superficie, sin beneficio para ~10 pantallas de consulta |

## Consecuencias

**A favor**
- React escapa todo: desaparece la clase de errores más peligrosa de la referencia.
- Estructura estándar, documentada, fácil de conseguir gente que la conozca.
- Misma tecnología que el sistema grande (ADR-0004): componentes y lógica reutilizables.
- La lógica de dominio de la referencia (informe, contactos, consultas, autorización) se mueve sin
  cambios: no depende del framework.

**En contra / a vigilar**
- **Caché.** Next cachea agresivamente. Para datos por clínica es crítico: toda página autenticada
  debe ser dinámica y responder `Cache-Control: private, no-store`. Lleva test.
- **CSP.** Next inserta scripts en línea; una política `script-src 'self'` lo rompe. Usar CSP con nonce.
- **Estado en memoria.** Los códigos pendientes viven en el proceso. Funciona con `next start` en un
  servidor propio (un proceso persistente). **No funciona en serverless** (Vercel y similares): ahí
  habría que moverlos a Redis o a una tabla.
- Hay paso de compilación (`next build`), que la referencia no tenía.

## Despliegue (propuesta, a decidir con el laboratorio)

En el servidor del laboratorio (Windows, donde corre VFP), como servicio, publicado con
**Cloudflare Tunnel**: HTTPS sin abrir puertos. Permite, a futuro, **cerrar el MySQL que hoy está
expuesto a internet** con la cuenta de administración — antes, verificar que las apps móviles de
Olga no dependan de ese acceso público.
