/**
 * Catalogos PROVISIONALES del modulo. No hay catalogo real del backend
 * todavia; los valores salen de la especificacion funcional.
 *
 * PENDIENTE de confirmar con backend:
 * - `TIPOS_CONTRATO`: la app host usa el catalogo de modalidades de
 *   nomina (por regimen), que tiene muchos mas valores. Hay que decidir si
 *   la gestión de conflictos usa ese catalogo o estas cuatro categorias.
 * - `TIPOS_PROCESO_EXCUSA`: la especificacion indica que los campos exactos
 *   del formulario de excusa estan por confirmar.
 *
 * @author Elvis Flores
 */

/** Tipos de contrato del formulario de conflicto de interes. */
export const TIPOS_CONTRATO: readonly string[] = [
  'Ocasional',
  'Permanente',
  'Servicios ocasionales LOEP',
  'Nombramientos provisionales LOEP'
];

/** Tipos de proceso del formulario de excusa. */
export const TIPOS_PROCESO_EXCUSA: readonly string[] = [
  'Proceso de selección',
  'Proceso de compra',
  'Evaluación de desempeño'
];
