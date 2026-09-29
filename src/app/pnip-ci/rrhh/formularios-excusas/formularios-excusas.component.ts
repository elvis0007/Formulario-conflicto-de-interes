import {
    Component,
    DestroyRef,
    OnDestroy,
    OnInit,
    inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Excusa } from '../../core/models';
import { CatalogosMockService } from '../../core/services/catalogos-mock.service';
import { ExcusasMockService } from '../../core/services/excusas-mock.service';
import { ConfirmacionTemporal } from '../../core/utils/confirmacion-temporal';
import {
    FiltrosExcusas,
    filtrarExcusas,
    filtrosExcusasVacios
} from '../../core/utils/filtros-listados.util';
import {
    BadgePnipComponent
} from '../../shared/components/badge-pnip/badge-pnip.component';
import {
    ColumnaTabla,
    DataTablePnipComponent
} from '../../shared/components/data-table-pnip/data-table-pnip.component';
import {
    DetallePnipDirective,
    FilaPnipDirective
} from '../../shared/components/data-table-pnip/plantillas-tabla';
import {
    EmptyStatePnipComponent
} from '../../shared/components/empty-state-pnip/empty-state-pnip.component';
import {
    ExpandArrowButtonPnipComponent
} from '../../shared/components/expand-arrow-button-pnip/expand-arrow-button-pnip.component';
import {
    IconoPnipComponent
} from '../../shared/components/icono-pnip/icono-pnip.component';
import {
    ModalPnipComponent
} from '../../shared/components/modal-pnip/modal-pnip.component';
import { FechaLargaPipe } from '../../shared/pipes/fecha-larga.pipe';
import { NombreFormalPipe } from '../../shared/pipes/nombre-formal.pipe';
import { DetalleExcusaComponent } from './detalle-excusa/detalle-excusa.component';

/**
 * Formularios › Excusas (`/pnip/rrhh/formularios/excusas`).
 *
 * Mismo estilo que Formularios › Conflicto de Interés: banda «Excusas
 * recibidas (n)», filtros combinados (origen, tipo de proceso, fechas,
 * texto), Exportar (solo confirmacion), tabla con fila desplegable (motivo y
 * reemplazo) y modal con la excusa completa.
 *
 * El catalogo de tipos de proceso es PROVISIONAL (ver `catalogos.data.ts`).
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-formularios-excusas',
    imports: [
        FormsModule,
        BadgePnipComponent,
        DataTablePnipComponent,
        DetalleExcusaComponent,
        DetallePnipDirective,
        EmptyStatePnipComponent,
        ExpandArrowButtonPnipComponent,
        FilaPnipDirective,
        IconoPnipComponent,
        ModalPnipComponent,
        FechaLargaPipe,
        NombreFormalPipe
    ],
    templateUrl: './formularios-excusas.component.html',
    styleUrl: './formularios-excusas.component.scss'
})
export class FormulariosExcusasComponent implements OnInit, OnDestroy {
    /** Todas las excusas. */
    excusas: Excusa[] = [];

    /** Excusas que cumplen los filtros. */
    filtradas: Excusa[] = [];

    /** Si las excusas se estan cargando. */
    cargando = true;

    /** Opciones del filtro de tipo de proceso (catalogo provisional). */
    tiposProceso: string[] = [];

    /** Filtros actuales. */
    filtros: FiltrosExcusas = filtrosExcusasVacios();

    /** Excusa abierta en el modal; `null` si esta cerrado. */
    excusaAbierta: Excusa | null = null;

    /** Confirmacion de «Exportar». */
    readonly exportado = new ConfirmacionTemporal();

    /** Cabeceras de la tabla. */
    readonly columnas: ColumnaTabla[] = [
        { titulo: 'Nombre' },
        { titulo: 'Cédula' },
        { titulo: 'Origen' },
        { titulo: 'Proceso' },
        { titulo: 'Familiar relacionado' },
        { titulo: 'Fecha' },
        { titulo: 'Acciones', ancho: '100px' }
    ];

    /** Clave de fila para la tabla. */
    readonly clave = (e: Excusa): string => e.id;

    private readonly excusasService = inject(ExcusasMockService);
    private readonly catalogos = inject(CatalogosMockService);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Carga excusas y catalogo.
     */
    ngOnInit(): void {
        this.catalogos.obtenerTiposProcesoExcusa()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (tipos) => this.tiposProceso = tipos,
                error: (err: unknown) => console.error(
                    '[FormulariosExcusasComponent] Catalogo:', err
                )
            });

        this.excusasService.obtenerExcusas()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (lista) => {
                    this.excusas = lista;
                    this.cargando = false;
                    this.aplicarFiltros();
                },
                error: (err: unknown) => {
                    console.error('[FormulariosExcusasComponent] Excusas:', err);
                    this.cargando = false;
                }
            });
    }

    /**
     * Detiene el temporizador de la confirmacion.
     */
    ngOnDestroy(): void {
        this.exportado.cancelar();
    }

    /**
     * @returns `true` si algun filtro tiene valor.
     */
    get hayFiltros(): boolean {
        const vacios = filtrosExcusasVacios();

        return (Object.keys(vacios) as (keyof FiltrosExcusas)[])
            .some((clave) => this.filtros[clave] !== vacios[clave]);
    }

    /**
     * Recalcula la lista con todos los filtros.
     */
    aplicarFiltros(): void {
        this.filtradas = filtrarExcusas(this.excusas, this.filtros);
    }

    /**
     * Quita todos los filtros.
     */
    limpiarFiltros(): void {
        this.filtros = filtrosExcusasVacios();
        this.aplicarFiltros();
    }

    /**
     * Muestra la confirmacion de exportado (sin generar archivo).
     */
    exportar(): void {
        if (!this.exportado.activa) {
            this.exportado.disparar();
        }
    }
}
