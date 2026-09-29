import {
    Component,
    DestroyRef,
    ElementRef,
    HostListener,
    OnInit,
    ViewChild,
    inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Notificacion } from '../../../core/models';
import {
    NotificacionesMockService
} from '../../../core/services/notificaciones-mock.service';
import { esDeUltimosDias } from '../../../core/utils/fechas.util';
import {
    Tono,
    mapearTipoNotificacionATono
} from '../../../core/utils/tono.util';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo.pipe';

/** Dias hacia atras que muestra el panel. */
const DIAS_VISIBLES = 7;

/**
 * Campana de notificaciones de la barra superior.
 *
 * - Contador rojo con las no leidas de los ultimos 7 dias.
 * - Al hacer clic abre un panel de 410 px con las notificaciones de los
 *   ultimos 7 dias (punto de color por `tipo`, titulo, texto y tiempo
 *   relativo); las no leidas llevan fondo tintado.
 * - «Marcar todas como leídas» actualiza el servicio y recarga.
 * - El panel se cierra con clic fuera o con Esc.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-notification-bell',
    imports: [TiempoRelativoPipe],
    templateUrl: './notification-bell-pnip.component.html',
    styleUrl: './notification-bell-pnip.component.scss'
})
export class NotificationBellPnipComponent implements OnInit {
    /** Si el panel esta desplegado. */
    abierto = false;

    /** Notificaciones de los ultimos `DIAS_VISIBLES` dias. */
    notificaciones: Notificacion[] = [];

    /** Texto fijo del pie del panel. */
    readonly textoPie = 'Se muestran las notificaciones de los últimos '
        + DIAS_VISIBLES + ' días';

    private readonly servicio = inject(NotificacionesMockService);
    private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);

    /** Boton de la campana, para devolverle el foco al cerrar con Esc. */
    @ViewChild('boton') private boton?: ElementRef<HTMLButtonElement>;

    /**
     * Carga las notificaciones.
     */
    ngOnInit(): void {
        this.cargar();
    }

    /**
     * @returns Numero de notificaciones sin leer.
     */
    get noLeidas(): number {
        return this.notificaciones.filter((n) => !n.leida).length;
    }

    /**
     * @returns Etiqueta accesible del boton de la campana.
     */
    get etiquetaBoton(): string {
        return this.noLeidas === 0
            ? 'Notificaciones'
            : 'Notificaciones, ' + this.noLeidas + ' sin leer';
    }

    /**
     * @param notificacion Notificacion a pintar.
     * @returns Tono del punto de color.
     */
    tono(notificacion: Notificacion): Tono {
        return mapearTipoNotificacionATono(notificacion.tipo);
    }

    /**
     * Abre o cierra el panel.
     */
    alternar(): void {
        this.abierto = !this.abierto;
    }

    /**
     * Marca todas como leidas y recarga la lista.
     */
    marcarTodas(): void {
        this.servicio.marcarTodasComoLeidas()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.cargar(),
                error: (err: unknown) => console.error(
                    '[NotificationBellPnipComponent.marcarTodas]', err
                )
            });
    }

    /**
     * Cierra el panel si el clic fue fuera del componente.
     *
     * @param evento Clic en cualquier parte del documento.
     */
    @HostListener('document:click', ['$event'])
    alClicDocumento(evento: MouseEvent): void {
        const destino = evento.target as Node | null;

        if (this.abierto && destino !== null
            && !this.elemento.nativeElement.contains(destino)) {
            this.abierto = false;
        }
    }

    /**
     * Cierra el panel con Esc y devuelve el foco a la campana.
     */
    @HostListener('document:keydown.escape')
    alPresionarEsc(): void {
        if (this.abierto) {
            this.abierto = false;
            this.boton?.nativeElement.focus();
        }
    }

    /**
     * Pide las notificaciones y se queda con las de los ultimos dias.
     */
    private cargar(): void {
        this.servicio.obtenerNotificaciones()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (lista) => {
                    this.notificaciones = lista.filter(
                        (n) => esDeUltimosDias(n.fecha, DIAS_VISIBLES)
                    );
                },
                error: (err: unknown) => console.error(
                    '[NotificationBellPnipComponent.cargar]', err
                )
            });
    }
}
