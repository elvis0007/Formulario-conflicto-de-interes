/**
 * Rol de un usuario dentro del modulo PNIP-CI.
 *
 * - `rrhh`: gestiona formularios, conflictos, planes y revisa evidencias.
 * - `responsable`: ejecuta actividades de planes de accion y sube evidencias.
 *
 * No coincide con las abreviaturas de rol del backend (`A`, `R`, `E`...):
 * la traduccion la hace `RolPnipCiService`.
 *
 * @author EEASA
 */
export type RolPnipCi = 'rrhh' | 'responsable';
