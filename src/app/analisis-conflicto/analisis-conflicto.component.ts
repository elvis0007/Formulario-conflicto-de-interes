import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { AnalisisConflictos, Conflicto } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { GradoParentescoPipe } from '../pipes/grado-parentesco.pipe';
import { AnalisisMockService } from '../services/analisis-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { ColumnaTabla, DataTableComponent } from '../shared/data-table/data-table.component';
import { FilaTablaDirective } from '../shared/data-table/plantillas-tabla';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { OpcionPill, PillsComponent } from '../shared/pills/pills.component';
import {
  FiltroRiesgo,
  RIESGOS,
  RolesInvolucrados,
  contarPendientes,
  contarPorRiesgo,
  filtrarPorRiesgo,
  rolesInvolucrados,
  textoClasificacion,
  textoEstadoAnalisis,
  textoRiesgo
} from '../utils/analisis.util';
import { ConfirmacionTemporal } from '../utils/confirmacion-temporal';
import { TODOS } from '../utils/filtros-listados.util';
import {
  Tono,
  mapearClasificacionATono,
  mapearEstadoAnalisisATono,
  mapearRiesgoATono
} from '../utils/tono.util';

/** Registros por pagina de la tabla. */
const TAMANO_PAGINA = 5;

/** Opciones de «Mostrar n registros». */
const TAMANOS_PAGINA: readonly number[] = [5, 10, 15];

/** Ruta de la lista real de formularios recibidos (pantalla del host). */
const RUTA_FORMULARIOS = '/admin';

/**
 * Una fila de la tabla: el conflicto y lo que la plantilla muestra de el,
 * ya calculado (asi la plantilla no llama funciones en cada deteccion de
 * cambios).
 */
export interface FilaAnalisis {
  conflicto: Conflicto;
  roles: RolesInvolucrados;
  textoRiesgo: string;
  tonoRiesgo: Tono;
  textoClasificacion: string;
  tonoClasificacion: Tono;
  /** Homonimo: la fila se ve atenuada. */
  archivado: boolean;
  /** Texto provisional de la columna «Plan de acción» (Dia 6). */
  textoPlanes: string;
}

