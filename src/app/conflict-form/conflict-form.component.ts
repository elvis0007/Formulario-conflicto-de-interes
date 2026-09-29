import { Component, Inject, OnInit, PLATFORM_ID, effect } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { BackendService, ModalidadContratoDto, PersonalBusquedaDto, PersonalUbicacionDto, PlantillaTemporalDto } from '../services/backend.service';
import { AuthService } from '../services/auth.service';
import { ConflictoPdfService } from '../services/conflicto-pdf.service';

/** Institucion a la que pertenecen los familiares declarados en la seccion 2. */
const INSTITUCION_PROPIA = 'EEASA';

interface FamilyMember {
  name: string;
  ci: string;
  relationship: string;
  position: string;
  department: string;
  section: string;
  area: string;
}

interface Supplier {
  name: string;
  ci: string;
  relationship: string;
  detail: string;
  company: string;
  contractType: 'Público' | 'Profesional' | '';
}

@Component({
  selector: 'app-conflict-form',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './conflict-form.component.html',
  styleUrl: './conflict-form.component.scss'
})
export class ConflictFormComponent implements OnInit {
  form: FormGroup;
  statusMessage: string | null = null;
  statusType: 'success' | 'error' | 'info' | null = null;
  statusModalOpen = false;
  confirmacionEnvioAbierta = false;
  hasExistingForm = false;
  formHasChanges = false;
  private initialFormValue: string = '';

  /** Mínimo de caracteres que el backend exige para buscar (ver BackendService). */
  private static readonly MIN_BUSQUEDA = 3;
  /** Se precargo el nombre desde el registro civil y conviene revisarlo. */
  nombrePrecargado = false;

  /**
   * Evita repetir la consulta al registro civil.
   *
   * cargarDatosUsuario se invoca tanto desde ngOnInit como desde el effect que
   * observa al usuario, de modo que sin este cerrojo se consultaria dos veces
   * por cada carga del formulario. La consulta es auditada y de consumo
   * limitado, asi que se hace una sola vez por sesion de formulario.
   */
  private yaSeConsultoIdentidad = false;

  /**
   * Evita repetir la carga de la declaracion guardada.
   *
   * Mismo problema que yaSeConsultoIdentidad, arriba: cargarDatosUsuario se
   * invoca dos veces por carga, asi que sin este cerrojo se disparaban dos
   * peticiones a /plantillas/cedula/{ci} casi simultaneas. La que respondia
   * mas tarde volvia a hacer patchValue sobre personalInfo completo y pisaba
   * en silencio cualquier campo que la persona ya hubiera alcanzado a editar
   * entre medio, la fecha de ingreso sobre todo: para un externo con lo demas
   * ya precargado es el unico campo que le queda por escribir, asi que era
   * ahi donde mas se notaba el "no puedo modificarla".
   */
  private yaSeCargoFormularioGuardado = false;

  /**
   * Sugerencias del buscador de personal, por indice de familiar. Cada fila del
   * FormArray tiene su propia lista porque se pueden declarar varios familiares.
   */
  sugerenciasFamiliar: { [indice: number]: PersonalBusquedaDto[] } = {};

  /**
   * Catálogo de modalidades de contratación, solo si hay que mostrar el
   * selector. Al personal interno con modalidad en nómina no se le pide.
   */
  modalidades: ModalidadContratoDto[] = [];

  /**
   * Hay que preguntar la modalidad.
   *
   * Siempre para el externo, que nómina no conoce. Y para el interno cuyo
   * registro no tiene grupo de escala: sin esto se quedaría con el campo
   * vacío, que es justo lo que se está corrigiendo.
   */
  mostrarSelectorModalidad = false;

  /** Está subrogando o encargado de otro puesto, según nómina. */
  encargadoSegunNomina = false;

  /**
   * Régimen laboral según nómina, para mostrarlo junto a la modalidad heredada.
   * Sin él, al interno se le mostraba la modalidad pero el régimen no aparecía
   * en ningún lado, aunque sí se guardaba.
   */
  regimenSegunNomina = '';

  /**
   * Estado del catálogo de modalidades.
   *
   * Sin él, un catálogo que no llegaba se dibujaba como un "Régimen laboral:"
   * sin ninguna opción debajo. Como régimen y modalidad son obligatorios, el
   * formulario quedaba imposible de enviar sin nada que explicara por qué. Pasa
   * cuando el frontend se despliega contra un backend anterior al catálogo.
   */
  estadoCatalogo: 'cargando' | 'listo' | 'error' = 'cargando';

  /**
   * Pestaña activa del buscador de familiares.
   *
   * La pregunta de la sección 2 abarca a quien trabaja en la institución "o en
   * entidades relacionadas". Quien trabaja en EEASA está en nómina y se busca
   * por nombre; quien trabaja en otra entidad no está, y solo se lo puede
   * identificar por cédula en el registro civil. Son dos búsquedas distintas y
   * se presentan como dos pestañas, en el mismo orden en que las nombra la
   * pregunta, en lugar de un único campo que se comportara distinto sin avisar.
   */
  modoBuscador: 'eeasa' | 'externa' = 'eeasa';

  /** Búsqueda por cédula de un familiar que trabaja en otra entidad. */
  cedulaExterna = '';
  estadoExterna: 'inicial' | 'invalida' | 'buscando' | 'encontrado' | 'no-encontrado' = 'inicial';
  nombreExterna: string | null = null;

  /** Estado del modal de búsqueda de personal para declarar familiares. */
  buscadorAbierto = false;
  busquedaPersonal = '';
  resultadosBusqueda: PersonalBusquedaDto[] = [];
  buscando = false;

  /** Termino tecleado en el buscador, para no repetir consultas identicas. */
  private busquedaPersonal$ = new Subject<string>();

  esUsuarioInterno: boolean = false;

  /** Índice de secciones del formulario, usado por la navegación lateral. */
  readonly secciones = [
    { id: 's1', num: '01', label: 'Información personal' },
    { id: 's2', num: '02', label: 'Intereses personales' },
    { id: 's3', num: '03', label: 'Proveedores y contratistas' },
    { id: 's4', num: '04', label: 'Incompatibilidad' },
    { id: 's5', num: '05', label: 'Gestión y prevención' },
    { id: 's6', num: '06', label: 'Declaración' },
    { id: 's7', num: '07', label: 'Protección de datos personales' }
  ];
  seccionActiva: string = 's1';

  /** Grados de parentesco admitidos en la declaración de familiares. */
  readonly parentescos = [
    'Cónyuge',
    'Padre / Madre',
    'Hijo / Hija',
    'Hermano / Hermana',
    'Tío / Tía',
    'Primo / Prima',
    'Sobrino / Sobrina',
    'Afinidad 2.º grado'
  ];

  /**
   * Etiquetas para el aviso de "campos faltantes", una por sección.
   *
   * Solo hace falta nombrar los campos que alguna vez llevan
   * `Validators.required`; los demás nunca van a aparecer en la lista. No se
   * distingue aquí entre interno y externo: eso ya lo resuelve el validador
   * de cada campo (a un interno con modalidad en nómina, por ejemplo,
   * `employmentType` no lleva `required`, así que `agregarFaltantes` nunca lo
   * evalúa para esa persona). La etiqueta es la misma, el conjunto de campos
   * que se revisan cambia solo.
   */
  private static readonly ETIQUETAS_PERSONAL_INFO: { [campo: string]: string } = {
    fullName: 'Nombre completo',
    apellidoPaterno: 'Primer apellido',
    nombrePrimero: 'Primer nombre',
    ci: 'C.I.',
    unit: 'Unidad/Área a la que se incorpora',
    position: 'Cargo',
    startDate: 'Fecha de ingreso',
    employmentType: 'En calidad de',
    laborRegime: 'Régimen laboral'
  };

  private static readonly ETIQUETAS_INTERESES: { [campo: string]: string } = {
    hasFinancialInterest: '¿Tiene interés financiero o personal?',
    hasFamilyInstitution: '¿Tiene familiares que trabajen en la institución?',
    familyMembers: 'Agregue al menos un familiar, o responda "No"'
  };

  private static readonly ETIQUETAS_FAMILIAR: { [campo: string]: string } = {
    name: 'Nombre',
    ci: 'C.I.',
    relationship: 'Parentesco',
    position: 'Institución o entidad donde trabaja'
  };

  private static readonly ETIQUETAS_SUPPLIERS: { [campo: string]: string } = {
    hasSupplierRelations: '¿Tiene relación con proveedores o contratistas?',
    suppliersList: 'Agregue al menos un proveedor o contratista, o responda "No"'
  };

  private static readonly ETIQUETAS_PROVEEDOR: { [campo: string]: string } = {
    name: 'Nombre',
    ci: 'C.I.',
    relationship: 'Parentesco',
    detail: 'Detalle la relación',
    company: 'Empresa'
  };

  private static readonly ETIQUETAS_INCOMPATIBILITY: { [campo: string]: string } = {
    hasOtherSituations: '¿Existen otras situaciones de conflicto de interés?'
  };

  private static readonly ETIQUETAS_PROCEDURES: { [campo: string]: string } = {
    commitToReview: 'Compromiso de revisión periódica de sus actividades',
    commitToInform: 'Compromiso de informar sobre un conflicto de interés'
  };

  /**
   * Campos de "Información personal" que llegaron precargados desde la cuenta
   * del usuario. Se muestran en solo lectura: siguen formando parte del valor
   * del formulario y de sus validaciones, pero no se pueden editar.
   */
  camposBloqueados: { [campo: string]: boolean } = {};

