import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { ConsultaPrevia, DatosCandidato } from '../../models';
import { ConsultaPreviaApi, RespuestaApi } from '../../models/api';
import { RELOJ } from '../../utils/reloj';
import { ConsultaPreviaMockService } from '../consulta-previa-mock.service';
import { crearPedidoConsulta, mapearConsulta } from './mapeos/consulta-previa.mapeo';
import { datosDe, mensajeDeError, urlApi } from './peticiones';

/** Mensaje si el backend no explica el fallo. */
const ERROR_CONSULTA = 'No se pudo hacer la consulta. Inténtalo de nuevo.';

/**
 * Consulta previa contra el backend (wssisci). Mismos métodos públicos que
 * `ConsultaPreviaMockService`, al que sustituye en `app.config.ts`.
 *
 * El backend solo calcula: no guarda las consultas ni las coincidencias.
 *
 * @author Sebas Constante
 */
@Injectable({
  providedIn: 'root'
})
export class ConsultaPreviaHttpService implements Pick<ConsultaPreviaMockService, keyof ConsultaPreviaMockService> {
  /**
   * Motivo del último fallo de `consultarCandidato` (el `mensaje` del
   * backend en 400/403…, o el aviso de sin conexión). `null` si la última
   * salió bien.
   */
  ultimoError: string | null = null;

  private readonly http = inject(HttpClient);
  private readonly reloj = inject(RELOJ);

  /**
   * Consulta si un candidato tiene posibles parientes entre los empleados
   * (`POST /consultas-previas`, como aspirante).
   *
   * @param datos Datos del candidato.
   * @returns La consulta con sus coincidencias, o `null` si el backend la
   * rechaza (datos inválidos) o si falla; el motivo queda en `ultimoError`.
   */
  consultarCandidato(datos: DatosCandidato): Observable<ConsultaPrevia | null> {
    const limpios: DatosCandidato = {
      cedula: datos.cedula.trim(),
      nombres: datos.nombres.trim().replace(/\s+/g, ' '),
      apellidos: datos.apellidos.trim().replace(/\s+/g, ' ')
    };

    return this.http
      .post<RespuestaApi<ConsultaPreviaApi>>(urlApi('/consultas-previas'), crearPedidoConsulta(limpios))
      .pipe(
        datosDe<ConsultaPreviaApi>(),
        map((api): ConsultaPrevia | null => api === undefined ? null : mapearConsulta(api, limpios, this.reloj())),
        tap(() => this.ultimoError = null),
        catchError((err: unknown) => {
          this.ultimoError = mensajeDeError(err, ERROR_CONSULTA);
          console.error('[ConsultaPreviaHttpService.consultarCandidato]', this.ultimoError, err);
          return of(null);
        })
      );
  }
}
