import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Contenedor de todas las pantallas del modulo PNIP-CI.
 *
 * Su unica responsabilidad por ahora es aplicar, en su `:host`, los tokens
 * de diseno y la tipografia Barlow, de modo que solo afecten a lo que se
 * pinta dentro de su `<router-outlet>` y no al resto de la aplicacion.
 *
 * @author EEASA
 */
@Component({
    selector: 'app-pnip-ci-shell',
    imports: [RouterOutlet],
    templateUrl: './pnip-ci-shell.component.html',
    styleUrl: './pnip-ci-shell.component.scss'
})
export class PnipCiShellComponent {
}
