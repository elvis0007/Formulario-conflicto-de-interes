/**
 * Sobres genéricos de respuesta del backend (wssisci).
 *
 * Regla de nombres JSON, confirmada en el Java:
 * - El sobre `ApiResponseDto` va en minúsculas: `estado`, `mensaje`, `datos`.
 * - Los DTO de salida del módulo de conflictos llevan `@JsonProperty` en MAYÚSCULAS con
 *   guion bajo (p. ej. `ESTADO_SEGUIMIENTO`). No hay `@JsonNaming` ni estrategia global.
 * - Los DTO de entrada (requests JSON) NO llevan `@JsonProperty`: van en camelCase.
 *
 * Fechas (Jackson con `WRITE_DATES_AS_TIMESTAMPS` desactivado, ver `JacksonConfig`):
 * - `LocalDate` llega como `"yyyy-MM-dd"`.
 * - `LocalDateTime` llega como ISO-8601 sin zona, p. ej. `"2026-10-13T10:15:30.123456"`
 *   (la fracción de segundo puede faltar o tener hasta 9 dígitos).
 *
 * @author Sebas Constante
 */

/** Valor de `estado` en el sobre de respuesta. */
export type EstadoRespuestaApi = 'OK' | 'ERROR';

/**
 * Sobre que envuelve todas las respuestas JSON del backend.
 * `ApiResponseDto` usa `@JsonInclude(NON_NULL)`: `mensaje` y `datos` se omiten si son null.
 * En errores (400, 403, 404, 409) `estado` es `'ERROR'` y `mensaje` trae el texto para el usuario.
 */
export interface RespuestaApi<T> {
  estado: EstadoRespuestaApi;
  mensaje?: string;
  datos?: T;
}

/**
 * Página de resultados (`PaginatedResponseDto`). Va dentro de `RespuestaApi.datos`.
 * `PAGINA_ACTUAL` empieza en 0. El tamaño máximo de página es 200 (`Paginas.TAMANO_MAXIMO`).
 * Ojo: la clave del tamaño lleva eñe: `TAMAÑO_PAGINA`.
 */
export interface PaginaApi<T> {
  DATOS: T[];
  PAGINA_ACTUAL: number;
  'TAMAÑO_PAGINA': number;
  TOTAL_ELEMENTOS: number;
  TOTAL_PAGINAS: number;
  ES_PRIMERA: boolean;
  ES_ULTIMA: boolean;
}
