import {
  FuenteCoincidenciaApi,
  ParentescoApi,
  RiesgoApi,
  TipoConsultaApi,
  TipoGradoApi,
} from './enums-api';

/**
 * Interfaces de la consulta previa (aspirantes y proveedores), tal cual llegan del backend.
 *
 * @author Sebas Constante
 */

/**
 * Cuerpo JSON (camelCase) de `POST /consultas-previas`. Responde `ConsultaPreviaApi`.
 */
export interface CrearConsultaRequestApi {
  /** Obligatorio: `ASPIRANTE` o `PROVEEDOR`. */
  tipo: TipoConsultaApi;
  /** Obligatorio, cédula o RUC, máx. 20 caracteres. */
  cedula: string;
  /** Obligatorio, máx. 200 caracteres. */
  nombres: string;
  /** Máx. 200 caracteres. */
  nombrePadre?: string | null;
  /** Máx. 200 caracteres. */
  nombreMadre?: string | null;
  /** Máx. 200 caracteres. */
  nombreConyuge?: string | null;
  /** Máx. 300 caracteres. */
  empresa?: string | null;
}

/** Coincidencia hallada contra la nómina o las declaraciones (`CoincidenciaDto`). Anidada en `ConsultaPreviaApi`. */
export interface CoincidenciaApi {
  DMPER_CODIGO: string | null;
  CEDULA: string | null;
  NOMBRE: string | null;
  CARGO: string | null;
  DEPARTAMENTO: string | null;
  PARENTESCO: ParentescoApi | null;
  TIPO_GRADO: TipoGradoApi | null;
  GRADO: number | null;
  RIESGO: RiesgoApi | null;
  /** Decimal (BigDecimal), p. ej. 0.95. */
  CONFIANZA: number | null;
  FUENTE: FuenteCoincidenciaApi | null;
  DETALLE: string | null;
}

/**
 * Resultado de una consulta previa (`ConsultaPreviaDto`).
 * Devuelto por `POST /consultas-previas`.
 */
export interface ConsultaPreviaApi {
  TIPO: TipoConsultaApi | null;
  CEDULA: string | null;
  NOMBRES: string | null;
  NOMBRE_PADRE: string | null;
  NOMBRE_MADRE: string | null;
  NOMBRE_CONYUGE: string | null;
  EMPRESA: string | null;
  /** ISO-8601 sin zona. */
  FECHA: string | null;
  TOTAL_COINCIDENCIAS: number;
  /** Null si no hay coincidencias. */
  RIESGO_MAXIMO: RiesgoApi | null;
  /** true si la lista de coincidencias se recortó por un tope. */
  TRUNCADO: boolean;
  COINCIDENCIAS: CoincidenciaApi[] | null;
  ADVERTENCIAS: string[] | null;
}
