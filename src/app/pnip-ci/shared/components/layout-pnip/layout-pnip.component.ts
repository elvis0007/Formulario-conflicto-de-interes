import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { RolPnipCiService } from '../../../core/services/rol-pnip-ci.service';
import { ItemMenu } from '../sidebar-pnip/item-menu';
import { SidebarPnipComponent } from '../sidebar-pnip/sidebar-pnip.component';
import { TopbarPnipComponent } from '../topbar-pnip/topbar-pnip.component';

/** Clave de `Route.data` con el menu (`ItemMenu[]`) del layout. */
export const DATO_MENU = 'menu';

/**
 * Layout de una seccion del modulo: sidebar + barra superior + contenido.
 *
 * DECISION: un solo layout parametrizado en vez de un shell para RRHH y
 * otro para Responsable. Lo unico que cambia entre ambos es el menu, que se
 * pasa por `data.menu` de la ruta (`MENU_RRHH` / `MENU_RESPONSABLE`); dos
 * componentes serian dos copias de la misma estructura.
 *
 * @author EEASA
 */
@Component({
    selector: 'app-pnip-layout',
    imports: [RouterOutlet, SidebarPnipComponent, TopbarPnipComponent],
    templateUrl: './layout-pnip.component.html',
    styleUrl: './layout-pnip.component.scss'
})
export class LayoutPnipComponent {
    private readonly ruta = inject(ActivatedRoute);
    private readonly rolService = inject(RolPnipCiService);

    /** Menu de la seccion, tomado de `data.menu`. */
    readonly menu: readonly ItemMenu[] =
        (this.ruta.snapshot.data[DATO_MENU] as ItemMenu[] | undefined) ?? [];

    /** Nombre del usuario para el pie del sidebar. */
    readonly nombreUsuario = this.rolService.obtenerNombreUsuario();

    /** Rol del usuario para el pie del sidebar. */
    readonly rolUsuario = this.rolService.obtenerEtiquetaRol();

    /** Iniciales del avatar del sidebar. */
    readonly inicialesUsuario = this.rolService.obtenerIniciales();
}
