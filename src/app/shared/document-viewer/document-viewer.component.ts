import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Archivo } from '../../models';
import { FechaLargaPipe } from '../../pipes/fecha-larga.pipe';
import { ConfirmacionTemporal } from '../../utils/confirmacion-temporal';
import { IconoComponent } from '../icono/icono.component';

/** Zoom minimo, maximo y paso, en porcentaje. */
export const ZOOM_MINIMO = 50;
export const ZOOM_MAXIMO = 200;
export const ZOOM_PASO = 25;

/** Prefijo de las URLs de los archivos de ejemplo (no existen). */
const PREFIJO_ARCHIVO_EJEMPLO = '/mock/';

/** Alto del visor de PDF al 100 %, en px. */
const ALTO_PDF_PX = 620;

/**
 * Visor de documentos sin dependencias: PDF en un `<iframe>` (el visor del
 * navegador) e imagenes en un `<img>`.
 *
 * - Barra: nombre del archivo, quien lo subio y cuando, zoom − / + con el
 *   porcentaje, «Descargar» (cambia a «Descargado ✓» unos segundos) y
 *   cerrar.
 * - Los archivos de ejemplo (URL `/mock/...`, que no existe) muestran
 *   «Vista previa no disponible (archivo de ejemplo)» en lugar de un error.
 *   Los subidos en la sesion (URL `blob:`) y los del backend si se ven.
 *
 * Lo usan Revisión de Evidencias y, desde el Dia 10, el Responsable.
 *
 * SEGURIDAD: la URL del PDF se marca como confiable
 * (`bypassSecurityTrustResourceUrl`) porque un `<iframe>` lo exige. Solo
 * debe recibir URLs de nuestros servicios (`blob:` locales o `/archivos/:id`
 * del backend), nunca una URL escrita por el usuario.
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-document-viewer',
  imports: [FechaLargaPipe, IconoComponent],
  templateUrl: './document-viewer.component.html',
  styleUrl: './document-viewer.component.scss'
})
export class DocumentViewerComponent implements OnChanges, OnDestroy {
  /** Archivo a mostrar. */
  @Input({ required: true }) archivo!: Archivo;

  /** Nombre de quien lo subio. */
  @Input() subidoPor = '';

  /** Fecha y hora de subida (ISO 8601). */
  @Input() fechaSubida = '';

  /** Se pide cerrar el visor. */
  @Output() cerrar = new EventEmitter<void>();

  /** Zoom actual, en porcentaje. */
  zoom = 100;

  /** URL del PDF ya marcada como confiable para el `<iframe>`. */
  urlPdf: SafeResourceUrl | null = null;

  /** Confirmacion «Descargado ✓». */
  readonly descargado = new ConfirmacionTemporal();

  readonly zoomMinimo = ZOOM_MINIMO;
  readonly zoomMaximo = ZOOM_MAXIMO;

  private readonly sanitizer = inject(DomSanitizer);

  /** @returns `true` si es un archivo de ejemplo sin vista previa. */
  get esEjemplo(): boolean {
    return this.archivo.url.startsWith(PREFIJO_ARCHIVO_EJEMPLO);
  }

  /** @returns `true` si es un PDF. */
  get esPdf(): boolean {
    return this.archivo.tipo === 'pdf';
  }

  /** @returns Alto del `<iframe>` del PDF segun el zoom, en px. */
  get altoPdf(): number {
    return Math.round(ALTO_PDF_PX * this.zoom / 100);
  }

  /**
   * Al cambiar de archivo, vuelve al 100 % y prepara la URL del PDF.
   *
   * @param cambios Cambios de inputs.
   */
  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['archivo']) {
      this.zoom = 100;
      this.descargado.cancelar();
      this.urlPdf = this.esPdf && !this.esEjemplo
        ? this.sanitizer.bypassSecurityTrustResourceUrl(this.archivo.url)
        : null;
    }
  }

  /**
   * Detiene el temporizador de «Descargado ✓».
   */
  ngOnDestroy(): void {
    this.descargado.cancelar();
  }

  /**
   * Cambia el zoom un paso, sin pasar de los limites.
   *
   * @param direccion 1 para acercar, -1 para alejar.
   */
  cambiarZoom(direccion: 1 | -1): void {
    this.zoom = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, this.zoom + direccion * ZOOM_PASO));
  }

  /**
   * Descarga el archivo (si existe) y muestra «Descargado ✓». Los de
   * ejemplo no existen: solo se confirma.
   */
  descargar(): void {
    if (this.descargado.activa) {
      return;
    }
    if (!this.esEjemplo) {
      const enlace = document.createElement('a');

      enlace.href = this.archivo.url;
      enlace.download = this.archivo.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
    }
    this.descargado.disparar();
  }
}
