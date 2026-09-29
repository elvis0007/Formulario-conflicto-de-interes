import {
    Component,
    DestroyRef,
    Input,
    OnChanges,
    OnInit,
    inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { ItemMenu, buscarGrupo, buscarItemActivo } from './item-menu';

/**
 * Menu lateral del modulo (240 px). Recibe su menu por `@Input`, asi que
 * el mismo componente sirve para RRHH y para Responsable.
 *
 * - El item activo se calcula con `buscarItemActivo` (por prefijo de URL),
 *   no con `routerLinkActive`: asi una pantalla fuera del menu, como Plan de
 *   Accion, puede resaltar «Análisis de Conflictos».
 * - Al cargar o navegar, el grupo que contiene el item activo se expande.
 *   Los demas grupos se abren y cierran a mano.
 * - Al pie muestra iniciales, nombre y rol del usuario.
 *
 * @author EEASA
 */
@Component({
    selector: 'app-pnip-sidebar',
    imports: [RouterLink],
    templateUrl: './sidebar-pnip.component.html',
    styleUrl: './sidebar-pnip.component.scss'
})
export class SidebarPnipComponent implements OnInit, OnChanges {
    /** Items del menu. */
    @Input({ required: true }) menu: readonly ItemMenu[] = [];

    /** Nombre del usuario para el pie. */
    @Input() nombreUsuario = '';

    /** Rol del usuario para el pie. */
    @Input() rolUsuario = '';

    /** Iniciales del avatar; si no se pasan, se sacan de `nombreUsuario`. */
    @Input() inicialesUsuario = '';

    /** Hoja que corresponde a la URL actual. */
    itemActivo: ItemMenu | null = null;

    /** Grupos desplegados. */
    readonly expandidos = new Set<ItemMenu>();

    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Calcula el item activo y se suscribe a la navegacion.
     */
    ngOnInit(): void {
        this.actualizar(this.router.url);
        this.router.events.pipe(
            filter((e): e is NavigationEnd => e instanceof NavigationEnd),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (e) => this.actualizar(e.urlAfterRedirects),
            error: (err: unknown) => console.error(
                '[SidebarPnipComponent.ngOnInit] Error de navegacion:', err
            )
        });
    }

    /**
     * Recalcula el item activo si cambia el menu.
     */
    ngOnChanges(): void {
        this.actualizar(this.router.url);
    }

    /**
     * @returns `inicialesUsuario`, o las dos primeras letras de las dos
     * primeras palabras del nombre si no se pasaron.
     */
    get iniciales(): string {
        if (this.inicialesUsuario !== '') {
            return this.inicialesUsuario;
        }

        return this.nombreUsuario
            .split(/\s+/)
            .filter((parte) => parte.length > 0)
            .slice(0, 2)
            .map((parte) => parte[0].toUpperCase())
            .join('');
    }

    /**
     * @param grupo Grupo del menu.
     * @returns `true` si el grupo contiene el item activo.
     */
    contieneActivo(grupo: ItemMenu): boolean {
        return buscarGrupo(this.menu, this.itemActivo) === grupo;
    }

    /**
     * Abre o cierra un grupo.
     *
     * @param grupo Grupo pulsado.
     */
    alternarGrupo(grupo: ItemMenu): void {
        if (this.expandidos.has(grupo)) {
            this.expandidos.delete(grupo);
        } else {
            this.expandidos.add(grupo);
        }
    }

    /**
     * Actualiza el item activo y expande su grupo.
     *
     * @param url URL activa.
     */
    private actualizar(url: string): void {
        const activo = buscarItemActivo(this.menu, url);
        const grupo = buscarGrupo(this.menu, activo);

        this.itemActivo = activo;
        if (grupo !== null) {
            this.expandidos.add(grupo);
        }
    }
}
