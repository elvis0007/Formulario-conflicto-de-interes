import { Injectable, Injector, inject } from '@angular/core';
import {
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  defer,
  forkJoin,
  from,
  map,
  of,
  pipe,
  switchMap,
  tap,
  throwError
} from 'rxjs';
import {
  Actividad,
  ActividadSugerida,
  Archivo,
  EstadoActividad,
  Notificacion,
  PlanAccion,
  PlanDeResponsable
} from '../models';
import { textoParentesco } from '../utils/analisis.util';
import { tipoDeEvidencia, validarDocumentoFirmado, validarEvidencia } from '../utils/documento.util';
import { calcularFechaLimite, formatearFechaIso, parsearFecha } from '../utils/fechas.util';
import { manejarError } from '../utils/manejar-error';
import {
  actividadCompleta,
  derivarEstadoPlan,
  estaVencida,
  hayPlanActivo,
  responsablesDelPlan
} from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { esPlanActivo } from '../utils/revision.util';
import { sugerirActividades } from '../utils/sugerencia-plan.util';
import { CONFLICTOS } from './mock-data/conflictos.data';
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

/** Resultado de subir una evidencia. */
export interface ResultadoEvidencia {
  /** Plan actualizado (vista del responsable), o `null` si no se subio. */
  plan: PlanDeResponsable | null;
  /** Motivo por el que no se subio, o `null` si se subio. */
  error: string | null;
}

/** Estados de actividad que admiten subir (o volver a subir) evidencia. */
export const ESTADOS_CON_SUBIDA: readonly EstadoActividad[] = ['PENDIENTE', 'RECHAZADA'];

/** Error: la actividad no es del usuario actual (o no existe). */
export const ERROR_ACTIVIDAD_AJENA = 'Solo puedes subir evidencias de tus actividades.';

/** Error: el plan no esta activo. */
export const ERROR_PLAN_NO_ACTIVO = 'El plan no está activo: no admite evidencias.';

/** Error: la actividad ya esta en revision o aprobada. */
export const ERROR_ACTIVIDAD_SIN_SUBIDA =
  'Esta actividad ya tiene una evidencia en revisión o aprobada.';

/** Mensaje si la subida de una evidencia falla por otra razon. */
const ERROR_SUBIDA_EVIDENCIA = 'No se pudo subir la evidencia. Inténtalo de nuevo.';

/** Resultado del cierre anticipado de un plan (`cerrarPlan`). */
export interface ResultadoCierre {
  /** Plan cerrado, o `null` si no se cerro. */
  plan: PlanAccion | null;
  /** Motivo por el que no se cerro, o `null` si se cerro. */
  error: string | null;
}

/** Error: cierre anticipado sin motivo. */
export const ERROR_MOTIVO_CIERRE = 'El motivo del cierre es obligatorio.';

/** Error: solo se cierra anticipadamente un plan firmado. */
export const ERROR_CIERRE_NO_FIRMADO = 'Solo se cierra anticipadamente un plan firmado (en ejecución).';

/** Error: el plan tiene una evidencia esperando revision. */
export const ERROR_CIERRE_EN_REVISION =
  'Hay una evidencia por revisar: apruébala o recházala antes de cerrar el plan.';

/** Error: ninguna actividad esta vencida. */
export const ERROR_CIERRE_SIN_VENCIDAS =
  'El plan solo se cierra anticipadamente cuando al menos una actividad tiene el plazo vencido.';

/** Mensaje si el cierre falla por otra razon. */
export const ERROR_CIERRE = 'No se pudo cerrar el plan. Inténtalo de nuevo.';

/** Mensaje si no se pudieron traer las actividades sugeridas. */
export const ERROR_SUGERENCIA = 'No se pudieron cargar las actividades sugeridas. Inténtalo de nuevo.';

