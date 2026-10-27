import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import {
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  defer,
  from,
  map,
  of,
  pipe,
  switchMap,
  tap,
  throwError
} from 'rxjs';
import { ActividadSugerida, PlanAccion, PlanDeResponsable } from '../../models';
import {
  ActividadBandejaApi,
  ActividadSugeridaApi,
  ConflictoDetalleApi,
  EvidenciaApi,
  ExpedienteApi,
  MetodoFirmaApi,
  PlanApi,
  RespuestaApi,
  RevisarEvidenciaRequestApi
} from '../../models/api';
import { validarDocumentoFirmado, validarEvidencia } from '../../utils/documento.util';
import { formatearFechaIso } from '../../utils/fechas.util';
import { manejarError } from '../../utils/manejar-error';
import { RELOJ } from '../../utils/reloj';
import { PerfilUsuarioService } from '../perfil-usuario.service';
import {
  ERROR_CIERRE,
  ERROR_MOTIVO_CIERRE,
  PlanesMockService,
  ResultadoCierre,
  ResultadoDocumento,
  ResultadoEvidencia
} from '../planes-mock.service';
import { crearPedidoPlan, mapearActividadSugerida, mapearPlan, mapearPlanesDeResponsable } from './mapeos/plan.mapeo';
import { datosDe, idEnRuta, mensajeDeError, todasLasPaginas, urlApi } from './peticiones';

/** Tamaño máximo de archivo del backend (`ValidadorArchivo.TAMANIO_MAXIMO`): 5 MB. */
export const TAMANO_MAXIMO_BACKEND_BYTES = 5 * 1024 * 1024;

/** Error: el archivo supera el máximo del backend. */
export const ERROR_ARCHIVO_GRANDE = 'El archivo supera el tamaño máximo permitido (5 MB).';

/** Error: el contenido no es PDF, PNG ni JPG (se mira la firma, como el backend). */
export const ERROR_ARCHIVO_TIPO = 'Tipo de archivo no permitido: solo se aceptan PDF, PNG o JPG.';

/** Error: se pide algo de un plan que este servicio aún no cargó. */
export const ERROR_PLAN_DESCONOCIDO = 'No se encontró el plan. Recarga la página e inténtalo de nuevo.';

/**
 * Cómo se registra la firma del plan. El FR.02 se imprime, se firma a mano
 * y se sube escaneado: `FISICA` (el backend acepta `FISICA` o `ELECTRONICA`).
 */
const METODO_FIRMA: MetodoFirmaApi = 'FISICA';

/** Mensaje si una acción falla sin que el backend diga por qué. */
const ERROR_ACCION = 'No se pudo completar la acción. Inténtalo de nuevo.';

/** Mensaje si la subida del documento falla por otra razón. */
const ERROR_SUBIDA = 'No se pudo subir el documento. Inténtalo de nuevo.';

/** Mensaje si la subida de una evidencia falla por otra razón. */
const ERROR_SUBIDA_EVIDENCIA = 'No se pudo subir la evidencia. Inténtalo de nuevo.';

/** Firmas (primeros bytes) que acepta el backend: PDF, PNG y JPEG. */
const FIRMAS_PERMITIDAS: readonly (readonly number[])[] = [
  [0x25, 0x50, 0x44, 0x46],
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  [0xff, 0xd8, 0xff]
];

/** Documento firmado elegido y aún no enviado (se envía al firmar). */
interface DocumentoPendiente {
  archivo: File;
  /** URL local (`blob:`) para verlo antes de enviar. */
  url: string;
  /** ISO 8601. */
  fechaSubida: string;
}

/**
 * Planes de acción contra el backend. Mismos métodos públicos que
 * `PlanesMockService` (TypeScript lo comprueba con el `implements`); se
 * registra en su lugar en `app.config.ts`.
 *
 * - Guarda en memoria los planes tal como llegan (`PlanApi`) para resolver
 *   lo que el modelo no tiene: el id de la evidencia pendiente, los
 *   involucrados y la fecha de reunión que `PUT /planes/{id}` reemplaza.
 * - El backend firma en un solo paso (`POST /planes/{id}/firmar`, con el
 *   archivo): `subirDocumentoFirmado` solo guarda el archivo aquí y
 *   `enviarYNotificar` lo envía.
 * - Tras revisar una evidencia vuelve a pedir el conflicto: el backend
 *   puede haber cerrado el plan y finalizado el conflicto.
 * - Las acciones que devuelven `null` al fallar dejan el `mensaje` del
 *   backend en `ultimoError`.
 *
 * @author Sebas Constante
 */
