import { Component } from '@angular/core';
import { EstadoActividad, EstadoPlan, Riesgo } from '../../../core/models';
import {
    Tono,
    mapearEstadoActividadATono,
    mapearEstadoPlanATono,
    mapearRiesgoATono
} from '../../../core/utils/tono.util';
import { BadgePnipComponent } from '../badge-pnip/badge-pnip.component';
import { KpiCardComponent } from '../kpi-card/kpi-card.component';
import { ModalPnipComponent } from '../modal-pnip/modal-pnip.component';
import { OpcionPill, PillsPnipComponent } from '../pills-pnip/pills-pnip.component';

/**
 * TEMPORAL (Dia 3). Muestra los componentes compartidos para revisarlos en
 * el navegador mientras no hay pantallas reales. Se elimina cuando se
 * construya el dashboard de RRHH.
 *
 * @author EEASA
 */
@Component({
    selector: 'app-pnip-vitrina',
    imports: [
        BadgePnipComponent,
        KpiCardComponent,
        ModalPnipComponent,
        PillsPnipComponent
    ],
    templateUrl: './vitrina-pnip.component.html',
    styleUrl: './vitrina-pnip.component.scss'
})
export class VitrinaPnipComponent {
    /** Riesgos de ejemplo. */
    readonly riesgos: readonly Riesgo[] = ['alto', 'medio', 'bajo', 'ninguno'];

    /** Estados de plan de ejemplo. */
    readonly estadosPlan: readonly EstadoPlan[] =
        ['borrador', 'activo', 'activo_vencidas', 'cerrado'];

    /** Estados de actividad de ejemplo. */
    readonly estadosActividad: readonly EstadoActividad[] =
        ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'vencida'];

    /** Filtros de ejemplo para las pildoras. */
    readonly filtros: OpcionPill[] = [
        { valor: 'todos', etiqueta: 'Todos', contador: 8 },
        { valor: 'alto', etiqueta: 'Alto', contador: 2, tono: 'rojo' },
        { valor: 'medio', etiqueta: 'Medio', contador: 3, tono: 'ambar' },
        { valor: 'bajo', etiqueta: 'Bajo', contador: 2, tono: 'verde' },
        { valor: 'ninguno', etiqueta: 'Ninguno', contador: 1, tono: 'gris' }
    ];

    /** Filtro elegido en pildoras y KPIs. */
    filtro = 'todos';

    /** Modal abierto: `null`, `normal` o `ancho`. */
    modal: 'normal' | 'ancho' | null = null;

    readonly tonoRiesgo = mapearRiesgoATono;
    readonly tonoPlan = mapearEstadoPlanATono;

    /**
     * @param estado Estado de actividad.
     * @param vistaResponsable Si es la vista del responsable.
     * @returns Tono de la insignia.
     */
    tonoActividad(estado: EstadoActividad, vistaResponsable: boolean): Tono {
        return mapearEstadoActividadATono(estado, vistaResponsable);
    }

    /**
     * Alterna el filtro de un KPI (clic en el activo lo quita).
     *
     * @param valor Filtro del KPI.
     */
    alternarFiltro(valor: string): void {
        this.filtro = this.filtro === valor ? 'todos' : valor;
    }
}
