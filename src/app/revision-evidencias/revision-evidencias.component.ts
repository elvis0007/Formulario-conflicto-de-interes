import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { PARAMETRO_CONFLICTO } from '../app.paths';
import { Actividad, Conflicto, PlanAccion } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { DocumentViewerComponent } from '../shared/document-viewer/document-viewer.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { textoRiesgo } from '../utils/analisis.util';
import { calcularDiasRestantes, formatearFecha, parsearFecha } from '../utils/fechas.util';
import { calcularAvance, textoEstadoPlan } from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import {
  GrupoResponsable,
  ResumenRevision,
  agruparPorResponsable,
  contarResumen,
  esPlanActivo,
  textoEstadoActividad
} from '../utils/revision.util';
import {
  Tono,
  mapearEstadoActividadATono,
  mapearEstadoPlanATono,
  mapearRiesgoATono
} from '../utils/tono.util';

/** Mensaje si una accion de revision falla. */
const ERROR_ACCION = 'No se pudo completar la acción. Inténtalo de nuevo.';

/** Aviso del modal cuando el plan se cierra solo. */
export const AVISO_PLAN_CERRADO = 'Plan cerrado: todas las actividades fueron aprobadas';

/** Una tarjeta de la cuadricula: un conflicto con su plan activo. */
export interface TarjetaRevision {
  conflicto: Conflicto;
  plan: PlanAccion;
  /** «Plan 02 · Nombre». */
  tituloPlan: string;
  textoRiesgo: string;
  tonoRiesgo: Tono;
  textoEstado: string;
  tonoEstado: Tono;
  porRevisar: number;
  aprobadas: number;
  total: number;
}

/** Lo que la lista del modal muestra de una actividad. */
export interface VistaActividad {
  actividad: Actividad;
  textoEstado: string;
  tonoEstado: Tono;
  /** «dd/mm/aaaa», o vacio si no tiene. */
  fechaLimite: string;
  /** Vencida: la fecha limite paso sin aprobacion. */
  vencida: boolean;
  /** Se puede aprobar o rechazar. */
  enRevision: boolean;
  /** Ya se aprobo o rechazo: muestra el resultado y «Deshacer». */
  resuelta: boolean;
}

/** Un grupo del modal: un responsable y sus actividades. */
export interface VistaGrupo extends Omit<GrupoResponsable, 'actividades'> {
  actividades: VistaActividad[];
}

