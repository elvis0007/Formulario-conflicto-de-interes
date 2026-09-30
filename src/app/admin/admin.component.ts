import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConflictFormComponent } from '../conflict-form/conflict-form.component';
import { BackendService, ModalidadContratoDto, PlantillaTemporalDto, PlantillaLecturaItem, SinArchivoConflictoItem } from '../services/backend.service';
import { ConflictoPdfService } from '../services/conflicto-pdf.service';
import { GenerateCodeModalComponent } from '../generate-code-modal/generate-code-modal.component';
import { ManageRrhhModalComponent } from '../manage-rrhh-modal/manage-rrhh-modal.component';
import * as XLSX from 'xlsx';
import { AuthService } from '../services/auth.service';
import { SidebarMenuComponent } from '../sidebar-menu/sidebar-menu.component';

@Component({
  selector: 'app-admin',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ConflictFormComponent,
    SidebarMenuComponent,
    GenerateCodeModalComponent,
    ManageRrhhModalComponent
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  forms: PlantillaTemporalDto[] = [];
  filteredForms: PlantillaTemporalDto[] = [];
  pagedForms: PlantillaTemporalDto[] = [];
  searchTerm: string = '';
  filterType: 'ALL' | 'I' | 'A' | 'F' = 'ALL';
  /**
   * Modalidad seleccionada. Es un código de nómina (DMGES15) o, para las
   * declaraciones anteriores al selector, el texto que guardaron ("Ocasional").
   * Un código nunca coincide con uno de esos textos, así que no hace falta
   * distinguirlos: se comparan los dos y gana el que corresponda.
   */
  filterEmploymentType: string = 'ALL';

  /** Catálogo de nómina, para armar las opciones del filtro. */
  modalidades: ModalidadContratoDto[] = [];
  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  pageSizeOptions: number[] = [5, 10, 15];
  pageSize: number = 10;
  currentPage: number = 1;
  totalPages: number = 1;
  showForm = false;
  showList = true;
  showCodeModal = false;
  showPdfErrorModal = false;
  sidebarCollapsed = true;
  showManageRRHHModal = false;
  generatingReport = false;
  reportError: string | null = null;
  isAdminOrRrhh = false;
  listSection: 'forms' | 'missing' = 'forms';
  expandedHistory: Record<number, boolean> = {};
  historyByActiveId: Record<number, PlantillaTemporalDto[]> = {};
  loadingHistory: Record<number, boolean> = {};
  sinArchivoList: SinArchivoConflictoItem[] = [];
  loadingSinArchivo = false;
  sendingAllSinArchivo = false;
  sendingSinArchivoByKey: Record<string, boolean> = {};
  sinArchivoMessage: string | null = null;
  sinArchivoError: string | null = null;
  isMobile = false;
  showMobileMenu = false;

  constructor(
    private backendService: BackendService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private conflictoPdfService: ConflictoPdfService
  ) {}

  ngOnInit(): void {
    this.updateViewportFlags();
    this.isAdminOrRrhh = this.authService.hasRole('A') || this.authService.hasRole('R');

    if (this.isAdminOrRrhh) {
      this.showForm = false;
      this.showList = true;
      this.loadForms();
      this.loadSinArchivoConflicto();
      this.backendService.getModalidades().subscribe((m) => (this.modalidades = m));
    } else {
      this.showForm = true;
      this.showList = false;
    }

    this.route.queryParamMap.subscribe(params => {
      const abrir = params.get('abrirCodigo');
      if (abrir === '1') {
        this.showForm = false;
        this.showList = true;
        this.openCodeModal();
      }
      const abrirRoles = params.get('abrirRoles');
      if (abrirRoles === '1' && this.isAdminOrRrhh) {
        this.showForm = false;
        this.showList = true;
        this.openManageRRHHModal();
      }
      // PNIP-CI: el menú lateral, fuera de /admin, abre directo el formulario.
      if (params.get('vista') === 'formulario') {
        this.showForm = true;
        this.showList = false;
      }
    });
  }

  loadSinArchivoConflicto(): void {
    if (!this.isAdminOrRrhh) {
      return;
    }
    this.loadingSinArchivo = true;
    this.sinArchivoError = null;
    this.backendService.getSinArchivoConflicto().subscribe({
      next: (items) => {
        this.sinArchivoList = items || [];
        this.loadingSinArchivo = false;
      },
      error: () => {
        this.sinArchivoList = [];
        this.loadingSinArchivo = false;
        this.sinArchivoError = 'Could not load pending users list.';
      }
    });
  }

  getSinArchivoNombre(item: SinArchivoConflictoItem): string {
    return (item.NOMBRES || item['nombres'] || item['NOMBRE'] || 'No name').toString();
  }

  getSinArchivoCorreo(item: SinArchivoConflictoItem): string {
    return (item.EMAIL || item['email'] || item['CORREO'] || 'No email').toString();
  }

  getSinArchivoDmper(item: SinArchivoConflictoItem): string {
    return (item.DMPER || item.CODIGO || item['dmper'] || item['codigo'] || '').toString();
  }

  sendCorreoSinArchivoIndividual(item: SinArchivoConflictoItem): void {
    const dmperCodigo = this.getSinArchivoDmper(item);
    const key = dmperCodigo || this.getSinArchivoCorreo(item);
    if (!dmperCodigo) {
      this.sinArchivoError = 'This record does not include DMPER code.';
      return;
    }
    this.sendingSinArchivoByKey[key] = true;
    this.sinArchivoMessage = null;
    this.sinArchivoError = null;
    this.backendService.enviarCorreoSinArchivoIndividual(dmperCodigo).subscribe({
      next: (ok) => {
        this.sendingSinArchivoByKey[key] = false;
        this.sinArchivoMessage = ok
          ? `Email sent to ${this.getSinArchivoNombre(item)}.`
          : `Could not send email to ${this.getSinArchivoNombre(item)}.`;
      },
      error: () => {
        this.sendingSinArchivoByKey[key] = false;
        this.sinArchivoError = `Could not send email to ${this.getSinArchivoNombre(item)}.`;
      }
    });
  }

  sendCorreoSinArchivoTodos(): void {
    if (!this.sinArchivoList.length) {
      return;
    }
    this.sendingAllSinArchivo = true;
    this.sinArchivoMessage = null;
    this.sinArchivoError = null;
    this.backendService.enviarCorreoSinArchivoTodos().subscribe({
      next: (ok) => {
        this.sendingAllSinArchivo = false;
        this.sinArchivoMessage = ok
          ? 'Bulk notification sent.'
          : 'Could not send bulk notification.';
      },
      error: () => {
        this.sendingAllSinArchivo = false;
        this.sinArchivoError = 'Could not send bulk notification.';
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportFlags();
  }

  private updateViewportFlags(): void {
    if (typeof window === 'undefined') {
      this.isMobile = false;
      return;
    }
    this.isMobile = window.innerWidth <= 768;
    if (!this.isMobile) {
      this.showMobileMenu = false;
    }
  }

  loadForms(): void {
    if (!this.isAdminOrRrhh) {
      return;
    }
    this.backendService.getAllForms().subscribe({
      next: (forms) => {
        // Solo registros activos. Los provisionales (sin formulario enviado) ya
        // los excluye el backend, y los externos sí se muestran, marcados con
        // su distintivo en la tabla.
        // Nota: no se filtra por CLAVE_TEMPORAL porque la API nunca expone ese
        // campo (es una credencial); siempre llega null.
        const activeForms = (forms || []).filter(
          (form) => this.isEstadoActivo(form.ESTADO)
        );

        this.forms = activeForms.map((form) => ({
          ...form,
          employmentType: this.extractPersonalInfo(form, 'employmentType'),
          employmentTypeCode: this.extractPersonalInfo(form, 'employmentTypeCode')
        }));
        this.filterForms();
      },
      error: (err) => {
        console.error('[AdminComponent] Error al cargar formularios desde backend:', err);
        this.forms = [];
        this.filteredForms = [];
      }
    });
  }

  toggleHistory(form: PlantillaTemporalDto): void {
    const id = Number(form.CODIGO);
    if (!id) return;

    const current = !!this.expandedHistory[id];
    if (current) {
      this.expandedHistory[id] = false;
      return;
    }

    this.expandedHistory[id] = true;

    if (this.historyByActiveId[id]) {
      return;
    }

    this.loadingHistory[id] = true;
    this.backendService.getFormHistory(id).subscribe({
      next: (history) => {
        // History must include only inactive records (state 0/INACTIVO).
        const inactive = (history || []).filter((h) => this.isEstadoInactivo((h as any).ESTADO));
        this.historyByActiveId[id] = inactive;
        this.loadingHistory[id] = false;
      },
      error: (err) => {
        console.error('[AdminComponent] Error al cargar historial:', err);
        this.historyByActiveId[id] = [];
        this.loadingHistory[id] = false;
      }
    });
  }

  /**
   * Indica si un registro concreto se generó cuando la persona todavía era
   * externa (sin código de nómina DMPER). Se evalúa por registro y no por
   * persona: así el historial muestra en qué momento pasó de externa a interna.
   */
  esRegistroExterno(form: PlantillaTemporalDto): boolean {
    return !(form.DMPER || '').trim();
  }

  getOrigenLabel(form: PlantillaTemporalDto): string {
    return this.esRegistroExterno(form) ? 'Externo' : 'Interno';
  }

  private isEstadoActivo(estado: unknown): boolean {
    const value = String(estado ?? '').trim().toUpperCase();
    return value === '1' || value === 'ACTIVO';
  }

  private isEstadoInactivo(estado: unknown): boolean {
    const value = String(estado ?? '').trim().toUpperCase();
    return value === '0' || value === 'INACTIVO';
  }

  private extractPersonalInfo(form: PlantillaTemporalDto, campo: string): string | null {
    if (!form.JSON) {
      return null;
    }
    try {
      const value: any = JSON.parse(form.JSON);
      return value?.personalInfo?.[campo] || null;
    } catch (e) {
      console.error('[AdminComponent] Error al leer ' + campo + ' del JSON:', e);
      return null;
    }
  }

  /**
   * Opciones del filtro, agrupadas por régimen como en el formulario.
   */
  get modalidadesPorRegimen(): Array<{ regimen: string; modalidades: ModalidadContratoDto[] }> {
    const grupos = new Map<string, { regimen: string; modalidades: ModalidadContratoDto[] }>();
    this.modalidades.forEach((m) => {
      const codigo = m.REGIMEN_CODIGO || '';
      if (!grupos.has(codigo)) {
        grupos.set(codigo, { regimen: (m.REGIMEN || codigo).split(' - ')[0].trim(), modalidades: [] });
      }
      grupos.get(codigo)!.modalidades.push(m);
    });
    return Array.from(grupos.values());
  }

  /**
   * Modalidades escritas en declaraciones anteriores al selector, que no tienen
   * código. Se ofrecen aparte para que esas declaraciones sigan siendo
   * filtrables; cuando ya no queden, el grupo desaparece solo.
   */
  get contratosHeredados(): string[] {
    const textos = new Set<string>();
    (this.forms || []).forEach((f) => {
      if (!f.employmentTypeCode && f.employmentType) {
        textos.add(f.employmentType);
      }
    });
    return Array.from(textos).sort();
  }

  /** Etiqueta legible de un régimen, desde el catálogo. */
  private etiquetaRegimen(codigo: string | null | undefined): string {
    if (!codigo) {
      return '';
    }
    const encontrada = this.modalidades.find((m) => m.REGIMEN_CODIGO === codigo);
    return encontrada?.REGIMEN || codigo;
  }

  downloadExcusePdf(): void {
    const link = document.createElement('a');
    link.href = '/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
    link.download = 'FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Arma el reporte a Excel con lo que devuelve /plantilla-temporal/lectura.
   *
   * Antes se recorria aqui el JSON de cada declaracion. Ahora el desglose lo
   * hace la base a traves de las vistas V_DRI_CI_*, de modo que el reporte y
   * las consultas que RRHH corre en SQL salen del mismo lugar.
   *
   * El endpoint devuelve todas las declaraciones vigentes, sin saber nada de
   * los filtros de la pantalla, asi que se cruzan por codigo con las filas
   * visibles: el boton sigue exportando lo que el usuario esta viendo.
   *
   * No se filtra por LECTURA: el formulario solo la marca cuando hay familiares
   * o proveedores, y el reporte general dejaba fuera a quien declaraba un
   * interes financiero u otras situaciones sin tener relaciones.
   */
  generateExcelReport(): void {
    this.generatingReport = true;
    this.reportError = null;

    const visibles = new Map<number, PlantillaTemporalDto>();
    (this.filteredForms || [])
      .filter((f) => f.CODIGO != null)
      .forEach((f) => visibles.set(Number(f.CODIGO), f));

    if (visibles.size === 0) {
      this.generatingReport = false;
      this.reportError = 'No hay registros para el reporte con los filtros seleccionados.';
      return;
    }

    this.backendService.getPlantillasParaLectura().subscribe({
      next: (declaraciones) => this.buildExcelWorkbook(declaraciones, visibles),
      error: (err) => {
        console.error('[AdminComponent] Error al obtener las declaraciones para el reporte:', err);
        this.generatingReport = false;
        this.reportError = 'No se pudo obtener la información del reporte.';
      }
    });
  }

  /** Las respuestas de si/no viajan como texto, no como booleano. */
  private siNo(valor: string | null | undefined): string {
    return valor === 'true' ? 'Sí' : 'No';
  }

  private buildExcelWorkbook(
    declaraciones: PlantillaLecturaItem[],
    visibles: Map<number, PlantillaTemporalDto>
  ): void {
    const personalRows: any[] = [];
    const supplierRows: any[] = [];
    const generalRows: any[] = [];

    declaraciones
      .filter((d) => d.codigo != null && visibles.has(Number(d.codigo)))
      .forEach((d) => {
        const form = visibles.get(Number(d.codigo))!;
        const info = d.personalInfo;

        const nombre = info?.fullName || form.NOMBRE || '';
        const cedula = info?.ci || form.CEDULA || '';
        const unidad = info?.unit || form.DEPARTAMENTO || '';

        // Solo se reporta la lista si la persona respondio que si: puede quedar
        // contenido viejo en el formulario despues de cambiar la respuesta.
        const familiares = d.hasFamilyInstitution === 'true' ? d.familyMembers || [] : [];
        const proveedores = d.hasSupplierRelations === 'true' ? d.suppliers || [] : [];

        // Hoja 1: relaciones personales
        familiares.forEach((m) => {
          personalRows.push({
            'Nombre empleado': nombre,
            'Cédula empleado': cedula,
            'Unidad': unidad,
            'Nombre relación': m.name || '',
            'Cédula relación': m.ci || '',
            'Parentesco': m.relationship || '',
            'Institución': m.position || '',
            'Departamento': m.department || '',
            'Sección': m.section || '',
            'Área': m.area || ''
          });
        });

        // Hoja 2: relaciones con proveedores
        proveedores.forEach((s) => {
          supplierRows.push({
            'Nombre empleado': nombre,
            'Cédula empleado': cedula,
            'Unidad': unidad,
            'Nombre proveedor': s.name || '',
            'Cédula proveedor': s.ci || '',
            'Parentesco o relación': s.relationship || '',
            'Empresa': s.company || '',
            'Detalle': s.detail || ''
          });
        });

        // Hoja 3: reporte general
        const familySummary = familiares
          .map(
            (m, i) =>
              `${i + 1}) ${m.name || ''} - CI: ${m.ci || ''} - Parentesco: ${
                m.relationship || ''
              } - Institución: ${m.position || ''} - Depto: ${m.department || ''}`
          )
          .join(' | ');

        const suppliersSummary = proveedores
          .map(
            (s, i) =>
              `${i + 1}) ${s.name || ''} - CI: ${s.ci || ''} - Relación: ${
                s.relationship || ''
              } - Empresa: ${s.company || ''} - Detalle: ${s.detail || ''}`
          )
          .join(' | ');

        generalRows.push({
          'Nombre empleado': nombre,
          'Cédula empleado': cedula,
          'Unidad': unidad,
          'Cargo': info?.position || form.CARGO || '',
          'En calidad de': info?.employmentType || form.employmentType || '',
          'Régimen laboral': this.etiquetaRegimen(info?.laborRegime),
          'Tipo declaración': (form.ESTADO_PLANTILLA as string) || info?.status || '',
          'Fecha generación (registro)': form.FECHA_GENERACION || '',
          'Interés financiero': this.siNo(d.hasFinancialInterest),
          'Detalle interés financiero': d.financialInterestDetail || '',
          'Tiene familiares en institución': this.siNo(d.hasFamilyInstitution),
          'Familiares (detalle)': familySummary,
          'Tiene relación con proveedores': this.siNo(d.hasSupplierRelations),
          'Proveedores (detalle)': suppliersSummary,
          'Otras situaciones de incompatibilidad': this.siNo(d.hasOtherSituations),
          'Detalle otras situaciones': d.otherSituationsDetail || '',
          'Se compromete a revisar anualmente': this.siNo(d.commitToReview),
          'Se compromete a informar nuevas situaciones': this.siNo(d.commitToInform)
        });
      });

    if (generalRows.length === 0) {
      this.generatingReport = false;
      this.reportError = 'No hay datos para exportar en el reporte.';
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Hoja 1: reporte general con todo lo ingresado por la persona
    const wsGeneral = XLSX.utils.json_to_sheet(generalRows);
    XLSX.utils.book_append_sheet(workbook, wsGeneral, 'Reporte general');

    // Hoja 2: relaciones personales
    const wsPersonal = XLSX.utils.json_to_sheet(
      personalRows.length > 0 ? personalRows : [{ 'Mensaje': 'Sin datos de relaciones personales' }]
    );
    XLSX.utils.book_append_sheet(workbook, wsPersonal, 'Relaciones personales');

    // Hoja 3: relaciones con proveedores
    const wsSuppliers = XLSX.utils.json_to_sheet(
      supplierRows.length > 0 ? supplierRows : [{ 'Mensaje': 'Sin datos de relaciones con proveedores' }]
    );
    XLSX.utils.book_append_sheet(workbook, wsSuppliers, 'Relaciones proveedores');

    XLSX.writeFile(workbook, 'reporte_conflicto_interes.xlsx');
    this.generatingReport = false;
  }

  filterForms(): void {
    let result = [...this.forms];

    // Filtro por tipo
    if (this.filterType !== 'ALL') {
      result = result.filter((form) => {
        const code = (form.ESTADO_PLANTILLA || '').toUpperCase();
        return code === this.filterType;
      });
    }

    // Filtro por tipo de contrato
    if (this.filterEmploymentType !== 'ALL') {
      const seleccion = this.filterEmploymentType;
      const seleccionTexto = seleccion.toLowerCase();
      result = result.filter(
        (form) =>
          form.employmentTypeCode === seleccion ||
          (form.employmentType || '').toLowerCase() === seleccionTexto
      );
    }

    // Filtro por rango de fechas (comparando solo la parte de fecha yyyy-MM-dd)
    if (this.filterStartDate) {
      result = result.filter((form) => {
        if (!form.FECHA_GENERACION) return false;
        const fechaStr = (form.FECHA_GENERACION as string).substring(0, 10);
        return fechaStr >= this.filterStartDate!;
      });
    }

    if (this.filterEndDate) {
      result = result.filter((form) => {
        if (!form.FECHA_GENERACION) return false;
        const fechaStr = (form.FECHA_GENERACION as string).substring(0, 10);
        return fechaStr <= this.filterEndDate!;
      });
    }

    // Filtro de texto (nombre, cédula, tipo, fecha formateada)
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase().trim();
      result = result.filter((form) => {
        const nombre = (form.NOMBRE || '').toLowerCase();
        const cedula = (form.CEDULA || '').toLowerCase();
        const tipo = this.getStatusLabel(form.ESTADO_PLANTILLA || '').toLowerCase();
        const contrato = (form.employmentType || '').toLowerCase();
        const fecha = form.FECHA_GENERACION ? this.formatDate(form.FECHA_GENERACION).toLowerCase() : '';

        return (
          nombre.includes(search) ||
          cedula.includes(search) ||
          tipo.includes(search) ||
          contrato.includes(search) ||
          fecha.includes(search)
        );
      });
    }

    this.filteredForms = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  onSearchChange(): void {
    this.filterForms();
  }

  onFiltersChange(): void {
    this.filterForms();
  }

  private updatePagination(): void {
    const total = this.filteredForms.length;
    this.totalPages = total === 0 ? 1 : Math.ceil(total / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.pagedForms = this.filteredForms.slice(startIndex, endIndex);
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  toggleMobileMenu(): void {
    if (!this.isMobile) {
      return;
    }
    this.showMobileMenu = !this.showMobileMenu;
  }

  toggleView(view: 'form' | 'list'): void {
    this.showForm = view === 'form';
    this.showList = view === 'list';
    // En móvil el menú ya cumplió: se cierra para mostrar lo elegido
    this.showMobileMenu = false;
    if (view === 'list') {
      this.loadForms();
      this.loadSinArchivoConflicto();
    }
  }

  toggleListSection(section: 'forms' | 'missing'): void {
    this.listSection = section;
    if (section === 'forms') {
      this.loadForms();
    } else {
      this.loadSinArchivoConflicto();
    }
  }

  openCodeModal(): void {
    this.showCodeModal = true;
  }

  closeCodeModal(): void {
    this.showCodeModal = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { abrirCodigo: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.showForm = false;
    this.showList = true;
    this.loadForms();
  }

  openManageRRHHModal(): void {
    this.showManageRRHHModal = true;
  }

  closeManageRRHHModal(): void {
    this.showManageRRHHModal = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { abrirRoles: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.showForm = false;
    this.showList = true;
    this.loadForms();
  }

  onSidebarMouseEnter(): void {
    this.sidebarCollapsed = false;
  }

  onSidebarMouseLeave(): void {
    this.sidebarCollapsed = true;
  }

  previewPdf(form: PlantillaTemporalDto): void {
    if (!form.JSON) {
      this.showPdfErrorModal = true;
      return;
    }

    let value: any;
    try {
      value = JSON.parse(form.JSON);
    } catch (e) {
      console.error('Error al parsear JSON de la plantilla:', e);
      this.showPdfErrorModal = true;
      return;
    }

    this.generatePdfFromForm(value, true);
  }

  deleteForm(id: number | string | undefined): void {
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(code: string | null | undefined): string {
    switch (code) {
      case 'I':
        return 'Inicial';
      case 'A':
        return 'Actualización';
      case 'F':
        return 'Final';
      default:
        return code || '';
    }
  }

  /**
   * Delega en ConflictoPdfService, que centraliza el maquetado del PDF.
   */
  private generatePdfFromForm(formData: any, preview: boolean = false): void {
    this.conflictoPdfService.generar(formData, preview);
  }
}
