-- Usuario de solo lectura para el portal. Lo crea Olga.
-- El portal hoy no tiene otra opción que la cuenta de administración: esto la reemplaza.
--
-- 1. Cambiar la clave por una larga y al azar. Por ejemplo, en una terminal:
--      node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
-- 2. Mejor todavía: reemplazar '%' por la IP del servidor donde corra el portal.

CREATE USER 'portal_ro'@'%' IDENTIFIED BY 'CAMBIAR-POR-UNA-CLAVE-LARGA';

GRANT SELECT ON cedivep.descres   TO 'portal_ro'@'%';
GRANT SELECT ON cedivep.pedidos   TO 'portal_ro'@'%';
GRANT SELECT ON cedivep.clini_vet TO 'portal_ro'@'%';
-- Cuando esté cargada (para los particulares):
-- GRANT SELECT ON cedivep.paciente TO 'portal_ro'@'%';

FLUSH PRIVILEGES;
