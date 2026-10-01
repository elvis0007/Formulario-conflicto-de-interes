import { Persona } from './persona';

/**
 * Persona que debe llenar el formulario de conflicto de interes y aun no
 * lo ha hecho (pestana «No han llenado formulario»).
 *
 * @author Elvis Flores
 */
export interface EmpleadoSinFormulario {
    persona: Persona;
    /** Si es empleado (`Interno`) o no (`Externo`). */
    origen: 'Interno' | 'Externo';
    /**
     * Fecha y hora (ISO 8601) del ultimo recordatorio enviado; no existe si
     * nunca se le envio uno.
     */
    ultimoRecordatorio?: string;
}
