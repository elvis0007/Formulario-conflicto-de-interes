import { Persona } from './persona';
import { GradoParentesco, Relacion, Riesgo } from './tipos-conflicto';

/**
 * Datos de un candidato para la Consulta Previa a Contratación. Basta la
 * cedula, o los nombres y los apellidos.
 *
 * @author Elvis Flores
 */
export interface DatosCandidato {
  /** 10 digitos, o vacia. */
  cedula: string;
  nombres: string;
  apellidos: string;
}

/**
 * Un empleado actual con posible parentesco con el candidato.
 *
 * @author Elvis Flores
 */
export interface CoincidenciaCandidato {
  empleado: Persona;
  /** Lo que el candidato seria del empleado: «Padre», «Hermano/a»... */
  parentesco: string;
  relacion: Relacion;
  /** `null` para los conyuges (no aplica grado). */
  grado: GradoParentesco | null;
  /** Riesgo estimado segun el grado. */
  riesgo: Riesgo;
  /** Por que se encontro: declaracion, nombres de padres, apellidos... */
  motivo: string;
}

/**
 * Una consulta hecha en la sesion (informativa: no crea un caso en el
 * analisis ni un plan).
 *
 * @author Elvis Flores
 */
export interface ConsultaPrevia {
  id: string;
  /** Fecha y hora de la consulta (ISO 8601). */
  fecha: string;
  datos: DatosCandidato;
  coincidencias: CoincidenciaCandidato[];
}
