# Portal CEDIVEP — implementación de referencia (Express)

**Esta es la referencia, no el producto final.** Se decidió pasar a Next.js (ver `HANDOFF.md` y
`docs/ADR-0008-stack-portal.md` en la raíz). La lógica de `src/` se reutiliza; las rutas
(`server.ts`) y las pantallas (`render.ts`) se reescriben.

Funciona completa contra un demo SQLite con la forma exacta de las tablas reales:

```bash
npm install
npm test      # 41 tests: contactos, armado del informe, flujo de ingreso y seguridad
npm start     # http://localhost:3000 — ingresar con 0981 000 001 (el código sale en pantalla)
```

| Archivo | Qué hace |
|---|---|
| `src/informe.ts` | Arma el informe desde `descres`: secciones, orden, animales, rodeos, estados, formato de números. Funciones puras |
| `src/contacto.ts` | Normaliza los teléfonos y correos sucios de `clini_vet` |
| `src/repo.ts` | Las consultas. La autorización por clínica vive acá (`p.CLINICA = ?`) |
| `src/auth.ts` | Códigos de 6 dígitos, límites de intentos, cookies firmadas |
| `src/db.ts` | Drivers MySQL (real) y SQLite (demo) |
| `src/config.ts` | Configuración y centinelas verificados |
| `src/server.ts` | Rutas Express — **se reescribe** en Next.js |
| `src/render.ts` | HTML con plantillas de texto — **se reescribe** como componentes React |
| `src/seed/fixture.ts` | Datos de ejemplo: rodeo, pedido en proceso, anulado, contacto compartido, comodín |

## Historial de git

`historial-git.bundle` tiene los commits de esta referencia (el MVP de julio y cómo se llegó al portal
por clínica). Para verlos sin mezclarlos con el repo nuevo:

```bash
git clone _referencia/historial-git.bundle /tmp/referencia-historial && git -C /tmp/referencia-historial log
```