@Injectable({
  providedIn: 'root'
})
export class PlanesHttpService implements Pick<PlanesMockService, keyof PlanesMockService> {
  /**
   * Motivo del último fallo de una acción que devuelve `null` (el
   * `mensaje` del backend en 400/403/404/409). `null` si la última salió
   * bien.
   */
  ultimoError: string | null = null;

  private readonly http = inject(HttpClient);
  private readonly reloj = inject(RELOJ);

  /** Para leer el empleado actual solo al subir evidencia (como el mock). */
  private readonly injector = inject(Injector);

  /** Últimos planes recibidos del backend, por id. */
  private readonly planesApi = new Map<string, PlanApi>();

  /** Documentos firmados elegidos y aún no enviados, por id de plan. */
  private readonly documentos = new Map<string, DocumentoPendiente>();

  /**
   * Todos los planes (revisión de evidencias, informes):
   * `GET /conflictos/expedientes`, todas las páginas. Cada actividad trae
   * solo su última evidencia.
   *
   * @returns Lista de planes; vacía si la consulta falla.
   */
  obtenerPlanes(): Observable<PlanAccion[]> {
    return this.expedientes().pipe(
      map((planes) => this.recordar(planes)),
      manejarError<PlanAccion[]>('PlanesHttpService.obtenerPlanes', [])
    );
  }

  /**
   * Un plan por id. Ninguna pantalla lo usa hoy; si no está en memoria se
   * buscan todos los expedientes.
   *
   * @param id Id del plan.
   * @returns El plan, o `undefined` si no existe o la consulta falla.
   */
  obtenerPlanPorId(id: string): Observable<PlanAccion | undefined> {
    const conocido = this.planesApi.get(id);
    const fuente = conocido
      ? of(this.aModelo(conocido))
      : this.expedientes().pipe(map((planes) => this.recordar(planes).find((p) => p.id === id)));

    return fuente.pipe(
      manejarError<PlanAccion | undefined>('PlanesHttpService.obtenerPlanPorId', undefined)
    );
  }

  /**
   * Planes de un conflicto, por número: `PLANES` de `GET /conflictos/{id}`
   * (con todas las evidencias).
   *
   * @param conflictoId Id del conflicto.
   * @returns Planes del conflicto; vacía si no tiene o la consulta falla.
   */
  obtenerPlanesDeConflicto(conflictoId: string): Observable<PlanAccion[]> {
    return this.detalle(conflictoId).pipe(
      map((detalle) => this.recordar(planesDelDetalle(detalle)).sort((a, b) => a.numero - b.numero)),
      manejarError<PlanAccion[]>('PlanesHttpService.obtenerPlanesDeConflicto', [])
    );
  }

  /**
   * Actividades sugeridas para el plan: `GET /conflictos/{id}/plan/sugerencia`
   * (catálogo del backend según el riesgo y si es proveedor; no se guarda).
   *
   * @param conflictoId Id del conflicto.
   * @returns Las sugeridas; `null` si falla (el motivo queda en
   * `ultimoError`).
   * @author Elvis Flores
   */
  obtenerActividadesSugeridas(conflictoId: string): Observable<ActividadSugerida[] | null> {
    return this.http
      .get<RespuestaApi<ActividadSugeridaApi[]>>(urlApi('/conflictos/' + idEnRuta(conflictoId) + '/plan/sugerencia'))
      .pipe(
        datosDe<ActividadSugeridaApi[]>(),
        map((lista): ActividadSugerida[] | null => [...(lista ?? [])]
          .sort((a, b) => a.ORDEN - b.ORDEN)
          .map(mapearActividadSugerida)),
        this.fallar<ActividadSugerida[] | null>('PlanesHttpService.obtenerActividadesSugeridas', null)
      );
  }

