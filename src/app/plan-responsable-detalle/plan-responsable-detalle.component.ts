import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, map, of, switchMap } from 'rxjs';
import { RUTAS } from '../app.paths';
import { Actividad, Archivo, Conflicto, PlanAccion, PlanDeResponsable } from '../models';
import { FechaLargaPipe } from '../pipes/fecha-larga.pipe';
import { ConflictosMockService } from '../services/conflictos-mock.service';
import { PerfilUsuarioService } from '../services/perfil-usuario.service';
import { ESTADOS_CON_SUBIDA, PlanesMockService } from '../services/planes-mock.service';
import { BadgeComponent } from '../shared/badge/badge.component';
import { DocumentViewerComponent } from '../shared/document-viewer/document-viewer.component';
import { IconoComponent } from '../shared/icono/icono.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { textoParentesco, textoRiesgo } from '../utils/analisis.util';
import { ACCEPT_EVIDENCIA, validarEvidencia } from '../utils/documento.util';
import { DiasRestantes, calcularDiasRestantes, formatearFecha, parsearFecha } from '../utils/fechas.util';
import { textoEstadoPlan } from '../utils/planes.util';
import { RELOJ } from '../utils/reloj';
import { textoPlazo } from '../utils/responsable.util';
import { textoEstadoActividad } from '../utils/revision.util';
import { Tono, mapearEstadoActividadATono, mapearEstadoPlanATono, mapearRiesgoATono } from '../utils/tono.util';

/** Lo que la pantalla muestra de una actividad. */
export interface VistaActividadResponsable {
  actividad: Actividad;
  /** Textos de la vista del Responsable (una vencida dice «Pendiente»). */
  textoEstado: string;
  tonoEstado: Tono;
  plazo: string;
  /** «dd/mm/aaaa», o vacio. */
  fechaLimite: string;
  /** Dias restantes; solo si tiene algo por hacer. */
  dias: DiasRestantes | null;
  /** Plazo en rojo: vencida, o paso la fecha sin evidencia. */
  vencida: boolean;
  /** Se puede subir (o volver a subir) la evidencia. */
  puedeSubir: boolean;
}

/** Documento abierto en el visor. */
export interface DocumentoAbierto {
  titulo: string;
  archivo: Archivo;
  subidoPor: string;
  fechaSubida: string;
}

/** Mensaje si la carga falla. */
const ERROR_CARGA = 'No se pudo cargar el plan. Inténtalo de nuevo.';

