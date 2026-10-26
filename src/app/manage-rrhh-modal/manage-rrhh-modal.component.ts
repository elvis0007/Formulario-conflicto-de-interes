import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BackendService,
  RolDto,
  RolUsuarioDto,
  CrearRolUsuarioPayload,
  PersonalDto,
  PaginatedPersonalResponse
} from '../services/backend.service';
import { AuthService } from '../services/auth.service';
import { AssignUsersModalComponent } from '../assign-users-modal/assign-users-modal.component';

@Component({
  selector: 'app-manage-rrhh-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AssignUsersModalComponent],
  templateUrl: './manage-rrhh-modal.component.html',
  styleUrl: './manage-rrhh-modal.component.scss'
})
export class ManageRrhhModalComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();

  rolesLoading: boolean = false;
  rolesError: string | null = null;
  personalLoading: boolean = false;

  roles: RolDto[] = [];
  jefeRRHHRolId: number | null = null;
  adminRolId: number | null = null;
  jefesRRHH: RolUsuarioDto[] = [];
  admins: RolUsuarioDto[] = [];
  showAssignUsersModal: boolean = false;
  selectedRolType: 'A' | 'R' | null = null;
  personalCompleto: PersonalDto[] = [];
  expandedAdmin: boolean = false;
  expandedRRHH: boolean = false;

  authService = inject(AuthService);

  constructor(private backendService: BackendService) {}

  ngOnInit(): void {
    this.loadPersonalCompleto();
  }

  private loadPersonalCompleto(): void {
    this.personalLoading = true;
    this.backendService.getPersonal(0, 10000).subscribe({
      next: (response: PaginatedPersonalResponse) => {
        this.personalCompleto = response.datos || [];
        this.personalLoading = false;
        // Una vez cargado el personal, cargar los roles
        this.loadRolesYJefes();
      },
      error: (err) => {
        console.error('[ManageRrhhModal] Error al cargar personal completo:', err);
        this.personalLoading = false;
        // Aún así intentar cargar los roles
        this.loadRolesYJefes();
      }
    });
  }

  getNombrePersonal(codigoPersonal: string): string {
    // Si aún se está cargando el personal, no mostrar nada o mostrar un placeholder
    if (this.personalLoading || this.personalCompleto.length === 0) {
      return 'Cargando...';
    }
    const personal = this.personalCompleto.find(p => p.CODIGO === codigoPersonal);
    return personal ? personal.NOMBRE_COMPLETO : codigoPersonal;
  }

  onClose(): void {
    this.closed.emit();
  }

  private loadRolesYJefes(): void {
    if (!this.authService.isAuthenticated()) {
      this.rolesError = 'No está autenticado. Por favor inicie sesión.';
      this.rolesLoading = false;
      return;
    }

    // [PNIP-CI] Sebas Constante - 26/10/2026
    // Qué hace: el token propio de SISCI se guarda como TOKEN-SISCI y el
    //   usuario como USUARIO-SISCI (antes TOKEN-SISTEC / USUARIO-SISTEC;
    //   alineado con el backend, svn r4079).
    const token = localStorage.getItem('TOKEN-SISCI') || localStorage.getItem('TOKEN-INTRANET');
    // [FIN PNIP-CI]
    console.log('[ManageRrhhModal] Token disponible:', !!token);
    console.log('[ManageRrhhModal] Usuario autenticado:', this.authService.getCurrentUser());

    this.rolesLoading = true;
    this.rolesError = null;

    this.backendService.getRoles().subscribe({
      next: (roles) => {
        console.log('[ManageRrhhModal] Roles obtenidos:', roles);
        this.roles = roles || [];
        const rolJefe = this.roles.find((r) => r.ABREVIATURA === 'R');
        const rolAdmin = this.roles.find((r) => r.ABREVIATURA === 'A');
        console.log('[ManageRrhhModal] Rol Jefe encontrado:', rolJefe);
        console.log('[ManageRrhhModal] Rol Admin encontrado:', rolAdmin);
        this.jefeRRHHRolId = rolJefe ? rolJefe.CODIGO : null;
        this.adminRolId = rolAdmin ? rolAdmin.CODIGO : null;

        if (this.jefeRRHHRolId == null) {
          this.rolesError =
            'No se encontró el rol R: JEFE DE RECURSOS HUMANOS en la tabla de roles.';
          this.rolesLoading = false;
          return;
        }

        let cargasCompletadas = 0;
        const totalCargas = (this.jefeRRHHRolId ? 1 : 0) + (this.adminRolId ? 1 : 0);

        const verificarCompletado = () => {
          cargasCompletadas++;
          if (cargasCompletadas >= totalCargas) {
            this.rolesLoading = false;
          }
        };

        if (this.jefeRRHHRolId != null) {
          console.log('[ManageRrhhModal] Buscando usuarios con rol Jefe RRHH ID:', this.jefeRRHHRolId);
          this.backendService.getRolUsuariosByRol(this.jefeRRHHRolId).subscribe({
            next: (asignaciones) => {
              console.log('[ManageRrhhModal] Asignaciones Jefes RRHH obtenidas:', asignaciones);
              this.jefesRRHH = asignaciones || [];
              verificarCompletado();
            },
            error: (err) => {
              console.error('[ManageRrhhModal] Error al cargar Jefes de RRHH:', err);
              console.error('[ManageRrhhModal] Error completo:', JSON.stringify(err, null, 2));
              const mensajeError = err?.error?.mensaje || err?.error?.message || err?.message || 'No se pudieron cargar los Jefes de RRHH.';
              this.rolesError = `Error: ${mensajeError}`;
              if (err?.status === 401 || err?.status === 403) {
                this.rolesError = 'No tiene permisos para acceder a esta información. Verifique su autenticación.';
              }
              verificarCompletado();
            }
          });
        }

        if (this.adminRolId != null) {
          console.log('[ManageRrhhModal] Buscando usuarios con rol Admin ID:', this.adminRolId);
          this.backendService.getRolUsuariosByRol(this.adminRolId).subscribe({
            next: (asignaciones) => {
              console.log('[ManageRrhhModal] Asignaciones Admin obtenidas:', asignaciones);
              this.admins = asignaciones || [];
              verificarCompletado();
            },
            error: (err) => {
              console.error('[ManageRrhhModal] Error al cargar Admins:', err);
              console.error('[ManageRrhhModal] Error completo:', JSON.stringify(err, null, 2));
              if (!this.rolesError) {
                const mensajeError = err?.error?.mensaje || err?.error?.message || err?.message || 'No se pudieron cargar los Admins.';
                this.rolesError = `Error: ${mensajeError}`;
                if (err?.status === 401 || err?.status === 403) {
                  this.rolesError = 'No tiene permisos para acceder a esta información. Verifique su autenticación.';
                }
              }
              verificarCompletado();
            }
          });
        }
      },
      error: (err) => {
        console.error('[ManageRrhhModal] Error al cargar roles:', err);
        console.error('[ManageRrhhModal] Error completo:', JSON.stringify(err, null, 2));
        const mensajeError = err?.error?.mensaje || err?.error?.message || err?.message || 'No se pudieron cargar los roles.';
        this.rolesError = `Error: ${mensajeError}`;
        if (err?.status === 401 || err?.status === 403) {
          this.rolesError = 'No tiene permisos para acceder a esta información. Verifique su autenticación.';
        }
        this.rolesLoading = false;
      }
    });
  }

  toggleAdminSection(): void {
    if (this.expandedAdmin) {
      this.expandedAdmin = false;
    } else {
      this.expandedAdmin = true;
      this.expandedRRHH = false;
    }
  }

  toggleRRHHSection(): void {
    if (this.expandedRRHH) {
      this.expandedRRHH = false;
    } else {
      this.expandedRRHH = true;
      this.expandedAdmin = false;
    }
  }

  abrirModalAsignarUsuarios(rolType: 'A' | 'R'): void {
    if (!this.authService.isAdminRole()) {
      this.rolesError = 'Solo los administradores pueden asignar roles a usuarios.';
      return;
    }
    this.selectedRolType = rolType;
    this.showAssignUsersModal = true;
  }

  cerrarModalAsignarUsuarios(): void {
    this.showAssignUsersModal = false;
    this.selectedRolType = null;
  }

  onUsuariosAsignados(): void {
    this.cerrarModalAsignarUsuarios();
    // Recargar los roles y mantener la sección expandida
    const mantenerAdmin = this.expandedAdmin;
    const mantenerRRHH = this.expandedRRHH;
    this.loadRolesYJefes();
    // Restaurar el estado expandido después de cargar
    setTimeout(() => {
      this.expandedAdmin = mantenerAdmin;
      this.expandedRRHH = mantenerRRHH;
    }, 100);
  }

  eliminarJefeRRHH(asignacion: RolUsuarioDto): void {
    if (!asignacion.CODIGO) {
      return;
    }

    const adminsBackup = [...this.admins];
    const jefesBackup = [...this.jefesRRHH];

    if (asignacion.ROL_CODIGO === this.adminRolId) {
      this.admins = this.admins.filter(a => a.CODIGO !== asignacion.CODIGO);
    } else if (asignacion.ROL_CODIGO === this.jefeRRHHRolId) {
      this.jefesRRHH = this.jefesRRHH.filter(j => j.CODIGO !== asignacion.CODIGO);
    }

    this.rolesError = null;

    this.backendService.deleteRolUsuario(asignacion.CODIGO).subscribe({
      next: () => {
      },
      error: (err) => {
        console.error('[ManageRrhhModal] Error al eliminar rol:', err);
        this.admins = adminsBackup;
        this.jefesRRHH = jefesBackup;
        this.rolesError =
          err?.error?.mensaje ||
          err?.message ||
          'No se pudo eliminar la asignación.';
      }
    });
  }
}

