-- Índices para el portal. Los corre Olga (es su base). Son seguros: no cambian datos,
-- solo aceleran las consultas. Hoy ni descres ni pedidos tienen un solo índice.
--
-- Al 05/10/2026 la consulta del portal tarda 0,07 s porque las tablas son chicas
-- (descres ~93.000 filas, pedidos ~9.300). Sin índices, eso crece con la ventana de datos.

CREATE INDEX ix_descres_pedido ON descres (FEC_PED, NROMOV, UBICACION);
CREATE INDEX ix_ped_clave      ON pedidos (FECHA_RECE, NRO_RECEPC);
CREATE INDEX ix_ped_clinica    ON pedidos (CLINICA);
