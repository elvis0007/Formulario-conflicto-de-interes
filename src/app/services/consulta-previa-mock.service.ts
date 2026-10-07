import { Injectable, inject } from '@angular/core';
import { Observable, defer, throwError } from 'rxjs';
import { ConsultaPrevia, DatosCandidato } from '../models';
import { buscarCoincidencias, validarDatosCandidato } from '../utils/consulta-previa.util';
import { manejarError } from '../utils/manejar-error';
import { RELOJ } from '../utils/reloj';
import { FORMULARIOS } from './mock-data/formularios.data';
import { PERSONAS } from './mock-data/personas.data';
import { simularRespuesta } from './mock-data/simular-respuesta';

/**
 * Consulta Previa a Contratación con datos simulados.
 *
 * Es INFORMATIVA: no crea un caso en el analisis ni un plan de accion.
 * Busca contra los empleados de ejemplo y sus formularios declarados
 * (`buscarCoincidencias`) y guarda en memoria las consultas de la sesion.
 *
 * Con el backend: `GET /consulta-previa?cedula&nombres&apellidos`.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class ConsultaPreviaMockService {
  /** Consultas de la sesion, de la mas reciente a la mas antigua. */
  private readonly consultas: ConsultaPrevia[] = [];

  /** Correlativo de las consultas (CP-001...). */
  private correlativo = 0;

  private readonly reloj = inject(RELOJ);

  /**
   * Consulta si un candidato tiene posibles parientes entre los empleados.
   * Exige la cedula (10 digitos) o nombres y apellidos.
   *
   * @param datos Datos del candidato.
   * @returns La consulta con sus coincidencias, o `null` si los datos no
   * son validos o si falla.
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

      this.consultas.unshift(consulta);
      return simularRespuesta(consulta);
    }).pipe(
      manejarError<ConsultaPrevia | null>('ConsultaPreviaMockService.consultarCandidato', null)
    );
  }

  /**
   * @returns Consultas hechas en la sesion, de la mas reciente a la mas
   * antigua; vacia si no hay o si falla.
   * @author Elvis Flores
   */
  obtenerConsultasRecientes(): Observable<ConsultaPrevia[]> {
    return simularRespuesta(this.consultas).pipe(
      manejarError<ConsultaPrevia[]>('ConsultaPreviaMockService.obtenerConsultasRecientes', [])
    );
  }
}