/**
 * Revisión de Evidencias (especificacion §6.8).
 *
 * - Resumen: «n por revisar», «n aprobadas hoy», «n rechazadas hoy».
 * - Una tarjeta por conflicto con plan activo, primero las que tienen
 *   evidencias por revisar.
 * - Modal por tarjeta con las actividades agrupadas por responsable:
 *   «Ver documento», «Aprobar», «Rechazar» (motivo obligatorio) y
 *   «Deshacer». Al ver un documento, el modal se ensancha y el visor queda
 *   a la izquierda.
 * - Si al aprobar se cierra el plan, el modal lo avisa y la tarjeta
 *   desaparece al cerrarlo.
 *
 * Las reglas (que se puede aprobar, rechazar o deshacer, el cierre
 * automatico) las aplica `PlanesMockService`.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-revision-evidencias',
  imports: [
    BadgeComponent,
    DocumentViewerComponent,
    EmptyStateComponent,
    FechaLargaPipe,
    IconoComponent,
    ModalComponent
  ],
  templateUrl: './revision-evidencias.component.html',
  styleUrl: './revision-evidencias.component.scss'
})
export class RevisionEvidenciasComponent implements OnInit {
  /** Todavia no llego la primera respuesta. */
  cargando = true;

  /** Resumen de la cabecera. */
  resumen: ResumenRevision = { porRevisar: 0, aprobadasHoy: 0, rechazadasHoy: 0 };

  /** Tarjetas de la cuadricula. */
  tarjetas: TarjetaRevision[] = [];

  /** Tarjeta abierta en el modal; `null` con el modal cerrado. */
  abierta: TarjetaRevision | null = null;

  /** Grupos por responsable del plan abierto. */
  grupos: VistaGrupo[] = [];

  /** Actividad cuyo documento se esta viendo. */
  viendo: Actividad | null = null;

  /** Actividad en la que se escribe el motivo del rechazo. */
  rechazandoId: string | null = null;

  /** Texto del motivo del rechazo. */
  motivo = '';

  /** Se intento confirmar un rechazo sin motivo. */
  motivoFaltante = false;

  /** Actividad con una accion en curso. */
  procesandoId: string | null = null;

  /** Error de la ultima accion. */
  errorAccion: string | null = null;

  readonly avisoPlanCerrado = AVISO_PLAN_CERRADO;

  /** Todos los planes (se actualizan en su lugar tras cada accion). */
  private planes: PlanAccion[] = [];

  /** Conflictos, por id. */
  private conflictos = new Map<string, Conflicto>();

  private readonly planesServicio = inject(PlanesMockService);
  private readonly conflictosServicio = inject(ConflictosMockService);
  private readonly reloj = inject(RELOJ);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns Titulo del modal: «Conflicto #id — Plan 0n · Nombre». */
  get tituloModal(): string {
    const t = this.abierta;

    return t ? 'Conflicto #' + t.conflicto.id + ' — ' + t.tituloPlan : '';
  }

  /** @returns `true` si el plan abierto se cerro. */
  get planCerrado(): boolean {
    return this.abierta?.plan.estado === 'cerrado';
  }

  /**
   * Carga planes y conflictos.
   */
  ngOnInit(): void {
    forkJoin({
      planes: this.planesServicio.obtenerPlanes(),
      conflictos: this.conflictosServicio.obtenerConflictos()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ planes, conflictos }) => {
          this.planes = planes;
          this.conflictos = new Map(conflictos.map((c) => [c.id, c]));
          this.cargando = false;
          this.recalcular();
          this.abrirDesdeUrl();
        },
        error: (err: unknown) => {
          this.cargando = false;
          console.error('[RevisionEvidenciasComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Con `?conflicto=C-001` (p. ej. desde el dashboard), abre su tarjeta si
   * tiene un plan activo.
   */
  private abrirDesdeUrl(): void {
    const id = this.ruta.snapshot.queryParamMap.get(PARAMETRO_CONFLICTO);
    const tarjeta = this.tarjetas.find((t) => t.conflicto.id === id);

    if (tarjeta !== undefined) {
      this.abrir(tarjeta);
    }
  }

  /**
   * Abre el modal de una tarjeta.
   *
   * @param tarjeta Tarjeta elegida.
   */
  abrir(tarjeta: TarjetaRevision): void {
    this.abierta = tarjeta;
    this.viendo = null;
    this.cancelarRechazo();
    this.errorAccion = null;
    this.grupos = this.crearGrupos(tarjeta.plan);
  }

  /**
   * Cierra el modal; si el plan se cerro, su tarjeta desaparece ahora.
   */
  cerrar(): void {
    if (this.procesandoId !== null) {
      return;
    }
    this.abierta = null;
    this.viendo = null;
    this.cancelarRechazo();
    this.recalcular();
  }

  /**
   * Muestra el documento de una actividad en el visor.
   *
   * @param actividad Actividad con evidencia.
   */
  verDocumento(actividad: Actividad): void {
    this.viendo = actividad.evidencia ? actividad : null;
  }

  /**
   * Aprueba la evidencia de una actividad.
   *
   * @param actividad Actividad en revision.
   */
  aprobar(actividad: Actividad): void {
    this.ejecutar(actividad, (planId) => this.planesServicio.aprobarEvidencia(planId, actividad.id));
  }

  /**
   * Abre el campo de motivo para rechazar una actividad.
   *
   * @param actividad Actividad en revision.
   */
  empezarRechazo(actividad: Actividad): void {
    this.rechazandoId = actividad.id;
    this.motivo = '';
    this.motivoFaltante = false;
  }

  /**
   * Cierra el campo de motivo sin rechazar.
   */
  cancelarRechazo(): void {
    this.rechazandoId = null;
    this.motivo = '';
    this.motivoFaltante = false;
  }

  /**
   * Guarda el motivo escrito.
   *
   * @param evento `input` del textarea.
   */
  alEscribirMotivo(evento: Event): void {
    this.motivo = (evento.target as HTMLTextAreaElement).value;
    if (this.motivo.trim() !== '') {
      this.motivoFaltante = false;
    }
  }

  /**
   * «Confirmar rechazo»: exige el motivo.
   *
   * @param actividad Actividad en revision.
   */
  confirmarRechazo(actividad: Actividad): void {
    const motivo = this.motivo.trim();

    if (motivo === '') {
      this.motivoFaltante = true;
      return;
    }
    this.ejecutar(actividad, (planId) => this.planesServicio.rechazarEvidencia(planId, actividad.id, motivo));
  }

  /**
   * Deshace la revision de una actividad aprobada o rechazada.
   *
   * @param actividad Actividad resuelta.
   */
  deshacer(actividad: Actividad): void {
    this.ejecutar(actividad, (planId) => this.planesServicio.deshacerRevision(planId, actividad.id));
  }

  /**
   * @param iso Fecha ISO.
   * @returns «dd/mm/aaaa», o vacio si no es valida.
   */
  fecha(iso: string | undefined): string {
    if (!iso) {
      return '';
    }
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[RevisionEvidenciasComponent.fecha] Fecha inválida:', iso, err);
      return '';
    }
  }

  /**
   * Corre una accion de revision y actualiza el plan, los grupos, las
   * tarjetas y el resumen.
   *
   * @param actividad Actividad afectada.
   * @param accion Llamada al servicio con el id del plan.
   */
  private ejecutar(actividad: Actividad, accion: (planId: string) => Observable<PlanAccion | null>): void {
    const tarjeta = this.abierta;

    if (tarjeta === null || this.procesandoId !== null) {
      return;
    }

    this.procesandoId = actividad.id;
    this.errorAccion = null;
    accion(tarjeta.plan.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plan) => {
          this.procesandoId = null;
          if (plan === null) {
            this.errorAccion = ERROR_ACCION;
            return;
          }
          this.cancelarRechazo();
          this.actualizarPlan(plan);
        },
        error: (err: unknown) => {
          this.procesandoId = null;
          this.errorAccion = ERROR_ACCION;
          console.error('[RevisionEvidenciasComponent.ejecutar]', err);
        }
      });
  }

  /**
   * Reemplaza un plan actualizado y recalcula todo lo que depende de el.
   *
   * @param plan Plan devuelto por el servicio.
   */
  private actualizarPlan(plan: PlanAccion): void {
    this.planes = this.planes.map((p) => p.id === plan.id ? plan : p);
    this.recalcular();
    this.abierta = this.tarjetas.find((t) => t.plan.id === plan.id) ?? null;
    if (this.abierta !== null) {
      this.grupos = this.crearGrupos(plan);
    }
    if (this.viendo !== null) {
      this.viendo = plan.actividades.find((a) => a.id === this.viendo?.id) ?? null;
    }
  }

  /**
   * Recalcula el resumen y las tarjetas. La tarjeta del plan abierto se
   * mantiene aunque se haya cerrado, hasta cerrar el modal.
   */
  private recalcular(): void {
    const abiertoId = this.abierta?.plan.id;

    this.resumen = contarResumen(this.planes, this.reloj());
    this.tarjetas = this.planes
      .filter((p) => esPlanActivo(p) || p.id === abiertoId)
      .map((p) => this.crearTarjeta(p))
      .filter((t): t is TarjetaRevision => t !== null)
      .sort((a, b) => b.porRevisar - a.porRevisar || a.conflicto.id.localeCompare(b.conflicto.id));
  }

  /**
   * @param plan Plan activo.
   * @returns Su tarjeta, o `null` si no se encuentra el conflicto.
   */
  private crearTarjeta(plan: PlanAccion): TarjetaRevision | null {
    const conflicto = this.conflictos.get(plan.conflictoId);
    const avance = calcularAvance(plan.actividades);

    if (conflicto === undefined) {
      return null;
    }

    return {
      conflicto,
      plan,
      tituloPlan: 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre,
      textoRiesgo: textoRiesgo(conflicto.riesgo),
      tonoRiesgo: mapearRiesgoATono(conflicto.riesgo),
      textoEstado: textoEstadoPlan(plan.estado),
      tonoEstado: mapearEstadoPlanATono(plan.estado),
      porRevisar: plan.actividades.filter((a) => a.estado === 'en_revision').length,
      aprobadas: avance.cumplidas,
      total: avance.total
    };
  }

  /**
   * @param plan Plan abierto.
   * @returns Sus actividades agrupadas por responsable, listas para la vista.
   */
  private crearGrupos(plan: PlanAccion): VistaGrupo[] {
    const hoy = this.reloj();

    return agruparPorResponsable(plan.actividades).map((grupo) => ({
      ...grupo,
      actividades: grupo.actividades.map((actividad): VistaActividad => {
        const aprobada = actividad.estado === 'aprobada';
        let vencida = actividad.estado === 'vencida';

        if (!aprobada && !vencida && actividad.fechaLimite) {
          try {
            vencida = calcularDiasRestantes(actividad.fechaLimite, hoy).vencida;
          } catch (err) {
            console.error('[RevisionEvidenciasComponent.crearGrupos]', err);
          }
        }

        return {
          actividad,
          textoEstado: textoEstadoActividad(actividad.estado, false),
          tonoEstado: mapearEstadoActividadATono(actividad.estado, false),
          fechaLimite: this.fecha(actividad.fechaLimite),
          vencida,
          enRevision: actividad.estado === 'en_revision' && actividad.evidencia !== undefined,
          resuelta: (aprobada || actividad.estado === 'rechazada') && actividad.evidencia !== undefined
        };
      })
    }));
  }
}
