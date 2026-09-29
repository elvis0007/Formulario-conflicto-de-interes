/**
 * Rol de un usuario dentro del modulo PNIP-CI.
 *
 * Solo existe `rrhh` (gestiona formularios, conflictos y planes, y revisa
 * evidencias). «Responsable» NO es un rol: cualquier empleado autenticado
 * puede ser responsable de una actividad concreta de un plan, porque el
 * backend se la asigna. Por eso las pantallas de responsable solo exigen
 * sesion (ver `rolGuard`).
 *
 * No coincide con las abreviaturas de rol del backend (`A`, `R`, `E`...):
 * la traduccion la hace `RolPnipCiService`.
 *
 * @author Elvis Flores
 */
export type RolPnipCi = 'rrhh';
