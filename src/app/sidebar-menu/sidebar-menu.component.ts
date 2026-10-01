import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MENU_RESPONSABLE, MENU_RRHH } from './menu-items';
import { ItemMenu, buscarGrupo, buscarItemActivo } from './item-menu';

type SidebarSection = 'form' | 'list';

/**
 * PNIP-CI: descarga del formulario de excusa. Es el mismo archivo y la misma
 * forma que usa AdminComponent.downloadExcusePdf(); se usa solo cuando el
 * menú está fuera de /admin (nadie escucha `excuseClicked`).
 */
const RUTA_PDF_EXCUSA = '/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sidebar-menu.component.html',
  styleUrl: './sidebar-menu.component.scss'
})
export class SidebarMenuComponent implements OnInit, OnChanges {
  // PNIP-CI: `null` cuando el menú está fuera de /admin (en /rrhh o
  // /responsable), donde ninguna de las dos vistas de AdminComponent está
  // activa.
  @Input() activeSection: SidebarSection | null = 'form';
  @Input() canViewList: boolean = false;


  collapsed = true;
  private isMobileViewport = false;

  @Output() formClicked = new EventEmitter<void>();
  @Output() excuseClicked = new EventEmitter<void>();
  @Output() listClicked = new EventEmitter<void>();

  // ==================================================================
  // PNIP-CI: menú ampliado (Dashboard, Formularios ▸, Conflicto ▸,
  // Informe General, Revisión de Evidencias, Historial) y distinto según
  // el rol. Los ítems nuevos son rutas; los 3 botones de «Formularios» son
  // los de siempre.
  // ==================================================================
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
  // FIN PNIP-CI
  // ==================================================================

  ngOnInit(): void {
    this.updateViewportState();

    // PNIP-CI: el rol sale de AuthService.hasRole(), igual que en rolGuard
    // y en AdminComponent.
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
  }

  // PNIP-CI: dentro de /admin, el grupo «Formularios» se abre solo, porque
  // una de sus opciones es la activa.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeSection'] && this.activeSection !== null) {
      this.gruposAbiertos.add('Formularios');
    }
  }

  // PNIP-CI: si nadie escucha el evento (menú fuera de /admin), navega a
  // /admin con la vista del formulario. Dentro de /admin se emite como
  // siempre y AdminComponent hace lo mismo que antes.
  onFormClick(): void {
    if (this.formClicked.observed) {
      this.formClicked.emit();
      return;
    }
    this.router.navigate(['/admin'], { queryParams: { vista: 'formulario' } });
  }

  // PNIP-CI: fuera de /admin descarga el mismo PDF que AdminComponent.
  onExcuseClick(): void {
    if (this.excuseClicked.observed) {
      this.excuseClicked.emit();
      return;
    }
    this.descargarPdfExcusa();
  }

  // PNIP-CI: fuera de /admin navega a /admin, que para RRHH abre la lista.
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

  // ==================================================================
  // PNIP-CI: grupos, ítem activo y descarga fuera de /admin.
  // ==================================================================

  /** Abre o cierra un grupo. */
  alternarGrupo(etiqueta: string): void {
    if (this.gruposAbiertos.has(etiqueta)) {
      this.gruposAbiertos.delete(etiqueta);
    } else {
      this.gruposAbiertos.add(etiqueta);
    }
  }

  /** El grupo se resalta si contiene la opción activa. */
  grupoActivo(grupo: ItemMenu): boolean {
    if (grupo.formulariosHost) {
      return this.activeSection !== null;
    }
    return buscarGrupo(this.menu, this.itemActivo) === grupo;
  }

  /**
   * Calcula el ítem activo por prefijo de URL (así Plan de Acción resalta
   * «Análisis de Conflictos») y abre su grupo.
   */
  private actualizarItemActivo(url: string): void {
    const activo = buscarItemActivo(this.menu, url);
    const grupo = buscarGrupo(this.menu, activo);

    this.itemActivo = activo;
    if (grupo !== null) {
      this.gruposAbiertos.add(grupo.etiqueta);
    }
  }

  private descargarPdfExcusa(): void {
    const link = document.createElement('a');
    link.href = RUTA_PDF_EXCUSA;
    link.download = 'FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  // FIN PNIP-CI
  // ==================================================================
}
