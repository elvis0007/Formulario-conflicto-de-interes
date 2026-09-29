import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

/**
 * Genera el PDF del formulario de conflicto de intereses sobre la plantilla
 * oficial en imagenes.
 *
 * Estaba duplicado casi identico en AdminComponent y ConflictFormComponent:
 * 235 lineas que solo se diferenciaban en de donde salian los datos y en si
 * el resultado se descargaba o se abria para previsualizar. Se centraliza aqui
 * para que exista un unico lugar donde corregir el maquetado.
 *
 * El dibujado ocurre dentro de page1.onload, asi que es asincrono: el metodo
 * retorna antes de que el PDF este listo.
 */
@Injectable({ providedIn: 'root' })
export class ConflictoPdfService {

  /**
   * Posicion vertical (mm) de la linea "Nombre" de cada casilla de las hojas
   * anexas, medida sobre las propias imagenes de la plantilla.
   *
   * Antes se calculaban como 60 + n * 18 asumiendo un paso uniforme, pero la
   * plantilla no lo tiene: en familiares el paso es de 18.4 mm hasta la casilla
   * 10 y salta a 22 mm despues. El texto se iba desalineando hasta quedar
   * 11 mm abajo en la ultima casilla, o sea tres renglones fuera de su linea.
   */
  private static readonly CASILLAS_FAMILIARES = [
    60.0, 78.4, 96.8, 115.2, 133.7, 152.1, 170.5, 188.9, 211.0, 233.1, 251.5
  ];

  private static readonly CASILLAS_PROVEEDORES = [
    59.0, 76.3, 93.5, 110.6, 127.9, 145.1, 162.3, 179.6, 196.6, 213.4, 230.4, 247.3
  ];

  /** Separacion entre los renglones de una misma casilla, por plantilla. */
  private static readonly RENGLONES_FAMILIARES = [0, 3.6, 7.3, 11.1];
  private static readonly RENGLONES_PROVEEDORES = [0, 3.4, 6.8, 10.2];

  /** Hasta donde se puede escribir a la derecha sin salir del area impresa. */
  private static readonly MARGEN_DERECHO = 196;

  /**
   * Ancho util (mm) de cada campo, medido desde donde arranca el texto hasta
   * donde termina la linea impresa de la plantilla.
   *
   * Importa mas de lo que parece: Departamento solo tiene 25 mm, y los valores
   * que se autocompletan desde nomina ("DEPARTAMENTO DE SUBTRANSMISION" mide
   * 53 mm a 8pt) lo doblaban en ancho, invadiendo la columna siguiente.
   *
   * Departamento y Area cierran su renglon y a su derecha la hoja esta en
   * blanco, asi que llegan hasta el margen en vez de recortarse: "RELACIONES
   * INDUSTRIALES" salia como "RELACIONES I...".
   */
  private static readonly ANCHOS = {
    nombre: 63,
    ci: 38,
    parentesco: 104,
    institucion: 63,
    departamento: ConflictoPdfService.MARGEN_DERECHO - 150,
    seccion: 63,
    area: ConflictoPdfService.MARGEN_DERECHO - 140,
    detalle: 97,
    empresa: 107
  };

  /**
   * Casillas de la seccion 1, medidas sobre formulario_p1.png. Las de la
   * izquierda llegan hasta la etiqueta de la columna derecha (C.I., Fecha de
   * ingreso, En calidad de, que empiezan en 133 mm). "En calidad de" cierra su
   * renglon: llega hasta el margen y admite un segundo renglon debajo, porque
   * las modalidades LOEP miden hasta 57 mm a 8pt ("NOMBRAMIENTOS PROVISIONALES
   * LOEP") y la linea impresa solo 28.
   */
  private static readonly ANCHOS_PERSONALES = {
    nombre: 131 - 55,
    ci: 32,
    unidad: 131 - 78,
    cargo: 131 - 39,
    fecha: 24,
    modalidad: ConflictoPdfService.MARGEN_DERECHO - 154
  };

  /**
   * Prefijos que la plantilla ya imprime como etiqueta al lado del campo, por
   * lo que repetirlos dentro de la casilla solo gasta ancho.
   *
   * Los valores vienen de la estructura organizacional de nomina, donde los
   * nodos se llaman "DEPARTAMENTO DE SUBTRANSMISION" o "AREA CENTRO DE
   * CONTROL". En la casilla de Departamento, que mide 25 mm, el nombre
   * completo no entra ni al tamano de letra minimo; sin el prefijo entra a 8pt.
   */
  private static readonly PREFIJOS_REDUNDANTES: { [campo: string]: string[] } = {
    departamento: ['DEPARTAMENTO DE ', 'DEPARTAMENTO ', 'DPTO. DE ', 'DPTO. ', 'DPTO.'],
    seccion: ['SECCION ', 'SECCIÓN '],
    area: ['AREA ', 'ÁREA ']
  };