  /**
   * Planes del responsable (bandeja): `GET /actividades/mias` con los
   * cerrados, agrupado por plan. Cada plan trae solo sus actividades.
   *
   * @param empleadoId Id del empleado. El backend lo ignora (toma el
   * responsable del token); aquí solo se usa como `responsableId` de sus
   * actividades.
   * @returns Sus planes, por conflicto y número; vacía si falla.
   */
  obtenerPlanesDeResponsable(empleadoId: string): Observable<PlanDeResponsable[]> {
    return this.bandeja().pipe(
      map((filas) => mapearPlanesDeResponsable(filas, empleadoId)),
      manejarError<PlanDeResponsable[]>('PlanesHttpService.obtenerPlanesDeResponsable', [])
    );
  }

  /**
   * Un plan visto por su responsable (de la misma bandeja).
   *
   * @param planId Id del plan.
   * @param empleadoId Id del empleado (el backend usa el token; ver
   * `obtenerPlanesDeResponsable`).
   * @returns El plan, o `null` si no tiene actividades suyas o falla.
   */
  obtenerPlanDeResponsable(planId: string, empleadoId: string): Observable<PlanDeResponsable | null> {
    return this.bandeja().pipe(
      map((filas) => mapearPlanesDeResponsable(filas, empleadoId).find((v) => v.plan.id === planId) ?? null),
      manejarError<PlanDeResponsable | null>('PlanesHttpService.obtenerPlanDeResponsable', null)
    );
  }

  /**
   * Guarda un borrador. Plan nuevo (`id` vacío, como en el mock):
   * `POST /conflictos/{conflictoId}/plan`; existente: `PUT /planes/{id}`,
   * que reemplaza actividades e involucrados (estos se reenvían tal como
   * llegaron). El backend exige en cada actividad descripción, responsable
   * y un plazo de al menos un día.
   *
   * @param plan Plan a guardar.
   * @returns El plan guardado, o `null` si no se pudo (motivo en
   * `ultimoError`).
   */
  guardarBorrador(plan: PlanAccion): Observable<PlanAccion | null> {
    const cuerpo = crearPedidoPlan(plan, this.planesApi.get(plan.id));
    const peticion = plan.id === ''
      ? this.http.post<RespuestaApi<PlanApi>>(urlApi('/conflictos/' + idEnRuta(plan.conflictoId) + '/plan'), cuerpo)
      : this.http.put<RespuestaApi<PlanApi>>(urlApi('/planes/' + idEnRuta(plan.id)), cuerpo);

    return peticion.pipe(
      datosDe<PlanApi>(),
      map((guardado) => this.recordar([guardado])[0]),
      this.fallar<PlanAccion | null>('PlanesHttpService.guardarBorrador', null)
    );
  }

  /**
   * Elige el documento firmado de un borrador. No llama al backend: lo
   * valida (5 MB y PDF/PNG/JPG por contenido, como el backend, y PDF como
   * pide la pantalla) y lo guarda en memoria hasta `enviarYNotificar`.
   *
   * @param planId Id del plan.
   * @param archivo Plan firmado escaneado.
   * @returns El plan con el documento local, o el motivo por el que no se
   * aceptó.
   */
  subirDocumentoFirmado(planId: string, archivo: File): Observable<ResultadoDocumento> {
    return this.validarArchivo(archivo, validarDocumentoFirmado).pipe(
      map((error): ResultadoDocumento => {
        const plan = this.planesApi.get(planId);

        if (error !== null) {
          return { plan: null, error };
        }
        if (plan === undefined) {
          return { plan: null, error: ERROR_PLAN_DESCONOCIDO };
        }
        if (plan.ESTADO_PLAN !== 'BORRADOR') {
          return { plan: null, error: 'Solo se puede subir el documento a un plan en borrador.' };
        }

        this.liberarDocumento(planId);
        this.documentos.set(planId, {
          archivo,
          url: URL.createObjectURL(archivo),
          fechaSubida: this.reloj().toISOString()
        });
        return { plan: this.aModelo(plan), error: null };
      }),
      manejarError<ResultadoDocumento>('PlanesHttpService.subirDocumentoFirmado', {
        plan: null,
        error: ERROR_SUBIDA
      })
    );
  }

