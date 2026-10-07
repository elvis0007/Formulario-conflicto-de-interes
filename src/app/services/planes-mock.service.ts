import { Injectable, Injector, inject } from '@angular/core';
import { Observable, defer, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { Actividad, Notificacion, PlanAccion } from '../models';
import { validarDocumentoFirmado } from '../utils/documento.util';
import { calcularFechaLimite, formatearFechaIso, parsearFecha } from '../utils/fechas.util';
import { manejarError } from '../utils/manejar-error';
import {
  actividadCompleta,
  derivarEstadoPlan,
  hayPlanActivo,
  responsablesDelPlan
} from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { PLANES } from './mock-data/planes.data';
import { simularRespuesta } from './mock-data/simular-respuesta';
import { NotificacionesMockService } from './notificaciones-mock.service';
import { PerfilUsuarioService } from './perfil-usuario.service';

/** Resultado de subir el documento firmado. */
export interface ResultadoDocumento {
  /** Plan actualizado, o `null` si no se subio. */
  plan: PlanAccion | null;
  /** Motivo por el que no se subio, o `null` si se subio. */
  error: string | null;
}

/** Mensaje si la subida falla por otra razon. */
const ERROR_SUBIDA = 'No se pudo subir el documento. Inténtalo de nuevo.';

/**
 * Planes de accion con datos simulados. Se sustituira por un servicio HTTP
 * con los mismos metodos.
 *
 * Es la UNICA fuente de los planes: guarda su propia copia en memoria y
 * los cambios (crear o guardar un borrador) duran toda la sesion.
 * `AnalisisMockService` le pide los planes de cada conflicto, asi un plan
 * creado en Plan de Acción aparece tambien en Análisis de Conflictos.
 *
 * @author Elvis Flores
 */
@Injectable({
  providedIn: 'root'
})
export class PlanesMockService {
  /** Planes en memoria. */
  private readonly planes: PlanAccion[] = structuredClone([...PLANES]);

  /** Ultimo numero de actividad asignado (varias en un mismo guardado). */
  private ultimoIdActividad = 0;

  private readonly reloj = inject(RELOJ);
  private readonly notificaciones = inject(NotificacionesMockService);

  /**
   * Para resolver `PerfilUsuarioService` (nombre de quien revisa) solo al
   * revisar: asi crear este servicio no exige la sesion.
   */
  private readonly injector = inject(Injector);

  /**
   * Obtiene todos los planes.
   *
   * @returns Lista de planes; vacia si la consulta falla.
   */
  obtenerPlanes(): Observable<PlanAccion[]> {
    return simularRespuesta(this.planes).pipe(
      manejarError<PlanAccion[]>('PlanesMockService.obtenerPlanes', [])
    );
  }

  /**
   * Obtiene un plan por id.
   *
   * @param id Id del plan.
   * @returns El plan, o `undefined` si no existe o la consulta falla.
   */
  obtenerPlanPorId(id: string): Observable<PlanAccion | undefined> {
    const plan = this.planes.find((p) => p.id === id);

    return simularRespuesta(plan).pipe(
      manejarError<PlanAccion | undefined>(
        'PlanesMockService.obtenerPlanPorId',
        undefined
      )
    );
  }

  /**
   * Obtiene los planes de un conflicto, por numero (Plan 01, Plan 02...).
   *
   * @param conflictoId Id del conflicto.
   * @returns Planes del conflicto; vacia si no tiene o la consulta falla.
   */
  obtenerPlanesDeConflicto(conflictoId: string): Observable<PlanAccion[]> {
    const planes = this.planes
      .filter((p) => p.conflictoId === conflictoId)
      .sort((a, b) => a.numero - b.numero);

    return simularRespuesta(planes).pipe(
      manejarError<PlanAccion[]>(
        'PlanesMockService.obtenerPlanesDeConflicto',
        []
      )
    );
  }

  /**
   * Obtiene los planes en los que un empleado es responsable de al menos
   * una actividad (vista de responsable). Incluye planes en cualquier
   * estado: la pantalla decide cuales mostrar.
   *
   * @param empleadoId Id del empleado (`Actividad.responsableId`).
   * @returns Planes del responsable; vacia si no tiene o si falla.
   */
  obtenerPlanesPorResponsable(empleadoId: string): Observable<PlanAccion[]> {
    const planes = this.planes.filter((plan) => plan.actividades.some(
      (actividad) => actividad.responsableId === empleadoId
    ));

    return simularRespuesta(planes).pipe(
      manejarError<PlanAccion[]>(
        'PlanesMockService.obtenerPlanesPorResponsable',
        []
      )
    );
  }

  /**
   * Guarda un plan en borrador.
   *
   * - Si su `id` esta vacio, lo crea: le asigna id y el siguiente numero
   *   dentro de su conflicto. No se crea si el conflicto ya tiene un plan
   *   vigente (solo puede haber uno).
   * - Si no, actualiza el plan existente, que debe seguir en borrador.
   *
   * Las actividades sin id reciben uno. Solo acepta planes en estado
   * `borrador`.
   *
   * @param plan Plan a guardar.
   * @returns El plan guardado (con id y numero), o `null` si no se pudo
   * guardar.
   */
  guardarBorrador(plan: PlanAccion): Observable<PlanAccion | null> {
    return defer(() => {
      const delConflicto = this.planes.filter((p) => p.conflictoId === plan.conflictoId);
      const guardado = structuredClone(plan);
      let indice = -1;

      if (plan.estado !== 'borrador') {
        return throwError(() => new Error('Solo se guardan planes en borrador.'));
      }

      if (guardado.id === '') {
        if (hayPlanActivo(delConflicto)) {
          return throwError(() => new Error('El conflicto ya tiene un plan vigente.'));
        }
        guardado.id = this.siguienteIdPlan();
        guardado.numero = delConflicto.reduce((max, p) => Math.max(max, p.numero), 0) + 1;
      } else {
        indice = this.planes.findIndex((p) => p.id === guardado.id);
        if (indice < 0) {
          return throwError(() => new Error('No existe el plan ' + guardado.id + '.'));
        }
        if (this.planes[indice].estado !== 'borrador') {
          return throwError(() => new Error('El plan ' + guardado.id + ' ya no es un borrador.'));
        }
        guardado.numero = this.planes[indice].numero;
        // El documento solo cambia con subir/quitarDocumentoFirmado.
        guardado.documentoFirmado = this.planes[indice].documentoFirmado;
      }

      guardado.actividades = guardado.actividades.map((actividad) => ({
        ...actividad,
        id: actividad.id || this.siguienteIdActividad()
      }));

      if (indice < 0) {
        this.planes.push(guardado);
      } else {
        this.planes[indice] = guardado;
      }

      return simularRespuesta(guardado);
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.guardarBorrador', null)
    );
  }

  /**
   * Sube (o reemplaza) el documento firmado de un plan en borrador. Valida
   * que sea PDF y que no supere 10 MB (`validarDocumentoFirmado`).
   * Guarda nombre, tipo, fecha de subida y una URL local
   * (`URL.createObjectURL`) para poder verlo; si habia uno, libera su URL.
   *
   * @param planId Id del plan.
   * @param archivo PDF escaneado del plan firmado.
   * @returns El plan actualizado, o el motivo por el que no se subio.
   */
  subirDocumentoFirmado(planId: string, archivo: File): Observable<ResultadoDocumento> {
    return defer(() => {
      const plan = this.planes.find((p) => p.id === planId);
      const error = validarDocumentoFirmado(archivo);

      if (plan === undefined) {
        return throwError(() => new Error('No existe el plan ' + planId + '.'));
      }
      if (plan.estado !== 'borrador') {
        return simularRespuesta<ResultadoDocumento>({
          plan: null,
          error: 'Solo se puede subir el documento a un plan en borrador.'
        });
      }
      if (error !== null) {
        return simularRespuesta<ResultadoDocumento>({ plan: null, error });
      }

      this.liberarDocumento(plan);
      plan.documentoFirmado = {
        nombre: archivo.name,
        url: URL.createObjectURL(archivo),
        tipo: 'pdf',
        fechaSubida: this.reloj().toISOString()
      };
      return simularRespuesta<ResultadoDocumento>({ plan, error: null });
    }).pipe(
      manejarError<ResultadoDocumento>('PlanesMockService.subirDocumentoFirmado', {
        plan: null,
        error: ERROR_SUBIDA
      })
    );
  }

  /**
   * Quita el documento firmado de un plan en borrador (y libera su URL).
   *
   * @param planId Id del plan.
   * @returns El plan sin documento, o `null` si no existe o no esta en
   * borrador.
   */
  quitarDocumentoFirmado(planId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const plan = this.planes.find((p) => p.id === planId);

      if (plan === undefined || plan.estado !== 'borrador') {
        return throwError(() => new Error('El plan ' + planId + ' no existe o no está en borrador.'));
      }

      this.liberarDocumento(plan);
      delete plan.documentoFirmado;
      return simularRespuesta(plan);
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.quitarDocumentoFirmado', null)
    );
  }

  /**
   * «Enviar y notificar»: activa un plan en borrador y avisa a sus
   * responsables.
   *
   * Exige que el plan este en borrador, tenga documento firmado y al menos
   * una actividad, todas completas (`actividadCompleta`). Entonces:
   * - fija la fecha de inicio en HOY. En el backend real la fijara el
   *   servidor al recibir el envio; aqui se toma del reloj de la app
   *   (`RELOJ`);
   * - calcula la fecha limite de cada actividad (`calcularFechaLimite`) y
   *   las deja en `pendiente`;
   * - deja el plan en `activo`;
   * - agrega una notificacion por cada responsable distinto, con su id.
   *
   * @param planId Id del plan.
   * @returns El plan activo, o `null` si no se pudo enviar.
   */
  enviarYNotificar(planId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const plan = this.planes.find((p) => p.id === planId);
      let fechaInicio = '';

      if (plan === undefined || plan.estado !== 'borrador') {
        return throwError(() => new Error('El plan ' + planId + ' no existe o no está en borrador.'));
      }
      if (!plan.documentoFirmado) {
        return throwError(() => new Error('Falta el documento firmado.'));
      }
      if (plan.actividades.length === 0 || !plan.actividades.every((a) => actividadCompleta(a))) {
        return throwError(() => new Error('Hay actividades incompletas.'));
      }

      fechaInicio = formatearFechaIso(this.reloj());
      plan.fechaInicio = fechaInicio;
      plan.estado = 'activo';
      plan.actividades = plan.actividades.map((actividad) => ({
        ...actividad,
        estado: 'pendiente',
        fechaLimite: formatearFechaIso(parsearFecha(
          calcularFechaLimite(fechaInicio, actividad.plazoMeses, actividad.plazoDias)
        ))
      }));

      return this.notificarResponsables(plan).pipe(
        switchMap(() => simularRespuesta(plan))
      );
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.enviarYNotificar', null)
    );
  }

  /**
   * Aprueba la evidencia de una actividad en revision.
   *
   * La actividad pasa a `aprobada` y la evidencia guarda quien la reviso
   * (nombre del usuario actual) y cuando (`RELOJ`). Avisa al responsable
   * («Evidencia aprobada»). Si era la ultima pendiente, el plan se cierra
   * solo: estado `cerrado`, fecha de cierre hoy y aviso a RRHH («Plan de
   * acción cerrado»). El estado del plan siempre sale de
   * `derivarEstadoPlan`.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @returns El plan actualizado, o `null` si no se pudo aprobar.
   */
  aprobarEvidencia(planId: string, actividadId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const { plan, actividad } = this.actividadEnRevision(planId, actividadId);
      const evidencia = actividad.evidencia;

      if (evidencia === undefined) {
        return throwError(() => new Error('La actividad ' + actividadId + ' no tiene evidencia.'));
      }

      actividad.estado = 'aprobada';
      evidencia.estado = 'aprobada';
      evidencia.revisadoPor = this.nombreRevisor();
      evidencia.fechaRevision = this.reloj().toISOString();
      delete evidencia.motivoRechazo;

      const avisos = [this.avisoAlResponsable(plan, actividad, 'Evidencia aprobada',
        'fue aprobada.', 'ok')];
      if (this.recalcularEstado(plan)) {
        avisos.push(this.avisoPlanCerrado(plan));
      }
      return this.notificarYResponder(plan, avisos);
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.aprobarEvidencia', null)
    );
  }

  /**
   * Rechaza la evidencia de una actividad en revision. El motivo es
   * obligatorio (no vacio). La actividad pasa a `rechazada` y la evidencia
   * guarda el motivo, quien la reviso y cuando. Avisa al responsable
   * («Evidencia rechazada», con el motivo) para que la vuelva a subir.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @param motivo Motivo del rechazo.
   * @returns El plan actualizado, o `null` si no se pudo rechazar.
   */
  rechazarEvidencia(planId: string, actividadId: string, motivo: string): Observable<PlanAccion | null> {
    return defer(() => {
      const texto = (motivo ?? '').trim();
      const { plan, actividad } = this.actividadEnRevision(planId, actividadId);
      const evidencia = actividad.evidencia;

      if (texto === '') {
        return throwError(() => new Error('El motivo del rechazo es obligatorio.'));
      }
      if (evidencia === undefined) {
        return throwError(() => new Error('La actividad ' + actividadId + ' no tiene evidencia.'));
      }

      actividad.estado = 'rechazada';
      evidencia.estado = 'rechazada';
      evidencia.motivoRechazo = texto;
      evidencia.revisadoPor = this.nombreRevisor();
      evidencia.fechaRevision = this.reloj().toISOString();
      this.recalcularEstado(plan);

      return this.notificarYResponder(plan, [this.avisoAlResponsable(plan, actividad,
        'Evidencia rechazada', 'fue rechazada: ' + texto + ' Vuelve a subirla.', 'rechazo')]);
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.rechazarEvidencia', null)
    );
  }

  /**
   * Deshace la revision de una actividad aprobada o rechazada: vuelve a
   * `en_revision` y se borran el resultado, el motivo, quien la reviso y
   * cuando. Si el plan se habia cerrado, vuelve a estar activo y se borra
   * su fecha de cierre.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @returns El plan actualizado, o `null` si no se pudo deshacer.
   */
  deshacerRevision(planId: string, actividadId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const plan = this.planes.find((p) => p.id === planId);
      const actividad = plan?.actividades.find((a) => a.id === actividadId);
      const evidencia = actividad?.evidencia;

      if (plan === undefined || actividad === undefined || plan.estado === 'borrador') {
        return throwError(() => new Error('No existe la actividad ' + actividadId + ' en un plan enviado.'));
      }
      if ((actividad.estado !== 'aprobada' && actividad.estado !== 'rechazada') || evidencia === undefined) {
        return throwError(() => new Error('La actividad ' + actividadId + ' no tiene una revisión que deshacer.'));
      }

      actividad.estado = 'en_revision';
      evidencia.estado = 'pendiente';
      delete evidencia.motivoRechazo;
      delete evidencia.revisadoPor;
      delete evidencia.fechaRevision;
      this.recalcularEstado(plan);

      return simularRespuesta(plan);
    }).pipe(
      manejarError<PlanAccion | null>('PlanesMockService.deshacerRevision', null)
    );
  }

  /**
   * @returns Siguiente id libre de plan (`PL-008`, `PL-009`...).
   */
  private siguienteIdPlan(): string {
    return 'PL-' + String(this.mayorNumero(this.planes.map((p) => p.id)) + 1).padStart(3, '0');
  }

  /**
   * @returns Siguiente id libre de actividad (`A-015`...).
   */
  private siguienteIdActividad(): string {
    const ids = this.planes.flatMap((p) => p.actividades.map((a) => a.id));

    this.ultimoIdActividad = Math.max(this.ultimoIdActividad, this.mayorNumero(ids)) + 1;
    return 'A-' + String(this.ultimoIdActividad).padStart(3, '0');
  }

  /**
   * @param ids Ids con un numero al final (`PL-007`, `A-014`).
   * @returns El mayor de esos numeros; 0 si no hay.
   */
  private mayorNumero(ids: readonly string[]): number {
    return ids.reduce((max, id) => {
      const numero = Number(/(\d+)$/.exec(id)?.[1] ?? 0);

      return Number.isFinite(numero) ? Math.max(max, numero) : max;
    }, 0);
  }

  /**
   * Agrega una notificacion por cada responsable distinto del plan.
   *
   * @param plan Plan recien enviado.
   * @returns Observable que completa cuando se agregaron.
   */
  private notificarResponsables(plan: PlanAccion): Observable<void> {
    const numero = String(plan.numero).padStart(2, '0');

    return this.notificaciones.agregarNotificaciones(
      responsablesDelPlan(plan.actividades).map((r) => ({
        titulo: 'Nuevo plan de acción asignado',
        texto: 'Conflicto #' + plan.conflictoId + ' · Plan ' + numero + ' · ' + plan.nombre + '. '
          + (r.actividades === 1 ? '1 actividad a tu cargo.' : r.actividades + ' actividades a tu cargo.'),
        tipo: 'info' as const,
        destinatarioId: r.id
      }))
    ).pipe(map(() => undefined));
  }

  /**
   * Libera la URL local del documento firmado de un plan, si la tiene.
   *
   * @param plan Plan.
   */
  private liberarDocumento(plan: PlanAccion): void {
    const url = plan.documentoFirmado?.url;

    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Busca una actividad en revision de un plan enviado.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @returns El plan y la actividad.
   * @throws Error si no existe o no esta en revision.
   */
  private actividadEnRevision(planId: string, actividadId: string): { plan: PlanAccion; actividad: Actividad } {
    const plan = this.planes.find((p) => p.id === planId);
    const actividad = plan?.actividades.find((a) => a.id === actividadId);

    if (plan === undefined || actividad === undefined) {
      throw new Error('No existe la actividad ' + actividadId + ' en el plan ' + planId + '.');
    }
    if (actividad.estado !== 'en_revision') {
      throw new Error('La actividad ' + actividadId + ' no está en revisión.');
    }

    return { plan, actividad };
  }

  /**
   * Recalcula el estado del plan con `derivarEstadoPlan` y mantiene la
   * fecha de cierre: la pone hoy si se acaba de cerrar y la borra si se
   * reabrio.
   *
   * @param plan Plan modificado.
   * @returns `true` si el plan se acaba de cerrar.
   */
  private recalcularEstado(plan: PlanAccion): boolean {
    const antes = plan.estado;

    plan.estado = derivarEstadoPlan(plan.actividades, plan.fechaInicio);
    if (plan.estado === 'cerrado' && antes !== 'cerrado') {
      plan.fechaCierre = formatearFechaIso(this.reloj());
      return true;
    }
    if (plan.estado !== 'cerrado') {
      delete plan.fechaCierre;
    }

    return false;
  }

  /**
   * @returns Nombre de quien revisa (usuario actual).
   */
  private nombreRevisor(): string {
    return this.injector.get(PerfilUsuarioService).obtenerNombreUsuario();
  }

  /**
   * @param plan Plan.
   * @returns «Conflicto #C-001 · Plan 02».
   */
  private referenciaPlan(plan: PlanAccion): string {
    return 'Conflicto #' + plan.conflictoId + ' · Plan ' + String(plan.numero).padStart(2, '0');
  }

  /**
   * Aviso al responsable de una actividad sobre su evidencia.
   *
   * @param plan Plan.
   * @param actividad Actividad revisada.
   * @param titulo Titulo de la notificacion.
   * @param resultado Final del texto («fue aprobada.»...).
   * @param tipo Tipo visual.
   * @returns La notificacion a crear.
   */
  private avisoAlResponsable(
    plan: PlanAccion,
    actividad: Actividad,
    titulo: string,
    resultado: string,
    tipo: Notificacion['tipo']
  ): Pick<Notificacion, 'titulo' | 'texto' | 'tipo' | 'destinatarioId'> {
    return {
      titulo,
      texto: 'Tu evidencia de «' + actividad.descripcion + '» (' + this.referenciaPlan(plan) + ') ' + resultado,
      tipo,
      destinatarioId: actividad.responsableId
    };
  }

  /**
   * @param plan Plan recien cerrado.
   * @returns Aviso para RRHH (sin destinatario).
   */
  private avisoPlanCerrado(plan: PlanAccion): Pick<Notificacion, 'titulo' | 'texto' | 'tipo' | 'destinatarioId'> {
    return {
      titulo: 'Plan cerrado',
      texto: this.referenciaPlan(plan) + ' · ' + plan.nombre
        + ' se cerró: todas sus actividades están aprobadas.',
      tipo: 'ok'
    };
  }

  /**
   * Agrega los avisos y responde con el plan.
   *
   * @param plan Plan actualizado.
   * @param avisos Notificaciones a crear.
   * @returns El plan, tras agregar los avisos.
   */
  private notificarYResponder(
    plan: PlanAccion,
    avisos: Pick<Notificacion, 'titulo' | 'texto' | 'tipo' | 'destinatarioId'>[]
  ): Observable<PlanAccion> {
    return forkJoin([
      avisos.length > 0 ? this.notificaciones.agregarNotificaciones(avisos) : of([]),
      simularRespuesta(plan)
    ]).pipe(map(([, actualizado]) => actualizado));
  }
}
