/**
 * Utilidades puras de fechas de la gestión de conflictos.
 *
 * Todas trabajan con fechas de calendario (sin hora) en hora local, para
 * que el cambio de zona horaria nunca mueva un dia.
 *
 * @author Elvis Flores
 */

/** Milisegundos de un dia. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Fecha ISO `aaaa-mm-dd`, con o sin hora a continuacion. */
const PATRON_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

/** Fecha `dd/mm/aaaa`. */
const PATRON_DMA = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Resultado de `calcularDiasRestantes`.
 */
export interface DiasRestantes {
  /** Texto para mostrar: `Vence en n días`, `Vence hoy`, `Vencida hace n días`. */
  texto: string;
  /** `true` si la fecha limite ya paso (hoy todavia no cuenta como vencida). */
  vencida: boolean;
  /** Dias hasta la fecha limite: positivo si falta, 0 hoy, negativo si vencio. */
  dias: number;
}

/**
 * Convierte una fecha de texto a `Date` a medianoche local.
 *
 * @param texto Fecha en `aaaa-mm-dd` (admite hora detras, que se ignora) o
 * en `dd/mm/aaaa`.
 * @returns La fecha a las 00:00 hora local.
 * @throws RangeError si el formato no es valido o la fecha no existe
 * (p. ej. `31/02/2026`).
 */
export function parsearFecha(texto: string): Date {
  const iso = PATRON_ISO.exec(texto);
  const dma = PATRON_DMA.exec(texto);
  let anio = 0;
  let mes = 0;
  let dia = 0;
  let fecha: Date;

  if (iso !== null) {
    anio = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (dma !== null) {
    dia = Number(dma[1]);
    mes = Number(dma[2]);
    anio = Number(dma[3]);
  } else {
    throw new RangeError('Formato de fecha no valido: ' + texto);
  }

  fecha = new Date(anio, mes - 1, dia);

  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1
    || fecha.getDate() !== dia) {
    throw new RangeError('La fecha no existe: ' + texto);
  }

  return fecha;
}

/**
 * Da formato `dd/mm/aaaa` a una fecha.
 *
 * @param fecha Fecha a formatear.
 * @returns Texto `dd/mm/aaaa`.
 */
export function formatearFecha(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');

  return dia + '/' + mes + '/' + fecha.getFullYear();
}

/**
 * Calcula la fecha limite de una actividad: inicio + meses + dias.
 *
 * Primero se suman los meses y despues los dias. Si el dia de inicio no
 * existe en el mes de destino, se usa el ultimo dia de ese mes
 * (31/01 + 1 mes = 28/02 o 29/02), en lugar de desbordar al mes siguiente
 * como haria `Date.setMonth`.
 *
 * @param fechaInicio Fecha de inicio del plan (`aaaa-mm-dd` o `dd/mm/aaaa`).
 * @param meses Meses de plazo (entero >= 0).
 * @param dias Dias de plazo (entero >= 0).
 * @returns Fecha limite en formato `dd/mm/aaaa`.
 * @throws RangeError si la fecha no es valida o el plazo no es un entero
 * no negativo.
 */
export function calcularFechaLimite(
  fechaInicio: string,
  meses: number,
  dias: number
): string {
  const inicio = parsearFecha(fechaInicio);
  const mesDestino = inicio.getMonth() + meses;
  let ultimoDiaMes = 0;
  let limite: Date;

  if (!Number.isInteger(meses) || !Number.isInteger(dias)
    || meses < 0 || dias < 0) {
    throw new RangeError(
      'Plazo no valido: ' + meses + ' meses, ' + dias + ' dias'
    );
  }

  ultimoDiaMes = new Date(inicio.getFullYear(), mesDestino + 1, 0)
    .getDate();
  limite = new Date(
    inicio.getFullYear(),
    mesDestino,
    Math.min(inicio.getDate(), ultimoDiaMes)
  );
  limite.setDate(limite.getDate() + dias);

  return formatearFecha(limite);
}

/**
 * Indica si una fecha esta dentro de un rango de dias, ambos extremos
 * incluidos. Compara solo la parte `aaaa-mm-dd`, como el filtro de fechas
 * de «Formularios recibidos» de la app host.
 *
 * @param fechaIso Fecha ISO (con o sin hora).
 * @param desde Inicio `aaaa-mm-dd` (valor de `<input type="date">`); vacio
 * = sin limite.
 * @param hasta Fin `aaaa-mm-dd`; vacio = sin limite.
 * @returns `true` si la fecha esta en el rango.
 */
export function estaEnRangoFechas(
  fechaIso: string,
  desde: string,
  hasta: string
): boolean {
  const dia = fechaIso.substring(0, 10);

  return (desde === '' || dia >= desde) && (hasta === '' || dia <= hasta);
}

/**
 * Indica si una fecha y hora cae dentro de los ultimos `dias` dias (se
 * cuentan periodos de 24 h hacia atras desde `ahora`).
 *
 * @param fechaIso Fecha ISO 8601, con hora.
 * @param dias Tamano de la ventana en dias.
 * @param ahora Momento de referencia; por defecto, el actual.
 * @returns `true` si esta dentro de la ventana; `false` si es anterior o
 * si la fecha no es valida.
 */
export function esDeUltimosDias(
  fechaIso: string,
  dias: number,
  ahora: Date = new Date()
): boolean {
  const momento = new Date(fechaIso).getTime();

  if (Number.isNaN(momento)) {
    return false;
  }

  return momento >= ahora.getTime() - dias * MS_POR_DIA;
}

/**
 * Calcula cuanto falta para una fecha limite, o cuanto hace que vencio.
 *
 * La fecha limite es el ultimo dia valido: si es hoy, la actividad aun no
 * esta vencida (`Vence hoy`).
 *
 * @param fechaLimite Fecha limite (`aaaa-mm-dd` o `dd/mm/aaaa`).
 * @param hoy Fecha de referencia; por defecto, la actual. Se ignora la hora.
 * @returns Texto, indicador de vencimiento y numero de dias.
 * @throws RangeError si `fechaLimite` no es una fecha valida.
 */
export function calcularDiasRestantes(
  fechaLimite: string,
  hoy: Date = new Date()
): DiasRestantes {
  const limite = parsearFecha(fechaLimite);
  const utcLimite = Date.UTC(
    limite.getFullYear(), limite.getMonth(), limite.getDate()
  );
  const utcHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dias = Math.round((utcLimite - utcHoy) / MS_POR_DIA);
  const cantidad = Math.abs(dias);
  const unidad = cantidad === 1 ? ' día' : ' días';

  if (dias > 0) {
    return { texto: 'Vence en ' + cantidad + unidad, vencida: false, dias };
  }
  if (dias === 0) {
    return { texto: 'Vence hoy', vencida: false, dias };
  }

  return {
    texto: 'Vencida hace ' + cantidad + unidad,
    vencida: true,
    dias
  };
}
