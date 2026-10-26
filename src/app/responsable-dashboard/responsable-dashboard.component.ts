import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, map, of } from 'rxjs';
import { PARAMETRO_ESTADO, RUTAS, rutaPlanResponsable } from '../app.paths';
import { Actividad, PlanAccion, PlanDeResponsable } from '../models';
import { EstadoActividadVista, estadoVistaActividad } from '../utils/planes.util';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { PersonasMockService } from '../services/personas-mock.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { BarraAvanceComponent } from '../shared/barra-avance/barra-avance.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ExpandArrowButtonComponent } from '../shared/expand-arrow-button/expand-arrow-button.component';
import { KpiCardComponent } from '../shared/kpi-card/kpi-card.component';
import { DiasRestantes, calcularDiasRestantes } from '../utils/fechas.util';
import { RELOJ } from '../utils/reloj';
import {
  ActividadProxima,
  ConteoEstados,
  FiltroEstado,
  actividadesDe,
  contarEstados,
  proximasAVencer
} from '../utils/responsable.util';
import { textoEstadoActividad } from '../utils/revision.util';
import { Tono, mapearEstadoActividadATono } from '../utils/tono.util';

/** Un indicador del dashboard. */
export interface IndicadorResponsable {
  /** Filtro de la Bandeja al que lleva. */
  filtro: Exclude<FiltroEstado, 'todas'>;
  titulo: string;
  valor: number;
  tono: Tono;
}

/** Una actividad abierta (sin aprobar) con su contexto. */
export interface ActividadAbierta {
  actividad: Actividad;
  plan: PlanAccion;
  /** «Persona A y Persona B» (de la bandeja), o vacio si no vienen. */
  personas: string;
  /** Dias para la fecha limite; no se muestran si esta en revision. */
  dias: DiasRestantes | null;
  /** Texto del boton: «Subir evidencia», «Volver a subir» o «Ver plan». */
  accion: string;
}

/** Un conflicto del acordeon «Avance por conflicto». */
export interface AvanceConflicto {
  conflictoId: string;
  /** «Persona A y Persona B» (de la bandeja), o vacio si no vienen. */
  personas: string;
  /** Sus planes, cada uno con solo las actividades del responsable. */
  planes: PlanAccion[];
  /** Todas sus actividades en ese conflicto (para la barra). */
  actividades: Actividad[];
}

/** Meses abreviados para la cajita de fecha. */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Orden de «Mis actividades abiertas»: lo que hay que corregir primero. */
const ORDEN_ABIERTAS: readonly EstadoActividadVista[] = ['RECHAZADA', 'VENCIDA', 'PENDIENTE', 'EN_REVISION'];