/**
 * Analisis de Conflictos (PNIP.CI.RG.02), primera mitad (Dia 5):
 *
 * - Encabezado: titulo, codigo, insignia Borrador / Validado, fecha de
 *   generacion y casos pendientes de clasificar; botones «Generar
 *   análisis», «Ver formularios», «Descargar Excel» y «Validar análisis».
 * - Filtro por riesgo en pildoras con conteos (sobre todos los casos).
 * - Tabla paginada de involucrados.
 * - Si nunca se genero un analisis, estado vacio con «Generar análisis».
 *
 * Quedan para el Dia 6, con su boton visible pero sin logica: el modal
 * «Ver detalles», «Validar análisis» y la columna real de planes.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-analisis-conflicto',
  imports: [
    BadgeComponent,
    DataTableComponent,
    EmptyStateComponent,
    FechaLargaPipe,
    FilaTablaDirective,
    GradoParentescoPipe,
    IconoComponent,
    PillsComponent
  ],
  templateUrl: './analisis-conflicto.component.html',
  styleUrl: './analisis-conflicto.component.scss'
})
export class AnalisisConflictoComponent implements OnInit, OnDestroy {
  /** Analisis cargado; `null` mientras llega la primera respuesta. */
  analisis: AnalisisConflictos | null = null;

  /** «Generar análisis» en curso. */
  generando = false;

  /** Riesgo elegido en las pildoras. */
  filtroRiesgo: FiltroRiesgo = TODOS;

  /** Pildoras de riesgo con sus conteos. */
  opcionesRiesgo: OpcionPill[] = [];

  /** Filas del filtro actual. */
  filasFiltradas: FilaAnalisis[] = [];

  /** Casos pendientes de clasificar (de todo el analisis). */
  pendientes = 0;

  /** Confirmacion pasajera de «Descargar Excel». */
  readonly descargado = new ConfirmacionTemporal();

  /** Cabeceras de la tabla. */
  readonly columnas: readonly ColumnaTabla[] = [
    { titulo: 'Involucrados', ancho: '30%' },
    { titulo: 'Relación' },
    { titulo: 'Grado' },
    { titulo: 'Departamentos' },
    { titulo: 'Riesgo' },
    { titulo: 'Estado' },
    { titulo: 'Detalles', alinear: 'center' },
    { titulo: 'Plan de acción' }
  ];

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly tamanosPagina = TAMANOS_PAGINA;

  /** Clave de cada fila para la tabla. */
  readonly claveFila = (fila: FilaAnalisis): string => fila.conflicto.id;

  /** Todas las filas del analisis, sin filtrar. */
  private filas: FilaAnalisis[] = [];

  private readonly servicio = inject(AnalisisMockService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * @returns `true` si ya se genero algun analisis.
   */
  get hayAnalisis(): boolean {
    return this.analisis !== null && this.analisis.estado !== null;
  }

  /**
   * @returns Texto de la insignia de estado; `''` si no hay analisis.
   */
  get textoEstado(): string {
    return this.analisis?.estado ? textoEstadoAnalisis(this.analisis.estado) : '';
  }

  /**
   * @returns Tono de la insignia de estado.
   */
  get tonoEstado(): Tono {
    return this.analisis?.estado ? mapearEstadoAnalisisATono(this.analisis.estado) : 'gris';
  }

  /**
   * @returns «n casos pendientes de clasificar», en singular o plural.
   */
  get textoPendientes(): string {
    if (this.pendientes === 0) {
      return 'Todos los casos están clasificados';
    }

    return this.pendientes === 1
      ? '1 caso pendiente de clasificar'
      : this.pendientes + ' casos pendientes de clasificar';
  }

  /**
   * Carga el analisis vigente.
   */
  ngOnInit(): void {
    this.servicio.obtenerAnalisisActual()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (analisis) => this.aplicarAnalisis(analisis),
        error: (err: unknown) => console.error(
          '[AnalisisConflictoComponent.ngOnInit]', err
        )
      });
  }

  /**
   * Detiene el temporizador de «Descargado ✓».
   */
  ngOnDestroy(): void {
    this.descargado.cancelar();
  }

  /**
   * Vuelve a correr el analisis y recarga la tabla. Mientras corre, el
   * boton queda deshabilitado con su estado de carga.
   */
  generarAnalisis(): void {
    if (this.generando) {
      return;
    }

    this.generando = true;
    this.servicio.generarAnalisis()
      .pipe(
        switchMap(() => this.servicio.obtenerAnalisisActual()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (analisis) => {
          this.generando = false;
          this.aplicarAnalisis(analisis);
        },
        error: (err: unknown) => {
          this.generando = false;
          console.error('[AnalisisConflictoComponent.generarAnalisis]', err);
        }
      });
  }

  /**
   * Abre la lista real de formularios recibidos.
   */
  verFormularios(): void {
    this.router.navigate([RUTA_FORMULARIOS]);
  }

  /**
   * Por ahora solo confirma visualmente («Descargado ✓»), sin archivo.
   */
  descargarExcel(): void {
    if (this.descargado.activa) {
      return;
    }
    this.descargado.disparar();
  }

  /**
   * Cambia el filtro de riesgo y filtra la tabla.
   *
   * @param valor Valor de la pildora elegida (`''` = Todos).
   */
  cambiarFiltro(valor: string): void {
    this.filtroRiesgo = valor as FiltroRiesgo;
    this.aplicarFiltro();
  }

  /**
   * Guarda el analisis y recalcula filas, conteos y pendientes.
   *
   * @param analisis Analisis recibido del servicio.
   */
  private aplicarAnalisis(analisis: AnalisisConflictos): void {
    const conteo = contarPorRiesgo(analisis.conflictos);

    this.analisis = analisis;
    this.filas = analisis.conflictos.map((c) => this.crearFila(c));
    this.pendientes = contarPendientes(analisis.conflictos);
    this.opcionesRiesgo = [
      { valor: TODOS, etiqueta: 'Todos', contador: conteo.total },
      ...RIESGOS.map((riesgo): OpcionPill => ({
        valor: riesgo,
        etiqueta: textoRiesgo(riesgo),
        contador: conteo[riesgo],
        tono: mapearRiesgoATono(riesgo)
      }))
    ];
    this.aplicarFiltro();
  }

  /**
   * Recalcula las filas visibles segun el filtro de riesgo.
   */
  private aplicarFiltro(): void {
    const ids = new Set(
      filtrarPorRiesgo(this.filas.map((f) => f.conflicto), this.filtroRiesgo)
        .map((c) => c.id)
    );

    this.filasFiltradas = this.filas.filter((f) => ids.has(f.conflicto.id));
  }

  /**
   * @param conflicto Caso del analisis.
   * @returns La fila de la tabla para ese caso.
   */
  private crearFila(conflicto: Conflicto): FilaAnalisis {
    const planes = conflicto.planes.length;

    return {
      conflicto,
      roles: rolesInvolucrados(conflicto),
      textoRiesgo: textoRiesgo(conflicto.riesgo),
      tonoRiesgo: mapearRiesgoATono(conflicto.riesgo),
      textoClasificacion: textoClasificacion(conflicto.clasificacion),
      tonoClasificacion: mapearClasificacionATono(conflicto.clasificacion),
      archivado: conflicto.clasificacion === 'homonimo',
      textoPlanes: planes === 1 ? '1 plan' : planes + ' planes'
    };
  }
}