  /**
   * Campos de cada familiar declarado que llegaron con dato del directorio y
   * por tanto se muestran como texto en vez de campo editable.
   *
   * Se anota en el momento en que el dato llega, no se deduce del valor actual:
   * si se calculara al vuelo, un campo que llegó vacío se convertiría en texto
   * en cuanto la persona escribiera la primera letra, y el cursor se perdería.
   *
   * Va en un `WeakMap` sobre el propio `FormGroup` y no en un arreglo paralelo
   * para no tener que sincronizar índices al quitar un familiar o al vaciar la
   * lista; cuando el grupo se descarta, su entrada se libera sola.
   */
  private camposFijosFamiliar = new WeakMap<AbstractControl, Set<string>>();

  /**
   * Cédulas de proveedor ya consultadas contra DINARDAP en esta sesión, para
   * no repetir la consulta si la persona retoca el campo sin cambiar el
   * número. DINARDAP es un servicio auditado y de consumo limitado, igual
   * que en precargarNombreDesdeCedula.
   */
  private identidadesConsultadas = new Map<string, string | null>();

  /**
   * Estado de la consulta a DINARDAP en cada fila de proveedor.
   *
   * La consulta era silenciosa: mientras llegaba la respuesta no se veía nada,
   * y si la cédula no estaba, tampoco. La persona no sabía si esperar o
   * escribir el nombre. Ahora se avisa en los dos momentos.
   */
  private estadoConsultaProveedor = new WeakMap<AbstractControl, 'buscando' | 'no-encontrado'>();

  /**
   * Campos de un familiar que pueden venir del directorio. `relationship` no
   * está: el parentesco no lo sabe el sistema, siempre lo elige la persona.
   */
  private static readonly CAMPOS_FAMILIAR_PRECARGABLES = [
    'name', 'ci', 'position', 'department', 'section', 'area'
  ];

  /**
   * Campos de "Información personal" que puede traer una declaración guardada.
   *
   * Los cuatro del nombre están porque una declaración anterior los capturó uno
   * a uno; no así cuando se deducen repartiendo el nombre completo, que se
   * marca aparte con `nombrePrecargado` y se deja editable para corregirlo.
   */
  private static readonly CAMPOS_PERSONALES_PRECARGABLES = [
    'fullName', 'apellidoPaterno', 'apellidoMaterno', 'nombrePrimero',
    'nombreSegundo', 'ci', 'unit', 'position'
  ];

  private readonly esNavegador: boolean;

  constructor(
    private fb: FormBuilder,
    private backendService: BackendService,
    private authService: AuthService,
    private router: Router,
    private conflictoPdfService: ConflictoPdfService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.esNavegador = isPlatformBrowser(platformId);
    const esUsuarioExterno = this.authService.hasRole('E');

    this.esUsuarioInterno = !esUsuarioExterno;

    this.form = this.fb.group({
      status: ['Inicial', Validators.required],
      personalInfo: this.fb.group({
        // El nombre completo se sigue guardando y es lo que usan el PDF y los
        // listados. Para los externos se arma a partir de los cuatro campos de
        // abajo; para el personal interno llega tal cual desde nomina.
        fullName: ['', Validators.required],
        // Solo se piden a los usuarios externos. Al capturarlos por separado se
        // guardan exactos, en vez de deducirlos del nombre completo, que falla
        // con apellidos compuestos.
        apellidoPaterno: [''],
        apellidoMaterno: [''],
        nombrePrimero: [''],
        nombreSegundo: [''],
        ci: ['', [Validators.required, this.ciValidator]],
        unit: ['', Validators.required],
        position: ['', Validators.required],
        // Para un interno se muestra fija cuando nómina la tiene (ver
        // heredarDatosDeNomina): es el dato real. Si nómina no la tiene, o
        // para un externo, sigue editable; hay ademas declaraciones antiguas
        // guardadas con la fecha del dia en que se lleno el formulario en vez
        // de la del ingreso real, y esas hay que poder corregirlas.
        startDate: ['', [Validators.required, this.fechaIngresoValidator]],
        // El texto de la modalidad es lo que ve la persona y lo que sale en
        // el PDF. El código y el régimen viajan al lado para poder consultar y
        // agrupar en SQL sin depender de que nadie renombre una descripción.
        //
        // Sin `required` de fábrica: quien hereda la modalidad de nómina no ve
        // el campo, y exigirle algo invisible dejaría el formulario bloqueado
        // sin nada que corregir. Se exige en configurarModalidad() solo cuando
        // el selector se muestra.
        employmentType: [''],
        employmentTypeCode: [''],
        laborRegime: ['']
      }),
      // Las preguntas Sí/No arrancan en `null`, no en `false`: con `false` el radio
      // "No" salía marcado de fábrica y el sistema registraba como respuesta algo
      // que la persona nunca declaró. `Validators.required` sólo rechaza `null`
      // (un `false` cuenta como respondido), así que obliga a contestarlas.
      personalInterests: this.fb.group({
        hasFinancialInterest: [null, Validators.required],
        financialInterestDetail: [''],
        hasFamilyInstitution: [null, Validators.required],
        familyMembers: this.fb.array([])
      }),
      suppliers: this.fb.group({
        hasSupplierRelations: [null, Validators.required],
        suppliersList: this.fb.array([])
      }),
      incompatibility: this.fb.group({
        hasOtherSituations: [null, Validators.required],
        otherSituationsDetail: ['']
      }),
      procedures: this.fb.group({
        commitToReview: [null, Validators.required],
        commitToInform: [null, Validators.required]
      }),
      declarationAccepted: [false, Validators.requiredTrue]
    });

    effect(() => {
      const usuario = this.authService.usuario();
      if (usuario) {
        this.cargarDatosUsuario();
      }
    });

    // El buscador consulta al servidor, asi que se espera a que el usuario
    // deje de teclear en vez de disparar una peticion por caracter.
    this.busquedaPersonal$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((termino) => this.backendService.buscarPersonal(termino))
      )
      .subscribe((resultados) => {
        this.resultadosBusqueda = resultados;
        this.buscando = false;
      });

    if (!this.esUsuarioInterno) {
      this.configurarNombreSeparado();
      this.configurarModalidad(true);
    }

