# Mapa completo de la MySQL de Olga (sonda v4, 13/08/2026)

Fuente: `probe_db4.py` corrido desde la Terminal de Luis. Salida cruda: `~/Documents/cedivep/db_probe4.txt`.

> **Nota (05/10):** el veredicto de abajo era cierto el 13/08. Después Olga cargó `pedidos` y el
> vínculo existe. Ver `04-verificacion-pedidos.md`. Este documento sigue valiendo por el schema
> completo y el análisis de contactos.

## Veredicto (13/08)

**La MySQL no tenía cómo relacionar un resultado con una clínica.** Evidencia (descubrimiento por
valores, no por nombres):

- `descres.NUMEROID` — 3.532 pedidos distintos — no compartía un solo valor con ninguna otra tabla.
- Lo que "cruzaba" con `descres` era coincidencia entre enteros chicos: `descres.UBICACION`
  (posiciones de impresión 1…2000) contra `clini_vet.CODIGO` (1…4312) daba 99,7 % y no significa nada.
- `retirodet` y `encomienda` tienen `CODCLIENTE → clini_vet.CODIGO`, pero son de **retiros de
  muestras y encomiendas**: no referencian al pedido de laboratorio.

Relaciones reales confirmadas: `doctor.CLINICA → clini_vet.CODIGO` (1.573 clínicas referenciadas,
100 % de solapamiento), `precios.CODANAL → analisis.CODANAL`,
`retirodet.CODCLIENTE`/`encomienda.CODCLIENTE → clini_vet.CODIGO`.

## Las tablas (13/08; al 05/10 se sumaron `pedidos`, `planilla` vacía y `aux_ana`)

| tabla | filas | para qué es |
|---|---|---|
| `descres` | 93.460 | resultados desnormalizados listos para imprimir. Ventana móvil |
| `audidescres` | 28.405 | auditoría de `descres`: mismas columnas + `fecmov, usuario, maquina, operacion` |
| `audidescres1` | 38 | ídem, tabla de trabajo |
| `retirodet` | 40.883 | detalle de retiros de muestras por cliente |
| `doctor` | 6.374 | veterinarios |
| `clini_vet` | 4.312 | clínicas |
| `encomienda` | 2.950 | encomiendas (290 MB: dos `longtext` con fotos en base64) |
| `analisis` | 314 | catálogo de análisis y subanálisis, con precios y tiempos |
| `precios` | 287 | lista de precios por análisis |
| `acreditado` | 72 | pagos/recepciones acreditados (de 2020) |
| `cobrador` | 65 | cobradores, con `CLAVE` para su app móvil |
| `retiro` | 14 | cabecera de retiros |
| `parametro` | 1 | configuración (`textopdf`, usuario `Olga`) |

### Columnas

**`descres`** (52): ver `01-hallazgos-descres.md`.

**`pedidos`** (94, cargada el 05/10): `FECHA_RECE`, `NRO_RECEPC`, `PRECIO`, `REFERENCIA`, `URGENTE`,
`CODIGO`, `HORA_RECEP`, `MIN_RECEPC`, `FECHA_EXTR`, `HORA_EXTRA`, `MIN_EXTRAC`, `FECHA_ENTR`,
`HORA_ENTRE`, `MIN_ENTREG`, `FECHA_2DAE`, `HORA_2DAEN`, `MIN_2DAENT`, `SUCURSAL`, **`PROPIETARI`**,
`ESTANCIA`, **`VETERINARI`**, **`CLINICA`**, `DEPARTAMEN`, `DISTRITO`, `LOCALIDAD`, `EXTRACCION`,
`PROFESIONA`, `HONORARIO_`, `CANTIDAD_D`, `MATERIALES`, `DESECHOS`, `PRECIO_DES`, `MONTO_KM`,
`CANTIDAD_K`, `EXTRACCIO2`, `CANTIDAD_E`, `TOTAL`, `SALDO`, `IVA`, `TIPO_FACTU`, `TIPO_FACT2`,
`FACTURA`, `FAC_DIAS`, `FEC_VEN`, `TIMBRADO`, `NRO_FACTUR`, `FEC_EMI`, `COBRADOR`, `FECHA`, `HORA`,
`OPERADOR`, `FEC_MODI`, `HORA_MODI`, `OP_MODI`, `FEC_BORRA`, `HORA_BORRA`, `OP_BORRA`, `CODIGO_OP`,
**`ANULADO`**, `FECHA_ANU`, `FECHA_REL`, `NRO_REL`, **`BORRADO`**, `CORREO`, `NROPRESU`, `NUMERO`,
`NROREF`, `ENVIO`, `OTROTIP`, `PORCE`, `TIPOPED`, `TRAJO`, `PROTOCO`, `APROBADO`, `RESPONSA`,
`ACLARA`, `FECAPRO`, `COMPU`, `MONTOAP`, `RETIRA`, `PROMO`, `MOTIVO`, `OBSERVACIO`, `FERIA`,
`PROANTES`, `CAJA`, `PERSONAL`, `TURNO`, `HORATU`, `NOMBRE`, `CAUSA`, `ORIGINAL`, `NROTRAN`,
`AUTORIZA`, `OBSMMORO`, `NROPROTO`. (`FECHA_RECE` es `date`; `NRO_RECEPC` y `CLINICA` son `decimal`.)

