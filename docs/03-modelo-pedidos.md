# El vínculo resultado → clínica, encontrado en los DBF (14/08/2026)

Fuente: los DBF de producción en `/Users/luisisasi/dev/isasiluispy/cedivepsp2/Nueva carpeta/`,
leídos directamente (sin VFP). Copia de noviembre 2025.

## La cadena

```
descres  (resultados, 1.290.725 regs en DBF)
   │
   │  (FEC_PED, NROMOV) = (FECHA_RECE, NRO_RECEPC)        [o NUMEROID, ver abajo]
   ▼
pedidos  (cabecera del pedido, 456.499 regs, 94 campos)
   ├── CLINICA    ──►  clini_vet  (4.359)
   ├── VETERINARI ──►  doctor     (6.397)
   └── PROPIETARI ──►  paciente   (216.322)
```

`paciente.dbf` es la tabla de **propietarios/clientes**, no de animales (el nombre engaña):
`CODIGO, PROPIETARI, NRO_CI, DIRECCION, TEL_CELU, TELEFONO, RUC, ESTANCIA, CORREO, MAILFAC,
MOROSO, HABILITA, DUDOSO, …` — misma forma que `doctor` y `clini_vet`.

El modelo real es **`pedidos` → `planilla` (detalle por animal) → `descres` (resultados)**. Olga lo
describió así en la reunión del 26/07: *"en la recepción de pedidos… tengo la fecha, el pedido,
quién trae el pedido… de qué clínica viene"*, y *"estos mismos análisis tienen una planilla en
donde va el nombre del animal, la raza, la edad, el pelaje…"*.

## Verificación

Últimos 7.880 registros de `descres.dbf` contra los últimos 40.000 de `pedidos.dbf`:

- **`(FEC_PED, NROMOV)` = `(FECHA_RECE, NRO_RECEPC)`: 7.880 / 7.880 → 100 %**
- `descres.NUMEROID` = `pedidos.NUMEROID`: 7.880 / 7.880 → 100 %
- `REFERENCIA` en `pedidos` es la etiqueta impresa: `251114/116`.

**Usar la clave compuesta.** `NUMEROID` en `pedidos.dbf` es un entero VFP `I4` que en los registros
viejos viene nulo (`-2147483648`); y la tabla `pedidos` que Olga cargó en MySQL no lo trae.

## Cobertura (40.000 pedidos más recientes de la copia)

| campo | valores distintos | con cliente real (≠ código 1) |
|---|---|---|
| `CLINICA` | 1.387 | 35.373 / 39.999 (88 %) |
| `VETERINARI` | 1.803 | 35.521 / 39.999 (89 %) |
| `PROPIETARI` | 21.107 | 39.984 / 39.999 (100 %) |

El código `1` es el comodín ("particular"). Para esos, la identidad es `PROPIETARI` → `paciente`.

## Lo que `pedidos` da además del vínculo

El ciclo de vida del pedido: `FECHA_RECE/HORA_RECEP` (recibido), `FECHA_EXTR` (extraído),
`FECHA_ENTR`, `FECHA_2DAE` (entregas), `ANULADO`, `BORRADO`, `APROBADO`, `RETIRA`, `ENVIO`,
`CORREO`, `URGENTE`, más facturación (`FACTURA`, `NRO_FACTUR`, `TIMBRADO`, `TOTAL`, `SALDO`, `IVA`).

`planilla.dbf` (1.250.792) es el detalle por animal: trae `COD_VET`, `COD_PRO`, `IDENTIFICA`
(caravana) y `NOMBRE_ANI`. En MySQL `planilla` existe pero está vacía; no hace falta para el
portal porque esos datos ya vienen desnormalizados en `descres`.
