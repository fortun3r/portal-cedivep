# docs/ — la evidencia

Documentos producidos durante el análisis de la base del laboratorio, **en orden cronológico**.
Son la evidencia detrás de las decisiones. **Si algo contradice a `HANDOFF.md`, gana `HANDOFF.md`**:
algunas conclusiones tempranas quedaron superadas por hallazgos posteriores. En particular:

- `01` dice que `NUMEROID` es la mejor clave → **superado**: la tabla `pedidos` de MySQL no lo trae.
  Usar `(FECHA_RECE, NRO_RECEPC)`.
- `01` y `02` dicen que la MySQL no tiene el vínculo con la clínica → **resuelto** en `03` y `04`:
  Olga cargó `pedidos`.

| Archivo | Qué es |
|---|---|
| `01-hallazgos-descres.md` | Cómo se lee `descres`: centinelas, orden de impresión, animales (13/08) |
| `02-mapa-mysql.md` | Las 13 tablas con todas sus columnas, y la calidad de los contactos (13/08) |
| `03-modelo-pedidos.md` | Cómo se encontró el vínculo resultado → clínica en los DBF (14/08) |
| `04-verificacion-pedidos.md` | La verificación final contra la base real con `pedidos` cargada (05/10) |
| `ADR-0008-stack-portal.md` | La decisión de stack. Copiarla a `_migracion/adr/` del proyecto grande |
