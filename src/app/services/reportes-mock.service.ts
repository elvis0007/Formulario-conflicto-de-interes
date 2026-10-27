import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { FiltroReporte, ResultadoReporte, TipoReporte } from '../models';

/**
 * Reportes en Excel con la sesion simulada: no hay backend del que sacar
 * los datos, asi que siempre responde `sin-backend` y la pantalla muestra
 * «Disponible con sesión real».
 *
 * Con el backend: `ReportesHttpService` (`GET /conflictos/reporte`).
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class ReportesMockService {
  /**
   * @param tipo Reporte pedido.
   * @param filtro Filtros de la pantalla.
   * @returns Siempre `{ estado: 'sin-backend' }`.
   * @author Elvis Flores
   */
  descargarReporte(tipo: TipoReporte, filtro: FiltroReporte): Observable<ResultadoReporte> {
    void tipo;
    void filtro;
    return of({ estado: 'sin-backend' });
  }
}
