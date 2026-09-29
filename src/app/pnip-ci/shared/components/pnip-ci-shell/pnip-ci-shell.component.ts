import {
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    inject
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Selector de la cabecera de la app host (`HeaderComponent`). */
const SELECTOR_CABECERA_HOST = 'app-header';

/** Variable CSS con el alto real de la cabecera del host, en px. */
const VARIABLE_ALTO_CABECERA = '--alto-cabecera-host';

/**
 * Contenedor de todas las pantallas del modulo PNIP-CI.
 *
 * - Aplica en su `:host` los tokens de diseno y la tipografia Barlow, de
 *   modo que solo afecten a lo que se pinta dentro de su `<router-outlet>`.
 * - Convive con la cabecera y el pie de la app host: se pinta en el flujo
 *   normal de la pagina, entre ambos. Mide el alto REAL de la cabecera del
 *   host (que es sticky y puede crecer si su titulo ocupa dos lineas) y lo
 *   publica en `--alto-cabecera-host`, para que el sidebar y la barra
 *   superior del modulo se fijen justo debajo de ella.
 *
 * Solo lee el tamano de la cabecera del host; no la modifica.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-ci-shell',
    imports: [RouterOutlet],
    templateUrl: './pnip-ci-shell.component.html',
    styleUrl: './pnip-ci-shell.component.scss'
})
export class PnipCiShellComponent implements OnInit, OnDestroy {
    private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

    /** Observador del tamano de la cabecera del host. */
    private observador: ResizeObserver | null = null;

    /**
     * Empieza a seguir el alto de la cabecera del host.
     */
    ngOnInit(): void {
        const cabecera = document.querySelector<HTMLElement>(
            SELECTOR_CABECERA_HOST
        );

        this.publicarAlto(cabecera);

        if (cabecera === null || typeof ResizeObserver === 'undefined') {
            return;
        }

        try {
            this.observador = new ResizeObserver(
                () => this.publicarAlto(cabecera)
            );
            this.observador.observe(cabecera);
        } catch (err) {
            console.error(
                '[PnipCiShellComponent.ngOnInit] No se pudo observar la '
                + 'cabecera del host:',
                err
            );
        }
    }

    /**
     * Deja de observar la cabecera.
     */
    ngOnDestroy(): void {
        this.observador?.disconnect();
        this.observador = null;
    }

    /**
     * Publica el alto de la cabecera en `--alto-cabecera-host`.
     *
     * @param cabecera Cabecera del host, o `null` si no existe (p. ej. en
     * /login no se pinta): entonces el alto es 0.
     */
    private publicarAlto(cabecera: HTMLElement | null): void {
        const alto = cabecera ? cabecera.getBoundingClientRect().height : 0;

        this.elemento.nativeElement.style.setProperty(
            VARIABLE_ALTO_CABECERA,
            Math.round(alto) + 'px'
        );
    }
}
