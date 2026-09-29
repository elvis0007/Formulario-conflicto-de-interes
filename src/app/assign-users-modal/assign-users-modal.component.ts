import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { BackendService, PersonalDto, DepartamentoDto, CrearRolUsuarioPayload, PaginatedPersonalResponse } from '../services/backend.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-assign-users-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-users-modal.component.html',
  styleUrl: './assign-users-modal.component.scss'
})
export class AssignUsersModalComponent implements OnInit {
  @Input() rolType!: 'A' | 'R';
  @Input() rolId!: number | null;
  @Output() closed = new EventEmitter<void>();
  @Output() usuariosAsignados = new EventEmitter<void>();

  personal: PersonalDto[] = [];
  personalCompleto: PersonalDto[] = [];
  personalFiltrado: PersonalDto[] = [];
  departamentos: DepartamentoDto[] = [];
  selectedDepartamento: string = '';
  searchTerm: string = '';
  selectedUsers: Set<string> = new Set();
  loading: boolean = false;
  error: string | null = null;

  currentPage: number = 0;
  itemsPerPage: number = 5;
  totalItems: number = 0;
  totalPages: number = 0;
  isFirstPage: boolean = true;
  isLastPage: boolean = false;
  tieneFiltros: boolean = false;

  private authService = inject(AuthService);

  constructor(private backendService: BackendService) {}

  ngOnInit(): void {
    if (!this.authService.isAdminRole()) {
      this.error = 'Solo los administradores pueden acceder a esta funcionalidad.';
      return;
    }
    this.loadData();
  }

  loadData(): void {
    // Si ya tenemos todos los datos cargados, solo aplicar filtros
    if (this.personalCompleto.length > 0) {
      this.applyFilters();
      return;
    }

    this.loading = true;
    this.error = null;

    // Cargar todos los datos una sola vez al inicio
    this.backendService.getPersonal(0, 10000).subscribe({
      next: (response: PaginatedPersonalResponse) => {
        this.personalCompleto = response.datos || [];
        this.personal = this.personalCompleto;
        this.loadDepartamentos();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('[AssignUsersModal] Error al cargar personal:', err);
        this.error = 'No se pudo cargar la lista de usuarios.';
        this.loading = false;
      }
    });
  }

  loadDepartamentos(): void {
    // Si ya tenemos los datos cargados, extraer departamentos de ellos
    if (this.personalCompleto.length > 0) {
      const departamentosSet = new Set<string>();
      this.personalCompleto.forEach(p => {
        if (p.DEPARTAMENTO && p.DEPARTAMENTO.trim()) {
          departamentosSet.add(p.DEPARTAMENTO);
        }
      });
      this.departamentos = Array.from(departamentosSet)
        .sort()
        .map(d => ({ CODIGO: d, NOMBRE: d }));
      return;
    }

    // Si no tenemos datos, cargarlos (esto solo debería pasar si loadData no se ha ejecutado)
    this.backendService.getPersonal(0, 10000).subscribe({
      next: (response: PaginatedPersonalResponse) => {
        const allPersonal = response.datos || [];
        const departamentosSet = new Set<string>();
        allPersonal.forEach(p => {
          if (p.DEPARTAMENTO && p.DEPARTAMENTO.trim()) {
            departamentosSet.add(p.DEPARTAMENTO);
          }
        });
        this.departamentos = Array.from(departamentosSet)
          .sort()
          .map(d => ({ CODIGO: d, NOMBRE: d }));
      },
      error: (err) => {
        console.error('[AssignUsersModal] Error al cargar departamentos:', err);
      }
    });
  }

