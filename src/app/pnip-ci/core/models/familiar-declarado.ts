/**
 * Familiar que un empleado declara en su formulario de conflicto de interes.
 *
 * @author Elvis Flores
 */
export interface FamiliarDeclarado {
    /** Parentesco con el declarante (p. ej. `Hermano`, `Suegra`). */
    parentesco: string;
    nombre: string;
    cedula: string;
    /** Si el familiar tambien trabaja en EEASA. */
    trabajaEnEmpresa: boolean;
}
