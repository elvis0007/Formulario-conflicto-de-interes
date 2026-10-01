import { FamiliarDeclarado } from './familiar-declarado';

/**
 * Formulario de declaracion de conflicto de interes, visto desde RRHH.
 *
 * @author Elvis Flores
 */
export interface FormularioCI {
  id: string;
  /** Nombre completo del declarante. */
  nombre: string;
  cedula: string;
  /** Si el declarante es empleado (`Interno`) o no (`Externo`). */
  origen: 'Interno' | 'Externo';
  /** Primera declaracion o actualizacion de una anterior. */
  tipo: 'Inicial' | 'Actualización';
  tipoContrato: string;
  /** Fecha de envio del formulario (ISO 8601). */
  fecha: string;
  cargo: string;
  departamento: string;
  estadoCivil: string;
  correo: string;
  familiares: FamiliarDeclarado[];
}
