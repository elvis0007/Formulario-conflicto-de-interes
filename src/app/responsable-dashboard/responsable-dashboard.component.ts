import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { PARAMETRO_ESTADO, RUTAS, rutaPlanResponsable } from '../app.paths';
import { PlanDeResponsable } from '../models';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { KpiCardComponent } from '../shared/kpi-card/kpi-card.component';
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

/** Meses abreviados para la cajita de fecha. */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Dashboard del Responsable (especificacion §6.11).
 *
 * - Saludo con su nombre y acceso a la Bandeja de Tareas.
 * - Alerta si tiene actividades vencidas.
 * - Indicadores (pendientes, en revisión, rechazadas, vencidas,
 *   aprobadas): cada uno abre la Bandeja con ese filtro (`?estado=`).
 * - «Próximas a vencer»: sus actividades pendientes o rechazadas por fecha
 *   limite, con los dias restantes y el enlace a su plan.
 *
 * Solo cuenta las actividades del empleado actual
 * (`PerfilUsuarioService.obtenerEmpleadoActualId()`) en planes enviados.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-responsable-dashboard',
  imports: [BadgeComponent, EmptyStateComponent, KpiCardComponent, RouterLink],
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
  conteo: ConteoEstados = { pendiente: 0, en_revision: 0, aprobada: 0, rechazada: 0, vencida: 0 };

  /** Indicadores clicables. */
  indicadores: IndicadorResponsable[] = [];

  /** «Próximas a vencer». */
  proximas: ActividadProxima[] = [];

  readonly rutaBandeja = RUTAS.responsable.planes;

  private readonly planesServicio = inject(PlanesMockService);
  private readonly perfil = inject(PerfilUsuarioService);
  private readonly router = inject(Router);
  private readonly reloj = inject(RELOJ);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Carga los planes del responsable y calcula indicadores y vencimientos.
   */
  ngOnInit(): void {
    const empleadoId = this.perfil.obtenerEmpleadoActualId();

    this.nombre = this.perfil.obtenerNombreUsuario();
    if (empleadoId === null) {
      this.cargando = false;
      return;
    }

    this.planesServicio.obtenerPlanesDeResponsable(empleadoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (planes) => {
          this.cargando = false;
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
   * @param planes Planes del responsable.
   */
  private calcular(planes: PlanDeResponsable[]): void {
    const actividades = actividadesDe(planes);

    this.totalActividades = actividades.length;
    this.conteo = contarEstados(actividades);
    this.proximas = proximasAVencer(planes, this.reloj());
    this.indicadores = [
      { filtro: 'pendiente', titulo: 'Pendientes', valor: this.conteo.pendiente, tono: 'ambar' },
      { filtro: 'en_revision', titulo: 'En revisión', valor: this.conteo.en_revision, tono: 'azul' },
      { filtro: 'rechazada', titulo: 'Rechazadas (a corregir)', valor: this.conteo.rechazada, tono: 'naranja' },
      { filtro: 'vencida', titulo: 'Vencidas', valor: this.conteo.vencida, tono: 'rojo' },
      { filtro: 'aprobada', titulo: 'Aprobadas', valor: this.conteo.aprobada, tono: 'verde' }
    ];
  }
}