  applyFilters(): void {
    // Los filtros se aplican sobre todos los datos cargados
    let filtered = [...this.personalCompleto];

    if (this.selectedDepartamento && this.selectedDepartamento.trim()) {
      filtered = filtered.filter(p => 
        p.DEPARTAMENTO && p.DEPARTAMENTO.toLowerCase() === this.selectedDepartamento.toLowerCase()
      );
    }

    if (this.searchTerm && this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(p =>
        (p.NOMBRE_COMPLETO && p.NOMBRE_COMPLETO.toLowerCase().includes(search)) ||
        (p.CARGO && p.CARGO.toLowerCase().includes(search))
      );
    }

    // Aplicar paginación del cliente sobre los resultados filtrados
    this.totalItems = filtered.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.isFirstPage = this.currentPage === 0;
    this.isLastPage = this.currentPage >= this.totalPages - 1 || this.totalPages === 0;
    
    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.personalFiltrado = filtered.slice(start, end);
  }

  onDepartamentoChange(): void {
    this.currentPage = 0;
    // Si ya tenemos los datos cargados, solo aplicar filtros (más rápido)
    if (this.personalCompleto.length > 0) {
      this.applyFilters();
    } else {
      // Si no tenemos datos, cargarlos
      this.loadData();
    }
  }

  onSearchChange(): void {
    this.currentPage = 0;
    // Si ya tenemos los datos cargados, solo aplicar filtros (más rápido)
    if (this.personalCompleto.length > 0) {
      this.applyFilters();
    } else {
      // Si no tenemos datos, cargarlos
      this.loadData();
    }
  }

  toggleUserSelection(codigo: string): void {
    if (this.selectedUsers.has(codigo)) {
      this.selectedUsers.delete(codigo);
    } else {
      this.selectedUsers.add(codigo);
    }
  }

  isUserSelected(codigo: string): boolean {
    return this.selectedUsers.has(codigo);
  }


  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      // Siempre aplicar filtros (paginación del cliente) ya que tenemos todos los datos
      this.applyFilters();
    }
  }

  changeItemsPerPage(): void {
    this.currentPage = 0;
    // Siempre aplicar filtros (paginación del cliente) ya que tenemos todos los datos
    this.applyFilters();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    
    if (total <= 7) {
      for (let i = 0; i < total; i++) {
        pages.push(i);
      }
    } else {
      if (this.currentPage <= 2) {
        for (let i = 0; i <= 3; i++) pages.push(i);
        pages.push(-1);
        pages.push(total - 1);
      } else if (this.currentPage >= total - 3) {
        pages.push(0);
        pages.push(-1);
        for (let i = total - 4; i < total; i++) pages.push(i);
      } else {
        pages.push(0);
        pages.push(-1);
        for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) pages.push(i);
        pages.push(-1);
        pages.push(total - 1);
      }
    }
    
    return pages;
  }

  asignarUsuarios(): void {
    if (!this.rolId) {
      this.error = 'No se puede asignar el rol, el ID del rol no está configurado.';
      return;
    }

    if (this.selectedUsers.size === 0) {
      this.error = 'Seleccione al menos un usuario para asignar el rol.';
      return;
    }

    this.loading = true;
    this.error = null;

    const asignaciones: Observable<any>[] = [];
    this.selectedUsers.forEach(codigo => {
      const payload: CrearRolUsuarioPayload = {
        ROL_CODIGO: this.rolId!,
        PERSONAL_CODIGO: codigo
      };
      asignaciones.push(this.backendService.assignRolToUsuario(payload));
    });

    forkJoin(asignaciones).subscribe({
      next: () => {
        this.loading = false;
        this.selectedUsers.clear();
        this.usuariosAsignados.emit();
      },
      error: (err) => {
        console.error('[AssignUsersModal] Error al asignar roles:', err);
        this.loading = false;
        this.error = 'No se pudieron asignar los roles a algunos usuarios. Intente nuevamente.';
      }
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  get modalTitle(): string {
    return this.rolType === 'A' ? 'Asignar Administradores' : 'Asignar Jefes de Recursos Humanos';
  }

  toggleSelectAll(): void {
    if (this.selectedUsers.size === this.personalFiltrado.length) {
      this.personalFiltrado.forEach(u => this.selectedUsers.delete(u.CODIGO));
    } else {
      this.personalFiltrado.forEach(u => this.selectedUsers.add(u.CODIGO));
    }
  }
}