  /** Tamanos de letra a probar antes de recortar el texto. */
  private static readonly TAMANOS = [8, 7.5, 7, 6.5, 6, 5.5];

  /**
   * Quita el prefijo que la etiqueta impresa de la plantilla ya indica.
   *
   * Solo se aplica al dibujar el PDF: el formulario en pantalla y el JSON
   * guardado conservan el nombre oficial completo. Si al quitarlo no quedara
   * nada se devuelve el texto original, para no vaciar la casilla cuando el
   * nodo se llama exactamente igual que su prefijo.
   */
  private quitarPrefijoRedundante(texto: any, campo: string): string {
    const contenido = (texto ?? '').toString().trim();
    const prefijos = ConflictoPdfService.PREFIJOS_REDUNDANTES[campo] ?? [];

    for (const prefijo of prefijos) {
      if (contenido.toUpperCase().startsWith(prefijo)) {
        const resto = contenido.slice(prefijo.length).trim();
        if (resto) {
          return resto;
        }
      }
    }

    return contenido;
  }

  /**
   * Escribe un texto dentro de una casilla de ancho fijo.
   *
   * Las casillas de la plantilla no se pueden ensanchar, porque debajo empieza
   * la casilla siguiente. Asi que primero se intenta reducir el tamano de
   * letra y, solo si aun no cabe, se recorta con puntos suspensivos. El dato
   * completo nunca se pierde: queda en el JSON guardado y se ve entero en la
   * aplicacion.
   *
   * Con `renglones = 2` el texto puede partirse en dos lineas al mismo tamano
   * de letra: la primera sobre la linea impresa y la segunda debajo. Solo para
   * casillas con aire debajo, como "En calidad de": a cada tamano se prefiere
   * una linea y, si no entra, dos antes que achicar mas la letra.
   */
  private escribirEnCasilla(doc: jsPDF, texto: string, x: number, y: number, anchoMax: number,
                            renglones: 1 | 2 = 1): void {
    const contenido = (texto ?? '').toString().trim();
    if (!contenido) {
      return;
    }

    for (const tamano of ConflictoPdfService.TAMANOS) {
      doc.setFontSize(tamano);
      if (doc.getTextWidth(contenido) <= anchoMax) {
        doc.text(contenido, x, y);
        doc.setFontSize(8);
        return;
      }
      if (renglones === 2) {
        const lineas: string[] = doc.splitTextToSize(contenido, anchoMax);
        if (lineas.length === 2) {
          // Interlineado de 1.15 veces el cuerpo de letra, pasado de pt a mm.
          doc.text(lineas[0], x, y);
          doc.text(lineas[1], x, y + tamano * 0.3528 * 1.15);
          doc.setFontSize(8);
          return;
        }
      }
    }

    // Ni al tamano minimo entra: se recorta al ultimo caracter que quepa.
    const ultimo = ConflictoPdfService.TAMANOS[ConflictoPdfService.TAMANOS.length - 1];
    doc.setFontSize(ultimo);
    let recorte = contenido;
    while (recorte.length > 1 && doc.getTextWidth(recorte + '...') > anchoMax) {
      recorte = recorte.slice(0, -1);
    }
    doc.text(recorte + '...', x, y);
    doc.setFontSize(8);
  }


