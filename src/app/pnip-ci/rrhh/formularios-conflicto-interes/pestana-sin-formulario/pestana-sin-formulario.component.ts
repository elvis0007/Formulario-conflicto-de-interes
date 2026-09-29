import {
    Component,
    DestroyRef,
    EventEmitter,
    OnInit,
    Output,
    inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmpleadoSinFormulario } from '../../../core/models';
import {
    FormulariosMockService
} from '../../../core/services/formularios-mock.service';
import {
    BadgePnipComponent
} from '../../../shared/components/badge-pnip/badge-pnip.component';
import {
    ColumnaTabla,
    DataTablePnipComponent
} from '../../../shared/components/data-table-pnip/data-table-pnip.component';
import {
    FilaPnipDirective
} from '../../../shared/components/data-table-pnip/plantillas-tabla';
import {
    EmptyStatePnipComponent
} from '../../../shared/components/empty-state-pnip/empty-state-pnip.component';
import {
    IconoPnipComponent
} from '../../../shared/components/icono-pnip/icono-pnip.component';
import { FechaLargaPipe } from '../../../shared/pipes/fecha-larga.pipe';
import { NombreFormalPipe } from '../../../shared/pipes/nombre-formal.pipe';

/**
 * Pestana «No han llenado formulario»: lista de personas pendientes y envio
 * de recordatorios, uno a uno o a todos.
 *
 * Sin backend no se envia ningun correo: el servicio simulado solo guarda
 * la fecha del recordatorio y el boton pasa a «Enviado ✓».
 *
 * Emite `total` al cargar, para el contador de la pestana.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-pestana-sin-formulario',
    imports: [
        BadgePnipComponent,
        DataTablePnipComponent,
        EmptyStatePnipComponent,
        FilaPnipDirective,
        IconoPnipComponent,
        FechaLargaPipe,
        NombreFormalPipe
    ],
    templateUrl: './pestana-sin-formulario.component.html',
    styleUrl: './pestana-sin-formulario.component.scss'
})
export class PestanaSinFormularioComponent implements OnInit {
    /** Se emite con el numero de personas pendientes al cargar. */
    @Output() total = new EventEmitter<number>();

    /** Personas que no han llenado el formulario. */
    empleados: EmpleadoSinFormulario[] = [];

    /** Si la lista se esta cargando. */
    cargando = true;

    /** Ids a los que ya se envio recordatorio en esta sesion. */
    readonly enviados = new Set<string>();

    /** Ids con un envio en curso. */
    readonly enviando = new Set<string>();

    /** Cabeceras de la tabla. */
    readonly columnas: ColumnaTabla[] = [
        { titulo: 'Nombre' },
        { titulo: 'Cédula' },
        { titulo: 'Origen' },
        { titulo: 'Cargo' },
        { titulo: 'Departamento' },
        { titulo: 'Recordatorio' },
        { titulo: 'Acciones', ancho: '190px' }
    ];

    /** Clave de fila para la tabla. */
    readonly clave = (e: EmpleadoSinFormulario): string => e.persona.id;

    private readonly servicio = inject(FormulariosMockService);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Carga la lista.
     */
    ngOnInit(): void {
        this.servicio.obtenerEmpleadosSinFormulario()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (lista) => {
                    this.empleados = lista;
                    this.cargando = false;
                    this.total.emit(lista.length);
                },
                error: (err: unknown) => {
                    console.error(
                        '[PestanaSinFormularioComponent.ngOnInit]', err
                    );
                    this.cargando = false;
                }
            });
    }

    /**
     * @returns `true` si ya se envio recordatorio a todos los de la lista.
     */
    get todosEnviados(): boolean {
        return this.empleados.length > 0
            && this.empleados.every((e) => this.enviados.has(e.persona.id));
    }

    /**
     * Envia un recordatorio a una persona.
     *
     * @param empleado Persona de la fila.
     */
    enviarUno(empleado: EmpleadoSinFormulario): void {
        this.enviar([empleado.persona.id]);
    }

    /**
     * Envia un recordatorio a todos los de la lista a quienes aun no se les
     * envio en esta sesion.
     */
    enviarATodos(): void {
        this.enviar(this.empleados
            .map((e) => e.persona.id)
            .filter((id) => !this.enviados.has(id)));
    }

    /**
     * Pide el envio al servicio y marca las filas al confirmarse.
     *
     * @param ids Ids de las personas.
     */
    private enviar(ids: string[]): void {
        const pendientes = ids.filter(
            (id) => !this.enviados.has(id) && !this.enviando.has(id)
        );

        if (pendientes.length === 0) {
            return;
        }

        pendientes.forEach((id) => this.enviando.add(id));
        this.servicio.enviarRecordatorio(pendientes)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (fecha) => this.marcarEnviados(pendientes, fecha),
                error: (err: unknown) => {
                    console.error(
                        '[PestanaSinFormularioComponent.enviar]', err
                    );
                    pendientes.forEach((id) => this.enviando.delete(id));
                }
            });
    }

    /**
     * Marca las filas como enviadas y actualiza su fecha de recordatorio.
     *
     * @param ids Ids enviados.
     * @param fecha Fecha del envio; `null` si el envio fallo.
     */
    private marcarEnviados(ids: string[], fecha: string | null): void {
        ids.forEach((id) => this.enviando.delete(id));

        if (fecha === null) {
            return;
        }

        for (const empleado of this.empleados) {
            if (ids.includes(empleado.persona.id)) {
                empleado.ultimoRecordatorio = fecha;
                this.enviados.add(empleado.persona.id);
            }
        }
    }
}
