## Application Details
|               |
| ------------- |
|**Generation Date and Time**<br>Mon Feb 02 2026 15:51:25 GMT+0000 (Coordinated Universal Time)|
|**App Generator**<br>SAP Fiori Application Generator|
|**App Generator Version**<br>1.20.1|
|**Generation Platform**<br>SAP Business Application Studio|
|**Template Used**<br>Basic|
|**Service Type**<br>None|
|**Service URL**<br>N/A|
|**Module Name**<br>listado_facturas|
|**Application Title**<br>Listado de Facturas|
|**Namespace**<br>claro.com|
|**UI5 Theme**<br>sap_horizon|
|**UI5 Version**<br>1.144.0|
|**Enable TypeScript**<br>False|
|**Add Eslint configuration**<br>False|

## Portal de Facturas - Proveedor

Portal SAPUI5 para gestión y consulta de facturas electrónicas para proveedores de Claro Perú.

### Características Principales

- **Listado de Facturas**: Visualización completa con filtros por tipo documento, número, fechas, estado y estado de pago
- **Detalle de Factura**: Vista completa con información general, detalle financiero, posiciones de contratos/OC y documentos anexos
- **Edición de Facturas**: Permite editar facturas en estado "Registrado" o "Rechazado" con validaciones de RUC y totales
- **Gestión de Pagos**: Consulta de información de pagos, certificados de retención y detalles bancarios
- **Exportación a Excel**: Exportación de facturas, posiciones de contratos, posiciones de OC y detalle de pagos
- **Datos Mock Completos**: 32 facturas de ejemplo con todos los estados, pagos y documentos anexos

### Requisitos Previos

1. **Node.js** LTS (Long Term Support) versión activa y npm asociado (ver https://nodejs.org)
2. **Cloud Foundry CLI** (para deployment): Descargar desde https://github.com/cloudfoundry/cli/releases
3. **Cloud MTA Build Tool (MBT)** (para deployment): `npm install -g mbt`
4. **Cuenta SAP BTP** con acceso a HTML5 Application Repository y SAP Build Work Zone

### Desarrollo Local

#### Instalación de Dependencias

```bash
npm install
```

#### Ejecución en Modo Desarrollo

La aplicación incluye un MockServer que simula el servicio OData V4 con datos de prueba:

```bash
npm start
```

El MockServer se inicializa automáticamente al detectar ejecución local (localhost). La aplicación estará disponible en `http://localhost:XXXX` (el puerto se muestra en la consola).

**Nota**: Los datos mock incluyen 32 facturas con estados variados, 17 posiciones de contratos, 40 posiciones de OC, 14 pagos registrados y 64 documentos anexos.

### Deployment a SAP BTP (Work Zone)

#### 1. Construcción del Paquete MTA

```bash
mbt build
```

Este comando genera el archivo `.mtar` en el directorio `mta_archives/`.

#### 2. Deployment al HTML5 Application Repository

Primero, autentícate en Cloud Foundry:

```bash
cf login -a <API_ENDPOINT> -o <ORG> -s <SPACE>
```

Luego, despliega el archivo MTA:

```bash
cf deploy mta_archives/clarocomlistadofacturas_0.0.1.mtar
```

#### 3. Configuración en SAP Build Work Zone

1. Accede a tu subaccount en SAP BTP Cockpit
2. Navega a **Instances and Subscriptions** > **SAP Build Work Zone, standard edition**
3. Abre el **Content Manager**
4. Selecciona **Content Provider** > Actualiza el repositorio HTML5
5. En **Content Explorer**, busca y agrega la aplicación "Portal de Facturas - Proveedor"
6. Crea un nuevo **Group** (ej: "Gestión de Proveedores") y añade la aplicación
7. Asigna el grupo al **Role** correspondiente
8. Publica el sitio de Work Zone

**Importante**: El MockServer **NO** se inicializa en Work Zone (solo en localhost). Para producción, debes configurar un servicio OData real en el archivo [manifest.json](webapp/manifest.json) bajo `"sap.app" > "dataSources" > "invoiceService"`.

### Estructura del Proyecto

```
listado_facturas/
├── webapp/
│   ├── controller/          # Controladores de vistas
│   │   ├── InvoiceList.controller.js
│   │   ├── InvoiceDetail.controller.js
│   │   ├── InvoiceEdit.controller.js
│   │   └── Home.controller.js
│   ├── view/                # Vistas XML
│   │   ├── InvoiceList.view.xml
│   │   ├── InvoiceDetail.view.xml
│   │   ├── InvoiceEdit.view.xml
│   │   └── Home.view.xml
│   ├── fragment/            # Fragmentos reutilizables
│   │   ├── PaymentDetail.fragment.xml
│   │   └── Attachments.fragment.xml
│   ├── util/                # Utilidades
│   │   ├── formatter.js     # Formateadores de datos
│   │   ├── exporter.js      # Exportación a Excel
│   │   └── validator.js     # Validaciones de negocio
│   ├── localService/        # Mock Service
│   │   ├── metadata.xml     # Definición OData V4
│   │   ├── mockserver.js    # Inicialización MockServer
│   │   └── mockdata/        # Datos de prueba JSON
│   │       ├── Invoices.json
│   │       ├── InvoiceContractItems.json
│   │       ├── InvoicePOItems.json
│   │       ├── PaymentDetails.json
│   │       └── Attachments.json
│   ├── i18n/                # Internacionalización
│   ├── Component.js         # Componente raíz
│   └── manifest.json        # Descriptor de aplicación
├── mta.yaml                 # Multi-Target Application descriptor
├── xs-app.json              # Configuración App Router
├── package.json             # Dependencias npm
└── ui5.yaml                 # Configuración UI5 Tooling
```

### Tecnologías Utilizadas

- **SAPUI5 1.144.0**: Framework de desarrollo
- **OData V4**: Protocolo de datos (simulado con MockServer)
- **sap.m**: Biblioteca principal de controles
- **sap.f**: Biblioteca de layouts flexibles (DynamicPage)
- **sap.ui.export**: Exportación a Excel (Spreadsheet)
- **Cloud Foundry**: Plataforma de deployment
- **SAP Build Work Zone**: Portal corporativo

### Funcionalidades Técnicas

#### MockServer
El MockServer se inicializa solo en entorno localhost. Verifica el código en [Component.js](webapp/Component.js):

```javascript
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    mockserver.init();
}
```

#### Validaciones de Negocio
- **RUC**: Validación de 11 dígitos (ver [validator.js](webapp/util/validator.js))
- **Edición por Estado**: Solo facturas "Registrado" o "Rechazado" pueden editarse
- **Totales**: Validación de suma Base + IGV = Total

#### Exportación
Implementada con `sap.ui.export.Spreadsheet`. Opciones:
1. Listado de facturas
2. Posiciones de contratos
3. Posiciones de órdenes de compra
4. Detalle de pagos

### Datos de Prueba

El MockServer incluye:
- **32 Facturas** con estados variados (6 Registrado, 4 Enviado, 13 Contabilizado, 4 Rechazado)
- **17 Posiciones de Contratos** con cuentas contables y centros de costo
- **40 Posiciones de OC** con materiales y fechas
- **14 Pagos Registrados** con certificados de retención
- **64 Documentos Anexos** (XML y PDF por cada factura)

### Soporte y Contacto

Para soporte técnico o consultas sobre la aplicación, contactar al equipo de desarrollo de Claro Perú.

---

**Versión**: 0.0.1  
**Última actualización**: Febrero 2026


