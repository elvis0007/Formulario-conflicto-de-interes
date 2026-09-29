import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Conflicto } from '../models';
import { manejarError } from '../utils/manejar-error';
import { CONFLICTOS } from './mock-data/conflictos.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta de conflictos de interes con datos simulados. Cada conflicto
 * incluye sus planes de accion. Se sustituira por un servicio HTTP con los
 * mismos metodos.
 *
 * @author EEASA
 */
@Injectable({
    providedIn: 'root'
})
export class ConflictosMockService {

    /**
     * Obtiene todos los conflictos.
     *
     * @returns Lista de conflictos; vacia si la consulta falla.
     */
    obtenerConflictos(): Observable<Conflicto[]> {
        return simularRespuesta([...CONFLICTOS]).pipe(
            manejarError<Conflicto[]>(
                'ConflictosMockService.obtenerConflictos',
                []
            )
        );
    }

    /**
     * Obtiene un conflicto por id.
     *
     * @param id Id del conflicto.
     * @returns El conflicto, o `undefined` si no existe o la consulta falla.
     */
    obtenerConflictoPorId(id: string): Observable<Conflicto | undefined> {
        const conflicto = CONFLICTOS.find((c) => c.id === id);

        return simularRespuesta(conflicto).pipe(
            manejarError<Conflicto | undefined>(
                'ConflictosMockService.obtenerConflictoPorId',
                undefined
            )
        );
    }
}
