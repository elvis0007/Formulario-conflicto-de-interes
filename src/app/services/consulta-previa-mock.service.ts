import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, of, tap, throwError } from 'rxjs';
import { ConsultaPrevia, DatosCandidato } from '../models';
import { buscarCoincidencias, validarDatosCandidato } from '../utils/consulta-previa.util';
import { RELOJ } from '../utils/reloj';
import { FORMULARIOS } from './mock-data/formularios.data';
import { PERSONAS } from './mock-data/personas.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta Previa a Contratación con datos simulados.
 *
 * Es INFORMATIVA: no crea un caso en el analisis ni un plan de accion.
 * Busca contra los empleados de ejemplo y sus formularios declarados
 * (`buscarCoincidencias`). Como el backend, no guarda las consultas.
 * Exige lo mismo que el backend: cedula, un nombre y un apellido.
 *
 * Con el backend: `POST /consultas-previas`.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class ConsultaPreviaMockService {
  /**
   * Motivo del ultimo fallo de `consultarCandidato` (el `mensaje` del
   * backend en la version HTTP). `null` si la ultima salio bien.
   */
  ultimoError: string | null = null;

  /** Correlativo de las consultas (CP-001...). */
  private correlativo = 0;

  private readonly reloj = inject(RELOJ);

  /**
   * Consulta si un candidato tiene posibles parientes entre los empleados.
   * Exige la cedula (10 digitos), un nombre y un apellido.
   *
   * @param datos Datos del candidato.
   * @returns La consulta con sus coincidencias, o `null` si los datos no
   * son validos o si falla (el motivo queda en `ultimoError`).
   * @author Elvis Flores
   */
  consultarCandidato(datos: DatosCandidato): Observable<ConsultaPrevia | null> {
    return defer(() => {
      const limpios: DatosCandidato = {
        cedula: datos.cedula.trim(),
        nombres: datos.nombres.trim().replace(/\s+/g, ' '),
        apellidos: datos.apellidos.trim().replace(/\s+/g, ' ')
      };
      const error = validarDatosCandidato(limpios);

      if (error !== null) {
        return throwError(() => new Error(error));
      }

      this.correlativo++;
      const consulta: ConsultaPrevia = {
        id: 'CP-' + String(this.correlativo).padStart(3, '0'),
        fecha: this.reloj().toISOString(),
        datos: limpios,
        coincidencias: buscarCoincidencias(limpios, PERSONAS, FORMULARIOS)
      };

      return simularRespuesta(consulta);
    }).pipe(
      tap(() => this.ultimoError = null),
      catchError((err: unknown) => {
        this.ultimoError = err instanceof Error && err.message !== '' ? err.message : null;
        console.error('[ConsultaPreviaMockService.consultarCandidato]', err);
        return of(null);
      })
    );
  }
}
