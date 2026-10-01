// [PNIP-CI] Elvis Flores - 30/09/2026
// Qué hace: imports del menú ampliado (rutas, rol del usuario e ítems de
// gestión de conflictos). Al import de @angular/core se agregan DestroyRef,
// OnChanges, SimpleChanges e inject.
import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MENU_RESPONSABLE, MENU_RRHH } from './menu-items';
import { ItemMenu, buscarGrupo, buscarItemActivo } from './item-menu';
// [FIN PNIP-CI]

type SidebarSection = 'form' | 'list';

// [PNIP-CI] Elvis Flores - 30/09/2026
// Qué hace: ruta del PDF de excusa para descargarlo fuera de /admin.
/**
 * Descarga del formulario de excusa. Es el mismo archivo y la misma forma
 * que usa AdminComponent.downloadExcusePdf(); se usa solo cuando el menú
 * está fuera de /admin (nadie escucha `excuseClicked`).
 */
const RUTA_PDF_EXCUSA = '/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
// [FIN PNIP-CI]

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: agrega RouterLink (los ítems nuevos son enlaces).
  imports: [CommonModule, RouterLink],
  // [FIN PNIP-CI]
  templateUrl: './sidebar-menu.component.html',
  styleUrl: './sidebar-menu.component.scss'
})
// [PNIP-CI] Elvis Flores - 30/09/2026
// Qué hace: la clase implementa además OnChanges (ver ngOnChanges) y
// activeSection admite `null`: así se usa fuera de /admin (en /rrhh o
// /responsable), donde ninguna de las dos vistas de AdminComponent está
// activa.
export class SidebarMenuComponent implements OnInit, OnChanges {
  @Input() activeSection: SidebarSection | null = 'form';
  // [FIN PNIP-CI]
  @Input() canViewList: boolean = false;


  collapsed = true;
  private isMobileViewport = false;

  @Output() formClicked = new EventEmitter<void>();
  @Output() excuseClicked = new EventEmitter<void>();
  @Output() listClicked = new EventEmitter<void>();

  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: estado del menú ampliado (Dashboard, Formularios ▸,
  // Conflicto ▸, Informe General, Revisión de Evidencias, Historial),
  // distinto según el rol. Los ítems nuevos son rutas; los 3 botones de
  // «Formularios» son los de siempre.
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** RRHH (roles R o A): ve el menú completo. El resto, el de Responsable. */
  esRrhh = false;

  /** Ítems del menú según el rol. */
  menu: readonly ItemMenu[] = MENU_RESPONSABLE;

  /** Ítem (ruta) que corresponde a la URL actual. */
  itemActivo: ItemMenu | null = null;

  /** Grupos desplegados, por etiqueta. */
  readonly gruposAbiertos = new Set<string>();
  // [FIN PNIP-CI]

  ngOnInit(): void {
    this.updateViewportState();

    // [PNIP-CI] Elvis Flores - 30/09/2026
    // Qué hace: elige el menú según el rol (sale de AuthService.hasRole(),
    // igual que en rolGuard y en AdminComponent) y sigue la URL para
    // resaltar el ítem activo.
    this.esRrhh = this.authService.hasRole('R') || this.authService.hasRole('A');
    this.menu = this.esRrhh ? MENU_RRHH : MENU_RESPONSABLE;
    this.actualizarItemActivo(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (e) => this.actualizarItemActivo(e.urlAfterRedirects),
        error: (err: unknown) => console.error('[SidebarMenuComponent] Navegación:', err)
      });
    // [FIN PNIP-CI]
  }

  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: dentro de /admin, el grupo «Formularios» se abre solo, porque
  // una de sus opciones es la activa.
  /**
   * Abre el grupo «Formularios» cuando AdminComponent indica una sección.
   *
   * @param changes Cambios de los inputs.
   * @author Elvis Flores
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeSection'] && this.activeSection !== null) {
      this.gruposAbiertos.add('Formularios');
    }
  }
  // [FIN PNIP-CI]

  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: los 3 botones de siempre. Si nadie escucha su evento (menú
  // fuera de /admin): el formulario navega a /admin?vista=formulario, la
  // excusa descarga el mismo PDF que AdminComponent y «Ver Formularios»
  // navega a /admin. Dentro de /admin se emiten como siempre y
  // AdminComponent hace lo mismo que antes.
  onFormClick(): void {
    if (this.formClicked.observed) {
      this.formClicked.emit();
      return;
    }
    this.router.navigate(['/admin'], { queryParams: { vista: 'formulario' } });
  }

  onExcuseClick(): void {
    if (this.excuseClicked.observed) {
      this.excuseClicked.emit();
      return;
    }
    this.descargarPdfExcusa();
  }

  onListClick(): void {
    if (!this.canViewList) {
      return;
    }
    if (this.listClicked.observed) {
      this.listClicked.emit();
      return;
    }
    this.router.navigate(['/admin']);
  }
  // [FIN PNIP-CI]

  // Deslizar el menú al pasar el mouse sin afectar el resto del layout.
  onMouseEnter(): void {
    if (this.isMobileViewport) {
      return;
    }
    this.collapsed = false;
  }

  onMouseLeave(): void {
    if (this.isMobileViewport) {
      return;
    }
    this.collapsed = true;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  private updateViewportState(): void {
    this.isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768;
    this.collapsed = !this.isMobileViewport;
  }

  // [PNIP-CI] Elvis Flores - 30/09/2026
  // Qué hace: grupos desplegables, ítem activo y descarga fuera de /admin.

  /**
   * Abre o cierra un grupo.
   *
   * @param etiqueta Etiqueta del grupo.
   * @author Elvis Flores
   */
  alternarGrupo(etiqueta: string): void {
    if (this.gruposAbiertos.has(etiqueta)) {
      this.gruposAbiertos.delete(etiqueta);
    } else {
      this.gruposAbiertos.add(etiqueta);
    }
  }

  /**
   * El grupo se resalta si contiene la opción activa.
   *
   * @param grupo Grupo del menú.
   * @returns `true` si alguna de sus opciones es la activa.
   * @author Elvis Flores
   */
  grupoActivo(grupo: ItemMenu): boolean {
    if (grupo.formulariosHost) {
      return this.activeSection !== null;
    }
    return buscarGrupo(this.menu, this.itemActivo) === grupo;
  }

  /**
   * Calcula el ítem activo por prefijo de URL (así Plan de Acción resalta
   * «Análisis de Conflictos») y abre su grupo.
   *
   * @param url URL actual.
   * @author Elvis Flores
   */
  private actualizarItemActivo(url: string): void {
    const activo = buscarItemActivo(this.menu, url);
    const grupo = buscarGrupo(this.menu, activo);

    this.itemActivo = activo;
    if (grupo !== null) {
      this.gruposAbiertos.add(grupo.etiqueta);
    }
  }

  /**
   * Descarga el PDF del formulario de excusa.
   *
   * @author Elvis Flores
   */
  private descargarPdfExcusa(): void {
    const link = document.createElement('a');
    link.href = RUTA_PDF_EXCUSA;
    link.download = 'FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  // [FIN PNIP-CI]
}
