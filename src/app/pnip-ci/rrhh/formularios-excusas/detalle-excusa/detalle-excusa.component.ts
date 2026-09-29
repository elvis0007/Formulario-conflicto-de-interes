import { Component, Input, OnDestroy } from '@angular/core';
import { Excusa } from '../../../core/models';
import { ConfirmacionTemporal } from '../../../core/utils/confirmacion-temporal';
import {
    BadgePnipComponent
} from '../../../shared/components/badge-pnip/badge-pnip.component';
import {
    IconoPnipComponent
} from '../../../shared/components/icono-pnip/icono-pnip.component';
import { FechaLargaPipe } from '../../../shared/pipes/fecha-larga.pipe';
import { NombreFormalPipe } from '../../../shared/pipes/nombre-formal.pipe';

/**
 * Cuerpo del modal «ver excusa»: todos los datos del formulario de excusa y
 * boton «Descargar PDF» (solo confirmacion visual, sin archivo real).
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-detalle-excusa',
    imports: [BadgePnipComponent, IconoPnipComponent, FechaLargaPipe,
        NombreFormalPipe],
    templateUrl: './detalle-excusa.component.html',
    // Misma presentacion que el detalle de formulario. Literal unico: el
    // compilador de Angular no admite rutas concatenadas.
    styleUrl: '../../formularios-conflicto-interes/detalle-formulario/detalle-formulario.component.scss'
})
export class DetalleExcusaComponent implements OnDestroy {
    /** Excusa a mostrar. */
    @Input({ required: true }) excusa!: Excusa;

    /** Confirmacion de «Descargar PDF». */
    readonly descargado = new ConfirmacionTemporal();

    /**
     * Muestra la confirmacion de descarga (ver `DetalleFormularioComponent`
     * sobre por que no se deshabilita el boton).
     */
    descargar(): void {
        if (!this.descargado.activa) {
            this.descargado.disparar();
        }
    }

    /**
     * Detiene el temporizador de la confirmacion.
     */
    ngOnDestroy(): void {
        this.descargado.cancelar();
    }
}
