import { Component, Input, OnDestroy } from '@angular/core';
import { FormularioCI } from '../../../core/models';
import { ConfirmacionTemporal } from '../../../core/utils/confirmacion-temporal';
import {
    BadgePnipComponent
} from '../../../shared/components/badge-pnip/badge-pnip.component';
import {
    IconoPnipComponent
} from '../../../shared/components/icono-pnip/icono-pnip.component';
import { FechaLargaPipe } from '../../../shared/pipes/fecha-larga.pipe';
import { NombreFormalPipe } from '../../../shared/pipes/nombre-formal.pipe';
import {
    TablaFamiliaresComponent
} from '../tabla-familiares/tabla-familiares.component';

/**
 * Cuerpo del modal «ver formulario»: datos del declarante, familiares
 * declarados y boton «Descargar PDF».
 *
 * «Descargar PDF» solo muestra una confirmacion: generar el archivo esta
 * fuera del alcance del front mientras no haya backend.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-detalle-formulario',
    imports: [
        BadgePnipComponent,
        IconoPnipComponent,
        TablaFamiliaresComponent,
        FechaLargaPipe,
        NombreFormalPipe
    ],
    templateUrl: './detalle-formulario.component.html',
    styleUrl: './detalle-formulario.component.scss'
})
export class DetalleFormularioComponent implements OnDestroy {
    /** Formulario a mostrar. */
    @Input({ required: true }) formulario!: FormularioCI;

    /** Confirmacion de «Descargar PDF». */
    readonly descargado = new ConfirmacionTemporal();

    /**
     * Muestra la confirmacion de descarga. No se deshabilita el boton (se
     * usa `aria-disabled`): un boton deshabilitado pierde el foco y, dentro
     * del modal, el foco saldria de la trampa.
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
