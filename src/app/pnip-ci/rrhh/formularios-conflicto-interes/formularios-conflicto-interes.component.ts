import {
    Component,
    DestroyRef,
    OnDestroy,
    OnInit,
    inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FormularioCI } from '../../core/models';
import { CatalogosMockService } from '../../core/services/catalogos-mock.service';
import {
    FormulariosMockService
} from '../../core/services/formularios-mock.service';
import { ConfirmacionTemporal } from '../../core/utils/confirmacion-temporal';
import {
    FiltrosFormularios,
    filtrarFormularios,
    filtrosFormulariosVacios
} from '../../core/utils/filtros-listados.util';
import { Tono } from '../../core/utils/tono.util';
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
import {
    PestanaPnip,
    TabsPnipComponent
} from '../../shared/components/tabs-pnip/tabs-pnip.component';
import { FechaLargaPipe } from '../../shared/pipes/fecha-larga.pipe';
import { NombreFormalPipe } from '../../shared/pipes/nombre-formal.pipe';
import {
    DetalleFormularioComponent
} from './detalle-formulario/detalle-formulario.component';
import {
    PestanaSinFormularioComponent
} from './pestana-sin-formulario/pestana-sin-formulario.component';
import {
    TablaFamiliaresComponent
} from './tabla-familiares/tabla-familiares.component';

/** Pestanas de la pantalla. */
type PestanaFormularios = 'recibidos' | 'pendientes';

/** Prefijo de ids de pestanas y paneles. */
const ID_PESTANAS = 'formularios-ci';

/**
 * Formularios › Conflicto de Interés (`/pnip/rrhh/formularios/
 * conflicto-interes`), codigo PNIP.CI.RG.01.
 *
 * - «Formularios recibidos»: filtros combinados (origen, tipo de contrato,
 *   fechas, texto), Exportar, tabla con fila desplegable de familiares y
 *   modal con el formulario completo.
 * - «No han llenado formulario»: ver `PestanaSinFormularioComponent`.
 *
 * Estilo tomado de «Formularios recibidos» de la app host. Exportar solo
 * muestra una confirmacion: el archivo real queda para el backend.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-formularios-conflicto-interes',
    imports: [
        FormsModule,
        RouterLink,
        BadgePnipComponent,
        DataTablePnipComponent,
        DetallePnipDirective,
        DetalleFormularioComponent,
        EmptyStatePnipComponent,
        ExpandArrowButtonPnipComponent,
        FilaPnipDirective,
        IconoPnipComponent,
        ModalPnipComponent,
        PestanaSinFormularioComponent,
        TablaFamiliaresComponent,
        TabsPnipComponent,
        FechaLargaPipe,
        NombreFormalPipe
    ],
    templateUrl: './formularios-conflicto-interes.component.html',
    styleUrl: './formularios-conflicto-interes.component.scss'
})
export class FormulariosConflictoInteresComponent implements OnInit, OnDestroy {
    /** Prefijo de ids de pestanas y paneles (para la plantilla). */
    readonly idPestanas = ID_PESTANAS;

    /** Pestana visible. */
    pestana: PestanaFormularios = 'recibidos';

    /** Pestanas con sus contadores. */
    pestanas: PestanaPnip[] = this.crearPestanas(null);

    /** Todos los formularios recibidos. */
    formularios: FormularioCI[] = [];

    /** Formularios que cumplen los filtros. */
    filtrados: FormularioCI[] = [];

    /** Si los formularios se estan cargando. */
    cargando = true;

    /** Opciones del filtro de tipo de contrato (catalogo provisional). */
    tiposContrato: string[] = [];

    /** Filtros actuales. */
    filtros: FiltrosFormularios = filtrosFormulariosVacios();

    /** Formulario abierto en el modal; `null` si esta cerrado. */
    formularioAbierto: FormularioCI | null = null;

    /** Confirmacion de «Exportar». */
    readonly exportado = new ConfirmacionTemporal();

    /** Cabeceras de la tabla. */
    readonly columnas: ColumnaTabla[] = [
        { titulo: 'Nombre' },
        { titulo: 'Cédula' },
        { titulo: 'Origen' },
        { titulo: 'Tipo' },
        { titulo: 'Tipo de contrato' },
        { titulo: 'Fecha' },
        { titulo: 'Acciones', ancho: '100px' }
    ];

    /** Clave de fila para la tabla. */
    readonly clave = (f: FormularioCI): string => f.id;

    private readonly formulariosService = inject(FormulariosMockService);
    private readonly catalogos = inject(CatalogosMockService);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Carga formularios y catalogo.
     */
    ngOnInit(): void {
        this.catalogos.obtenerTiposContrato()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (tipos) => this.tiposContrato = tipos,
                error: (err: unknown) => console.error(
                    '[FormulariosConflictoInteresComponent] Catalogo:', err
                )
            });

        this.formulariosService.obtenerFormularios()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (lista) => {
                    this.formularios = lista;
                    this.cargando = false;
                    this.aplicarFiltros();
                },
                error: (err: unknown) => {
                    console.error(
                        '[FormulariosConflictoInteresComponent] Formularios:',
                        err
                    );
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
        const vacios = filtrosFormulariosVacios();

        return (Object.keys(vacios) as (keyof FiltrosFormularios)[])
            .some((clave) => this.filtros[clave] !== vacios[clave]);
    }

    /**
     * @param valor Valor de la pestana elegida.
     */
    cambiarPestana(valor: string): void {
        this.pestana = valor === 'pendientes' ? 'pendientes' : 'recibidos';
    }

    /**
     * Actualiza el contador de la pestana «No han llenado formulario».
     *
     * @param total Personas pendientes.
     */
    alCargarPendientes(total: number): void {
        this.pestanas = this.crearPestanas(total);
    }

    /**
     * Recalcula la lista con todos los filtros.
     */
    aplicarFiltros(): void {
        this.filtrados = filtrarFormularios(this.formularios, this.filtros);
    }

    /**
     * Quita todos los filtros.
     */
    limpiarFiltros(): void {
        this.filtros = filtrosFormulariosVacios();
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

    /**
     * @param origen Origen del declarante.
     * @returns Verde para internos, naranja para externos.
     */
    tonoOrigen(origen: FormularioCI['origen']): Tono {
        return origen === 'Interno' ? 'verde' : 'naranja';
    }

    /**
     * @param total Personas pendientes; `null` mientras se cargan.
     * @returns Pestanas de la pantalla.
     */
    private crearPestanas(total: number | null): PestanaPnip[] {
        return [
            { valor: 'recibidos', etiqueta: 'Formularios recibidos' },
            {
                valor: 'pendientes',
                etiqueta: 'No han llenado formulario',
                contador: total ?? undefined
            }
        ];
    }
}
