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
import { concatMap, from, of, tap, toArray } from 'rxjs';

/** Columna por la que está ordenada una tabla; sin campo se respeta el orden en que llegó. */
interface OrdenTabla {
  campo: string;
  asc: boolean;
}

interface ColumnaTabla {
  campo: string;
  titulo: string;
}

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
  /** Lo que se ve en "No han llenado formulario" tras buscar, filtrar y ordenar. */
  sinArchivoFiltrados: SinArchivoConflictoItem[] = [];
  /** La página visible de sinArchivoFiltrados. La lista entera ya está en memoria: se pagina aquí. */
  sinArchivoPagina: SinArchivoConflictoItem[] = [];
  sinArchivoPageSizeOptions: number[] = [10, 25, 50, 100];
  sinArchivoPageSize = 25;
  sinArchivoCurrentPage = 1;
  sinArchivoTotalPages = 1;
  /** "3 de 12" mientras se envía uno por uno a los filtrados. */
  sinArchivoProgreso: string | null = null;
  sinArchivoSearch = '';
  sinArchivoDepto = 'ALL';
  departamentosSinArchivo: string[] = [];
  sinArchivoSort: OrdenTabla = { campo: 'nombre', asc: true };
  readonly sinArchivoColumnas: ColumnaTabla[] = [
    { campo: 'nombre', titulo: 'Nombre' },
    { campo: 'departamento', titulo: 'Departamento' },
    { campo: 'cargo', titulo: 'Cargo' },
    { campo: 'correo', titulo: 'Correo' }
  ];

  /** Orden de "Formularios recibidos". Sin campo se muestra como llega del servidor. */
  formsSort: OrdenTabla = { campo: '', asc: true };
  readonly formsColumnas: ColumnaTabla[] = [
    { campo: 'nombre', titulo: 'Nombre' },
    { campo: 'cedula', titulo: 'Cédula' },
    { campo: 'origen', titulo: 'Origen' },
    { campo: 'tipo', titulo: 'Tipo' },
    { campo: 'contrato', titulo: 'Tipo de contrato' },
    { campo: 'fecha', titulo: 'Fecha' }
  ];

  private readonly comparador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
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
        this.departamentosSinArchivo = Array.from(
          new Set(this.sinArchivoList.map((i) => this.getSinArchivoDepartamento(i)))
        ).sort(this.comparador.compare);
        // Si el departamento elegido ya no tiene pendientes, el filtro dejaría la tabla vacía sin explicación.
        if (!this.departamentosSinArchivo.includes(this.sinArchivoDepto)) {
          this.sinArchivoDepto = 'ALL';
        }
        this.aplicarFiltrosSinArchivo();
        this.loadingSinArchivo = false;
      },
      error: () => {
        this.sinArchivoList = [];
        this.sinArchivoFiltrados = [];
        this.departamentosSinArchivo = [];
        this.loadingSinArchivo = false;
        this.sinArchivoError = 'No se pudo cargar la lista de personal pendiente.';
      }
    });
  }

  getSinArchivoNombre(item: SinArchivoConflictoItem): string {
    return (item.NOMBRES || item['nombres'] || item['NOMBRE'] || 'Sin nombre').toString();
  }

  getSinArchivoCorreo(item: SinArchivoConflictoItem): string {
    return (item.EMAIL || item['email'] || item['CORREO'] || 'Sin correo').toString();
  }

  /** Partes de la ruta que manda nómina: "DEPARTAMENTO X\DIRECCION Y\SECCION Z". */
  private rutaSinArchivo(item: SinArchivoConflictoItem): string[] {
    return (item['DEPARTAMENTO'] || '')
      .toString()
      .split('\\')
      .map((parte: string) => parte.trim())
      .filter((parte: string) => !!parte);
  }

  /** El departamento es el primer tramo de la ruta; por él se filtra. */
  getSinArchivoDepartamento(item: SinArchivoConflictoItem): string {
    return this.rutaSinArchivo(item)[0] || 'Sin departamento';
  }

  /** Dirección, sección y área: el resto de la ruta, para ubicar a la persona dentro del departamento. */
  getSinArchivoUnidad(item: SinArchivoConflictoItem): string {
    return this.rutaSinArchivo(item).slice(1).join(' › ');
  }

  getSinArchivoCargo(item: SinArchivoConflictoItem): string {
    return (item['CARGO'] || '').toString().trim() || 'Sin registro';
  }

  aplicarFiltrosSinArchivo(): void {
    const texto = this.normalizar(this.sinArchivoSearch);
    const visibles = this.sinArchivoList.filter((item) => {
      if (this.sinArchivoDepto !== 'ALL' && this.getSinArchivoDepartamento(item) !== this.sinArchivoDepto) {
        return false;
      }
      if (!texto) {
        return true;
      }
      return this.normalizar(
        [
          this.getSinArchivoNombre(item),
          this.rutaSinArchivo(item).join(' '),
          this.getSinArchivoCargo(item),
          this.getSinArchivoCorreo(item)
        ].join(' ')
      ).includes(texto);
    });

    this.sinArchivoFiltrados = this.ordenarFilas(visibles, this.sinArchivoSort, (item, campo) => {
      switch (campo) {
        case 'departamento':
          // Dentro del departamento, por unidad: así quedan juntos los de una misma sección.
          return this.getSinArchivoDepartamento(item) + ' ' + this.getSinArchivoUnidad(item);
        case 'cargo':
          return this.getSinArchivoCargo(item);
        case 'correo':
          return this.getSinArchivoCorreo(item);
        default:
          return this.getSinArchivoNombre(item);
      }
    });
    this.sinArchivoCurrentPage = 1;
    this.paginarSinArchivo();
  }

  private paginarSinArchivo(): void {
    const total = this.sinArchivoFiltrados.length;
    this.sinArchivoTotalPages = total === 0 ? 1 : Math.ceil(total / this.sinArchivoPageSize);
    if (this.sinArchivoCurrentPage > this.sinArchivoTotalPages) {
      this.sinArchivoCurrentPage = this.sinArchivoTotalPages;
    }
    const inicio = (this.sinArchivoCurrentPage - 1) * this.sinArchivoPageSize;
    this.sinArchivoPagina = this.sinArchivoFiltrados.slice(inicio, inicio + Number(this.sinArchivoPageSize));
  }

  onSinArchivoPageSizeChange(): void {
    this.sinArchivoPageSize = Number(this.sinArchivoPageSize);
    this.sinArchivoCurrentPage = 1;
    this.paginarSinArchivo();
  }

  cambiarPaginaSinArchivo(delta: number): void {
    const destino = this.sinArchivoCurrentPage + delta;
    if (destino < 1 || destino > this.sinArchivoTotalPages) {
      return;
    }
    this.sinArchivoCurrentPage = destino;
    this.paginarSinArchivo();
  }

  get hayFiltroSinArchivo(): boolean {
    return !!this.sinArchivoSearch.trim() || this.sinArchivoDepto !== 'ALL';
  }

  /** "128" si se ve todo, "12 de 128" si hay un filtro puesto. */
  conteo(visibles: number, total: number): string {
    return visibles === total ? `${total}` : `${visibles} de ${total}`;
  }

  limpiarFiltrosSinArchivo(): void {
    this.sinArchivoSearch = '';
    this.sinArchivoDepto = 'ALL';
    this.aplicarFiltrosSinArchivo();
  }

  ordenarSinArchivo(campo: string): void {
    this.cambiarOrden(this.sinArchivoSort, campo);
    this.aplicarFiltrosSinArchivo();
  }

  ordenarForms(campo: string): void {
    this.cambiarOrden(this.formsSort, campo);
    this.filterForms();
  }

  /** Primer clic: ascendente. Segundo clic sobre la misma columna: descendente. */
  private cambiarOrden(orden: OrdenTabla, campo: string): void {
    if (orden.campo === campo) {
      orden.asc = !orden.asc;
    } else {
      orden.campo = campo;
      orden.asc = true;
    }
  }

  indicadorOrden(orden: OrdenTabla, campo: string): string {
    if (orden.campo !== campo) {
      return '↕';
    }
    return orden.asc ? '▲' : '▼';
  }

  ariaOrden(orden: OrdenTabla, campo: string): string {
    if (orden.campo !== campo) {
      return 'none';
    }
    return orden.asc ? 'ascending' : 'descending';
  }

  /** Minúsculas y sin tildes, para que "garcia" encuentre "García". */
  private normalizar(texto: string | null | undefined): string {
    return (texto || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /** Copia ordenada. Los vacíos van siempre al final, en cualquiera de los dos sentidos. */
  private ordenarFilas<T>(filas: T[], orden: OrdenTabla, valor: (fila: T, campo: string) => string): T[] {
    if (!orden.campo) {
      return filas;
    }
    const sentido = orden.asc ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = (valor(a, orden.campo) || '').trim();
      const vb = (valor(b, orden.campo) || '').trim();
      if (!va || !vb) {
        return va ? -1 : vb ? 1 : 0;
      }
      return sentido * this.comparador.compare(va, vb);
    });
  }

  getSinArchivoDmper(item: SinArchivoConflictoItem): string {
    return (item.DMPER || item.CODIGO || item['dmper'] || item['codigo'] || '').toString();
  }

  sendCorreoSinArchivoIndividual(item: SinArchivoConflictoItem): void {
    const dmperCodigo = this.getSinArchivoDmper(item);
    const key = dmperCodigo || this.getSinArchivoCorreo(item);
    if (!dmperCodigo) {
      this.sinArchivoError = 'Este registro no tiene código de personal.';
      return;
    }
    this.sendingSinArchivoByKey[key] = true;
    this.sinArchivoMessage = null;
    this.sinArchivoError = null;
    this.backendService.enviarCorreoSinArchivoIndividual(dmperCodigo).subscribe({
      next: (ok) => {
        this.sendingSinArchivoByKey[key] = false;
        this.sinArchivoMessage = ok
          ? `Correo enviado a ${this.getSinArchivoNombre(item)}.`
          : `No se pudo enviar el correo a ${this.getSinArchivoNombre(item)}.`;
      },
      error: () => {
        this.sendingSinArchivoByKey[key] = false;
        this.sinArchivoError = `No se pudo enviar el correo a ${this.getSinArchivoNombre(item)}.`;
      }
    });
  }

  /**
   * Envío masivo. Sin filtros usa el envío del servidor a todo el personal
   * pendiente. Con un filtro puesto envía solo a quienes se ven en la tabla
   * (en todas sus páginas), uno por uno, porque el servidor no conoce los
   * filtros de la pantalla.
   */
  sendCorreoSinArchivoTodos(): void {
    const filtrado = this.hayFiltroSinArchivo;
    const destinatarios = filtrado ? this.sinArchivoFiltrados : this.sinArchivoList;
    if (!destinatarios.length) {
      return;
    }
    const alcance = filtrado
      ? `las ${destinatarios.length} persona(s) que coinciden con el filtro`
      : `todo el personal pendiente (${destinatarios.length} persona(s))`;
    if (!window.confirm(`Se enviará el correo de recordatorio a ${alcance}. ¿Continuar?`)) {
      return;
    }

    this.sendingAllSinArchivo = true;
    this.sinArchivoMessage = null;
    this.sinArchivoError = null;

    if (!filtrado) {
      this.backendService.enviarCorreoSinArchivoTodos().subscribe({
        next: (ok) => {
          this.sendingAllSinArchivo = false;
          this.sinArchivoMessage = ok
            ? 'Se envió la notificación a todo el personal pendiente.'
            : 'No se pudo enviar la notificación masiva.';
        },
        error: () => {
          this.sendingAllSinArchivo = false;
          this.sinArchivoError = 'No se pudo enviar la notificación masiva.';
        }
      });
      return;
    }

    // De uno en uno y en orden: no satura el servidor de correo y permite mostrar el avance.
    let hechos = 0;
    this.sinArchivoProgreso = `0 de ${destinatarios.length}`;
    from(destinatarios)
      .pipe(
        concatMap((item) => {
          const dmper = this.getSinArchivoDmper(item);
          // enviarCorreoSinArchivoIndividual ya convierte un error en false.
          return dmper ? this.backendService.enviarCorreoSinArchivoIndividual(dmper) : of(false);
        }),
        tap(() => {
          hechos++;
          this.sinArchivoProgreso = `${hechos} de ${destinatarios.length}`;
        }),
        toArray()
      )
      .subscribe({
        next: (resultados) => {
          const enviados = resultados.filter((ok) => ok).length;
          const fallidos = resultados.length - enviados;
          this.sendingAllSinArchivo = false;
          this.sinArchivoProgreso = null;
          if (enviados > 0) {
            this.sinArchivoMessage = `Correo enviado a ${enviados} de ${resultados.length} persona(s) filtradas.`;
          }
          if (fallidos > 0) {
            this.sinArchivoError = `No se pudo enviar a ${fallidos} persona(s). Intente de nuevo más tarde.`;
          }
        },
        error: () => {
          this.sendingAllSinArchivo = false;
          this.sinArchivoProgreso = null;
          this.sinArchivoError = 'El envío se interrumpió. Revise la conexión e intente de nuevo.';
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
        // Del más reciente al más antiguo; las fechas ISO se ordenan bien como texto.
        inactive.sort((a, b) => (b.FECHA_GENERACION || '').localeCompare(a.FECHA_GENERACION || ''));
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

    this.filteredForms = this.ordenarFilas(result, this.formsSort, (form, campo) => {
      switch (campo) {
        case 'cedula':
          return form.CEDULA || '';
        case 'origen':
          return this.getOrigenLabel(form);
        case 'tipo':
          return this.getStatusLabel(form.ESTADO_PLANTILLA || '');
        case 'contrato':
          return form.employmentType || '';
        case 'fecha':
          return form.FECHA_GENERACION || '';
        default:
          return form.NOMBRE || '';
      }
    });
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
