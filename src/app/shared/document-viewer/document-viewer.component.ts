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
import { Observable, Subscription } from 'rxjs';
import { Archivo } from '../../models';
import { FechaLargaPipe } from '../../pipes/fecha-larga.pipe';
import { PlanesMockService } from '../../services/planes-mock.service';
import { ConfirmacionTemporal } from '../../utils/confirmacion-temporal';
import { IconoComponent } from '../icono/icono.component';

/** Tipo MIME con que se muestra cada clase de archivo del modelo. */
const TIPOS_MIME: Record<Archivo['tipo'], string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg'
};

/** Zoom minimo, maximo y paso, en porcentaje. */
export const ZOOM_MINIMO = 50;
export const ZOOM_MAXIMO = 200;
export const ZOOM_PASO = 25;

/** Mensaje si el archivo no se pudo obtener del backend. */
export const ERROR_CARGA_ARCHIVO = 'No se pudo cargar el archivo. Inténtalo de nuevo más tarde.';

/** Prefijo de las URLs de los archivos de ejemplo (no existen). */
const PREFIJO_ARCHIVO_EJEMPLO = '/mock/';

/** Prefijo de las URLs locales (archivo recien elegido en esta sesion). */
const PREFIJO_URL_LOCAL = 'blob:';

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
 * - Los recien elegidos en la sesion (URL `blob:`) se muestran directo.
 * - Los del backend no tienen URL publica (`Archivo.url` es una ruta de la
 *   API que exige el token): el contenido se pide con
 *   `PlanesMockService.obtenerDocumentoPlan` (`planId`) u
 *   `obtenerArchivoEvidencia` (`evidenciaId`), se muestra con una URL local
 *   (`URL.createObjectURL`) y esa URL se libera al cambiar de archivo o al
 *   cerrar el visor. Si no llega, se avisa.
 *
 * Lo usan Revisión de Evidencias, Plan de Acción y el detalle del plan del
 * Responsable.
 *
 * SEGURIDAD: la URL del PDF se marca como confiable
 * (`bypassSecurityTrustResourceUrl`) porque un `<iframe>` lo exige. Solo
 * recibe URLs locales (`blob:`) creadas por la app, nunca una URL escrita
 * por el usuario.
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

  /** Id del plan, si el archivo es su documento firmado. */
  @Input() planId = '';

  /** Id de la evidencia, si el archivo es una evidencia. */
  @Input() evidenciaId = '';

  /** Se pide cerrar el visor. */
  @Output() cerrar = new EventEmitter<void>();

  /** Zoom actual, en porcentaje. */
  zoom = 100;

  /** URL que se muestra y se descarga (`blob:`); `null` si aun no hay. */
  urlArchivo: string | null = null;

  /** URL del PDF ya marcada como confiable para el `<iframe>`. */
  urlPdf: SafeResourceUrl | null = null;

  /** Se esta pidiendo el archivo al backend. */
  cargandoArchivo = false;

  /** Motivo por el que no se puede mostrar; `null` si no hay error. */
  errorArchivo: string | null = null;

  /** Confirmacion «Descargado ✓». */
  readonly descargado = new ConfirmacionTemporal();

  readonly zoomMinimo = ZOOM_MINIMO;
  readonly zoomMaximo = ZOOM_MAXIMO;

  /** URL creada por este visor (hay que liberarla). */
  private urlCreada: string | null = null;

  /** Peticion del archivo en curso. */
  private peticion: Subscription | null = null;

  private readonly sanitizer = inject(DomSanitizer);
  private readonly planesServicio = inject(PlanesMockService);

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

  /** @returns `true` si «Descargar» no puede hacer nada todavia. */
  get descargaNoDisponible(): boolean {
    return !this.esEjemplo && this.urlArchivo === null;
  }

  /**
   * Al cambiar de archivo, vuelve al 100 % y prepara su contenido.
   *
   * @param cambios Cambios de inputs.
   */
  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['archivo'] || cambios['planId'] || cambios['evidenciaId']) {
      this.zoom = 100;
      this.descargado.cancelar();
      this.cargarArchivo();
    }
  }

  /**
   * Detiene el temporizador de «Descargado ✓», cancela la peticion y
   * libera la URL local.
   */
  ngOnDestroy(): void {
    this.descargado.cancelar();
    this.liberar();
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
   * Descarga el archivo y muestra «Descargado ✓». Los de ejemplo no
   * existen: solo se confirma. Sin contenido (cargando o con error) no
   * hace nada.
   */
  descargar(): void {
    if (this.descargado.activa || this.descargaNoDisponible) {
      return;
    }
    if (!this.esEjemplo && this.urlArchivo !== null) {
      const enlace = document.createElement('a');

      enlace.href = this.urlArchivo;
      enlace.download = this.archivo.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
    }
    this.descargado.disparar();
  }

  /**
   * Decide de donde sale el contenido: nada (ejemplo), la URL local o el
   * backend.
   */
  private cargarArchivo(): void {
    let fuente: Observable<Blob | null> | null = null;

    this.liberar();
    this.errorArchivo = null;
    this.cargandoArchivo = false;
    if (this.esEjemplo) {
      return;
    }
    if (this.archivo.url.startsWith(PREFIJO_URL_LOCAL)) {
      this.mostrar(this.archivo.url);
      return;
    }

    fuente = this.fuente();
    if (fuente === null) {
      this.errorArchivo = ERROR_CARGA_ARCHIVO;
      return;
    }

    this.cargandoArchivo = true;
    this.peticion = fuente.subscribe({
      next: (contenido) => {
        this.cargandoArchivo = false;
        if (contenido === null) {
          // El motivo del servicio si lo hay (p. ej. el documento del plan solo
          // lo ve RRHH: 403 para el responsable).
          this.errorArchivo = this.planesServicio.ultimoError ?? ERROR_CARGA_ARCHIVO;
          return;
        }
        // Tipo fijo según el archivo, no el que diga la respuesta: un blob
        // text/html en el iframe correría con el origen de la app.
        this.urlCreada = URL.createObjectURL(
          new Blob([contenido], { type: TIPOS_MIME[this.archivo.tipo] })
        );
        this.mostrar(this.urlCreada);
      },
      error: (err: unknown) => {
        this.cargandoArchivo = false;
        this.errorArchivo = ERROR_CARGA_ARCHIVO;
        console.error('[DocumentViewerComponent.cargarArchivo]', err);
      }
    });
  }

  /** @returns La consulta del contenido, o `null` si no se sabe de quien es. */
  private fuente(): Observable<Blob | null> | null {
    if (this.evidenciaId !== '') {
      return this.planesServicio.obtenerArchivoEvidencia(this.evidenciaId);
    }
    if (this.planId !== '') {
      return this.planesServicio.obtenerDocumentoPlan(this.planId);
    }

    return null;
  }

  /**
   * @param url URL local que se muestra.
   */
  private mostrar(url: string): void {
    this.urlArchivo = url;
    this.urlPdf = this.esPdf ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }

  /**
   * Cancela la peticion en curso y libera la URL que creo este visor (la
   * `blob:` del archivo recien subido no es suya: no se toca).
   */
  private liberar(): void {
    this.peticion?.unsubscribe();
    this.peticion = null;
    if (this.urlCreada !== null) {
      URL.revokeObjectURL(this.urlCreada);
      this.urlCreada = null;
    }
    this.urlArchivo = null;
    this.urlPdf = null;
  }
}