  /**
   * Vuelca en hojas de continuacion los registros que no caben en las casillas
   * de la plantilla anexa.
   *
   * La plantilla tiene un numero fijo de casillas impresas. Antes se seguia
   * escribiendo mas alla de la ultima, encima del pie de pagina y, pasados los
   * 16 registros, fuera de la hoja. Aqui se usa una hoja limpia sin imagen de
   * fondo: no se rompe la plantilla y no se pierde ningun dato.
   *
   * @param titulo         Encabezado de la hoja
   * @param registros      Elementos que no entraron en la plantilla
   * @param numeroInicial  Numero del primer registro, para seguir la cuenta
   * @param campos         Devuelve los pares etiqueta/valor de cada registro
   */
  private escribirContinuacion(
    doc: jsPDF,
    titulo: string,
    registros: any[],
    numeroInicial: number,
    campos: (registro: any) => [string, any][]
  ): void {
    const MARGEN_INFERIOR = 275;
    let y = 0;

    const nuevaHoja = () => {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(titulo, 20, 25);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      y = 35;
    };

    nuevaHoja();

    registros.forEach((registro, index) => {
      const lineas = campos(registro)
        .filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '')
        .map(([etiqueta, valor]) => `${etiqueta}: ${String(valor).trim()}`);

      if (lineas.length === 0) {
        return;
      }

      // El alto del bloque depende de cuantas lineas ocupe cada campo tras
      // ajustarlo al ancho util de la hoja, asi que se calcula antes de decidir
      // si cabe en lo que queda de pagina.
      const envueltas: string[] = [];
      lineas.forEach((linea) => envueltas.push(...doc.splitTextToSize(linea, 170)));
      const alto = 5 + envueltas.length * 4;

      if (y + alto > MARGEN_INFERIOR) {
        nuevaHoja();
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${numeroInicial + index}.`, 20, y);
      doc.setFont('helvetica', 'normal');
      envueltas.forEach((linea) => {
        doc.text(linea, 27, y);
        y += 4;
      });
      y += 5;
    });
  }

  /**
   * @param formData Valor del formulario, con la misma forma que se guarda en
   *                 DCIPU_JSON (personalInfo, personalInterests, suppliers...)
   * @param preview  true abre el PDF en una pestana nueva; false lo descarga
   */
  generar(formData: any, preview: boolean = false): void {
    // Se normalizan las secciones antes de dibujar. El historial regenera los
    // PDF a partir del JSON guardado en su momento, y ese JSON puede no traer
    // todas las secciones: registros antiguos, o guardados parciales. Sin esto
    // una sola declaracion incompleta rompe la generacion con
    // "Cannot read properties of undefined".
    const value: any = {
      ...(formData ?? {}),
      personalInfo: formData?.personalInfo ?? {},
      personalInterests: formData?.personalInterests ?? {},
      suppliers: formData?.suppliers ?? {},
      incompatibility: formData?.incompatibility ?? {},
      procedures: formData?.procedures ?? {}
    };

    const doc = new jsPDF('p', 'mm', 'a4');

    const page1 = new Image();
    page1.src = '/sisci/assets/formulario_p1.png';

    const page2 = new Image();
    page2.src = '/sisci/assets/formulario_p2.png';

    const page3 = new Image();
    page3.src = '/sisci/assets/formulario_p3.png';

    const page4 = new Image();
    page4.src = '/sisci/assets/formulario_p4.png';

    page1.onload = () => {
      doc.addImage(page1, 'PNG', 0, 0, 210, 297);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const P = ConflictoPdfService.ANCHOS_PERSONALES;
      this.escribirEnCasilla(doc, value.personalInfo.fullName, 55, 56, P.nombre);
      this.escribirEnCasilla(doc, value.personalInfo.ci, 149, 56, P.ci);
      this.escribirEnCasilla(doc, value.personalInfo.unit, 78, 60.5, P.unidad);
      this.escribirEnCasilla(doc, value.personalInfo.position, 39, 65, P.cargo);
      this.escribirEnCasilla(doc, value.personalInfo.startDate, 158, 60.5, P.fecha);
      this.escribirEnCasilla(doc, value.personalInfo.employmentType, 154, 65, P.modalidad, 2);

      if (value.status) {
        doc.text(`${value.status}`, 115,50.5); 
      }

      const hasFinancial = value.personalInterests.hasFinancialInterest ? 'Sí' : 'No';
      doc.text(hasFinancial === 'Sí' ? 'X' : '', 48.5, 90.5); 
      doc.text(hasFinancial === 'No' ? 'X' : '', 79.5, 90.5); 

      if (value.personalInterests.hasFinancialInterest && value.personalInterests.financialInterestDetail) {
        const detailText = value.personalInterests.financialInterestDetail;
        const detailLines = doc.splitTextToSize(detailText, 140);
        let detailY = 102; 
        detailLines.forEach((line: string) => {
          doc.text(line, 27, detailY);
          detailY += 4;
        });
      }

      let y = 133;

      const hasFamily = value.personalInterests.hasFamilyInstitution ? 'Sí' : 'No';
      doc.text(hasFamily === 'Sí' ? 'X' : '', 48.5, 121.5); 
      doc.text(hasFamily === 'No' ? 'X' : '', 79.5, 121.5); 

      const additionalFamilyMembers: any[] = [];

      if (value.personalInterests.hasFamilyInstitution && Array.isArray(value.personalInterests.familyMembers)) {
        value.personalInterests.familyMembers.forEach((m: any, index: number) => {
          if (index >= 2) {
            additionalFamilyMembers.push(m);
          } else {
            if (y > 260) {
              doc.addPage();
              doc.addImage(page2, 'PNG', 0, 0, 210, 297);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              y = 40;
            }

            this.escribirEnCasilla(doc, m.name, 65, y, ConflictoPdfService.ANCHOS.nombre);
            this.escribirEnCasilla(doc, m.ci, 136, y, ConflictoPdfService.ANCHOS.ci);
            y += 4;

            this.escribirEnCasilla(doc, m.relationship, 65, y, ConflictoPdfService.ANCHOS.parentesco);
            y += 4;

            if (m.position || m.department || m.section || m.area) {
              const institY = y;
              const seccionY = institY + 4;

              this.escribirEnCasilla(doc, m.position, 65, institY, ConflictoPdfService.ANCHOS.institucion);
              this.escribirEnCasilla(doc, this.quitarPrefijoRedundante(m.department, 'departamento'), 150, institY, ConflictoPdfService.ANCHOS.departamento);
              this.escribirEnCasilla(doc, this.quitarPrefijoRedundante(m.section, 'seccion'), 65, seccionY, ConflictoPdfService.ANCHOS.seccion);
              this.escribirEnCasilla(doc, this.quitarPrefijoRedundante(m.area, 'area'), 140, seccionY, ConflictoPdfService.ANCHOS.area);

              y = seccionY + 10;
            } else {
              y += 4;
            }
          }
        });
      }

      let ySuppliers = 213.5;
      const hasSuppliers = value.suppliers.hasSupplierRelations ? 'Sí' : 'No';
      doc.text(hasSuppliers === 'Sí' ? 'X' : '', 48.5, 203.5);
      doc.text(hasSuppliers === 'No' ? 'X' : '', 79.5, 203.5);

      const additionalSuppliers: any[] = [];

      if (value.suppliers.hasSupplierRelations && Array.isArray(value.suppliers.suppliersList)) {
        value.suppliers.suppliersList.forEach((s: any, index: number) => {
          if (index >= 2) {
            additionalSuppliers.push(s);
          } else {
            if (ySuppliers > 260) {
              doc.addPage();
              doc.addImage(page2, 'PNG', 0, 0, 210, 297);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              ySuppliers = 30;
            }
            this.escribirEnCasilla(doc, s.name, 65, ySuppliers, ConflictoPdfService.ANCHOS.nombre);
            this.escribirEnCasilla(doc, s.ci, 140, ySuppliers, ConflictoPdfService.ANCHOS.ci);
            ySuppliers += 4;
            this.escribirEnCasilla(doc, s.relationship, 65, ySuppliers, ConflictoPdfService.ANCHOS.parentesco);
            ySuppliers += 3;

            const det = doc.splitTextToSize(s.detail || '', 140);
            doc.text(det, 75, ySuppliers);                
            ySuppliers += det.length * 4;

            this.escribirEnCasilla(doc, s.company, 65, ySuppliers, ConflictoPdfService.ANCHOS.empresa);

            ySuppliers += 9;
          }
        });
      }

      doc.addPage();
      doc.addImage(page2, 'PNG', 0, 0, 210, 297);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      let yPage2 = 68; 
      
      const hasOtherSituations = value.incompatibility.hasOtherSituations ? 'Sí' : 'No';
      doc.text(hasOtherSituations === 'Sí' ? 'X' : '', 48.5, yPage2);
      doc.text(hasOtherSituations === 'No' ? 'X' : '', 79.5, yPage2);

      if (value.incompatibility.hasOtherSituations && value.incompatibility.otherSituationsDetail) {
        const otherDetailText = value.incompatibility.otherSituationsDetail;
        const otherDetailLines = doc.splitTextToSize(otherDetailText, 150);
        let otherDetailY = yPage2 + 12;
        otherDetailLines.forEach((line: string) => {
          doc.text(line, 27, otherDetailY);
          otherDetailY += 5;
        });
      }

      let yProcedures = yPage2 + 44.5; 
      
      const commitToReview = value.procedures.commitToReview ? 'Sí' : 'No';
      doc.text(commitToReview === 'Sí' ? 'X' : '', 48.5, yProcedures);
      doc.text(commitToReview === 'No' ? 'X' : '', 79.5, yProcedures);

      let yInform = yProcedures + 19.5; 
      const commitToInform = value.procedures.commitToInform ? 'Sí' : 'No';
      doc.text(commitToInform === 'Sí' ? 'X' : '', 48.5, yInform);
      doc.text(commitToInform === 'No' ? 'X' : '', 79.5, yInform);

     if (additionalFamilyMembers.length > 0) {
        doc.addPage();
        doc.addImage(page3, 'PNG', 0, 0, 210, 297);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        const casillas = ConflictoPdfService.CASILLAS_FAMILIARES;
        const renglon = ConflictoPdfService.RENGLONES_FAMILIARES;
        const A = ConflictoPdfService.ANCHOS;

        // La plantilla anexa tiene casillas numeradas del 3 al 13. Lo que pase
        // de ahi va a una hoja de continuacion en blanco, para no escribir
        // encima del pie de pagina ni fuera de la hoja.
        const enPlantilla = additionalFamilyMembers.slice(0, casillas.length);
        const sobrantes = additionalFamilyMembers.slice(casillas.length);

        enPlantilla.forEach((m: any, index: number) => {
          const yBase = casillas[index];

          this.escribirEnCasilla(doc, m.name, 65, yBase + renglon[0], A.nombre);
          this.escribirEnCasilla(doc, m.ci, 136, yBase + renglon[0], A.ci);
          this.escribirEnCasilla(doc, m.relationship, 65, yBase + renglon[1], A.parentesco);
          this.escribirEnCasilla(doc, m.position, 65, yBase + renglon[2], A.institucion);
          this.escribirEnCasilla(doc, this.quitarPrefijoRedundante(m.department, 'departamento'), 150, yBase + renglon[2], A.departamento);
          this.escribirEnCasilla(doc, this.quitarPrefijoRedundante(m.section, 'seccion'), 65, yBase + renglon[3], A.seccion);
          this.escribirEnCasilla(doc, this.quitarPrefijoRedundante(m.area, 'area'), 140, yBase + renglon[3], A.area);
        });

        if (sobrantes.length > 0) {
          this.escribirContinuacion(
            doc,
            'Declaración de Intereses Personales - Continuación',
            sobrantes,
            casillas.length + 3,
            (m: any) => [
              ['Nombre', m.name], ['C.I.', m.ci], ['Parentesco', m.relationship],
              ['Institución', m.position], ['Departamento', m.department],
              ['Sección', m.section], ['Área', m.area]
            ]
          );
        }
      }

      if (additionalSuppliers.length > 0) {
        doc.addPage();
        doc.addImage(page4, 'PNG', 0, 0, 210, 297);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        
        const casillasProv = ConflictoPdfService.CASILLAS_PROVEEDORES;
        const renglonProv = ConflictoPdfService.RENGLONES_PROVEEDORES;
        const AP = ConflictoPdfService.ANCHOS;

        // Casillas del 3 al 14; el resto va a una hoja de continuacion.
        const provEnPlantilla = additionalSuppliers.slice(0, casillasProv.length);
        const provSobrantes = additionalSuppliers.slice(casillasProv.length);

        provEnPlantilla.forEach((s: any, index: number) => {
          const yBase = casillasProv[index];

          this.escribirEnCasilla(doc, s.name, 65, yBase + renglonProv[0], AP.nombre);
          this.escribirEnCasilla(doc, s.ci, 140, yBase + renglonProv[0], AP.ci);
          this.escribirEnCasilla(doc, s.relationship, 65, yBase + renglonProv[1], AP.parentesco);
          this.escribirEnCasilla(doc, s.detail, 75, yBase + renglonProv[2], AP.detalle);
          this.escribirEnCasilla(doc, s.company, 65, yBase + renglonProv[3], AP.empresa);
        });

        if (provSobrantes.length > 0) {
          this.escribirContinuacion(
            doc,
            'Relación con Proveedores o Contratistas - Continuación',
            provSobrantes,
            casillasProv.length + 3,
            (s: any) => [
              ['Nombre', s.name], ['C.I.', s.ci], ['Parentesco', s.relationship],
              ['Detalle de la relación', s.detail], ['Empresa', s.company]
            ]
          );
        }
      }
      

      const fileName = `ConflictoInteres_${value.personalInfo.fullName || 'formulario'}.pdf`;
      
      if (preview) {
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
      } else {
        doc.save(fileName);
      }
    };
  }
}
