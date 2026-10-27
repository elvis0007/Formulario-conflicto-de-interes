import { Component, DestroyRef, Input, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FiltroReporte, TipoReporte } from '../../models';
import { ReportesMockService } from '../../services/reportes-mock.service';
import { ConfirmacionTemporal } from '../../utils/confirmacion-temporal';
import { IconoComponent } from '../icono/icono.component';

/** Tiempo que se ve «Disponible con sesión real», en ms. */
const DURACION_SIN_BACKEND_MS = 4000;

/**
 * Boton «Descargar Excel» de un reporte (RG.02 o RG.03).
 *
 * - Mientras descarga: «Descargando…» y no se puede volver a pulsar.
 * - Al terminar: «Descargado ✓» unos segundos.
 * - Con la sesion simulada: «Disponible con sesión real» (no hay backend).
 * - Si falla: el motivo debajo del boton (`role="alert"`).
 *
 * El componente padre pasa los filtros que el backend sabe aplicar.
 *
 * Uso:
 * `<app-boton-excel tipo="RG.03" [filtro]="filtroExcel" />`
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-boton-excel',
  imports: [IconoComponent],
  templateUrl: './boton-excel.component.html',
  styleUrl: './boton-excel.component.scss'
})
export class BotonExcelComponent implements OnDestroy {
  /** Reporte que descarga. */
  @Input({ required: true }) tipo!: TipoReporte;

  /** Filtros de la pantalla en el momento de pulsar. */
  @Input() filtro: FiltroReporte = {};

  /** Hay una descarga en curso. */
  descargando = false;

  /** Motivo del ultimo fallo; `null` si no hubo. */
  error: string | null = null;

  /** «Descargado ✓». */
  readonly descargado = new ConfirmacionTemporal();

  /** «Disponible con sesión real». */
  readonly sinBackend = new ConfirmacionTemporal(DURACION_SIN_BACKEND_MS);

  private readonly servicio = inject(ReportesMockService);
  private readonly destroyRef = inject(DestroyRef);

  /** @returns Texto del boton segun el estado. */
  get texto(): string {
    if (this.descargando) {
      return 'Descargando…';
    }
    if (this.descargado.activa) {
      return 'Descargado ✓';
    }
    return this.sinBackend.activa ? 'Disponible con sesión real' : 'Descargar Excel';
  }

  /** @returns `true` si el boton no debe hacer nada al pulsarlo. */
  get ocupado(): boolean {
    return this.descargando || this.descargado.activa || this.sinBackend.activa;
  }

  /**
   * Pide el reporte con los filtros actuales.
   *
   * @author Elvis Flores
   */
  descargar(): void {
    if (this.ocupado) {
      return;
    }
    this.descargando = true;
    this.error = null;
    this.servicio.descargarReporte(this.tipo, this.filtro)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.descargando = false;
        if (resultado.estado === 'descargado') {
          this.descargado.disparar();
        } else if (resultado.estado === 'sin-backend') {
          this.sinBackend.disparar();
        } else {
          this.error = resultado.mensaje;
        }
      });
  }

  ngOnDestroy(): void {
    this.descargado.cancelar();
    this.sinBackend.cancelar();
  }
}
