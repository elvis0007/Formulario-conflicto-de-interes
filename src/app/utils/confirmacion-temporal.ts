/** Tiempo por defecto que se muestra la confirmacion, en ms. */
const DURACION_POR_DEFECTO_MS = 2000;

/**
 * Estado de una confirmacion visual pasajera: un boton cambia a
 * «Exportado ✓» durante unos segundos y vuelve a su texto normal.
 *
 * Se usa para acciones que todavia no hacen nada real (Exportar,
 * Descargar PDF) mientras no hay backend. El componente debe llamar a
 * `cancelar()` en `ngOnDestroy` para no dejar temporizadores vivos.
 *
 * Uso:
 * ```ts
 * readonly exportado = new ConfirmacionTemporal();
 * exportar(): void { this.exportado.disparar(); }
 * ```
 * ```html
 * {{ exportado.activa ? 'Exportado ✓' : 'Exportar' }}
 * ```
 *
 * @author Elvis Flores
 */
export class ConfirmacionTemporal {
    /** Si la confirmacion esta visible. */
    activa = false;

    /** Temporizador en curso. */
    private temporizador: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param duracionMs Tiempo que se muestra la confirmacion.
     */
    constructor(private readonly duracionMs = DURACION_POR_DEFECTO_MS) {
    }

    /**
     * Muestra la confirmacion (reinicia el tiempo si ya estaba visible).
     */
    disparar(): void {
        this.limpiarTemporizador();
        this.activa = true;
        this.temporizador = setTimeout(() => {
            this.activa = false;
            this.temporizador = null;
        }, this.duracionMs);
    }

    /**
     * Oculta la confirmacion y detiene el temporizador.
     */
    cancelar(): void {
        this.limpiarTemporizador();
        this.activa = false;
    }

    /**
     * Detiene el temporizador en curso, si lo hay.
     */
    private limpiarTemporizador(): void {
        if (this.temporizador !== null) {
            clearTimeout(this.temporizador);
            this.temporizador = null;
        }
    }
}
