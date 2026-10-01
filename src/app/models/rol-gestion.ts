/**
 * Rol de un usuario dentro de la gestión de conflictos.
 *
 * - `rrhh`: gestiona formularios, conflictos y planes, y revisa
 *   evidencias. Lo tienen los roles `R` (Jefe de RRHH) y `A`
 *   (Administrador) del backend.
 * - `responsable`: cumple las actividades que un plan de accion le asigna.
 *   Lo da el rol `P` del backend, que se asigna a quien recibe
 *   actividades.
 *
 * Un usuario puede tener los dos (p. ej. `R` y `P`).
 *
 * No coincide con las abreviaturas de rol del backend (`A`, `R`, `P`,
 * `E`...): la traduccion la hace `PerfilUsuarioService`.
 *
 * @author Elvis Flores
 */
export type RolGestion = 'rrhh' | 'responsable';
