import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Excusa } from '../models';
import { manejarError } from '../utils/manejar-error';
import { EXCUSAS } from './mock-data/excusas.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta de formularios de excusa con datos simulados. Se sustituira por
 * un servicio HTTP con los mismos metodos.
 *
 * @author EEASA
 */
@Injectable({
    providedIn: 'root'
})
export class ExcusasMockService {

    /**
     * Obtiene todas las excusas.
     *
     * @returns Lista de excusas; vacia si la consulta falla.
     */
    obtenerExcusas(): Observable<Excusa[]> {
        return simularRespuesta([...EXCUSAS]).pipe(
            manejarError<Excusa[]>('ExcusasMockService.obtenerExcusas', [])
        );
    }

    /**
     * Obtiene una excusa por id.
     *
     * @param id Id de la excusa.
     * @returns La excusa, o `undefined` si no existe o la consulta falla.
     */
    obtenerExcusaPorId(id: string): Observable<Excusa | undefined> {
        const excusa = EXCUSAS.find((e) => e.id === id);

        return simularRespuesta(excusa).pipe(
            manejarError<Excusa | undefined>(
                'ExcusasMockService.obtenerExcusaPorId',
                undefined
            )
        );
    }
}
