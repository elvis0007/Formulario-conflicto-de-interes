import { EstadoSeguimiento, EventoHistorial } from '../../../models';
import { ActividadRecienteApi, EstadoSeguimientoApi, ProcesoApi } from '../../../models/api';
import { AUTOR_SISTEMA, EventoReciente, TipoEvento } from '../../../utils/historial.util';

/**
 * Funciones puras que convierten la línea de tiempo y la actividad reciente
 * del backend a los eventos del Historial.
 *
 * @author Integración backend
 */

/** Texto de cada estado de seguimiento en los eventos. */
const TEXTO_ESTADO: Readonly<Record<EstadoSeguimiento, string>> = {
  DETECTADO: 'Detectado',
  EN_ANALISIS: 'En análisis',
  EN_PLANIFICACION: 'En planificación',
  EN_EJECUCION: 'En ejecución',
  FINALIZADO: 'Finalizado',
  DESCARTADO: 'Descartado'
};

/**
 * @param estado Estado al que pasa el conflicto.
 * @returns Categoría visual: los estados finales son «cierre».
 */
function tipoDeEstado(estado: EstadoSeguimientoApi | null): TipoEvento {
  if (estado === 'FINALIZADO' || estado === 'DESCARTADO') {
    return 'cierre';
  }
  return estado === null || estado === 'DETECTADO' ? 'info' : 'ok';
}

/**
 * @param anterior Estado de origen (`null` en la detección).
 * @param nuevo Estado de destino.
 * @param comentario Justificación de RRHH, si la hay.
 * @returns Frase del cambio de estado, con el comentario al final.
 */
function textoTransicion(
  anterior: EstadoSeguimientoApi | null,
  nuevo: EstadoSeguimientoApi | null,
  comentario: string | null
): string {
  const destino = nuevo === null ? '' : TEXTO_ESTADO[nuevo];
  const base = anterior === null
    ? destino + '.'
    : TEXTO_ESTADO[anterior] + ' → ' + destino + '.';

  return comentario === null || comentario.trim() === '' ? base : base + ' ' + comentario.trim();
}

/**
 * Cada fila de la línea de tiempo es un cambio de estado del conflicto; la
 * primera (sin estado anterior) es la detección.
 *
 * @param api Fila de `LINEA_DE_TIEMPO`.
 * @param conflictoId Id del conflicto dueño de la línea.
 * @returns Evento de nivel conflicto.
 * @author Integración backend
 */
export function mapearProceso(api: ProcesoApi, conflictoId: string): EventoHistorial {
  return {
    fecha: api.FECHA ?? '',
    autor: api.USUARIO ?? AUTOR_SISTEMA,
    texto: textoTransicion(api.ESTADO_ANTERIOR, api.ESTADO_NUEVO, api.COMENTARIO),
    tipo: tipoDeEstado(api.ESTADO_NUEVO),
    nivel: 'conflicto',
    refId: conflictoId
  };
}

/**
 * @param api Movimiento de `GET /conflictos/actividad-reciente`.
 * @returns Evento reciente, con los nombres de las dos personas en el texto.
 * @author Integración backend
 */
export function mapearActividadReciente(api: ActividadRecienteApi): EventoReciente {
  const conflictoId = String(api.CONFLICTO_ID ?? '');
  const personas = [api.NOMBRE_A, api.NOMBRE_B].filter((n): n is string => n !== null).join(' y ');
  const transicion = textoTransicion(api.ESTADO_ANTERIOR, api.ESTADO_NUEVO, api.COMENTARIO);

  return {
    evento: {
      fecha: api.FECHA ?? '',
      autor: api.USUARIO ?? AUTOR_SISTEMA,
      texto: personas === '' ? transicion : personas + ': ' + transicion,
      tipo: tipoDeEstado(api.ESTADO_NUEVO),
      nivel: 'conflicto',
      refId: conflictoId
    },
    conflictoId: conflictoId === '' ? null : conflictoId
  };
}
