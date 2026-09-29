import { Component } from '@angular/core';
import {
    VitrinaPnipComponent
} from '../../shared/components/vitrina-pnip/vitrina-pnip.component';

/**
 * Resumen general del modulo para RRHH.
 *
 * PLACEHOLDER: solo muestra el nombre de la pantalla y, temporalmente, la
 * vitrina de componentes compartidos del Dia 3.
 *
 * @author EEASA
 */
@Component({
    selector: 'app-pnip-rrhh-dashboard',
    imports: [VitrinaPnipComponent],
    template: '<h2>Dashboard RRHH</h2><app-pnip-vitrina />'
})
export class RrhhDashboardComponent {
}
