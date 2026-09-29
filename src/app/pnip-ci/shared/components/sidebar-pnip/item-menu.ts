/**
 * Entrada del menu lateral. Es una hoja (con `ruta`) o un grupo
 * desplegable (con `hijos`).
 *
 * @author Elvis Flores
 */
export interface ItemMenu {
    /** Texto visible. */
    etiqueta: string;
    /** Ruta absoluta de la pantalla (solo hojas). */
    ruta?: string;
    /**
     * Prefijos de URL de pantallas que NO estan en el menu pero deben
     * resaltar este item (p. ej. Plan de Accion resalta «Análisis de
     * Conflictos»). Solo se usan si ninguna hoja coincide por su propia ruta.
     */
    prefijosAdicionales?: string[];
    /** Items de un grupo desplegable. */
    hijos?: ItemMenu[];
}

/** Prioridad de una coincidencia: por ruta propia gana a prefijo extra. */
const PRIORIDAD_RUTA_PROPIA = 2;
const PRIORIDAD_PREFIJO_ADICIONAL = 1;

/**
 * Devuelve las hojas del menu (entra en los grupos).
 *
 * @param menu Menu completo.
 * @returns Items con `ruta`, en orden.
 */
export function obtenerHojas(menu: readonly ItemMenu[]): ItemMenu[] {
    return menu.flatMap((item) => item.hijos ? obtenerHojas(item.hijos) : [item]);
}

/**
 * Indica si `url` es `prefijo` o cuelga de el como segmento completo
 * (`/a/b` coincide con `/a/b` y `/a/b/c`, pero no con `/a/bc`).
 *
 * @param url URL sin query ni fragmento.
 * @param prefijo Ruta o prefijo a comparar.
 * @returns `true` si coincide.
 */
function coincidePrefijo(url: string, prefijo: string): boolean {
    const base = prefijo.endsWith('/') ? prefijo.slice(0, -1) : prefijo;

    return url === base || url.startsWith(base + '/');
}

/**
 * Busca el UNICO item del menu que debe verse activo para una URL,
 * comparando prefijos (no igualdad exacta):
 *
 * 1. Gana la hoja cuya `ruta` es prefijo de la URL (la mas larga si hay
 *    varias). Asi `/pnip/responsable/planes/PL-1` resalta «Bandeja de
 *    Tareas» (`/pnip/responsable/planes`).
 * 2. Si ninguna coincide por ruta propia, gana la hoja con el
 *    `prefijosAdicionales` mas largo que coincida. Asi
 *    `/pnip/rrhh/conflictos/C-1/planes/PL-1` (Plan de Accion, fuera del
 *    menu) resalta «Análisis de Conflictos», mientras que
 *    `/pnip/rrhh/conflictos/consulta-previa` sigue resaltando «Consulta
 *    Previa» por la regla 1.
 *
 * @param menu Menu completo.
 * @param url URL activa (se ignoran query y fragmento).
 * @returns Hoja activa, o `null` si ninguna coincide.
 */
export function buscarItemActivo(
    menu: readonly ItemMenu[],
    url: string
): ItemMenu | null {
    const limpia = url.split(/[?#]/)[0];
    let mejor: ItemMenu | null = null;
    let mejorPrioridad = 0;
    let mejorLargo = -1;

    for (const hoja of obtenerHojas(menu)) {
        const candidatos: { prefijo: string; prioridad: number }[] = [];

        if (hoja.ruta) {
            candidatos.push({
                prefijo: hoja.ruta,
                prioridad: PRIORIDAD_RUTA_PROPIA
            });
        }
        for (const prefijo of hoja.prefijosAdicionales ?? []) {
            candidatos.push({
                prefijo,
                prioridad: PRIORIDAD_PREFIJO_ADICIONAL
            });
        }

        for (const { prefijo, prioridad } of candidatos) {
            const esMejor = prioridad > mejorPrioridad
                || (prioridad === mejorPrioridad
                    && prefijo.length > mejorLargo);

            if (coincidePrefijo(limpia, prefijo) && esMejor) {
                mejor = hoja;
                mejorPrioridad = prioridad;
                mejorLargo = prefijo.length;
            }
        }
    }

    return mejor;
}

/**
 * Grupo que contiene a un item.
 *
 * @param menu Menu completo.
 * @param item Item buscado.
 * @returns El grupo de primer nivel que lo contiene, o `null`.
 */
export function buscarGrupo(
    menu: readonly ItemMenu[],
    item: ItemMenu | null
): ItemMenu | null {
    if (item === null) {
        return null;
    }

    return menu.find((g) => g.hijos && obtenerHojas(g.hijos).includes(item))
        ?? null;
}
