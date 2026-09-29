import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EmpleadoSinFormulario, FormularioCI } from '../models';
import { manejarError } from '../utils/manejar-error';
import {
    EMPLEADOS_SIN_FORMULARIO,
    FORMULARIOS
} from './mock-data/formularios.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Formularios de conflicto de interes con datos simulados. Se sustituira
 * por un servicio HTTP con los mismos metodos.
 *
 * Guarda su propia copia de las personas sin formulario para simular el
 * envio de recordatorios durante la sesion (sin correo real).
 *
 * @author Elvis Flores
 */
@Injectable({
    providedIn: 'root'
})
export class FormulariosMockService {
    /** Estado en memoria de quienes no han llenado el formulario. */
    private readonly sinFormulario: EmpleadoSinFormulario[] =
        structuredClone([...EMPLEADOS_SIN_FORMULARIO]);

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
     * Obtiene quienes aun no han llenado el formulario.
     *
     * @returns Lista de personas; vacia si la consulta falla.
     */
    obtenerEmpleadosSinFormulario(): Observable<EmpleadoSinFormulario[]> {
        return simularRespuesta([...this.sinFormulario]).pipe(
            manejarError<EmpleadoSinFormulario[]>(
                'FormulariosMockService.obtenerEmpleadosSinFormulario',
                []
            )
        );
    }

    /**
     * Registra el envio de un recordatorio a las personas indicadas. Sin
     * backend no se envia ningun correo: solo se actualiza la fecha.
     *
     * @param personaIds Ids de las personas.
     * @returns Fecha ISO del envio; `null` si la operacion falla.
     */
    enviarRecordatorio(personaIds: readonly string[]): Observable<string | null> {
        const fecha = new Date().toISOString();

        for (const empleado of this.sinFormulario) {
            if (personaIds.includes(empleado.persona.id)) {
                empleado.ultimoRecordatorio = fecha;
            }
        }

        return simularRespuesta<string | null>(fecha).pipe(
            manejarError<string | null>(
                'FormulariosMockService.enviarRecordatorio',
                null
            )
        );
    }
}
