import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { EstadoSeguimiento, FiltroReporte, ResultadoReporte, TipoReporte } from '../../models';
import { ConflictoApi, RespuestaApi } from '../../models/api';
import { RELOJ } from '../../utils/reloj';
import { ReportesMockService } from '../reportes-mock.service';
import { crearLibroReporte, filasReporte, nombreArchivoReporte } from './mapeos/reporte.mapeo';
import { datosDe, mensajeDeError, urlApi } from './peticiones';

/** Mensaje si el backend no explica el fallo. */
const ERROR_REPORTE = 'No se pudo descargar el Excel. Inténtalo de nuevo.';

/**
 * Estados de un conflicto que nunca tuvo un plan enviado: el Informe
 * General (RG.03) no los muestra, así que tampoco van en su Excel.
 */
const SIN_PLAN_ENVIADO: readonly EstadoSeguimiento[] = ['DETECTADO', 'EN_ANALISIS', 'DESCARTADO'];

/** Tipo MIME de un `.xlsx`. */
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Reportes en Excel contra el backend. Mismos métodos públicos que
 * `ReportesMockService`, al que sustituye en `app.config.ts`.
 *
 * `GET /conflictos/reporte` (roles A y R) devuelve los conflictos sin
 * paginar, con los mismos filtros que `GET /conflictos`; el backend no
 * genera el archivo. El libro se arma con `xlsx` y se descarga en el
 * navegador. El token lo pone el interceptor, como en toda petición.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class ReportesHttpService implements Pick<ReportesMockService, keyof ReportesMockService> {
  private readonly http = inject(HttpClient);
  private readonly reloj = inject(RELOJ);

  /**
   * Pide los datos del reporte, arma el Excel y lo descarga.
   *
   * @param tipo `RG.02` (Análisis) o `RG.03` (Informe General).
   * @param filtro Filtros que entiende el backend.
   * @returns `descargado` con el nombre del archivo, o `error` con el
   * motivo (el `mensaje` del backend si lo hay).
   * @author Elvis Flores
   */
  descargarReporte(tipo: TipoReporte, filtro: FiltroReporte): Observable<ResultadoReporte> {
    return this.http
      .get<RespuestaApi<ConflictoApi[]>>(urlApi('/conflictos/reporte'), { params: this.parametros(filtro) })
      .pipe(
        datosDe<ConflictoApi[]>(),
        map((conflictos): ResultadoReporte => {
          const filas = (conflictos ?? []).filter((c) => tipo !== 'RG.03' || !this.sinPlanEnviado(c));
          const nombreArchivo = nombreArchivoReporte(tipo, this.reloj());
          const contenido: ArrayBuffer = XLSX.write(crearLibroReporte(tipo, filasReporte(tipo, filas)), {
            bookType: 'xlsx',
            type: 'array'
          });

          this.guardarArchivo(new Blob([contenido], { type: MIME_XLSX }), nombreArchivo);
          return { estado: 'descargado', nombreArchivo };
        }),
        catchError((err: unknown) => {
          const mensaje = mensajeDeError(err, ERROR_REPORTE);

          console.error('[ReportesHttpService.descargarReporte]', mensaje, err);
          return of<ResultadoReporte>({ estado: 'error', mensaje });
        })
      );
  }

  /**
   * Descarga un archivo en el navegador con un enlace temporal.
   *
   * @param archivo Contenido.
   * @param nombre Nombre con el que se guarda.
   */
  protected guardarArchivo(archivo: Blob, nombre: string): void {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  /**
   * @param filtro Filtros de la pantalla.
   * @returns Solo los que tienen valor.
   */
  private parametros(filtro: FiltroReporte): HttpParams {
    let params = new HttpParams();

    if (filtro.analisisId) {
      params = params.set('analisisId', filtro.analisisId);
    }
    if (filtro.riesgo) {
      params = params.set('riesgo', filtro.riesgo);
    }
    if (filtro.estado) {
      params = params.set('estado', filtro.estado);
    }
    if (filtro.vencido) {
      params = params.set('vencido', true);
    }
    return params;
  }

  /**
   * @param c Conflicto del reporte.
   * @returns `true` si nunca tuvo un plan enviado.
   */
  private sinPlanEnviado(c: ConflictoApi): boolean {
    return c.ESTADO_SEGUIMIENTO === null || SIN_PLAN_ENVIADO.includes(c.ESTADO_SEGUIMIENTO);
  }
}
