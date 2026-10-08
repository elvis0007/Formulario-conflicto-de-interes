import { Component, Input, OnChanges } from '@angular/core';
import { Actividad } from '../../models';
import { calcularAvance } from '../../utils/planes.util';
import { textoEstadoActividad } from '../../utils/revision.util';
import { Tono, mapearEstadoActividadATono } from '../../utils/tono.util';

/** Un segmento de la barra: una actividad. */
interface SegmentoAvance {
  id: string;
  tono: Tono;
  /** Tooltip: «descripcion · estado». */
  titulo: string;
}

/**
 * Barra de avance segmentada: un segmento por actividad, coloreado por su
 * estado, con tooltip (descripcion y estado). Lleva un texto accesible
 * («3 de 5 cumplidas») y, si se pide, el mismo texto visible al lado.
 *
 * La usan el Informe General (avance del plan actual) y el dashboard del
 * Responsable (avance de sus actividades).
 *
 * @author Elvis Flores
 */
@Component({
  selector: 'app-barra-avance',
  templateUrl: './barra-avance.component.html',
  styleUrl: './barra-avance.component.scss'
})
export class BarraAvanceComponent implements OnChanges {
  /** Actividades, en el orden en que se dibujan. */
  @Input({ required: true }) actividades: readonly Actividad[] = [];

  /** Textos y colores de la vista del Responsable. */
  @Input() vistaResponsable = false;

  /** Muestra «x de y cumplidas» junto a la barra. */
  @Input() mostrarTexto = true;

  /** «3 de 5 cumplidas» o «Sin actividades». */
  texto = '';

  /** Segmentos a dibujar. */
  segmentos: SegmentoAvance[] = [];

  /**
   * Recalcula el texto y los segmentos.
   */
  ngOnChanges(): void {
    const avance = calcularAvance(this.actividades);

    this.texto = avance.total === 0 ? 'Sin actividades' : avance.cumplidas + ' de ' + avance.total + ' cumplidas';
    this.segmentos = this.actividades.map((a) => ({
      id: a.id,
      tono: mapearEstadoActividadATono(a.estado, this.vistaResponsable),
      titulo: a.descripcion + ' · ' + textoEstadoActividad(a.estado, this.vistaResponsable)
    }));
  }
}