  /**
   * Quita el documento elegido (solo existe en memoria hasta enviar).
   *
   * @param planId Id del plan.
   * @returns El plan sin documento, o `null` si no se conoce o no está en
   * borrador.
   */
  quitarDocumentoFirmado(planId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const plan = this.planesApi.get(planId);

      if (plan === undefined || plan.ESTADO_PLAN !== 'BORRADOR') {
        return throwError(() => new Error('El plan no existe o no está en borrador.'));
      }

      this.liberarDocumento(planId);
      return of(this.aModelo(plan));
    }).pipe(
      this.fallar<PlanAccion | null>('PlanesHttpService.quitarDocumentoFirmado', null)
    );
  }

  /**
   * «Enviar y notificar» = firmar: `POST /planes/{id}/firmar` (multipart)
   * con el documento elegido, método `FISICA` y fecha de firma de hoy. El
   * backend fija las fechas límite, pone el conflicto `EN_EJECUCION` y
   * avisa a los responsables.
   *
   * @param planId Id del plan.
   * @returns El plan firmado, o `null` si no se pudo (motivo en
   * `ultimoError`).
   */
  enviarYNotificar(planId: string): Observable<PlanAccion | null> {
    return defer(() => {
      const documento = this.documentos.get(planId);
      const formulario = new FormData();

      if (documento === undefined) {
        return throwError(() => new Error('Falta el documento firmado.'));
      }

      formulario.append('archivo', documento.archivo, documento.archivo.name);
      formulario.append('metodoFirma', METODO_FIRMA);
      formulario.append('fechaFirma', formatearFechaIso(this.reloj()));
      return this.http.post<RespuestaApi<PlanApi>>(urlApi('/planes/' + idEnRuta(planId) + '/firmar'), formulario);
    }).pipe(
      datosDe<PlanApi>(),
      map((firmado) => {
        this.liberarDocumento(planId);
        return this.recordar([firmado])[0];
      }),
      this.fallar<PlanAccion | null>('PlanesHttpService.enviarYNotificar', null)
    );
  }

  /**
   * Aprueba la evidencia pendiente de una actividad
   * (`PUT /evidencias/{id}/revisar`). Si era la última, el backend cierra
   * el plan y finaliza el conflicto.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @returns El plan actualizado, o `null` si no se pudo.
   */
  aprobarEvidencia(planId: string, actividadId: string): Observable<PlanAccion | null> {
    return this.revisar(planId, actividadId, { aprobada: true, motivo: null }).pipe(
      this.fallar<PlanAccion | null>('PlanesHttpService.aprobarEvidencia', null)
    );
  }

  /**
   * Rechaza la evidencia pendiente de una actividad, con motivo
   * obligatorio.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @param motivo Motivo del rechazo.
   * @returns El plan actualizado, o `null` si no se pudo.
   */
  rechazarEvidencia(planId: string, actividadId: string, motivo: string): Observable<PlanAccion | null> {
    const texto = (motivo ?? '').trim();
    const accion = texto === ''
      ? throwError(() => new Error('El motivo del rechazo es obligatorio.'))
      : this.revisar(planId, actividadId, { aprobada: false, motivo: texto });

    return accion.pipe(
      this.fallar<PlanAccion | null>('PlanesHttpService.rechazarEvidencia', null)
    );
  }

  /**
   * El responsable sube la evidencia de una actividad:
   * `POST /actividades/{id}/evidencias` (multipart: archivo y observación
   * vacía). Antes valida el archivo como el backend. Después vuelve a pedir
   * la bandeja para devolver el plan actualizado.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @param archivo Archivo elegido.
   * @returns El plan (vista del responsable) o el motivo por el que no se
   * subió (el `mensaje` del backend si lo rechazó).
   */
  subirEvidencia(planId: string, actividadId: string, archivo: File): Observable<ResultadoEvidencia> {
    return this.validarArchivo(archivo, validarEvidencia).pipe(
      switchMap((error) => {
        const formulario = new FormData();

        if (error !== null) {
          return of<ResultadoEvidencia>({ plan: null, error });
        }

        formulario.append('archivo', archivo, archivo.name);
        formulario.append('observacion', '');
        return this.http.post<RespuestaApi<EvidenciaApi>>(
          urlApi('/actividades/' + idEnRuta(actividadId) + '/evidencias'), formulario
        ).pipe(
          catchError((err: unknown) => {
            const mensaje = mensajeDeError(err, ERROR_SUBIDA_EVIDENCIA);

            console.error('[PlanesHttpService.subirEvidencia]', mensaje, err);
            return throwError(() => new Error(mensaje));
          }),
          switchMap(() => this.planDeResponsableActual(planId))
        );
      }),
      catchError((err: unknown) => of<ResultadoEvidencia>({
        plan: null,
        error: mensajeDeError(err, ERROR_SUBIDA_EVIDENCIA)
      }))
    );
  }

  /**
   * Cierre anticipado: `POST /planes/{id}/cerrar` con el motivo. El
   * backend exige plan `FIRMADO`, al menos una actividad vencida y ninguna
   * evidencia por revisar (409 si no); deja las no aceptadas `NO_CUMPLIDA`
   * y el conflicto de vuelta en `EN_PLANIFICACION`.
   *
   * @param planId Id del plan.
   * @param motivo Motivo del cierre (obligatorio).
   * @returns El plan cerrado, o el motivo por el que no se cerró.
   * @author Sebas Constante
   */
  cerrarPlan(planId: string, motivo: string): Observable<ResultadoCierre> {
    const texto = (motivo ?? '').trim();

    if (texto === '') {
      return of({ plan: null, error: ERROR_MOTIVO_CIERRE });
    }

    return this.http.post<RespuestaApi<PlanApi>>(urlApi('/planes/' + idEnRuta(planId) + '/cerrar'), { motivo: texto })
      .pipe(
        datosDe<PlanApi>(),
        map((cerrado): ResultadoCierre => ({ plan: this.recordar([cerrado])[0], error: null })),
        catchError((err: unknown) => {
          const error = mensajeDeError(err, ERROR_CIERRE);

          console.error('[PlanesHttpService.cerrarPlan]', error, err);
          return of<ResultadoCierre>({ plan: null, error });
        })
      );
  }

  /**
   * Descarga el documento firmado: `GET /planes/{id}/documento`.
   *
   * Solo para RRHH (A y R; confirmado por Sebas el 27/10/2026): la
   * pantalla del Responsable no ofrece el botón a quien es solo `P`.
   *
   * @param planId Id del plan.
   * @returns El archivo, o `null` si no tiene o falla (el motivo queda en
   * `ultimoError`).
   * @author Sebas Constante
   * @author Elvis Flores
   */
  obtenerDocumentoPlan(planId: string): Observable<Blob | null> {
    return this.http.get(urlApi('/planes/' + idEnRuta(planId) + '/documento'), { responseType: 'blob' }).pipe(
      this.fallar<Blob | null>('PlanesHttpService.obtenerDocumentoPlan', null)
    );
  }

  /**
   * Descarga el archivo de una evidencia: `GET /evidencias/{id}/archivo`.
   *
   * @param evidenciaId Id de la evidencia (`Evidencia.id`).
   * @returns El archivo, o `null` si no existe, no es suya o falla (el
   * motivo queda en `ultimoError`).
   * @author Sebas Constante
   * @author Elvis Flores
   */
  obtenerArchivoEvidencia(evidenciaId: string): Observable<Blob | null> {
    return this.http.get(urlApi('/evidencias/' + idEnRuta(evidenciaId) + '/archivo'), { responseType: 'blob' }).pipe(
      this.fallar<Blob | null>('PlanesHttpService.obtenerArchivoEvidencia', null)
    );
  }

  // ---------------------------------------------------------------------

  /** @returns Los planes de todos los expedientes (todas las páginas). */
  private expedientes(): Observable<PlanApi[]> {
    return todasLasPaginas<ExpedienteApi>(this.http, '/conflictos/expedientes').pipe(
      map((expedientes) => expedientes.flatMap((e) => e.PLANES ?? []))
    );
  }

  /**
   * @param conflictoId Id del conflicto.
   * @returns Su detalle (`GET /conflictos/{id}`).
   */
  private detalle(conflictoId: string): Observable<ConflictoDetalleApi> {
    return this.http.get<RespuestaApi<ConflictoDetalleApi>>(urlApi('/conflictos/' + idEnRuta(conflictoId)))
      .pipe(datosDe<ConflictoDetalleApi>());
  }

  /** @returns La bandeja del usuario del token, con los planes cerrados. */
  private bandeja(): Observable<ActividadBandejaApi[]> {
    return this.http.get<RespuestaApi<ActividadBandejaApi[]>>(urlApi('/actividades/mias'), {
      params: { incluirCerrados: true }
    }).pipe(
      datosDe<ActividadBandejaApi[]>(),
      map((filas) => filas ?? [])
    );
  }

  /**
   * Revisa la evidencia pendiente de una actividad y devuelve el plan tal
   * como quedó (vuelve a pedir el conflicto).
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @param cuerpo `{ aprobada, motivo }`.
   * @returns El plan actualizado.
   */
  private revisar(planId: string, actividadId: string, cuerpo: RevisarEvidenciaRequestApi): Observable<PlanAccion> {
    return this.evidenciaPendiente(planId, actividadId).pipe(
      switchMap(({ conflictoId, evidenciaId }) => this.http
        .put<RespuestaApi<unknown>>(urlApi('/evidencias/' + idEnRuta(evidenciaId) + '/revisar'), cuerpo)
        .pipe(switchMap(() => this.detalle(conflictoId)))),
      map((detalle) => {
        const plan = this.recordar(planesDelDetalle(detalle)).find((p) => p.id === planId);

        if (plan === undefined) {
          throw new Error(ERROR_PLAN_DESCONOCIDO);
        }
        return plan;
      })
    );
  }

  /**
   * Busca la evidencia `PENDIENTE` de una actividad en el plan conocido; si
   * no está (o no se conoce el plan), vuelve a pedir el conflicto (o todos
   * los expedientes) y busca otra vez.
   *
   * @param planId Id del plan.
   * @param actividadId Id de la actividad.
   * @returns Conflicto del plan e id de la evidencia.
   */
  private evidenciaPendiente(
    planId: string,
    actividadId: string
  ): Observable<{ conflictoId: string; evidenciaId: string }> {
    const buscar = (): { conflictoId: string; evidenciaId: string } | null => {
      const plan = this.planesApi.get(planId);
      const actividad = plan?.ACTIVIDADES?.find((a) => String(a.CODIGO) === actividadId);
      const evidencia = [...(actividad?.EVIDENCIAS ?? [])].reverse()
        .find((e) => e.ESTADO_REVISION === 'PENDIENTE' && e.CODIGO !== null);

      return plan && evidencia
        ? { conflictoId: String(plan.CONFLICTO_ID), evidenciaId: String(evidencia.CODIGO) }
        : null;
    };
    const encontrada = buscar();
    const conocido = this.planesApi.get(planId);

    if (encontrada !== null) {
      return of(encontrada);
    }

    const recarga = conocido
      ? this.detalle(String(conocido.CONFLICTO_ID)).pipe(map(planesDelDetalle))
      : this.expedientes();

    return recarga.pipe(map((planes) => {
      this.recordar(planes);
      const otraVez = buscar();

      if (otraVez === null) {
        throw new Error('La actividad no tiene una evidencia pendiente de revisión.');
      }
      return otraVez;
    }));
  }

  /**
   * Tras subir una evidencia: la vista del responsable de ese plan.
   *
   * @param planId Id del plan.
   * @returns El resultado para la pantalla.
   */
  private planDeResponsableActual(planId: string): Observable<ResultadoEvidencia> {
    const empleadoId = this.injector.get(PerfilUsuarioService).obtenerEmpleadoActualId() ?? '';

    return this.bandeja().pipe(
      map((filas): ResultadoEvidencia => {
        const vista = mapearPlanesDeResponsable(filas, empleadoId).find((v) => v.plan.id === planId) ?? null;

        return vista
          ? { plan: vista, error: null }
          : { plan: null, error: 'La evidencia se envió, pero no se pudo recargar el plan. Actualiza la página.' };
      }),
      catchError((err: unknown) => {
        console.error('[PlanesHttpService.subirEvidencia] No se pudo recargar la bandeja.', err);
        return of<ResultadoEvidencia>({
          plan: null,
          error: 'La evidencia se envió, pero no se pudo recargar el plan. Actualiza la página.'
        });
      })
    );
  }

  /**
   * Guarda los planes recibidos y los convierte al modelo.
   *
   * @param planes Planes del backend.
   * @returns Los planes del modelo (con el documento local si lo hay).
   */
  private recordar(planes: readonly PlanApi[]): PlanAccion[] {
    for (const plan of planes) {
      if (plan.CODIGO !== null) {
        this.planesApi.set(String(plan.CODIGO), plan);
      }
    }

    return planes.map((plan) => this.aModelo(plan));
  }

  /**
   * @param plan Plan del backend.
   * @returns El plan del modelo; un borrador con documento elegido (aún no
   * enviado) lo lleva en `documentoFirmado`.
   */
  private aModelo(plan: PlanApi): PlanAccion {
    const modelo = mapearPlan(plan);
    const documento = this.documentos.get(modelo.id);

    if (documento !== undefined && modelo.estado === 'BORRADOR') {
      modelo.documentoFirmado = {
        nombre: documento.archivo.name,
        url: documento.url,
        tipo: 'pdf',
        fechaSubida: documento.fechaSubida
      };
    }

    return modelo;
  }

  /**
   * Olvida el documento elegido de un plan y libera su URL local.
   *
   * @param planId Id del plan.
   */
  private liberarDocumento(planId: string): void {
    const documento = this.documentos.get(planId);

    if (documento !== undefined) {
      URL.revokeObjectURL(documento.url);
      this.documentos.delete(planId);
    }
  }

  /**
   * Valida un archivo con las reglas del backend (`ValidadorArchivo`):
   * máximo 5 MB y PDF, PNG o JPEG por sus primeros bytes. Antes aplica la
   * regla de la pantalla (`validarDocumentoFirmado` o `validarEvidencia`).
   *
   * @param archivo Archivo elegido.
   * @param reglaPantalla Validación del front.
   * @returns El mensaje de error, o `null` si es válido.
   */
  private validarArchivo(archivo: File, reglaPantalla: (archivo: File) => string | null): Observable<string | null> {
    if (archivo.size > TAMANO_MAXIMO_BACKEND_BYTES) {
      return of(ERROR_ARCHIVO_GRANDE);
    }

    const error = reglaPantalla(archivo);

    if (error !== null) {
      return of(error);
    }

    return from(archivo.slice(0, 8).arrayBuffer()).pipe(
      map((inicio) => {
        const bytes = new Uint8Array(inicio);
        const permitido = FIRMAS_PERMITIDAS.some((firma) => firma.every((b, i) => bytes[i] === b));

        return permitido ? null : ERROR_ARCHIVO_TIPO;
      })
    );
  }

  /**
   * Manejo de error de las acciones que devuelven `null` al fallar: deja
   * el `mensaje` del backend en `ultimoError` (o lo limpia si salió bien),
   * lo registra y emite `valor`.
   *
   * @param origen `Clase.metodo`, para el log.
   * @param valor Valor que se emite si falla.
   * @returns Operador.
   */
  private fallar<T>(origen: string, valor: T): MonoTypeOperatorFunction<T> {
    return pipe(
      tap(() => this.ultimoError = null),
      catchError((err: unknown) => {
        this.ultimoError = mensajeDeError(err, ERROR_ACCION);
        console.error('[' + origen + ']', this.ultimoError, err);
        return of(valor);
      })
    );
  }
}

/**
 * @param detalle Detalle del conflicto.
 * @returns Todos sus planes (`PLANES`; si no viene, `PLAN`).
 */
function planesDelDetalle(detalle: ConflictoDetalleApi | undefined): PlanApi[] {
  return detalle?.PLANES ?? (detalle?.PLAN ? [detalle.PLAN] : []);
}