/**
 * Dashboard del Responsable (especificacion §6.11).
 *
 * - Saludo con su nombre (en la sesion simulada, el del empleado elegido
 *   con `SISCI-DEV-EMPLEADO`) y «Ir a mi bandeja».
 * - Alerta si tiene actividades vencidas.
 * - Indicadores (pendientes, en revisión, rechazadas, vencidas,
 *   aprobadas): cada uno abre la Bandeja con ese filtro (`?estado=`).
 * - «Avance general»: barra segmentada de todas sus actividades.
 * - «Mis actividades abiertas»: conflicto, personas, plan, estado, dias y
 *   «Subir evidencia» / «Volver a subir».
 * - «Próximas a vencer» (los «Próximos vencimientos» de la §6.11).
 * - «Avance por conflicto»: acordeon conflicto › plan › actividades.
 *
 * Solo cuenta sus actividades en planes enviados.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-responsable-dashboard',
  imports: [
    BadgeComponent,
    BarraAvanceComponent,
    EmptyStateComponent,
    ExpandArrowButtonComponent,
    KpiCardComponent,
    RouterLink
  ],
  templateUrl: './responsable-dashboard.component.html',
  styleUrl: './responsable-dashboard.component.scss'
})
export class ResponsableDashboardComponent implements OnInit {
  /** Todavia no llego la respuesta. */
  cargando = true;

  /** Nombre para el saludo. */
  nombre = '';

  /** Cuantas actividades tiene en total. */
  totalActividades = 0;

  /** Actividades por estado. */
  conteo: ConteoEstados = {
    PENDIENTE: 0, EN_REVISION: 0, ACEPTADA: 0, RECHAZADA: 0, NO_CUMPLIDA: 0, VENCIDA: 0
  };

  /** Indicadores clicables. */
  indicadores: IndicadorResponsable[] = [];

  /** Todas sus actividades (barra de avance general). */
  actividades: Actividad[] = [];

  /** «Mis actividades abiertas». */
  abiertas: ActividadAbierta[] = [];

  /** «Próximas a vencer». */
  proximas: ActividadProxima[] = [];

  /** «Avance por conflicto». */
  porConflicto: AvanceConflicto[] = [];

  readonly rutaBandeja = RUTAS.responsable.planes;

  /** Conflictos desplegados en el acordeon. */
  private readonly desplegados = new Set<string>();

  private readonly planesServicio = inject(PlanesMockService);
  private readonly personasServicio = inject(PersonasMockService);
  private readonly perfil = inject(PerfilUsuarioService);
  private readonly router = inject(Router);
  private readonly reloj = inject(RELOJ);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Carga sus planes y el nombre del saludo. Los nombres del caso vienen en
   * la bandeja: el rol P no puede pedir `/conflictos` (403).
   */
  ngOnInit(): void {
    const empleadoId = this.perfil.obtenerEmpleadoActualId();

    this.nombre = this.perfil.obtenerNombreUsuario();
    if (empleadoId === null) {
      this.cargando = false;
      return;
    }

    forkJoin({
      planes: this.planesServicio.obtenerPlanesDeResponsable(empleadoId),
      nombre: this.nombreDelSaludo(empleadoId)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ planes, nombre }) => {
          this.cargando = false;
          this.nombre = nombre;
          this.calcular(planes);
        },
        error: (err: unknown) => {
          this.cargando = false;
          console.error('[ResponsableDashboardComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Abre la Bandeja con un filtro.
   *
   * @param filtro Estado a filtrar.
   */
  irABandeja(filtro: FiltroEstado): void {
    this.router.navigate([RUTAS.responsable.planes], { queryParams: { [PARAMETRO_ESTADO]: filtro } })
      .catch((err: unknown) => console.error('[ResponsableDashboardComponent.irABandeja]', err));
  }

  /**
   * @param planId Id del plan.
   * @returns URL de su detalle.
   */
  rutaPlan(planId: string): string {
    return rutaPlanResponsable(planId);
  }

  /** @param conflictoId Conflicto. @returns `true` si esta desplegado. */
  estaDesplegado(conflictoId: string): boolean {
    return this.desplegados.has(conflictoId);
  }

  /** @param conflictoId Conflicto a desplegar o plegar. */
  alternar(conflictoId: string): void {
    if (this.desplegados.has(conflictoId)) {
      this.desplegados.delete(conflictoId);
    } else {
      this.desplegados.add(conflictoId);
    }
  }

  /** @param a Actividad. @returns Texto del estado (vista del Responsable). */
  textoEstadoDe(a: Actividad): string {
    return textoEstadoActividad(a.estado, true);
  }

  /** @param a Actividad. @returns Tono de su estado. */
  tonoEstadoDe(a: Actividad): Tono {
    return mapearEstadoActividadATono(a.estado, true);
  }

  /**
   * @param proxima Actividad.
   * @returns Texto del estado en la vista del Responsable.
   */
  textoEstado(proxima: ActividadProxima): string {
    return textoEstadoActividad(proxima.actividad.estado, true);
  }

  /**
   * @param proxima Actividad.
   * @returns Tono de su estado.
   */
  tonoEstado(proxima: ActividadProxima): Tono {
    return mapearEstadoActividadATono(proxima.actividad.estado, true);
  }

  /**
   * @param proxima Actividad.
   * @returns Dia y mes abreviado de su fecha limite («26», «oct»).
   */
  diaYMes(proxima: ActividadProxima): { dia: string; mes: string } {
    const [dia, mes] = proxima.fechaLimite.split('/');

    return { dia, mes: MESES_CORTOS[Number(mes) - 1] ?? '' };
  }

  /**
   * @param plan Plan.
   * @returns «Plan 02 · Nombre».
   */
  tituloPlan(plan: { numero: number; nombre: string }): string {
    return 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre;
  }

  /**
   * @param p Plan del responsable, con los nombres del caso.
   * @returns «Persona A y Persona B», o vacio si la bandeja no los trae.
   */
  personas(p: PlanDeResponsable): string {
    return [p.nombreA, p.nombreB].filter((n) => n !== '').join(' y ');
  }

  /**
   * Nombre del saludo: en la sesion simulada, el del empleado elegido
   * (`SISCI-DEV-EMPLEADO`), no el de la sesion («Usuario Desarrollo»).
   *
   * @param empleadoId Empleado actual.
   * @returns El nombre a mostrar.
   */
  private nombreDelSaludo(empleadoId: string): Observable<string> {
    const deSesion = this.perfil.obtenerNombreUsuario();

    if (!this.perfil.esSesionSimulada()) {
      return of(deSesion);
    }
    return this.personasServicio.obtenerPersonaPorId(empleadoId).pipe(map((p) => p?.nombres ?? deSesion));
  }

  /**
   * @param planes Planes del responsable (con los nombres del caso).
   */
  private calcular(planes: PlanDeResponsable[]): void {
    const hoy = this.reloj();

    this.actividades = actividadesDe(planes);
    this.totalActividades = this.actividades.length;
    this.conteo = contarEstados(this.actividades, hoy);
    this.proximas = proximasAVencer(planes, hoy);
    this.indicadores = [
      { filtro: 'PENDIENTE', titulo: 'Pendientes', valor: this.conteo.PENDIENTE, tono: 'ambar' },
      { filtro: 'EN_REVISION', titulo: 'En revisión', valor: this.conteo.EN_REVISION, tono: 'azul' },
      { filtro: 'RECHAZADA', titulo: 'Rechazadas (a corregir)', valor: this.conteo.RECHAZADA, tono: 'naranja' },
      { filtro: 'VENCIDA', titulo: 'Vencidas', valor: this.conteo.VENCIDA, tono: 'rojo' },
      { filtro: 'ACEPTADA', titulo: 'Aprobadas', valor: this.conteo.ACEPTADA, tono: 'verde' }
    ];
    this.abiertas = planes
      .flatMap((p) => p.plan.actividades
        .filter((a) => a.estado !== 'ACEPTADA' && a.estado !== 'NO_CUMPLIDA')
        .map((actividad): ActividadAbierta => ({
          actividad,
          plan: p.plan,
          personas: this.personas(p),
          dias: actividad.estado === 'EN_REVISION' ? null : this.dias(actividad, hoy),
          accion: actividad.estado === 'RECHAZADA' ? 'Volver a subir'
            : actividad.estado === 'EN_REVISION' ? 'Ver plan' : 'Subir evidencia'
        })))
      .sort((a, b) => ORDEN_ABIERTAS.indexOf(estadoVistaActividad(a.actividad, hoy))
        - ORDEN_ABIERTAS.indexOf(estadoVistaActividad(b.actividad, hoy))
        || (a.dias?.dias ?? 0) - (b.dias?.dias ?? 0));

    const porId = new Map<string, AvanceConflicto>();
    for (const p of planes) {
      const plan = p.plan;
      const grupo = porId.get(plan.conflictoId)
        ?? { conflictoId: plan.conflictoId, personas: this.personas(p), planes: [], actividades: [] };

      grupo.planes.push(plan);
      grupo.actividades.push(...plan.actividades);
      porId.set(plan.conflictoId, grupo);
    }
    this.porConflicto = [...porId.values()];
  }

  /**
   * @param actividad Actividad.
   * @param hoy Hoy.
   * @returns Dias para su fecha limite, o `null` si no tiene.
   */
  private dias(actividad: Actividad, hoy: Date): DiasRestantes | null {
    if (!actividad.fechaLimite) {
      return null;
    }
    try {
      return calcularDiasRestantes(actividad.fechaLimite, hoy);
    } catch (err) {
      console.error('[ResponsableDashboardComponent.dias]', err);
      return null;
    }
  }
}