/** Mensaje generico de una accion que fallo sin motivo conocido. */
const ERROR_ACCION = 'No se pudo completar la acción. Inténtalo de nuevo.';

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
  /**
   * Motivo del ultimo fallo de una accion que devuelve `null`
   * (`guardarBorrador`, `enviarYNotificar`, `aprobarEvidencia`...), para que
   * la pantalla pueda mostrar por que no se pudo. Vuelve a `null` cuando una
   * de esas acciones sale bien.
   *
   * @author Sebas Constante
   */
  ultimoError: string | null = null;

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
   * Actividades que el sistema sugiere para el plan de un conflicto, segun
   * su riesgo (`sugerirActividades`, mismas reglas que el backend).
   *
   * Con el backend: `GET /conflictos/{id}/plan/sugerencia`.
   *
   * @param conflictoId Id del conflicto.
   * @returns Las sugeridas; `null` si el conflicto no existe (el motivo
   * queda en `ultimoError`).
   * @author Elvis Flores
   */
  obtenerActividadesSugeridas(conflictoId: string): Observable<ActividadSugerida[] | null> {
    const conflicto = CONFLICTOS.find((c) => c.id === conflictoId);

    this.ultimoError = conflicto ? null : ERROR_SUGERENCIA;
    return simularRespuesta(conflicto ? sugerirActividades(conflicto) : null);
  }

  /**
   * Planes de un responsable (Bandeja de Tareas): los que tienen al menos
   * una actividad suya y no estan en borrador (un borrador aun no se le
   * notifico). Cada plan trae SOLO sus actividades.
   *
   * Con el backend, `GET /responsable/planes` lo filtrara segun la sesion.
   *
   * @param empleadoId Id del empleado (`Actividad.responsableId`).
   * @returns Sus planes, por conflicto y numero; vacia si no tiene o si
   * falla.
   * @author Elvis Flores
   */
  obtenerPlanesDeResponsable(empleadoId: string): Observable<PlanDeResponsable[]> {
    const planes = this.planes
      .filter((plan) => this.esVisibleParaResponsable(plan, empleadoId))
      .sort((a, b) => a.conflictoId.localeCompare(b.conflictoId) || a.numero - b.numero)
      .map((plan) => this.vistaDeResponsable(plan, empleadoId));

    return simularRespuesta(planes).pipe(
      manejarError<PlanDeResponsable[]>('PlanesMockService.obtenerPlanesDeResponsable', [])
    );
  }

  /**
   * Un plan visto por uno de sus responsables, con solo sus actividades.
   *
   * @param planId Id del plan.
   * @param empleadoId Id del empleado.
   * @returns El plan, o `null` si no existe, esta en borrador o no tiene
   * actividades de ese empleado (asi no se ven planes ajenos por URL).
   * @author Elvis Flores
   */
  obtenerPlanDeResponsable(planId: string, empleadoId: string): Observable<PlanDeResponsable | null> {
    const plan = this.planes.find((p) => p.id === planId);
    const vista = plan !== undefined && this.esVisibleParaResponsable(plan, empleadoId)
      ? this.vistaDeResponsable(plan, empleadoId)
      : null;

    return simularRespuesta(vista).pipe(
      manejarError<PlanDeResponsable | null>('PlanesMockService.obtenerPlanDeResponsable', null)
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
   * `BORRADOR`.
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

      if (plan.estado !== 'BORRADOR') {
        return throwError(() => new Error('Solo se guardan planes en borrador.'));
      }

      if (guardado.id === '') {
        if (hayPlanActivo(delConflicto)) {
          return throwError(() => new Error('El conflicto ya tiene un plan vigente.'));
        }
        guardado.id = this.siguienteIdPlan();
        guardado.numero = delConflicto.reduce((max, p) => Math.max(max, p.numero), 0) + 1;
        guardado.fechaCreacion = this.reloj().toISOString();
        guardado.creadoPor = this.nombreRevisor();
      } else {
        indice = this.planes.findIndex((p) => p.id === guardado.id);
        if (indice < 0) {
          return throwError(() => new Error('No existe el plan ' + guardado.id + '.'));
        }
        if (this.planes[indice].estado !== 'BORRADOR') {
          return throwError(() => new Error('El plan ' + guardado.id + ' ya no es un borrador.'));
        }
        guardado.numero = this.planes[indice].numero;
        guardado.fechaCreacion = this.planes[indice].fechaCreacion;
        guardado.creadoPor = this.planes[indice].creadoPor;
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
      this.fallar<PlanAccion | null>('PlanesMockService.guardarBorrador', null)
    );
  }

  /**
   * Sube (o reemplaza) el documento firmado de un plan en borrador. Valida
   * que sea PDF y que no supere 5 MB (`validarDocumentoFirmado`).
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
      if (plan.estado !== 'BORRADOR') {
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

      if (plan === undefined || plan.estado !== 'BORRADOR') {
        return throwError(() => new Error('El plan ' + planId + ' no existe o no está en borrador.'));
      }

      this.liberarDocumento(plan);
      delete plan.documentoFirmado;
      return simularRespuesta(plan);
    }).pipe(
      this.fallar<PlanAccion | null>('PlanesMockService.quitarDocumentoFirmado', null)
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
   *   las deja en `PENDIENTE`;
   * - deja el plan en `FIRMADO`;
   * - agrega una notificacion por cada responsable distinto, con su id.
   *
   * @param planId Id del plan.
   * @returns El plan activo, o `null` si no se pudo enviar.
   */
  enviarYNotificar(planId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const plan = this.planes.find((p) => p.id === planId);
      let fechaInicio = '';

      if (plan === undefined || plan.estado !== 'BORRADOR') {
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
      plan.estado = 'FIRMADO';
      plan.actividades = plan.actividades.map((actividad) => ({
        ...actividad,
        estado: 'PENDIENTE',
        fechaLimite: formatearFechaIso(parsearFecha(
          calcularFechaLimite(fechaInicio, actividad.plazoMeses, actividad.plazoDias)
        ))
      }));

      return this.notificarResponsables(plan).pipe(
        switchMap(() => simularRespuesta(plan))
      );
    }).pipe(
      this.fallar<PlanAccion | null>('PlanesMockService.enviarYNotificar', null)
    );
  }

  /**
   * Aprueba la evidencia de una actividad en revision.
   *
   * La actividad pasa a `ACEPTADA` y la evidencia guarda quien la reviso
   * (nombre del usuario actual) y cuando (`RELOJ`). Avisa al responsable
   * («Evidencia aprobada»). Si era la ultima pendiente, el plan se cierra
   * solo: estado `CERRADO`, fecha de cierre hoy y aviso a RRHH («Plan de
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

      actividad.estado = 'ACEPTADA';
      evidencia.estado = 'APROBADA';
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
      this.fallar<PlanAccion | null>('PlanesMockService.aprobarEvidencia', null)
    );
  }

  /**
   * Rechaza la evidencia de una actividad en revision. El motivo es
   * obligatorio (no vacio). La actividad pasa a `RECHAZADA` y la evidencia
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

      actividad.estado = 'RECHAZADA';
      evidencia.estado = 'RECHAZADA';
      evidencia.motivoRechazo = texto;
      evidencia.revisadoPor = this.nombreRevisor();
      evidencia.fechaRevision = this.reloj().toISOString();
      this.recalcularEstado(plan);

      return this.notificarYResponder(plan, [this.avisoAlResponsable(plan, actividad,
        'Evidencia rechazada', 'fue rechazada: ' + texto + ' Vuelve a subirla.', 'rechazo')]);
    }).pipe(
      this.fallar<PlanAccion | null>('PlanesMockService.rechazarEvidencia', null)
    );
  }

  /**
   * El responsable sube la evidencia de una de sus actividades.
   *
   * - Solo el responsable de la actividad (usuario actual), con el plan
   *   activo y la actividad pendiente, rechazada o vencida. En revision o
   *   aprobada no admite otra.
   * - PDF, PNG o JPG de hasta 5 MB (`validarEvidencia`).
   * - Una sola evidencia por actividad: reemplaza la rechazada (y libera
   *   su URL local). La actividad pasa a «en revisión» y el estado del plan
   *   se recalcula (una vencida deja de contar).
   * - Avisa a RRHH: «Nueva evidencia por revisar».
   *
   * Simulado: el archivo vive en una URL local (`blob:`) mientras dure la
   * sesion. Con el backend sera `POST /actividades/:id/evidencia`.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @param archivo Archivo elegido.
   * @returns El plan actualizado (vista del responsable) o el motivo por el
   * que no se subio.
   * @author Elvis Flores
   */
  subirEvidencia(planId: string, actividadId: string, archivo: File): Observable<ResultadoEvidencia> {
    return defer(() => {
      const empleadoId = this.empleadoActualId();
      const plan = this.planes.find((p) => p.id === planId);
      const actividad = plan?.actividades.find((a) => a.id === actividadId);
      const errorArchivo = validarEvidencia(archivo);
      const tipo = tipoDeEvidencia(archivo);

      if (plan === undefined || actividad === undefined || empleadoId === null
        || actividad.responsableId !== empleadoId) {
        return simularRespuesta<ResultadoEvidencia>({ plan: null, error: ERROR_ACTIVIDAD_AJENA });
      }
      if (!esPlanActivo(plan)) {
        return simularRespuesta<ResultadoEvidencia>({ plan: null, error: ERROR_PLAN_NO_ACTIVO });
      }
      if (!ESTADOS_CON_SUBIDA.includes(actividad.estado)) {
        return simularRespuesta<ResultadoEvidencia>({ plan: null, error: ERROR_ACTIVIDAD_SIN_SUBIDA });
      }
      if (errorArchivo !== null || tipo === null) {
        return simularRespuesta<ResultadoEvidencia>({ plan: null, error: errorArchivo });
      }

      const ahora = this.reloj().toISOString();
      const nuevo: Archivo = {
        nombre: archivo.name,
        url: URL.createObjectURL(archivo),
        tipo,
        fechaSubida: ahora
      };

      // La rechazada se guarda para el Historial; la vigente es la nueva.
      if (actividad.evidencia?.estado === 'RECHAZADA') {
        actividad.evidenciasAnteriores = [...(actividad.evidenciasAnteriores ?? []), actividad.evidencia];
      }
      this.liberarUrl(actividad.evidencia?.archivo.url);
      actividad.evidencia = {
        id: this.siguienteIdEvidencia(),
        archivo: nuevo,
        fechaSubida: ahora,
        estado: 'PENDIENTE'
      };
      actividad.estado = 'EN_REVISION';
      this.recalcularEstado(plan);

      return forkJoin([
        this.notificaciones.agregarNotificaciones([this.avisoNuevaEvidencia(plan, actividad)]),
        simularRespuesta(this.vistaDeResponsable(plan, empleadoId))
      ]).pipe(map(([, vista]): ResultadoEvidencia => ({ plan: vista, error: null })));
    }).pipe(
      manejarError<ResultadoEvidencia>('PlanesMockService.subirEvidencia', {
        plan: null,
        error: ERROR_SUBIDA_EVIDENCIA
      })
    );
  }

  /**
   * Cierre anticipado: RRHH da por terminado un plan firmado que no se
   * cumplio. Mismas reglas que el backend (`POST /planes/{id}/cerrar`):
   * motivo obligatorio, plan `FIRMADO`, ninguna actividad `EN_REVISION` y
   * al menos una vencida. Las actividades no aceptadas quedan
   * `NO_CUMPLIDA`; el plan, `CERRADO` (`ANTICIPADO`) con el motivo y la
   * fecha de hoy.
   *
   * El backend devuelve ademas el conflicto a `EN_PLANIFICACION`; este mock
   * no guarda el estado de los conflictos (tampoco lo cambia al enviar ni
   * al aprobar), asi que eso no se simula.
   *
   * @param planId Id del plan.
   * @param motivo Motivo del cierre.
   * @returns El plan cerrado, o el motivo por el que no se cerro.
   * @author Sebas Constante
   */
  cerrarPlan(planId: string, motivo: string): Observable<ResultadoCierre> {
    return defer(() => {
      const texto = (motivo ?? '').trim();
      const plan = this.planes.find((p) => p.id === planId);
      const hoy = this.reloj();
      let error: string | null = null;

      if (plan === undefined) {
        return throwError(() => new Error('No existe el plan ' + planId + '.'));
      }
      if (texto === '') {
        error = ERROR_MOTIVO_CIERRE;
      } else if (plan.estado !== 'FIRMADO') {
        error = ERROR_CIERRE_NO_FIRMADO;
      } else if (plan.actividades.some((a) => a.estado === 'EN_REVISION')) {
        error = ERROR_CIERRE_EN_REVISION;
      } else if (!plan.actividades.some((a) => estaVencida(a, hoy))) {
        error = ERROR_CIERRE_SIN_VENCIDAS;
      }
      if (error !== null) {
        return simularRespuesta<ResultadoCierre>({ plan: null, error });
      }

      plan.actividades = plan.actividades.map((a) => a.estado === 'ACEPTADA' ? a : { ...a, estado: 'NO_CUMPLIDA' });
      plan.estado = 'CERRADO';
      plan.tipoCierre = 'ANTICIPADO';
      plan.motivoCierre = texto;
      plan.fechaCierre = formatearFechaIso(hoy);
      return simularRespuesta<ResultadoCierre>({ plan, error: null });
    }).pipe(
      manejarError<ResultadoCierre>('PlanesMockService.cerrarPlan', { plan: null, error: ERROR_CIERRE })
    );
  }

  /**
   * Contenido del documento firmado de un plan. Si se subio en esta sesion
   * (URL `blob:`) se lee de ahi; los datos de ejemplo no tienen contenido
   * real y devuelven un texto de relleno.
   *
   * @param planId Id del plan.
   * @returns El archivo, o `null` si el plan no tiene documento o falla.
   * @author Sebas Constante
   */
  obtenerDocumentoPlan(planId: string): Observable<Blob | null> {
    const archivo = this.planes.find((p) => p.id === planId)?.documentoFirmado;

    // El visor muestra ultimoError si no llega nada: no debe quedar uno viejo.
    this.ultimoError = null;
    return this.contenidoSimulado(archivo).pipe(
      manejarError<Blob | null>('PlanesMockService.obtenerDocumentoPlan', null)
    );
  }

  /**
   * Contenido del archivo de una evidencia (vigente o anterior). Igual que
   * `obtenerDocumentoPlan`: `blob:` de esta sesion o texto de relleno.
   *
   * @param evidenciaId Id de la evidencia.
   * @returns El archivo, o `null` si no existe o falla.
   * @author Sebas Constante
   */
  obtenerArchivoEvidencia(evidenciaId: string): Observable<Blob | null> {
    const evidencia = this.planes
      .flatMap((p) => p.actividades)
      .flatMap((a) => [...(a.evidenciasAnteriores ?? []), ...(a.evidencia ? [a.evidencia] : [])])
      .find((e) => e.id === evidenciaId);

    this.ultimoError = null;
    return this.contenidoSimulado(evidencia?.archivo).pipe(
      manejarError<Blob | null>('PlanesMockService.obtenerArchivoEvidencia', null)
    );
  }

  /**
   * @param archivo Archivo del modelo.
   * @returns Su contenido (`blob:` local) o un texto de relleno; `null` si
   * no hay archivo.
   */
  private contenidoSimulado(archivo: Archivo | undefined): Observable<Blob | null> {
    if (archivo === undefined) {
      return simularRespuesta<Blob | null>(null);
    }
    if (archivo.url.startsWith('blob:')) {
      return from(fetch(archivo.url).then((r) => r.blob()));
    }

    return simularRespuesta<Blob | null>(new Blob(['Archivo simulado: ' + archivo.nombre], { type: 'text/plain' }));
  }

  /**
   * Manejo de error de las acciones que devuelven `null` al fallar: guarda
   * el motivo en `ultimoError` (o lo limpia si salio bien), lo registra y
   * emite `valor`.
   *
   * @param origen `Clase.metodo`, para el log.
   * @param valor Valor que se emite si falla.
   * @returns Operador.
   */
  private fallar<T>(origen: string, valor: T): MonoTypeOperatorFunction<T> {
    return pipe(
      tap(() => this.ultimoError = null),
      catchError((err: unknown) => {
        this.ultimoError = err instanceof Error && err.message !== '' ? err.message : ERROR_ACCION;
        console.error('[' + origen + ']', this.ultimoError, err);
        return of(valor);
      })
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
   * @returns Siguiente id libre de evidencia (`EV-014`...).
   */
  private siguienteIdEvidencia(): string {
    const ids = this.planes.flatMap((p) => p.actividades.flatMap((a) => [
      ...(a.evidenciasAnteriores ?? []),
      ...(a.evidencia ? [a.evidencia] : [])
    ].map((e) => e.id)));

    return 'EV-' + String(this.mayorNumero(ids) + 1).padStart(3, '0');
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
    if (actividad.estado !== 'EN_REVISION') {
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
    if (plan.estado === 'CERRADO' && antes !== 'CERRADO') {
      plan.fechaCierre = formatearFechaIso(this.reloj());
      plan.tipoCierre = 'CUMPLIDO';
      return true;
    }
    if (plan.estado !== 'CERRADO') {
      delete plan.fechaCierre;
      delete plan.tipoCierre;
    }

    return false;
  }

  /**
   * @returns Nombre de quien revisa (usuario actual).
   */
  /**
   * @param plan Plan.
   * @param empleadoId Id del empleado.
   * @returns `true` si el responsable puede verlo: no es borrador y tiene
   * al menos una actividad suya.
   */
  private esVisibleParaResponsable(plan: PlanAccion, empleadoId: string): boolean {
    return plan.estado !== 'BORRADOR'
      && plan.actividades.some((a) => a.responsableId === empleadoId);
  }

  /**
   * Arma la vista del responsable con los datos del caso que trae la
   * bandeja del backend (`NOMBRE_A`, `NOMBRE_B`, `PARENTESCO`, `RIESGO`);
   * aqui salen de los conflictos de ejemplo, sin pedir `/conflictos` (el
   * rol P no puede).
   *
   * @param plan Plan completo.
   * @param empleadoId Id del empleado.
   * @returns El plan con solo las actividades del empleado, el total y el
   * caso.
   */
  private vistaDeResponsable(plan: PlanAccion, empleadoId: string): PlanDeResponsable {
    const conflicto = CONFLICTOS.find((c) => c.id === plan.conflictoId);

    return {
      plan: { ...plan, actividades: plan.actividades.filter((a) => a.responsableId === empleadoId) },
      totalActividades: plan.actividades.length,
      nombreA: conflicto?.personaA.nombres ?? '',
      nombreB: conflicto?.personaB.nombres ?? '',
      parentesco: conflicto ? textoParentesco(conflicto) : '',
      riesgo: conflicto?.riesgo ?? null
    };
  }

  /** @returns Id del empleado que usa la app (`PerfilUsuarioService`). */
  private empleadoActualId(): string | null {
    return this.injector.get(PerfilUsuarioService).obtenerEmpleadoActualId();
  }

  /**
   * Libera una URL local (`blob:`) que ya no se usa.
   *
   * @param url URL del archivo anterior.
   */
  private liberarUrl(url: string | undefined): void {
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * @param plan Plan.
   * @param actividad Actividad con la evidencia nueva.
   * @returns Aviso para RRHH (sin destinatario).
   */
  private avisoNuevaEvidencia(
    plan: PlanAccion,
    actividad: Actividad
  ): Pick<Notificacion, 'titulo' | 'texto' | 'tipo' | 'destinatarioId'> {
    return {
      titulo: 'Nueva evidencia por revisar',
      texto: this.referenciaPlan(plan) + ' · «' + actividad.descripcion + '» — subida por '
        + actividad.responsableNombre + '.',
      tipo: 'info'
    };
  }

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
