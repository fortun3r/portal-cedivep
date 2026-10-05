# `descres` real — hallazgos de la sonda (13/08/2026)

Fuente: `probe_db2.py` corrido desde la Terminal de Luis contra `190.128.170.42:3309`.
Salida cruda en su disco: `~/Documents/cedivep/db_probe2.txt` y `descres_muestra.csv` (500 filas).

## Servidor

- **MySQL 8.0.20**, `utf8mb4` / `utf8mb4_0900_ai_ci`, `sql_mode=STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION`.
- Usuario efectivo `root@%`, plugin `mysql_native_password`.
- 10 bases en el servidor: `cedivep` (13 tablas, la buena) más `cedivepcopia`, `cedivepprecios`,
  `cediveprespaldo`, `cediveprespaldo2`, `encomienda`, `respaldo02`, `respaldo26`,
  `respaldofebrero`, `siesta` — respaldos/experimentos de Olga, 10 tablas cada una.

## Tablas de `cedivep`

| tabla | filas | tamaño |
|---|---|---|
| descres | 93.460 | 104,6 MB |
| retirodet | 40.883 | 26,6 MB |
| audidescres | 26.939 | 31,6 MB |
| doctor | 6.374 | 10,5 MB |
| clini_vet | 4.312 | 5,5 MB |
| encomienda | 2.950 | 290,5 MB |
| analisis | 314 | 0,3 MB |
| precios | 287 | |
| acreditado | 72 | |
| cobrador | 65 | |
| retiro | 14 | |
| audidescres1 | 38 | |
| parametro | 1 | |

`descres` **no está vacía**: 93.460 filas. Pero es una ventana, no historia: solo
**12 fechas, del 15 al 28 de julio de 2026** (≈4.600–10.100 filas por día), 3.532 pedidos.
Olga la sincroniza desde el DBF; no es la base viva del laboratorio.

## Estructura de `descres` (52 columnas)

Todas `NOT NULL` sin default (herencia del DBF), fechas vacías como `0000-00-00`.

Claves y orden:

- **`NUMEROID`** — id único del pedido. Verificado biyectivo con `(FEC_PED, NROMOV)` en la muestra.
  *(Superado: la tabla `pedidos` de MySQL no trae NUMEROID. Ver HANDOFF.md.)*
- `FEC_PED` + `NROMOV` — fecha y correlativo del día (la "referencia" impresa, `260724/ 5`).
- `CODANAL` — análisis dentro del pedido; `NROSEC` — línea dentro del análisis.
- **`ORDEN` = el animal**, no el orden de impresión. Un pedido puede traer muchos animales
  (rodeo/feria): el pedido de ejemplo `2026-07-22 / 219` tiene **650 filas, `TOTHOJA=24` páginas**
  y animales `154983, 151667, 126, 105, …`.
- **`UBICACION` = el orden de impresión real**, único dentro del pedido y monótono
  (5, 10, 15… para el animal 1; sigue en 170, 175… para el animal 2). Ordenar por `UBICACION`
  reproduce el informe exactamente: título de sección, sus subanálisis, siguiente sección.

Contenido: `ANIMAL, ESPECIE, RAZA, SEXO/SEXOC, EDAD, PELAJE, MATERIAL, NOMANAL, NOMRESULTA,
RESULTADO (text), RESULTA (char 60, vacío en la muestra), RELATIVA, UNIDAD, MEDIDA, REFERENCIA
(text, con saltos de línea adentro), OBSERVA (text), TITULO, DENTRO, MARCA, CODAREA, GRUPO,
CODPERFIL, FIRMA, HAB, CONTROL, CONTROLA, HOJA/TOTHOJA, COPIA1/COPIA2, FECVTO, FERIA, FERIAOBS,
TIEMPO, NDESC, MES, RUC, NROREF, NROID, TUBO, AREAGUA, FECHA1/FECHA2, clave`.

## Centinelas

- **`TITULO`: `'S'` = fila de título de sección, `'N'` = fila de medición.** (7.379 S / 86.081 N;
  las 49 filas `S` de la muestra tienen `RESULTADO` vacío y `NOMRESULTA == NOMANAL`, p. ej.
  "BIOMETRIA HEMATICA", "LEUCOGRAMA", "LEPTOSPIROSIS").
- **`DENTRO`: `'S'` = dentro del rango, `'N'` = fuera.** (80.851 S / 12.609 N ≈ 13,5 % fuera).
  Verificado contra los rangos: Hematócrito 30 con ref. 31-45 → `N`; C.H.C.M. 37,5 con 31,0-37,0 → `N`;
  Hemoglobina 12,0 con 10,0-18,0 → `S`. Las filas de título traen `DENTRO='S'` (hay que ignorarlas).

## Impacto en el portal MVP original (ya corregido en `_referencia/`)

1. **`tituloIsSection` estaba mal y rompía todo el render.** Era
   `v.trim() !== '' && v.trim() !== '0'`, y como `'N'` no es vacío, **cada fila se dibujaba como
   título de sección**. Debe ser `v.trim().toUpperCase() === 'S'`.
2. `dentroMeansOutOfRange` (`'N'` → fuera) estaba bien.
3. **El orden debe ser `ORDER BY UBICACION`**, no `ORDEN, NROSEC`: con `NROSEC` los análisis
   distintos del mismo animal se entremezclan (todos empiezan en 1).
4. **Un pedido puede tener N animales.** Hay que agrupar por `ORDEN`.
5. **`descres` no tiene índices** (93 k filas, 104 MB). Ver `sql/indices.sql`. **No tocar sin Olga.**
6. Codificación **sin problema**: los acentos llegan bien en `utf8mb4`.
7. `REFERENCIA` y `OBSERVA` traen saltos de línea internos — `white-space: pre-line`.

## Propietario / veterinario

En `descres` **no están**. La única columna de identidad es `ANIMAL` (nombre o caravana).
Los datos del cliente viven en `doctor` y `clini_vet`. El vínculo pedido → clínica vive en la tabla
`pedidos` (ver `03` y `04`).

## `descres.clave varchar(255)`

Columna que Olga agregó el 8/8 para el código de clínica. Quedó vacía en todas las filas y se
descartó a favor de cargar `pedidos` (lo que ella misma propuso el 4/8).
