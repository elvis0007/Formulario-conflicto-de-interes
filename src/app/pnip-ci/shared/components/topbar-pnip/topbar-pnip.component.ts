import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
    NotificationBellPnipComponent
} from '../notification-bell-pnip/notification-bell-pnip.component';
import { obtenerBreadcrumb } from './breadcrumb';

/**
 * Barra superior del modulo (64 px): migas de pan a la izquierda, leidas de
 * `data.breadcrumb` de la ruta activa, y campana de notificaciones a la
 * derecha.
 *
 * @author Elvis Flores
 */
@Component({
    selector: 'app-pnip-topbar',
    imports: [NotificationBellPnipComponent],
    templateUrl: './topbar-pnip.component.html',
    styleUrl: './topbar-pnip.component.scss'
})
export class TopbarPnipComponent implements OnInit {
    /** Migas de pan de la pantalla actual. */
    migas: string[] = [];

    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Calcula las migas y las actualiza en cada navegacion.
     */
    ngOnInit(): void {
        this.actualizar();
        this.router.events.pipe(
            filter((e) => e instanceof NavigationEnd),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: () => this.actualizar(),
            error: (err: unknown) => console.error(
                '[TopbarPnipComponent.ngOnInit] Error de navegacion:', err
            )
        });
    }

    /**
     * Lee las migas de la ruta activa.
     */
    private actualizar(): void {
        this.migas = obtenerBreadcrumb(this.router.routerState.snapshot.root);
    }
}
