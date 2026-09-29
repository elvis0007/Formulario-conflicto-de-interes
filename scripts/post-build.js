const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'formulario-conflicto-interes', 'browser');
const metaInfPath = path.join(distPath, 'META-INF');
const webInfPath = path.join(distPath, 'WEB-INF');

// Crear directorios META-INF y WEB-INF
if (!fs.existsSync(metaInfPath)) {
  fs.mkdirSync(metaInfPath, { recursive: true });
  console.log('✓ Creado directorio META-INF');
}

if (!fs.existsSync(webInfPath)) {
  fs.mkdirSync(webInfPath, { recursive: true });
  console.log('✓ Creado directorio WEB-INF');
}

// Crear MANIFEST.MF en META-INF
const manifestContent = `Manifest-Version: 1.0
Created-By: Angular Build
Implementation-Title: Formulario Conflicto de Intereses
Implementation-Version: 1.0.0
Implementation-Vendor: EEASA
`;

fs.writeFileSync(path.join(metaInfPath, 'MANIFEST.MF'), manifestContent);
console.log('✓ Creado META-INF/MANIFEST.MF');

// Crear web.xml en WEB-INF
const webXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
         http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0">
    <display-name>Formulario Conflicto de Intereses</display-name>
    <description>Sistema Integrado de Conflicto de Intereses</description>
    
    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
    </welcome-file-list>
    
    <error-page>
        <error-code>404</error-code>
        <location>/index.html</location>
    </error-page>
    
    <error-page>
        <error-code>403</error-code>
        <location>/index.html</location>
    </error-page>
</web-app>
`;

fs.writeFileSync(path.join(webInfPath, 'web.xml'), webXmlContent);
console.log('Creado WEB-INF/web.xml');

console.log('\n Post-build completado: META-INF y WEB-INF creados con sus archivos');