/**
 * Detalle de un plan visto por el Responsable (especificacion §6.12,
 * detalle).
 *
 * - Cabecera con PNIP.CI.FR.02, conflicto, plan, estado y fecha de inicio.
 * - Tarjeta compacta del caso: las dos personas, el parentesco y el riesgo
 *   (especificacion §6.12; mockups aprobados por RRHH).
 * - «Ver documento del plan» y «Ver evidencia» en el visor de documentos.
 * - Solo las actividades del responsable, con plazo, fecha limite y dias
 *   restantes, estado y evidencia; «Subir evidencia» / «Volver a subir»
 *   (PDF, PNG o JPG de hasta 10 MB).
 * - Plan cerrado: solo lectura.
 * - Plan inexistente, en borrador o sin actividades suyas: «No se encontró
 *   el plan» (no se ven planes ajenos escribiendo la URL).
 *
 * Las reglas de la subida las aplica tambien `PlanesMockService`.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-plan-responsable-detalle',
  imports: [
    BadgeComponent,
    DocumentViewerComponent,
    FechaLargaPipe,
    IconoComponent,
    ModalComponent,
    RouterLink
  ],
  templateUrl: './plan-responsable-detalle.component.html',
  styleUrl: './plan-responsable-detalle.component.scss'
})
export class PlanResponsableDetalleComponent implements OnInit {
  /** Input oculto para elegir la evidencia. */
  @ViewChild('selectorArchivo') selectorArchivo?: ElementRef<HTMLInputElement>;

  /** Todavia no llego la respuesta. */
  cargando = true;

  /** Plan del responsable; `null` si no se encontro. */
  datos: PlanDeResponsable | null = null;

  /** Error al cargar. */
  errorCarga: string | null = null;

  /** Actividades listas para la vista. */
  actividades: VistaActividadResponsable[] = [];

  /** Caso del plan; `null` si no se encontro. */
  conflicto: Conflicto | null = null;

  /** Errores de subida por actividad. */
  errores: Record<string, string> = {};

  /** Actividad cuya evidencia se esta subiendo. */
  subiendoId: string | null = null;

  /** Documento abierto en el visor; `null` con el modal cerrado. */
  documento: DocumentoAbierto | null = null;

  readonly rutaBandeja = RUTAS.responsable.planes;
  readonly acceptEvidencia = ACCEPT_EVIDENCIA;

  /** Actividad para la que se abrio el selector de archivos. */
  private objetivoId: string | null = null;

  private readonly planesServicio = inject(PlanesMockService);
  private readonly perfil = inject(PerfilUsuarioService);
  private readonly conflictosServicio = inject(ConflictosMockService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly reloj = inject(RELOJ);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns El plan, o `null`. */
  get plan(): PlanAccion | null {
    return this.datos?.plan ?? null;
  }

  /** @returns «Plan 02 · Nombre». */
  get tituloPlan(): string {
    const plan = this.plan;

    return plan ? 'Plan ' + String(plan.numero).padStart(2, '0') + ' · ' + plan.nombre : '';
  }

  /** @returns Texto del estado del plan. */
  get textoEstado(): string {
    return this.plan ? textoEstadoPlan(this.plan.estado) : '';
  }

  /** @returns Tono del estado del plan. */
  get tonoEstado(): Tono {
    return this.plan ? mapearEstadoPlanATono(this.plan.estado) : 'gris';
  }

  /** @returns Parentesco del caso en una linea. */
  get parentesco(): string {
    return this.conflicto ? textoParentesco(this.conflicto) : '';
  }

  /** @returns «Riesgo alto», «Riesgo moderado»... */
  get textoRiesgo(): string {
    return this.conflicto ? 'Riesgo ' + textoRiesgo(this.conflicto.riesgo).toLowerCase() : '';
  }

  /** @returns Tono del riesgo del caso. */
  get tonoRiesgo(): Tono {
    return this.conflicto ? mapearRiesgoATono(this.conflicto.riesgo) : 'gris';
  }

  /** @returns `true` si el plan esta cerrado (solo lectura). */
  get soloLectura(): boolean {
    return this.plan?.estado === 'cerrado';
  }

  /**
   * Carga el plan de la URL (y lo vuelve a cargar si cambia `:planId`).
   */
  ngOnInit(): void {
    this.ruta.paramMap
      .pipe(
        switchMap((parametros) => {
          const planId = parametros.get('planId') ?? '';
          const empleadoId = this.perfil.obtenerEmpleadoActualId();

          this.cargando = true;
          this.errorCarga = null;
          this.errores = {};
          this.documento = null;
          if (empleadoId === null || planId === '') {
            this.conflicto = null;
            this.mostrar(null);
            return EMPTY;
          }
          // El caso solo se pide si el plan es suyo.
          return this.planesServicio.obtenerPlanDeResponsable(planId, empleadoId).pipe(
            switchMap((datos) => datos === null
              ? of({ datos, conflicto: undefined })
              : this.conflictosServicio.obtenerConflictoPorId(datos.plan.conflictoId)
                .pipe(map((conflicto) => ({ datos, conflicto }))))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ datos, conflicto }) => {
          this.conflicto = conflicto ?? null;
          this.mostrar(datos);
        },
        error: (err: unknown) => {
          this.cargando = false;
          this.errorCarga = ERROR_CARGA;
          console.error('[PlanResponsableDetalleComponent.ngOnInit]', err);
        }
      });
  }

  /**
   * Abre el selector de archivos para una actividad.
   *
   * @param actividad Actividad que admite evidencia.
   */
  elegirArchivo(actividad: Actividad): void {
    if (this.soloLectura || this.subiendoId !== null) {
      return;
    }
    this.objetivoId = actividad.id;
    this.selectorArchivo?.nativeElement.click();
  }

  /**
   * Valida el archivo elegido y lo sube.
   *
   * @param evento `change` del input.
   */
  alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    const actividadId = this.objetivoId;
    const plan = this.plan;

    input.value = '';
    this.objetivoId = null;
    if (archivo === undefined || actividadId === null || plan === null) {
      return;
    }

    const error = validarEvidencia(archivo);

    this.errores = { ...this.errores, [actividadId]: error ?? '' };
    if (error !== null) {
      return;
    }

    this.subiendoId = actividadId;
    this.planesServicio.subirEvidencia(plan.id, actividadId, archivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.subiendoId = null;
          if (resultado.plan === null) {
            this.errores = { ...this.errores, [actividadId]: resultado.error ?? '' };
            return;
          }
          this.mostrar(resultado.plan);
        },
        error: (err: unknown) => {
          this.subiendoId = null;
          console.error('[PlanResponsableDetalleComponent.alElegirArchivo]', err);
        }
      });
  }

  /**
   * Abre el documento firmado del plan.
   */
  verDocumentoPlan(): void {
    const archivo = this.plan?.documentoFirmado;

    if (archivo) {
      this.documento = {
        titulo: 'Documento del plan',
        archivo,
        subidoPor: 'RRHH',
        fechaSubida: archivo.fechaSubida ?? ''
      };
    }
  }

  /**
   * Abre la evidencia de una actividad.
   *
   * @param actividad Actividad con evidencia.
   */
  verEvidencia(actividad: Actividad): void {
    const evidencia = actividad.evidencia;

    if (evidencia) {
      this.documento = {
        titulo: 'Evidencia de la actividad',
        archivo: evidencia.archivo,
        subidoPor: actividad.responsableNombre,
        fechaSubida: evidencia.fechaSubida
      };
    }
  }

  /**
   * @param iso Fecha ISO.
   * @returns «dd/mm/aaaa», o vacio si no hay o no es valida.
   */
  fecha(iso: string | undefined): string {
    if (!iso) {
      return '';
    }
    try {
      return formatearFecha(parsearFecha(iso));
    } catch (err) {
      console.error('[PlanResponsableDetalleComponent.fecha] Fecha inválida:', iso, err);
      return '';
    }
  }

  /**
   * @param datos Plan recibido, o `null` si no se encontro.
   */
  private mostrar(datos: PlanDeResponsable | null): void {
    this.cargando = false;
    this.datos = datos;
    this.actividades = datos ? datos.plan.actividades.map((a) => this.crearVista(a, datos.plan)) : [];
  }

  /**
   * @param actividad Actividad del responsable.
   * @param plan Su plan.
   * @returns Lo que muestra la pantalla.
   */
  private crearVista(actividad: Actividad, plan: PlanAccion): VistaActividadResponsable {
    const porHacer = ESTADOS_CON_SUBIDA.includes(actividad.estado);
    let dias: DiasRestantes | null = null;

    if (porHacer && actividad.fechaLimite) {
      try {
        dias = calcularDiasRestantes(actividad.fechaLimite, this.reloj());
      } catch (err) {
        console.error('[PlanResponsableDetalleComponent.crearVista]', err);
      }
    }

    return {
      actividad,
      textoEstado: textoEstadoActividad(actividad.estado, true),
      tonoEstado: mapearEstadoActividadATono(actividad.estado, true),
      plazo: textoPlazo(actividad),
      fechaLimite: this.fecha(actividad.fechaLimite),
      dias,
      vencida: actividad.estado === 'vencida' || (dias?.vencida ?? false),
      puedeSubir: porHacer && plan.estado !== 'cerrado' && plan.estado !== 'borrador'
    };
  }
}