**`doctor`** (46): `CODDR`(PK), `NOMBRE`, `NOM_CORTO`, `VETERINARI`, **`CLINICA`→clini_vet**,
`COBRADOR`, `TELCONSUL`, `TELDOMICIL`, `CELULAR`, `EMAIL`, `RUC`, `DIRECCION`, `FECALTA`, `PRECIO`,
`SEXO`, `MOROSO`, `PROMO`, `ENVIO`, `DIFUSION`, `REFE`, `PORDONDE`, `CODIPAIS`, `CODIDEPA`,
`CODIDIST`, `CODICIUD`, `CONTRIBUYE`, `CODIOPER`, `CODITIPO`, `CODIDOCU`, `COBRANZA`, `NRODOCU`,
`MAILFAC`, `VALIDA`, `ORIGINAL`, `NACIONAL`, `ZONA`, `TIEMPOF`, `TIPOF`, `ENCOMIENDA`, `DISTRITO`,
`DEPTO`, `DUDOSO`, `HABILITA`, `COMENTA`, `TIPOPAG`, `GEOLOCA`.

**`clini_vet`** (41): `CODIGO`(PK), `NOMBRE`, `RUC`, `DIRECCION`, `TELEFONO`, `NOMBRERUC`,
`COBRADOR`, `NOMCOBRA`, `CORREO`, `MOROSO`, `PROMO`, `ENVIO`, `DEPTO`, `DISTRI`, `PRECIO`,
`DIFUSION`, `REFE`, `PORDONDE`, `CODIPAIS`, `CODIDEPA`, `CODIDIST`, `CODICIUD`, `CONTRIBUYE`,
`CODIOPER`, `CODITIPO`, `CODIDOCU`, `COBRANZA`, `NRODOCU`, `MAILFAC`, `VALIDA`, `ORIGINAL`,
`NACIONAL`, `ZONA`, `TIEMPOF`, `TIPOF`, `ENCOMIENDA`, `DUDOSO`, `HABILITA`, `COMENTA`, `TIPOPAG`,
`GELOLOCA`.

**`retirodet`** (20): `NUMERO`, `FECHAPEDIDO`, `ESTADO`, `TIPO`, `CODCLIENTE`, `NOMBRE`, `CODCOBRA`,
`COBRADOR`, `USUARIO`, `fecharetiro`, `codcance`, `cancela`, `retraso`, `comentario`, `tipopago`,
`ubicacion`, `operador`, `nombreoperador`, `fechanueva`, `dedondevino`.

**`encomienda`** (31): `NUMERO`, `CODEMP`, `DESCRI`, `TIPO`, `CODCLIENTE`, `nombre`, `QUIENENVIA`,
`QUIENESCRIBE`, `NROBOLETA`, `USUARIO`, `FECHAPEDIDO`, `FECHANUEVA`, `ESTADO`, `FECHARETIRO`,
`codcobra`, `cobrador`, `ubicacion`, `fechaespera`, `CODIGO`, `distrito`, `comentario`,
`dedondevino`, `nombreoperador`, `codcance`, `cancela`, `retraso`, `operador`, `imagen`(longtext),
`extencion`, `imagen1`(longtext), `extencion1`. **No seleccionar `imagen*`: son fotos de MB.**

**`analisis`** (61): `CODANAL`, `NROSEC`, `POSICION`, `NOMANAL`, `NOMRESULTA`, … (catálogo de
análisis; puede servir para el nombre "oficial" de cada `CODANAL`).

**`cobrador`** (5): `CODIGO`, `NOMBRE`, `CELULAR`, `CLAVE`, `ACTIVO`.

## Autenticación: qué hay cargado (sobre TODAS las clínicas/doctores)

| campo | con dato | distintos | válidos |
|---|---|---|---|
| `doctor.CELULAR` | 4.220 / 6.374 (66 %) | 4.127 | — |
| `doctor.EMAIL` | 2.737 / 6.374 (43 %) | 2.518 | 2.600 con formato de email |
| `clini_vet.TELEFONO` | 3.124 / 4.312 (72 %) | 3.024 | — |
| `clini_vet.CORREO` | 1.715 / 4.312 (40 %) | 1.598 | 1.692 |

Sobre las **577 clínicas que tienen resultados** (05/10): 96 % con teléfono, 76 % con email,
99 % con al menos uno.

**Los datos están sucios:**

- Campos de email con teléfonos adentro: `'0343 - 420 -984 DR. ZORRIL…'`.
- Varios correos en un campo: `'SSONYCARD87@GMAIL.COM,TUMA…'`.
- Celulares con dos números: `'981-114.114 - 754.278'`.
- `NOMBRE` con basura: `'-'`, `'--'`, `'1'`, `'.'`, `'----------'`.

**Precedente:** `cobrador.CLAVE` es cómo Olga autentica su app de cobradores. 18 tienen clave y hay
**un solo valor distinto: `1234`**. Argumento para no usar contraseñas.
