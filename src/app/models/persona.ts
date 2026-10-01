/**
 * Empleado o persona involucrada en un conflicto de interes.
 *
 * @author Elvis Flores
 */
export interface Persona {
    /** Identificador interno de la persona. */
    id: string;
    /** Nombres y apellidos completos. */
    nombres: string;
    cedula: string;
    cargo: string;
    departamento: string;
    /** Nombre del jefe inmediato, si se conoce. */
    jefeInmediato?: string;
    /** Fecha de ingreso a la empresa, en formato ISO 8601 (`YYYY-MM-DD`). */
    fechaIngreso?: string;
    /** Nombre del padre; se usa para detectar parentescos. */
    padre?: string;
    /** Nombre de la madre; se usa para detectar parentescos. */
    madre?: string;
    /** Nombre del conyuge; se usa para detectar parentescos por afinidad. */
    conyuge?: string;
}
