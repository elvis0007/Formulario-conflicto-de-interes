import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FormularioCI, Persona } from '../models';
import { manejarError } from '../utils/manejar-error';
import {
    EMPLEADOS_SIN_FORMULARIO,
    FORMULARIOS
} from './mock-data/formularios.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta de formularios de conflicto de interes con datos simulados. Se
 * sustituira por un servicio HTTP con los mismos metodos.
 *
 * @author EEASA
 */
@Injectable({
    providedIn: 'root'
})
export class FormulariosMockService {

    /**
     * Obtiene todos los formularios recibidos.
     *
     * @returns Lista de formularios; vacia si la consulta falla.
     */
    obtenerFormularios(): Observable<FormularioCI[]> {
        return simularRespuesta([...FORMULARIOS]).pipe(
            manejarError<FormularioCI[]>(
                'FormulariosMockService.obtenerFormularios',
                []
            )
        );
    }

    /**
     * Obtiene un formulario por id.
     *
     * @param id Id del formulario.
     * @returns El formulario, o `undefined` si no existe o si falla.
     */
    obtenerFormularioPorId(id: string): Observable<FormularioCI | undefined> {
        const formulario = FORMULARIOS.find((f) => f.id === id);

        return simularRespuesta(formulario).pipe(
            manejarError<FormularioCI | undefined>(
                'FormulariosMockService.obtenerFormularioPorId',
                undefined
            )
        );
    }

    /**
     * Obtiene los empleados que aun no han llenado el formulario.
     *
     * @returns Lista de empleados; vacia si la consulta falla.
     */
    obtenerEmpleadosSinFormulario(): Observable<Persona[]> {
        return simularRespuesta([...EMPLEADOS_SIN_FORMULARIO]).pipe(
            manejarError<Persona[]>(
                'FormulariosMockService.obtenerEmpleadosSinFormulario',
                []
            )
        );
    }
}
