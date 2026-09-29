/**
 * Formulario de excusa: una persona se aparta de un proceso en el que
 * participa un familiar suyo.
 *
 * @author EEASA
 */
export interface Excusa {
    id: string;
    /** Nombre completo de quien se excusa. */
    nombre: string;
    cedula: string;
    /** Si quien se excusa es empleado (`Interno`) o no (`Externo`). */
    origen: 'Interno' | 'Externo';
    /** Tipo de proceso del que se excusa (p. ej. contratacion). */
    proceso: string;
    /** Identificacion o descripcion concreta del proceso. */
    detalleProceso: string;
    /** Nombre del familiar que participa en el proceso. */
    familiar: string;
    parentesco: string;
    motivo: string;
    /** Persona que reemplaza a quien se excusa en el proceso. */
    reemplazo: string;
    /** Fecha de la excusa (ISO 8601). */
    fecha: string;
}
