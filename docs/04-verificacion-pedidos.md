# Verificación: ¿ya tenemos todo? (05/10/2026)

Olga cargó la tabla `pedidos` en la MySQL. Verificado con `probe_db5.py` contra la base real.

## Respuesta corta

**Sí, el portal se puede construir.** El vínculo resultado → clínica funciona de punta a punta:
la consulta real devuelve los pedidos de una clínica y arma el informe completo, con los valores
fuera de rango marcados, en 0,07 s.

## Lo que cargó

| tabla | filas | estado |
|---|---|---|
| `pedidos` | 9.283 | las 94 columnas (+3 nuevas: `AUTORIZA`, `OBSMMORO`, `NROPROTO`), **sin `NUMEROID`** |
| `planilla` | 0 | creada pero vacía (no hace falta) |
| `aux_ana` | 784 | nueva, sin revisar |

## Los chequeos

| chequeo | resultado |
|---|---|
| El join con `descres` | **3.531 de 3.532 pedidos (99,97 %)** |
| Pedidos con clínica real | **3.207 (90,8 %)** |
| Pedidos de particulares (`CLINICA=1`) | 324 (9,2 %) |
| Clínicas distintas con resultados | **625** |
| Clínicas que pueden loguearse | **572 de 577 (99 %)** — 96 % con teléfono, 76 % con email |
| Consulta del portal | 25 pedidos en **0,07 s** |
| Informe armado entero | sí, con fuera-de-rango correcto |
| Fechas de estado (`FECHA_EXTR`, `FECHA_ENTR`, `FECHA_2DAE`) | presentes |

Prueba real: clínica 2646, 113 pedidos. El informe de `260728/160` salió completo con secciones
(BIOMETRIA HEMATICA, LEUCOGRAMA) y "Neutrofilos en banda 03 % (0 - 2 %)" marcado fuera de rango.

## Lo que falta del lado del laboratorio

1. **Recargar `clini_vet`**: 48 de las 625 clínicas con resultados no existen ahí. Todos los
   códigos huérfanos son mayores a 4.312 (= filas de `clini_vet`): clínicas dadas de alta después.
2. **Cargar `paciente`**, para los 324 pedidos de particulares.
3. **Índices** (`sql/indices.sql`): ni `descres` ni `pedidos` tienen uno solo.
4. **Más historia**: `pedidos` cubre 01/07–01/08/2026 y `descres` 15–28/07. Es una ventana móvil.

## Detalles

- Un pedido con resultados no tiene cabecera (`2026-07-27 / 71`, 1 de 3.532): probablemente
  anulado o borrado del lado de `pedidos`. El portal no lo muestra.
