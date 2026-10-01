import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { manejarError } from '../utils/manejar-error';
import {
  TIPOS_CONTRATO,
  TIPOS_PROCESO_EXCUSA
} from './mock-data/catalogos.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Catalogos para filtros y formularios, con datos PROVISIONALES (ver
 * `catalogos.data.ts`). Se sustituira por un servicio HTTP con los mismos
 * metodos cuando el backend exponga los catalogos.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class CatalogosMockService {

  /**
   * @returns Tipos de contrato; vacio si la consulta falla.
   */
  obtenerTiposContrato(): Observable<string[]> {
    return simularRespuesta([...TIPOS_CONTRATO]).pipe(
      manejarError<string[]>(
        'CatalogosMockService.obtenerTiposContrato',
        []
      )
    );
  }

  /**
   * @returns Tipos de proceso de excusa; vacio si la consulta falla.
   */
  obtenerTiposProcesoExcusa(): Observable<string[]> {
    return simularRespuesta([...TIPOS_PROCESO_EXCUSA]).pipe(
      manejarError<string[]>(
        'CatalogosMockService.obtenerTiposProcesoExcusa',
        []
      )
    );
  }
}