    this.form.valueChanges.subscribe(() => {
      this.checkFormChanges();
    });
  }

  /**
   * Valor actual de un campo de "Información personal", para mostrarlo como
   * texto cuando el dato viene precargado y no se puede editar.
   *
   * El control sigue existiendo en el formulario aunque su input no se pinte:
   * el valor viaja igual al guardar y sus validaciones se siguen evaluando.
   */
  valorPersonal(campo: string): string {
    return (this.form.get(`personalInfo.${campo}`)?.value ?? '').toString().trim();
  }

  /**
   * Fecha de ingreso en formato `dd/MM/yyyy`, para mostrarla como texto.
   *
   * Se arma partiendo la cadena y no con el pipe `date` ni con `new Date()`:
   * eso interpretaria "yyyy-MM-dd" como medianoche UTC, y en Ecuador (UTC-5)
   * restaria un dia y la fecha mostrada no coincidiria con la guardada.
   */
  fechaIngresoTexto(): string {
    const valor = this.valorPersonal('startDate');
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor;
  }

  /**
   * Anota como fijos los campos del familiar que ya traen dato.
   *
   * Solo agrega, nunca quita: la ubicación llega en una segunda respuesta y no
   * debe revocar lo anotado al crear la fila. Se le pasan los campos que esa
   * respuesta pudo llenar, para no marcar por error algo que la persona
   * alcanzó a escribir mientras tanto.
   */
  private marcarCamposFijosFamiliar(grupo: AbstractControl, campos: string[]): void {
    const fijos = this.camposFijosFamiliar.get(grupo) ?? new Set<string>();
    campos.forEach((campo) => {
      if ((grupo.get(campo)?.value ?? '').toString().trim()) {
        fijos.add(campo);
      }
    });
    this.camposFijosFamiliar.set(grupo, fijos);
  }

  /**
   * Marca como fijos los campos de "Información personal" que ya traen dato.
   *
   * Igual que con los familiares, se anota cuando el dato llega y no se deduce
   * del valor actual: si se recalculara, un campo vacío se volvería texto en
   * cuanto la persona escribiera la primera letra.
   */
  private marcarCamposFijosPersonales(campos: string[]): void {
    const personalInfo = this.form.get('personalInfo');
    if (!personalInfo) {
      return;
    }
    campos.forEach((campo) => {
      if ((personalInfo.get(campo)?.value ?? '').toString().trim()) {
        this.camposBloqueados[campo] = true;
      }
    });
  }

  /** Ese campo del familiar llegó precargado y se muestra como texto. */
  familiarEsFijo(indice: number, campo: string): boolean {
    const grupo = this.familyMembers.at(indice);
    return !!grupo && !!this.camposFijosFamiliar.get(grupo)?.has(campo);
  }

  /** Valor de un campo del familiar, para mostrarlo como texto. */
  valorFamiliar(indice: number, campo: string): string {
    return (this.familyMembers.at(indice)?.get(campo)?.value ?? '').toString().trim();
  }

  /**
   * Tipo de declaración que el sistema determina automáticamente:
   * sin declaración previa enviada es "Inicial" (ingreso), y con una previa
   * es "Actualización". El usuario no elige entre estas dos; lo único que
   * puede marcar a mano es "Final" (salida de la empresa).
   */
  get tipoDeclaracionAutomatico(): 'Inicial' | 'Actualización' {
    return this.hasExistingForm ? 'Actualización' : 'Inicial';
  }

  /**
   * Actualiza si existe una declaración previa y realinea el tipo de
   * declaración, respetando la elección manual de "Final".
   */
  private setHasExistingForm(value: boolean): void {
    this.hasExistingForm = value;
    const status = this.form.get('status');
    if (status && status.value !== 'Final') {
      status.setValue(this.tipoDeclaracionAutomatico, { emitEvent: false });
    }
  }

  /**
   * Prepara la captura del nombre en campos separados para usuarios externos.
   *
   * El nombre completo deja de escribirse a mano y pasa a componerse de los
   * cuatro campos, de modo que siga alimentando el PDF y los listados sin que
   * nadie tenga que escribirlo dos veces.
   *
   * Solo se exigen el primer apellido y el primer nombre: hay personas con un
   * solo apellido o un solo nombre, y obligar a los cuatro las dejaria fuera.
   */
  private configurarNombreSeparado(): void {
    const personalInfo = this.form.get('personalInfo');
    if (!personalInfo) {
      return;
    }

    personalInfo.get('fullName')?.clearValidators();
    personalInfo.get('fullName')?.updateValueAndValidity({ emitEvent: false });
    personalInfo.get('apellidoPaterno')?.setValidators(Validators.required);
    personalInfo.get('nombrePrimero')?.setValidators(Validators.required);
    personalInfo.get('apellidoPaterno')?.updateValueAndValidity({ emitEvent: false });
    personalInfo.get('nombrePrimero')?.updateValueAndValidity({ emitEvent: false });

    ['apellidoPaterno', 'apellidoMaterno', 'nombrePrimero', 'nombreSegundo'].forEach((campo) => {
      personalInfo.get(campo)?.valueChanges.subscribe(() => this.componerNombreCompleto());
    });
  }

  /**
   * Decide si hay que preguntar la modalidad y ajusta las validaciones.
   *
   * Solo se exige lo que la persona puede contestar: si la modalidad se hereda
   * de nómina el campo no se muestra, y exigirlo dejaría el formulario
   * bloqueado sin nada visible que corregir.
   */
  private configurarModalidad(mostrar: boolean): void {
    this.mostrarSelectorModalidad = mostrar;

    const personalInfo = this.form.get('personalInfo');
    const regimen = personalInfo?.get('laborRegime');
    const modalidad = personalInfo?.get('employmentType');

    if (mostrar) {
      regimen?.setValidators(Validators.required);
      modalidad?.setValidators(Validators.required);
      this.cargarCatalogoModalidades();
    } else {
      regimen?.clearValidators();
      modalidad?.clearValidators();
    }

    regimen?.updateValueAndValidity({ emitEvent: false });
    modalidad?.updateValueAndValidity({ emitEvent: false });
  }

  /** El catálogo se pide una sola vez, y solo si se va a mostrar. */
  private cargarCatalogoModalidades(): void {
    if (this.modalidades.length > 0) {
      return;
    }
    this.estadoCatalogo = 'cargando';
    this.backendService.getModalidades().subscribe((modalidades) => {
      this.modalidades = modalidades;
      // El servicio convierte cualquier error en una lista vacía, así que la
      // lista vacía es la señal de fallo: nómina siempre tiene modalidades
      // vigentes, nunca devuelve cero.
      this.estadoCatalogo = modalidades.length > 0 ? 'listo' : 'error';
    });
  }

  /** Vuelve a pedir el catálogo desde el aviso de error. */
  reintentarCatalogo(): void {
    this.cargarCatalogoModalidades();
  }

  /**
   * Toma de nómina la modalidad y la fecha de ingreso del propio usuario
   * interno.
   *
   * Se consulta después de cargar la declaración guardada, no antes, para que
   * gane nómina: los campos se muestran bloqueados, y mostrar bloqueado un
   * valor viejo que ya no corresponde sería peor que no mostrarlo.
   *
   * Son dos datos independientes de la misma respuesta: que falte uno no debe
   * impedir precargar el otro. Si nómina no tiene la modalidad, se pregunta
   * con el mismo selector del externo; si no tiene la fecha de ingreso, ese
   * campo queda editable, igual que a un externo.
   */
  private heredarDatosDeNomina(): void {
    const usuario = this.authService.getCurrentUser();
    const codigo = usuario?.CODIGO;

    if (!codigo) {
      this.configurarModalidad(true);
      return;
    }

    this.backendService.obtenerUbicacionPersonal(codigo).subscribe({
      next: (ubicacion: PersonalUbicacionDto | null) => {
        this.encargadoSegunNomina = ubicacion?.ENCARGADO === true;
        // Solo la parte antes del guion: "LOEP - LEY ORGANICA DE EMPRESAS
        // PUBLICAS" se muestra como "LOEP", igual que en el selector.
        this.regimenSegunNomina = (ubicacion?.REGIMEN || '').split(' - ')[0].trim();

        // Chequeo por verdad, no por `!== null`: un campo que el backend no
        // incluyo en el JSON llega como `undefined`, no como `null`, y una
        // comparacion estricta contra `null` lo dejaria pasar como si
        // trajera dato. `if (valor)` trata undefined, null y '' por igual.
        if (ubicacion?.FECHA_INGRESO) {
          this.form.get('personalInfo.startDate')?.setValue(
            ubicacion.FECHA_INGRESO, { emitEvent: false });
          this.camposBloqueados['startDate'] = true;
          this.checkFormChanges();
        }

        if (!ubicacion?.MODALIDAD) {
          this.configurarModalidad(true);
          return;
        }

        this.form.get('personalInfo')?.patchValue({
          employmentType: ubicacion.MODALIDAD,
          employmentTypeCode: ubicacion.MODALIDAD_CODIGO,
          laborRegime: ubicacion.REGIMEN_CODIGO
        }, { emitEvent: false });

        this.camposBloqueados['employmentType'] = true;
        this.configurarModalidad(false);
        this.checkFormChanges();
      },
      error: () => {
        // Nómina no respondió. Se pregunta la modalidad, que es preferible a
        // guardar vacío; la fecha de ingreso queda editable, igual que a un
        // externo.
        this.configurarModalidad(true);
      }
    });
  }

  /**
   * Regímenes disponibles, deducidos del catálogo.
   *
   * La descripción de nómina es larga para un radio ("LOEP - LEY ORGANICA DE
   * EMPRESAS PUBLICAS"), así que se muestra la parte anterior al guion. Lo que
   * se guarda es el código, de modo que el texto es solo presentación.
   */
  get regimenes(): Array<{ codigo: string; etiqueta: string; descripcion: string }> {
    const vistos = new Map<string, { codigo: string; etiqueta: string; descripcion: string }>();
    this.modalidades.forEach((m) => {
      const codigo = m.REGIMEN_CODIGO || '';
      if (!codigo || vistos.has(codigo)) {
        return;
      }
      const descripcion = m.REGIMEN || codigo;
      vistos.set(codigo, {
        codigo,
        etiqueta: descripcion.split(' - ')[0].trim(),
        descripcion
      });
    });
    return Array.from(vistos.values());
  }

  /** Modalidades del régimen elegido. Vacía mientras no se elija ninguno. */
  get modalidadesDelRegimen(): ModalidadContratoDto[] {
    const regimen = this.form.get('personalInfo.laborRegime')?.value;
    return regimen
      ? this.modalidades.filter((m) => m.REGIMEN_CODIGO === regimen)
      : [];
  }

  /**
   * Al cambiar de régimen se limpia la modalidad: las de un régimen no valen
   * para el otro, y dejarla puesta guardaría una combinación imposible.
   */
  onRegimenChange(): void {
    this.form.get('personalInfo')?.patchValue({
      employmentType: '',
      employmentTypeCode: ''
    });
    this.checkFormChanges();
  }

  /** El select maneja el código; el texto se copia para el PDF y los listados. */
  onModalidadChange(codigo: string): void {
    const elegida = this.modalidades.find((m) => m.CODIGO === codigo);
    this.form.get('personalInfo')?.patchValue({
      employmentTypeCode: codigo,
      employmentType: elegida?.DESCRIPCION || ''
    });
    this.checkFormChanges();
  }

  /**
   * Rellena los cuatro campos del nombre cuando la declaración guardada solo
   * traía el nombre completo.
   *
   * Pasa con las declaraciones anteriores a que se capturara por separado: sin
   * esto los campos aparecerían vacíos y habría que reescribir el nombre. Se
   * reparte con el mismo criterio que usa el backend, y como queda a la vista
   * la persona puede corregirlo si el reparto no acertó.
   */
  private desglosarNombreSiHaceFalta(): void {
    const personalInfo = this.form.get('personalInfo');
    if (!personalInfo || this.esUsuarioInterno) {
      return;
    }

    const yaTienePartes = ['apellidoPaterno', 'apellidoMaterno', 'nombrePrimero', 'nombreSegundo']
      .some((campo) => (personalInfo.get(campo)?.value ?? '').toString().trim().length > 0);

    const completo = (personalInfo.get('fullName')?.value ?? '').toString().trim().replace(/\s+/g, ' ');
    if (yaTienePartes || !completo) {
      return;
    }

    const palabras = completo.split(' ');
    let partes: (string | null)[];

    if (palabras.length === 1) {
      partes = [palabras[0], null, null, null];
    } else if (palabras.length === 2) {
      // Se lee como "apellido nombre": poner la segunda palabra en el apellido
      // materno ensuciaría después las búsquedas por apellido.
      partes = [palabras[0], null, palabras[1], null];
    } else if (palabras.length === 3) {
      partes = [palabras[0], palabras[1], palabras[2], null];
    } else {
      partes = [palabras[0], palabras[1], palabras[2], palabras.slice(3).join(' ')];
    }

    personalInfo.patchValue({
      apellidoPaterno: partes[0] ?? '',
      apellidoMaterno: partes[1] ?? '',
      nombrePrimero: partes[2] ?? '',
      nombreSegundo: partes[3] ?? ''
    }, { emitEvent: false });

    // Este reparto es una conjetura, igual que el del registro civil: falla con
    // apellidos o nombres compuestos. Se avisa para que la persona lo revise, y
    // los cuatro campos se quedan editables para que pueda corregirlo.
    this.nombrePrecargado = true;
  }

  /**
   * Precarga el nombre del usuario externo desde el registro civil, usando la
   * cedula con la que inicio sesion.
   *
   * Solo se consulta cuando los cuatro campos estan vacios, de modo que no se
   * pisa lo que la persona ya escribio ni lo que traia una declaracion
   * anterior. Eso ademas evita repetir una consulta que es auditada y de
   * consumo limitado.
   *
   * Si el servicio no responde o la cedula no esta registrada, los campos
   * quedan vacios y se escriben a mano: precargar es una ayuda, no un
   * requisito.
   */
  private precargarNombreDesdeCedula(): void {
    const personalInfo = this.form.get('personalInfo');
    if (!personalInfo || this.esUsuarioInterno) {
      return;
    }

    const yaTienePartes = ['apellidoPaterno', 'apellidoMaterno', 'nombrePrimero', 'nombreSegundo']
      .some((campo) => (personalInfo.get(campo)?.value ?? '').toString().trim().length > 0);

    const cedula = (personalInfo.get('ci')?.value ?? '').toString().trim();
    if (yaTienePartes || cedula.length !== 10 || this.yaSeConsultoIdentidad) {
      return;
    }
    this.yaSeConsultoIdentidad = true;

    this.backendService.consultarIdentidad(cedula).subscribe((identidad) => {
      if (!identidad) {
        return;
      }

      personalInfo.patchValue({
        apellidoPaterno: identidad.APELLIDO_PATER ?? '',
        apellidoMaterno: identidad.APELLIDO_MATER ?? '',
        nombrePrimero: identidad.NOMBRE_PRIMERO ?? '',
        nombreSegundo: identidad.NOMBRE_SEGUNDO ?? ''
      }, { emitEvent: false });

      this.componerNombreCompleto();

      // El registro civil entrega el nombre como un solo texto, asi que las
      // cuatro partes salen de repartirlo y pueden fallar con apellidos
      // compuestos. Se avisa para que la persona lo revise.
      this.nombrePrecargado = true;
    });
  }

  /** Arma el nombre completo en el orden de nomina: apellidos y luego nombres. */
  private componerNombreCompleto(): void {
    const personalInfo = this.form.get('personalInfo');
    if (!personalInfo) {
      return;
    }

    const completo = ['apellidoPaterno', 'apellidoMaterno', 'nombrePrimero', 'nombreSegundo']
      .map((campo) => (personalInfo.get(campo)?.value ?? '').toString().trim())
      .filter((parte) => parte.length > 0)
      .join(' ');

    personalInfo.get('fullName')?.setValue(completo, { emitEvent: false });
  }

  downloadExcuseFromMenu(): void {
    const link = document.createElement('a');
    link.href = '/sisci/assets/FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
    link.download = 'FORMULARIO_DE_EXCUSAS_EV_EEASA.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  ngOnInit(): void {
    const tieneRolAdmin = this.authService.hasRole('A');
    const tieneRolJefeRRHH = this.authService.hasRole('R');
    if (tieneRolAdmin || tieneRolJefeRRHH) {
      this.router.navigate(['/admin']);
      return;
    }
    this.cargarDatosUsuario();
  }

  private cargarDatosUsuario(): void {
    const usuario = this.authService.getCurrentUser();
    if (usuario) {
      console.log('[ConflictFormComponent] Cargando datos del usuario:', usuario);
      
      const personalInfo = this.form.get('personalInfo');
      if (personalInfo) {
        if (usuario.NOMBRES) {
          if (!personalInfo.get('fullName')?.value) {
            personalInfo.patchValue({ fullName: usuario.NOMBRES }, { emitEvent: false });
          }
          this.camposBloqueados['fullName'] = true;
        }
        if (usuario.CEDULA) {
          if (!personalInfo.get('ci')?.value) {
            personalInfo.patchValue({ ci: usuario.CEDULA }, { emitEvent: false });
          }
          this.camposBloqueados['ci'] = true;
        }
        if (usuario.DEPARTAMENTO) {
          if (!personalInfo.get('unit')?.value) {
            personalInfo.patchValue({ unit: usuario.DEPARTAMENTO }, { emitEvent: false });
          }
          this.camposBloqueados['unit'] = true;
        }
        if (usuario.CARGO) {
          if (!personalInfo.get('position')?.value) {
            personalInfo.patchValue({ position: usuario.CARGO }, { emitEvent: false });
          }
          this.camposBloqueados['position'] = true;
        }

        this.desglosarNombreSiHaceFalta();

        const ci = personalInfo.get('ci')?.value || usuario.CEDULA;
        if (ci) {
          if (!this.yaSeCargoFormularioGuardado) {
            this.yaSeCargoFormularioGuardado = true;
            this.cargarFormularioGuardadoPorCi(ci);
          }
        } else {
          setTimeout(() => {
            this.saveInitialFormState();
          }, 100);
        }
      }
    } else {
      console.log('[ConflictFormComponent] No hay usuario autenticado para cargar datos');
      setTimeout(() => {
        this.saveInitialFormState();
      }, 100);
    }
  }


  private cargarFormularioGuardadoPorCi(ci: string): void {
    this.backendService.getFormsByCedula(ci).subscribe({
      next: (forms: PlantillaTemporalDto[]) => {

        if (!forms || forms.length === 0) {
          this.setHasExistingForm(false);
          this.precargarNombreDesdeCedula();
          return;
        }

        const sorted = [...forms].sort((a, b) => {
          const fechaA = a.FECHA_GENERACION ? new Date(a.FECHA_GENERACION).getTime() : 0;
          const fechaB = b.FECHA_GENERACION ? new Date(b.FECHA_GENERACION).getTime() : 0;
          return fechaB - fechaA;
        });

        const ultimoForm = sorted[0];
        if (!ultimoForm) {
          this.setHasExistingForm(false);
          this.precargarNombreDesdeCedula();
          return;
        }

        if (!ultimoForm.JSON) {
          
          this.setHasExistingForm(false);
          this.precargarNombreDesdeCedula();

          setTimeout(() => {
            this.saveInitialFormState();
          }, 100);
          return;
        }

        this.setHasExistingForm(true);

        console.log(' Cargando formulario desde BD para CI:', ci, ultimoForm);

        let saved: any;
        try {
          saved = JSON.parse(ultimoForm.JSON);
        } catch (e) {
          console.error('Error al parsear JSON de la plantilla:', e);
          return;
        }

        // De la declaración anterior sólo se recupera la información personal.
        // Las preguntas Sí/No vuelven a quedar sin responder para que la persona
        // las conteste de cero: antes se restauraban con `?? false` y volvían a
        // salir marcadas en "No", que es justo lo que confundía.
        //
        // Las listas SÍ se recuperan, pero deshabilitadas. Vaciarlas perdía
        // datos: al enviar, el backend actualiza el mismo registro en lugar de
        // versionarlo, así que quien reabría su declaración y volvía a enviarla
        // reemplazaba a sus familiares declarados por lo que alcanzara a
        // retipear, sin copia anterior donde recuperarlos.
        //
        // Deshabilitadas resuelve lo que motivó vaciarlas: un control
        // deshabilitado no cuenta para la validez ni entra en `form.value`, de
        // modo que el bloque puede estar oculto con la pregunta sin responder
        // sin dejar el formulario inválido y sin forma visible de arreglarlo.
        // Se habilitan al responder "Sí" y se vacían al responder "No".
        //
        // El `null` no llega a la base: las seis preguntas llevan
        // `Validators.required` y `onSubmit()` sólo envía con el formulario
        // válido, así que lo persistido siempre es `true` o `false`.
        this.familyMembers.clear();
        if (Array.isArray(saved.personalInterests?.familyMembers)) {
          saved.personalInterests.familyMembers.forEach((familiar: any) => {
            const grupo = this.crearGrupoFamiliar(
              familiar?.origen || ConflictFormComponent.ORIGEN_EEASA);
            grupo.patchValue(familiar);
            this.familyMembers.push(grupo);
            // Lo que quedó guardado salió del directorio en su momento, así que
            // se muestra como texto; lo que se guardó vacío sigue por llenar.
            // Del familiar de otra entidad solo vino la identidad: la entidad y
            // el departamento los escribió la persona y los puede corregir.
            this.marcarCamposFijosFamiliar(grupo,
              familiar?.origen === ConflictFormComponent.ORIGEN_EXTERNO
                ? ['name', 'ci']
                : ConflictFormComponent.CAMPOS_FAMILIAR_PRECARGABLES);
          });
        }

        this.suppliersList.clear();
        if (Array.isArray(saved.suppliers?.suppliersList)) {
          saved.suppliers.suppliersList.forEach((proveedor: any) => {
            const grupo = this.crearGrupoProveedor();
            grupo.patchValue(proveedor);
            this.suppliersList.push(grupo);
          });
        }

        // Despues de poblarlas, no antes: disable() solo alcanza a los
        // controles que ya existen.
        this.familyMembers.disable({ emitEvent: false });
        this.suppliersList.disable({ emitEvent: false });

        this.form.patchValue({
          personalInfo: saved.personalInfo || {},
          personalInterests: {
            hasFinancialInterest: null,
            financialInterestDetail: '',
            hasFamilyInstitution: null
          },
          suppliers: {
            hasSupplierRelations: null
          },
          incompatibility: {
            hasOtherSituations: null,
            otherSituationsDetail: ''
          },
          procedures: {
            commitToReview: null,
            commitToInform: null
          },
          // No se arrastra la aceptación de la declaración anterior: aceptar es un
          // acto propio de cada envío, así que debe marcarse de nuevo cada vez.
          declarationAccepted: false
        }, { emitEvent: false });

        // Antes de deducir nada: lo que la declaración guardada trajo con dato
        // se muestra como texto, y lo que llegó vacío queda por llenar. Las dos
        // llamadas de abajo solo actúan sobre campos vacíos, así que un nombre
        // deducido nunca queda marcado como fijo y se puede corregir.
        this.marcarCamposFijosPersonales(
          ConflictFormComponent.CAMPOS_PERSONALES_PRECARGABLES);

        this.desglosarNombreSiHaceFalta();
        this.precargarNombreDesdeCedula();
        if (this.esUsuarioInterno) {
          this.heredarDatosDeNomina();
        }

        setTimeout(() => {
          this.saveInitialFormState();
        }, 100);
      },
      error: (err) => {
        console.error('Error al cargar formulario desde BD por cédula:', ci, err);
        // Aunque falle la carga, se intenta precargar el nombre: los campos
        // quedaron vacios y es cuando mas ayuda.
        this.precargarNombreDesdeCedula();
        if (this.esUsuarioInterno) {
          this.heredarDatosDeNomina();
        }
      }
    });
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.statusMessage = message;
    this.statusType = type;
    this.statusModalOpen = true;
  }

  closeStatusModal(): void {
    this.statusModalOpen = false;
    this.statusMessage = null;
    this.statusType = null;
  }

  /**
   * Hoy en formato `yyyy-MM-dd`.
   *
   * Se arma con los getters locales y no con `toISOString()`, que devuelve la
   * fecha en UTC: en Ecuador (UTC-5) a partir de las 19:00 eso ya daria el dia
   * siguiente y dejaria pasar una fecha de manana.
   */
  private static hoyIso(): string {
    const hoy = new Date();
    const mes = `${hoy.getMonth() + 1}`.padStart(2, '0');
    const dia = `${hoy.getDate()}`.padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }

  /**
   * Tope del selector de fecha, para que el calendario no ofrezca dias futuros.
   *
   * Es la primera barrera, no la unica: el atributo `max` se puede saltar
   * escribiendo la fecha a mano o desde las herramientas del navegador, asi que
   * `fechaIngresoValidator` la vuelve a comprobar.
   */
  get fechaMaxima(): string {
    return ConflictFormComponent.hoyIso();
  }

  /**
   * Rechaza una fecha de ingreso posterior a hoy: nadie ingresa en el futuro.
   *
   * Compara las dos fechas como texto `yyyy-MM-dd`, que en ese formato ordena
   * igual que cronologicamente. Asi no hay que construir un `Date`, que al
   * interpretar la cadena como UTC correria la fecha un dia.
   *
   * El campo vacio lo rechaza `Validators.required`; aqui se deja pasar para no
   * mostrar dos errores por lo mismo.
   */
  fechaIngresoValidator(control: AbstractControl): ValidationErrors | null {
    const valor = (control.value ?? '').toString().trim();
    if (!valor) {
      return null;
    }
    return valor > ConflictFormComponent.hoyIso()
      ? { fechaFutura: { message: 'La fecha de ingreso no puede ser posterior a hoy.' } }
      : null;
  }

  ciValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const value = control.value.toString().trim();
    if (!/^\d+$/.test(value)) {
      return { ciInvalid: { message: 'La cédula de identidad debe contener solo números' } };
    }
    if (value.length !== 10) {
      return { ciInvalid: { message: 'Cédula invalida, debe contener 10 dígitos' } };
    }
    // Mismas reglas que CedulaEcuatorianaValidator en el backend, para que el
    // formulario no acepte lo que el servidor después rechaza. Sin esto, una
    // cédula mal tipeada de un proveedor salía a buscarse en el registro civil
    // y volvía como "no se encontraron datos", cuando el problema era el número.
    if (!ConflictFormComponent.cedulaEcuatorianaValida(value)) {
      return { ciInvalid: { message: 'Cédula inválida, verifique el número' } };
    }
    return null;
  }

  /** Provincia 01-24, tercer dígito hasta 5 y dígito verificador módulo 10. */
  private static cedulaEcuatorianaValida(cedula: string): boolean {
    const provincia = Number(cedula.substring(0, 2));
    if (provincia < 1 || provincia > 24 || Number(cedula[2]) > 5) {
      return false;
    }
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    const suma = coeficientes.reduce((acc, coef, i) => {
      const producto = Number(cedula[i]) * coef;
      return acc + (producto >= 10 ? producto - 9 : producto);
    }, 0);
    const verificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
    return verificador === Number(cedula[9]);
  }

  get familyMembers(): FormArray {
    return this.form.get('personalInterests.familyMembers') as FormArray;
  }

  get suppliersList(): FormArray {
    return this.form.get('suppliers.suppliersList') as FormArray;
  }

  /** Abre el buscador institucional; el familiar se crea al elegir a la persona. */
  abrirBuscadorFamiliar(): void {
    this.buscadorAbierto = true;
    this.busquedaPersonal = '';
    this.resultadosBusqueda = [];
    this.buscando = false;
    this.modoBuscador = 'eeasa';
    this.reiniciarBusquedaExterna();
  }

  /**
   * Cambia de pestaña. Si la persona escribió una cédula completa en la
   * pestaña de EEASA y no apareció, se la lleva a la otra pestaña ya cargada:
   * es el caso típico de quien empezó a buscar en el lugar equivocado.
   */
  cambiarModoBuscador(modo: 'eeasa' | 'externa'): void {
    this.modoBuscador = modo;
    const termino = this.busquedaPersonal.trim();
    if (modo === 'externa' && /^\d{10}$/.test(termino) && !this.cedulaExterna) {
      this.buscarCedulaExterna(termino);
    }
  }

  private reiniciarBusquedaExterna(): void {
    this.cedulaExterna = '';
    this.estadoExterna = 'inicial';
    this.nombreExterna = null;
  }

  onCedulaExternaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cedula = input.value.replace(/\D/g, '').substring(0, 10);
    input.value = cedula;
    this.buscarCedulaExterna(cedula);
  }

  /**
   * Busca por cédula en el registro civil a un familiar que no está en nómina.
   * Mismas reglas que la consulta de proveedores: solo cédulas válidas, y cada
   * cédula se consulta una vez por sesión.
   */
  private buscarCedulaExterna(cedula: string): void {
    this.cedulaExterna = cedula;
    this.nombreExterna = null;

    if (cedula.length < 10) {
      this.estadoExterna = 'inicial';
      return;
    }
    if (this.ciValidator({ value: cedula } as AbstractControl)) {
      this.estadoExterna = 'invalida';
      return;
    }

    this.consultarIdentidad(cedula, (nombre) => {
      // Se descarta la respuesta si la cédula cambió mientras se esperaba.
      if (this.cedulaExterna !== cedula) {
        return;
      }
      this.nombreExterna = nombre;
      this.estadoExterna = nombre ? 'encontrado' : 'no-encontrado';
    }, () => (this.estadoExterna = 'buscando'));
  }

  /** La cédula buscada en la pestaña de otra entidad ya está declarada. */
  get externaYaDeclarada(): boolean {
    return !!this.cedulaExterna && this.familyMembers.controls.some(
      (control) => (control.get('ci')?.value || '').trim() === this.cedulaExterna);
  }

  /**
   * Crea el familiar que trabaja en otra entidad.
   *
   * Nombre y cédula quedan fijos cuando el registro civil los confirmó. La
   * institución, en cambio, no la sabe ningún servicio: se deja vacía y
   * obligatoria, porque una relación declarada sin decir con qué entidad no
   * dice nada. Sección y área no aplican: son nodos de la estructura de EEASA.
   */
  agregarFamiliarExterno(): void {
    if (this.cedulaExterna.length !== 10 || this.externaYaDeclarada) {
      return;
    }

    const grupo = this.crearGrupoFamiliar(ConflictFormComponent.ORIGEN_EXTERNO);
    grupo.patchValue({
      ci: this.cedulaExterna,
      name: this.nombreExterna || ''
    });
    this.familyMembers.push(grupo);
    this.marcarCamposFijosFamiliar(grupo, this.nombreExterna ? ['name', 'ci'] : ['ci']);

    this.cerrarBuscadorFamiliar();
    this.checkFormChanges();
  }

  /** Ese familiar trabaja en otra entidad, no en EEASA. */
  familiarEsExterno(indice: number): boolean {
    return this.familyMembers.at(indice)?.get('origen')?.value === ConflictFormComponent.ORIGEN_EXTERNO;
  }

  cerrarBuscadorFamiliar(): void {
    this.buscadorAbierto = false;
  }

  onBuscarPersona(event: Event): void {
    const termino = (event.target as HTMLInputElement).value;
    this.busquedaPersonal = termino;
    this.buscando = termino.trim().length >= ConflictFormComponent.MIN_BUSQUEDA;
    if (!this.buscando) {
      this.resultadosBusqueda = [];
    }
    this.busquedaPersonal$.next(termino);
  }

  /** Leyenda bajo el campo de búsqueda del modal. */
  get textoResultados(): string {
    if (this.busquedaPersonal.trim().length < ConflictFormComponent.MIN_BUSQUEDA) {
      return 'Directorio institucional · escriba al menos ' +
        ConflictFormComponent.MIN_BUSQUEDA + ' caracteres';
    }
    if (this.buscando) {
      return 'Buscando…';
    }
    const total = this.resultadosBusqueda.length;
    return total === 1 ? '1 persona encontrada' : total + ' personas encontradas';
  }

  get sinResultados(): boolean {
    return !this.buscando &&
      this.busquedaPersonal.trim().length >= ConflictFormComponent.MIN_BUSQUEDA &&
      this.resultadosBusqueda.length === 0;
  }

  /** Evita declarar dos veces a la misma persona. */
  yaAgregado(persona: PersonalBusquedaDto): boolean {
    return this.familyMembers.controls.some((control) => {
      const ci = (control.get('ci')?.value || '').trim();
      const nombre = (control.get('name')?.value || '').trim();
      return persona.CEDULA
        ? ci === persona.CEDULA
        : !!persona.NOMBRE_COMPLETO && nombre === persona.NOMBRE_COMPLETO;
    });
  }

  /**
   * Crea el familiar con los datos de la persona elegida y completa su ubicación.
   *
   * La cedula solo llega para personal interno; para el resto el backend la manda
   * en null y el campo queda editable para escribirla a mano.
   */
  seleccionarPersona(persona: PersonalBusquedaDto): void {
    if (this.yaAgregado(persona)) {
      return;
    }

    const grupo = this.crearGrupoFamiliar();
    grupo.patchValue({
      name: persona.NOMBRE_COMPLETO || '',
      ci: persona.CEDULA || ''
    });
    this.familyMembers.push(grupo);
    // Lo que trajo el buscador queda fijo. La cedula solo llega para personal
    // interno; para el resto viene null y su campo se queda editable.
    this.marcarCamposFijosFamiliar(grupo, ['name', 'ci', 'position']);

    if (persona.CODIGO) {
      this.backendService.obtenerUbicacionPersonal(persona.CODIGO).subscribe((ubicacion) => {
        // Puede venir null: el procedimiento de la base usa INNER JOIN sobre zona
        // y estructura, y no ubica a todo el personal que devuelve el buscador.
        // En ese caso los campos se dejan para llenarlos a mano.
        if (!ubicacion) {
          return;
        }
        // Se escribe sobre el grupo y no sobre su posicion en la lista: si
        // mientras llegaba la respuesta se quito un familiar anterior, el
        // indice ya apuntaria a otra fila.
        //
        // Seccion y area solo existen para quienes cuelgan de esos nodos del
        // arbol organizacional; para el resto llegan nulas y se quedan vacias.
        grupo.patchValue({
          department: ubicacion.DEPARTAMENTO || '',
          section: ubicacion.SECCION || '',
          area: ubicacion.AREA || ''
        });
        // Solo los tres que pudo llenar esta respuesta: los demas ya se
        // anotaron al crear la fila.
        this.marcarCamposFijosFamiliar(grupo, ['department', 'section', 'area']);
      });
    }

    this.cerrarBuscadorFamiliar();
    this.checkFormChanges();
  }

  /**
   * Indica si el familiar de esa fila ya fue declarado en una fila anterior.
   *
   * Se compara por cédula cuando ambas están completas, porque identifica a la
   * persona sin ambigüedad, y por nombre normalizado cuando no. Solo se marca
   * la fila repetida, no la primera: es la que hay que corregir o quitar.
   */
  esFamiliarDuplicado(indice: number): boolean {
    const actual = this.familyMembers.at(indice);
    if (!actual) {
      return false;
    }

    const cedulaActual = (actual.get('ci')?.value ?? '').toString().trim();
    const nombreActual = this.normalizarNombre(actual.get('name')?.value);

    if (!cedulaActual && !nombreActual) {
      return false;
    }

    for (let previo = 0; previo < indice; previo++) {
      const otro = this.familyMembers.at(previo);
      const cedulaOtro = (otro.get('ci')?.value ?? '').toString().trim();

      if (cedulaActual && cedulaOtro) {
        if (cedulaActual === cedulaOtro) {
          return true;
        }
        // Con dos cédulas distintas son personas distintas, aunque coincida el
        // nombre: los homónimos existen.
        continue;
      }

      if (nombreActual && nombreActual === this.normalizarNombre(otro.get('name')?.value)) {
        return true;
      }
    }

    return false;
  }

  /** Hay algún familiar repetido en la lista. */
  hayFamiliaresDuplicados(): boolean {
    return this.familyMembers.controls.some((_, indice) => this.esFamiliarDuplicado(indice));
  }

  private normalizarNombre(valor: any): string {
    return (valor ?? '').toString().trim().toUpperCase().replace(/\s+/g, ' ');
  }

  /** Texto del contador que acompaña al rótulo "Familiares declarados". */
  get conteoFamiliares(): string {
    const total = this.familyMembers.length;
    return total === 1 ? '1 registro' : total + ' registros';
  }

  /** Iniciales para los avatares; guion si no hay nombre. */
  inicialesDe(nombre: string | null | undefined): string {
    const limpio = (nombre || '').trim();
    if (!limpio) {
      return '—';
    }
    return limpio
      .split(/\s+/)
      .slice(0, 2)
      .map((parte: string) => parte.charAt(0).toUpperCase())
      .join('');
  }

  inicialesFamiliar(indice: number): string {
    return this.inicialesDe(this.familyMembers.at(indice)?.get('name')?.value);
  }

  removeFamilyMember(index: number): void {
    this.familyMembers.removeAt(index);
    this.checkFormChanges();
  }

  addSupplier(): void {
    this.suppliersList.push(this.crearGrupoProveedor());
    this.checkFormChanges();
  }

  /**
   * Vuelve la fila del proveedor al punto de partida para buscar otra cédula.
   *
   * Cédula y nombre verificados van juntos: el nombre es el de esa cédula. Si
   * se pudiera cambiar la cédula dejando el nombre, quedaría declarado el
   * nombre de una persona con la cédula de otra. Por eso se limpian los dos.
   */
  cambiarCedulaProveedor(indice: number): void {
    const grupo = this.suppliersList.at(indice);
    if (!grupo) {
      return;
    }
    grupo.patchValue({ ci: '', name: '', nombreVerificado: false });
    this.estadoConsultaProveedor.delete(grupo);
    this.checkFormChanges();
  }

  /**
   * Fila vacia de familiar. La usan el buscador, que la completa con la persona
   * elegida, y la recuperacion de una declaracion anterior.
   */
  private crearGrupoFamiliar(origen: string = ConflictFormComponent.ORIGEN_EEASA): FormGroup {
    const externo = origen === ConflictFormComponent.ORIGEN_EXTERNO;
    return this.fb.group({
      name: ['', Validators.required],
      ci: ['', [Validators.required, this.ciValidator]],
      relationship: ['', Validators.required],
      // Para quien trabaja en EEASA es siempre EEASA y se muestra como texto.
      // Para quien trabaja en otra entidad es justamente lo que hay que
      // escribir, y es obligatorio.
      position: [externo ? '' : INSTITUCION_PROPIA, externo ? Validators.required : []],
      department: [''],
      section: [''],
      area: [''],
      // Se guarda para reconstruir la tarjeta al reabrir la declaración: sin él
      // no habría forma de saber si la institución se escribió a mano o vino
      // de nómina. Las declaraciones anteriores no lo tienen y valen como EEASA,
      // que era la única opción que ofrecía el buscador.
      origen: [origen]
    });
  }

  /** Valores del campo `origen` de un familiar. */
  private static readonly ORIGEN_EEASA = 'EEASA';
  private static readonly ORIGEN_EXTERNO = 'EXTERNA';

  /** Fila vacia de proveedor. */
  private crearGrupoProveedor(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      ci: ['', [Validators.required, this.ciValidator]],
      relationship: ['', Validators.required],
      detail: ['', Validators.required],
      company: ['', Validators.required],
      contractType: [''],
      // El nombre salió del registro civil para esta cédula. Se guarda para
      // mostrarlo fijo también al reabrir la declaración: sin él no se podría
      // distinguir un nombre confirmado de uno escrito a mano.
      nombreVerificado: [false]
    });
  }

  removeSupplier(index: number): void {
    this.suppliersList.removeAt(index);
    this.checkFormChanges();
  }

  private saveInitialFormState(): void {
    this.initialFormValue = JSON.stringify(this.form.value);
    this.formHasChanges = false;
  }

  private checkFormChanges(): void {
    const currentFormValue = JSON.stringify(this.form.value);
    this.formHasChanges = currentFormValue !== this.initialFormValue;
  }

  /**
   * Desplaza la vista hasta una sección del formulario desde el índice lateral.
   */
  irASeccion(id: string): void {
    this.seccionActiva = id;
    if (!this.esNavegador) {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Porcentaje de avance: proporción de controles con validador `required` /
   * `requiredTrue` que ya son válidos. Es un valor derivado de las validaciones
   * que ya existen, por lo que llega a 100 % exactamente cuando el formulario
   * puede enviarse.
   *
   * Es un getter, no un campo cacheado. Antes se actualizaba solo desde el
   * subscribe de `form.valueChanges`, y quedaba desactualizado después de
   * cualquier `patchValue(..., { emitEvent: false })` —por ejemplo, justo al
   * cargar una declaración guardada, que parchea decenas de campos de una
   * sola vez sin emitir evento— porque nada volvía a llamar al recálculo.
   * Como getter no hace falta acordarse de recalcular nada: Angular ya
   * reevalúa las expresiones de la plantilla en cada ciclo de detección de
   * cambios, así que siempre lee el estado real del formulario.
   */
  get progreso(): number {
    const requeridos = this.recolectarRequeridos(this.form);
    if (requeridos.length === 0) {
      return 0;
    }
    const completos = requeridos.filter((control) => control.valid).length;
    return Math.round((completos / requeridos.length) * 100);
  }

  /**
   * Los controles deshabilitados se excluyen por completo, no solo del
   * numerador de completos: `this.form.valid` —el que de verdad habilita el
   * envío— tampoco los toma en cuenta, así que contarlos aquí solo bajaba el
   * porcentaje sin que hubiera manera de completarlos y llegar al 100 %.
   * Pasaba con `familyMembers` y `suppliersList` justo después de cargar una
   * declaración guardada: quedan deshabilitados hasta que la persona vuelve
   * a contestar la pregunta Sí/No, y mientras tanto sus campos obligatorios
   * ya llenos contaban como pendientes.
   */
  private recolectarRequeridos(contenedor: FormGroup | FormArray): AbstractControl[] {
    const requeridos: AbstractControl[] = [];
    const hijos: AbstractControl[] = contenedor instanceof FormArray
      ? contenedor.controls
      : Object.values(contenedor.controls);

    hijos.forEach((control) => {
      if (control.disabled) {
        return;
      }
      if (control instanceof FormGroup || control instanceof FormArray) {
        // Una lista obligatoria cuenta como un campo más: vacía, el formulario
        // no se puede enviar, y la barra no debe marcar 100 %.
        if (control instanceof FormArray && control.hasValidator(Validators.required)) {
          requeridos.push(control);
        }
        requeridos.push(...this.recolectarRequeridos(control));
      } else if (
        control.hasValidator(Validators.required) ||
        control.hasValidator(Validators.requiredTrue)
      ) {
        requeridos.push(control);
      }
    });

    return requeridos;
  }

  /**
   * Arma el aviso de "faltan campos" nombrando cada uno, en vez del mensaje
   * genérico de antes: obligaba a revisar las siete secciones a mano para
   * encontrar qué faltaba.
   *
   * No hace falta ramificar por interno/externo: el conjunto de campos
   * requeridos ya varía solo, porque cada sección activa o desactiva sus
   * validadores según el caso (ver configurarNombreSeparado y
   * configurarModalidad). Aquí solo se nombra lo que en ese momento sigue
   * siendo obligatorio y está sin completar.
   */
  private mensajeCamposFaltantes(): string {
    const faltantes = this.camposFaltantes();
    if (faltantes.length === 0) {
      // No debería pasar: se llama solo cuando this.form.valid es false. Si
      // pasa, algo quedó inválido sin Validators.required (un patrón, por
      // ejemplo) y ahí sí conviene el aviso genérico.
      return 'Por favor complete todos los campos requeridos del formulario.';
    }
    const lista = faltantes.map((campo) => `• ${campo}`).join('\n');
    return `Faltan estos campos por completar:\n${lista}`;
  }

  /**
   * Nombres de los campos requeridos que faltan por completar, con la
   * sección o la fila a la que pertenecen. Mismo criterio que
   * recolectarRequeridos, así que esta lista y el porcentaje de la barra de
   * progreso siempre hablan del mismo conjunto de campos.
   */
  private camposFaltantes(): string[] {
    const faltantes: string[] = [];

    this.agregarFaltantes(faltantes, 'Información personal',
        this.form.get('personalInfo') as FormGroup,
        ConflictFormComponent.ETIQUETAS_PERSONAL_INFO);

    this.agregarFaltantes(faltantes, 'Intereses personales',
        this.form.get('personalInterests') as FormGroup,
        ConflictFormComponent.ETIQUETAS_INTERESES);
    this.familyMembers.controls.forEach((grupo, i) => {
      this.agregarFaltantes(faltantes, `Familiar ${i + 1}`,
          grupo as FormGroup, ConflictFormComponent.ETIQUETAS_FAMILIAR);
    });

    this.agregarFaltantes(faltantes, 'Proveedores y contratistas',
        this.form.get('suppliers') as FormGroup,
        ConflictFormComponent.ETIQUETAS_SUPPLIERS);
    this.suppliersList.controls.forEach((grupo, i) => {
      this.agregarFaltantes(faltantes, `Proveedor/Contratista ${i + 1}`,
          grupo as FormGroup, ConflictFormComponent.ETIQUETAS_PROVEEDOR);
    });

    this.agregarFaltantes(faltantes, 'Incompatibilidad',
        this.form.get('incompatibility') as FormGroup,
        ConflictFormComponent.ETIQUETAS_INCOMPATIBILITY);

    this.agregarFaltantes(faltantes, 'Gestión y prevención',
        this.form.get('procedures') as FormGroup,
        ConflictFormComponent.ETIQUETAS_PROCEDURES);

    if (this.form.get('declarationAccepted')?.invalid) {
      faltantes.push('Declaración: acepta los términos de la declaración');
    }

    return faltantes;
  }

  /**
   * Agrega a la lista cada campo directo del grupo que sea requerido y siga
   * inválido.
   *
   * `control.invalid` es `false` para un control deshabilitado (su estado es
   * `DISABLED`, ni `VALID` ni `INVALID`), así que una fila de familiar o
   * proveedor que llegó de una declaración guardada y todavía no se
   * reactivó respondiendo la pregunta Sí/No no aparece aquí como faltante:
   * no lo está, solo está a la espera de esa respuesta.
   */
  private agregarFaltantes(
      lista: string[], seccion: string, grupo: FormGroup | null,
      etiquetas: { [campo: string]: string }): void {
    if (!grupo) {
      return;
    }
    Object.keys(grupo.controls).forEach((campo) => {
      const control = grupo.get(campo);
      if (!control?.invalid) {
        return;
      }
      if (!control.hasValidator(Validators.required) && !control.hasValidator(Validators.requiredTrue)) {
        return;
      }
      lista.push(`${seccion}: ${etiquetas[campo] ?? campo}`);
    });
  }

  downloadPdfOnly(): void {
    if (this.formHasChanges) {
      this.showMessage('Los datos se han modificado, por favor guarde nuevamente los datos para descargar', 'info');
      return;
    }

    if (this.form.valid) {
      this.generatePdf();
    } else {
      this.form.markAllAsTouched();
      this.showMessage(this.mensajeCamposFaltantes(), 'error');
    }
  }

  /**
   * Valida todo lo que ya se validaba antes de enviar, y si pasa, abre el
   * modal de confirmación en vez de mandar directo al backend. El envío en
   * sí queda en confirmarEnvio(), para que la persona tenga una última
   * oportunidad de revisar el resumen antes de que quede registrado.
   */
  onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      this.showMessage(this.mensajeCamposFaltantes(), 'error');
      return;
    }

    if (this.hayFamiliaresDuplicados()) {
      this.showMessage(
        'Hay un familiar declarado más de una vez. Revise la lista y elimine el repetido.',
        'error');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      const tieneToken = this.authService.tokenSistec() !== null || this.authService.tokenIntranet() !== null;

      if (tieneToken && !this.authService.getCurrentUser()) {
        this.showMessage('Su sesión está siendo validada. Por favor espere un momento e intente nuevamente.', 'info');
        return;
      }

      this.showMessage('Su sesión ha expirado. Por favor inicie sesión nuevamente.', 'error');
      return;
    }

    this.confirmacionEnvioAbierta = true;
  }

  /** Cierra el modal de confirmación sin enviar nada: la persona sigue editando. */
  cancelarEnvio(): void {
    this.confirmacionEnvioAbierta = false;
  }

  /**
   * Confirmado desde el modal de resumen. Recién aquí se manda algo al
   * backend; todo lo anterior en onSubmit() ya comprobó que se puede enviar.
   */
  confirmarEnvio(): void {
    this.confirmacionEnvioAbierta = false;

    const formValue = this.form.value;

    // Siempre se envía por POST, para todos los usuarios. El backend busca la
    // declaración vigente por cédula y registra una versión nueva, así que no
    // hace falta mandarle el identificador desde aquí. Antes los externos
    // usaban PATCH contra un id guardado en memoria, que quedaba obsoleto
    // apenas se creaba una versión y hacía fallar el segundo envío.
    this.backendService.saveConflictForm(formValue).subscribe({
      next: () => {
        console.log('Formulario enviado exitosamente al backend');
        this.generatePdf();
        // Ya existe una declaración enviada: el tipo pasa a "Actualización".
        this.setHasExistingForm(true);
        this.saveInitialFormState();
        this.showMessage('', 'success');
      },
      error: (err) => {
        console.error('Error al enviar formulario al backend:', err);
        if (err.status === 401) {
          this.showMessage('Su sesión ha expirado. Por favor inicie sesión nuevamente.', 'error');
        } else {
          this.showMessage('Error al enviar el formulario al servidor.', 'error');
          this.generatePdf();
        }
      }
    });
  }

  /**
   * Texto acortado para el resumen de envío: el detalle de un interés o de
   * una incompatibilidad puede ser un párrafo largo, y el resumen es para
   * revisar de un vistazo, no para releer la redacción completa.
   */
  private resumenTexto(valor: string, limite: number = 140): string {
    const texto = (valor ?? '').toString().trim();
    return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
  }

  private siNo(valor: unknown): string {
    return valor ? 'Sí' : 'No';
  }

  /**
   * Resumen de lo que se va a enviar, agrupado por sección, para el modal de
   * confirmación. Solo se llama con el formulario ya validado (mismo punto
   * donde antes se enviaba directo), así que no hace falta comprobar nada
   * acá: los campos requeridos ya están completos.
   */
  resumenEnvio(): { titulo: string; lineas: string[] }[] {
    const personal: string[] = [
      `Nombre: ${this.valorPersonal('fullName') || '—'}`,
      `C.I.: ${this.valorPersonal('ci') || '—'}`,
      `Unidad/Área: ${this.valorPersonal('unit') || '—'}`,
      `Cargo: ${this.valorPersonal('position') || '—'}`,
      `Fecha de ingreso: ${this.fechaIngresoTexto() || '—'}`
    ];
    if (this.valorPersonal('employmentType')) {
      personal.push(`En calidad de: ${this.valorPersonal('employmentType')}`);
    }

    const intereses: string[] = [];
    const tieneInteres = this.form.get('personalInterests.hasFinancialInterest')?.value;
    intereses.push(`¿Interés financiero o personal?: ${this.siNo(tieneInteres)}`);
    if (tieneInteres) {
      intereses.push(`Detalle: ${this.resumenTexto(this.form.get('personalInterests.financialInterestDetail')?.value)}`);
    }
    const tieneFamiliares = this.form.get('personalInterests.hasFamilyInstitution')?.value;
    intereses.push(`¿Familiares en la institución o en otra entidad?: ${this.siNo(tieneFamiliares)}`);
    if (tieneFamiliares) {
      this.familyMembers.controls.forEach((grupo) => {
        const nombre = (grupo.get('name')?.value ?? '').toString().trim() || 'Familiar sin nombre';
        const parentesco = (grupo.get('relationship')?.value ?? '').toString().trim() || 'sin parentesco indicado';
        const institucion = (grupo.get('position')?.value ?? '').toString().trim();
        intereses.push(`• ${nombre} — ${parentesco}${institucion ? `, ${institucion}` : ''}`);
      });
    }

    const proveedores: string[] = [];
    const tieneProveedores = this.form.get('suppliers.hasSupplierRelations')?.value;
    proveedores.push(`¿Relación con proveedores o contratistas?: ${this.siNo(tieneProveedores)}`);
    if (tieneProveedores) {
      this.suppliersList.controls.forEach((grupo) => {
        const nombre = (grupo.get('name')?.value ?? '').toString().trim() || 'Proveedor sin nombre';
        const parentesco = (grupo.get('relationship')?.value ?? '').toString().trim() || 'sin parentesco indicado';
        const empresa = (grupo.get('company')?.value ?? '').toString().trim();
        proveedores.push(`• ${nombre} — ${parentesco}${empresa ? `, ${empresa}` : ''}`);
      });
    }

    const incompatibilidad: string[] = [];
    const otrasSituaciones = this.form.get('incompatibility.hasOtherSituations')?.value;
    incompatibilidad.push(`¿Otras situaciones de conflicto de interés?: ${this.siNo(otrasSituaciones)}`);
    if (otrasSituaciones) {
      incompatibilidad.push(`Detalle: ${this.resumenTexto(this.form.get('incompatibility.otherSituationsDetail')?.value)}`);
    }

    const gestion: string[] = [
      `Compromiso de revisión periódica: ${this.siNo(this.form.get('procedures.commitToReview')?.value)}`,
      `Compromiso de informar sobre un conflicto: ${this.siNo(this.form.get('procedures.commitToInform')?.value)}`
    ];

    return [
      { titulo: 'Información personal', lineas: personal },
      { titulo: 'Intereses personales', lineas: intereses },
      { titulo: 'Proveedores y contratistas', lineas: proveedores },
      { titulo: 'Incompatibilidad', lineas: incompatibilidad },
      { titulo: 'Gestión y prevención', lineas: gestion }
    ];
  }

  onCiInput(event: Event, control: AbstractControl): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.substring(0, 10);
    }
    control.setValue(value, { emitEvent: false });
  }

  /**
   * Filtra el C.I. de un proveedor igual que onCiInput, y ademas intenta
   * completar su nombre contra DINARDAP en cuanto la cedula queda completa.
   *
   * Un proveedor casi nunca esta en la nomina de EEASA, asi que el buscador
   * institucional de la seccion 2 no serviria aqui: no encontraria a nadie.
   * DINARDAP si lo resuelve, pero solo por cedula exacta, nunca por nombre,
   * asi que no hay lista de coincidencias que mostrar como en un buscador:
   * la persona escribe la cedula y, si existe, el nombre se completa solo.
   *
   * Sigue siendo una ayuda, no un requisito: si DINARDAP no encuentra la
   * cedula (empresa, proveedor extranjero, o simplemente no esta), el
   * nombre se escribe a mano como hasta ahora.
   */
  onSupplierCiInput(event: Event, indice: number): void {
    const grupo = this.suppliersList.at(indice);
    const control = grupo?.get('ci');
    if (!grupo || !control) {
      return;
    }

    this.onCiInput(event, control);
    // Al tocar la cédula, lo que se había avisado sobre la anterior deja de
    // valer.
    this.estadoConsultaProveedor.delete(grupo);

    const cedula = (control.value ?? '').toString().trim();
    // Solo una cédula válida. El backend descarta las mal escritas sin salir a
    // DINARDAP, así que preguntar por ellas solo produciría un "no se encontró"
    // engañoso; el error de dígito verificador ya se muestra bajo el campo.
    //
    // Se consulta aunque la fila ya tenga un nombre escrito. Antes no, para no
    // gastar consultas, pero eso dejaba el nombre de la cédula anterior pegado
    // a la nueva: quien corregía la cédula se quedaba con el nombre viejo.
    if (cedula.length !== 10 || control.invalid) {
      return;
    }

    this.consultarIdentidad(cedula, (nombre) => {
      // La persona pudo cambiar la cédula mientras se esperaba: esta respuesta
      // ya no corresponde a lo que hay en el campo.
      if ((control.value ?? '').toString().trim() !== cedula) {
        return;
      }
      this.aplicarNombreProveedor(grupo, nombre);
    }, () => this.estadoConsultaProveedor.set(grupo, 'buscando'));
  }

  /**
   * Consulta DINARDAP una sola vez por cédula en la sesión y entrega el nombre,
   * o null si no se encontró. La usan proveedores y familiares de otras
   * entidades: el servicio es auditado y de consumo limitado, y una cédula ya
   * consultada no cambia de dueño.
   */
  private consultarIdentidad(
      cedula: string, alResponder: (nombre: string | null) => void,
      alEmpezar: () => void): void {
    if (this.identidadesConsultadas.has(cedula)) {
      alResponder(this.identidadesConsultadas.get(cedula) ?? null);
      return;
    }
    alEmpezar();
    this.backendService.consultarIdentidad(cedula).subscribe((identidad) => {
      const nombre = identidad?.NOMBRE_COMPLETO || null;
      this.identidadesConsultadas.set(cedula, nombre);
      alResponder(nombre);
    });
  }

  /**
   * Con nombre del registro civil, la fila queda confirmada: cédula y nombre
   * fijos. Sin él, la fila sigue abierta para escribir el nombre a mano.
   */
  private aplicarNombreProveedor(grupo: AbstractControl, nombre: string | null): void {
    if (!nombre) {
      this.estadoConsultaProveedor.set(grupo, 'no-encontrado');
      grupo.get('nombreVerificado')?.setValue(false, { emitEvent: false });
      return;
    }
    this.estadoConsultaProveedor.delete(grupo);
    grupo.patchValue({ name: nombre, nombreVerificado: true }, { emitEvent: false });
    this.checkFormChanges();
  }

  /** Estado de la consulta de esa fila, para los avisos bajo la cédula. */
  estadoProveedor(indice: number): 'buscando' | 'no-encontrado' | null {
    const grupo = this.suppliersList.at(indice);
    return (grupo && this.estadoConsultaProveedor.get(grupo)) || null;
  }

  /** Cédula y nombre de esa fila vienen confirmados por el registro civil. */
  proveedorVerificado(indice: number): boolean {
    return this.suppliersList.at(indice)?.get('nombreVerificado')?.value === true;
  }

  /**
   * Se muestra el campo del nombre para escribirlo a mano: cuando el registro
   * civil no lo encontró, o cuando la fila ya traía un nombre escrito de antes.
   * Mientras no se haya buscado, no se muestra: el nombre sale de la cédula, y
   * dejarlo a la vista invitaría a escribirlo primero para después verlo
   * reemplazado.
   */
  proveedorNombreManual(indice: number): boolean {
    const grupo = this.suppliersList.at(indice);
    if (!grupo || this.proveedorVerificado(indice)) {
      return false;
    }
    return this.estadoProveedor(indice) === 'no-encontrado' ||
      !!(grupo.get('name')?.value ?? '').toString().trim();
  }

  onTextInput(event: Event, control: AbstractControl): void {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    const value = input.value.toUpperCase();
    control.setValue(value, { emitEvent: false });
  }

  onHasFamilyInstitutionChange(): void {
    const hasFamily = this.form.get('personalInterests.hasFamilyInstitution')?.value;
    // Al responder "Sí" no se crea ninguna fila vacía: el familiar nace al
    // elegir a la persona en el buscador institucional. Lo que sí se hace es
    // habilitar la lista, que llega deshabilitada cuando se recupero de una
    // declaracion anterior, para que esos familiares vuelvan a contar.
    if (hasFamily) {
      this.familyMembers.enable();
    } else {
      this.familyMembers.clear();
      this.familyMembers.enable();
    }
    this.exigirAlMenosUno(this.familyMembers, !!hasFamily);
    this.checkFormChanges();
  }

  onHasSupplierRelationsChange(): void {
    const hasSuppliers = this.form.get('suppliers.hasSupplierRelations')?.value;
    if (hasSuppliers) {
      // Igual que con familiares: puede llegar deshabilitada por venir de una
      // declaracion anterior, y entonces ya tiene filas que recuperar.
      this.suppliersList.enable();
      if (this.suppliersList.length === 0) {
        this.addSupplier();
      }
    } else {
      this.suppliersList.clear();
      this.suppliersList.enable();
    }
    this.exigirAlMenosUno(this.suppliersList, !!hasSuppliers);
    this.checkFormChanges();
  }

  /**
   * Responder "Sí" y no declarar a nadie deja una declaración que se
   * contradice. Antes, en proveedores lo evitaba que el botón de eliminar
   * desapareciera con un único registro, lo que obligaba a quedarse con él;
   * en familiares no lo evitaba nada. Ahora cualquier registro se puede
   * quitar, y lo que impide enviar la lista vacía es esta validación, que
   * además aparece nombrada en el aviso de campos faltantes.
   */
  private exigirAlMenosUno(lista: FormArray, exigir: boolean): void {
    if (exigir) {
      lista.setValidators(Validators.required);
    } else {
      lista.clearValidators();
    }
    lista.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Delega en ConflictoPdfService, que centraliza el maquetado del PDF.
   */
  private generatePdf(): void {
    this.conflictoPdfService.generar(this.form.value, false);
  }
}
