import { Component, Input } from '@angular/core';
import { FamiliarDeclarado } from '../../../core/models';
import {
    BadgePnipComponent
} from '../../../shared/components/badge-pnip/badge-pnip.component';

/**
 * Tabla compacta de los familiares declarados en un formulario. Se usa en
 * la fila desplegada del listado y dentro del modal del formulario.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-tabla-familiares',
    imports: [BadgePnipComponent],
    templateUrl: './tabla-familiares.component.html',
    styleUrl: './tabla-familiares.component.scss'
})
export class TablaFamiliaresComponent {
    /** Familiares a mostrar. */
    @Input({ required: true }) familiares: readonly FamiliarDeclarado[] = [];
}
