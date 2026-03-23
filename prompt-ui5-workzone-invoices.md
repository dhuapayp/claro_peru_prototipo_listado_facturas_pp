# Prompt para GitHub Copilot (Claude) — App SAPUI5 con Mock Data publicable en Work Zone

> **Uso:** copia TODO este archivo y pégalo como prompt en **GitHub Copilot Chat (modo Claude)** dentro de **VS Code**.  
> **Objetivo:** que Copilot genere **un proyecto completo** (código + estructura + archivos de despliegue) de una app **SAPUI5** con **mock data**, lista para ser publicada y consumida desde **SAP Build Work Zone** (Launchpad/Content Federation), usando **HTML5 Applications Repository**.

---

## Rol del asistente

Eres un **arquitecto y desarrollador senior SAP BTP + SAPUI5**, con experiencia en:
- UI5 Tooling, SAPUI5 freestyle, routing, OData V4 (mockserver) y JSONModel
- Deploy a **SAP BTP Cloud Foundry** como **HTML5 app** (HTML5 apps repo + destination + xsuaa opcional)
- Exposición en **SAP Build Work Zone** mediante contenido HTML5
- Buenas prácticas Fiori (UX consistente, accesibilidad, i18n, busy indicators, mensajes, validaciones)

---

## Contexto funcional (resumen)

Debes construir una aplicación para que el **proveedor** consulte y administre (según reglas) sus **facturas electrónicas**:

### Capacidades principales
1. Consultar facturas y su estado de registro: **Registrado, Enviado, Contabilizado, Rechazado**
2. Validar estado de pago: **Pendiente** o **Abonado**, incluyendo **fecha aproximada de pago** y **detalle del pago**
3. Visualizar detalle y posiciones (contratos / órdenes de compra) según estado
4. Visualizar documentos adjuntos del registro: **XML y PDF**
5. Modificar comprobantes **solo si** estado de registro es **Registrado** o **Rechazado**
6. Exportar:
   - Todo el listado
   - Detalle de posiciones
   - Detalle de pagos

---

## Requisitos de UI y navegación

### Pantalla 1: Listado de facturas (Master/List)
- Mostrar un **grid/table** con columnas:
  - Número de comprobante (número de factura)
  - Fecha de emisión
  - Fecha de registro
  - Estado (Registrado / Enviado / Contabilizado / Rechazado)
  - Importe y moneda
  - Fecha de vencimiento
  - Fecha aproximada de pago
  - Estado de pago (Pendiente / Abonado + nro doc pago)
  - Número de voucher (documento contable)
  - Clase de documento contable asociado
  - Indicador de impuesto (% retención o detracción)
  - Importe del impuesto calculado
  - Fecha de pago de impuesto
  - Número de documento de referencia (contrato o doc compras)
- **Filtros** (FilterBar o panel):
  - Tipo documento de pago
  - Número documento de pago (serie + número)
  - Fecha de emisión (rango)
  - Estado de registro
  - Estado de pago
- **Acciones por fila** (iconos/botones):
  - Visualizar detalle del comprobante
  - Editar comprobante (solo si estado es Registrado o Rechazado)
  - Detalle de pago (dialog o navegación)
- **Exportación**: botón “Exportar” (Excel/CSV) con opciones:
  - Exportar listado
  - Exportar posiciones
  - Exportar pagos

### Pantalla 2: Detalle del comprobante (Object Page)
Al entrar al detalle, mostrar:
- Tipo de documento de pago
- Número de factura
- RUC
- Nombre del proveedor
- Fecha de emisión
- Glosa
- Clase documento de pago
- Indicador afecto a IGV
- Indicador de impuesto
- Fecha recepción
- Fecha contable
- Número voucher (asiento contable)
- Moneda e importe base
- Valor IGV
- Valor total
- % retención + valor
- % detracción + valor
- Valor neto final
- Sección de **posiciones** (tab/segmented):
  - **Contratos / obligaciones programadas** con columnas:
    - Concepto
    - Código y descripción unidad negocio
    - Mes y año
    - Descripción / glosa
    - Cuenta contable y descripción
    - Importe
    - Centro de costos
    - Centro gestor
  - **Órdenes de compra** con columnas:
    - Número documento
    - Fecha documento
    - Posición
    - Material
    - Descripción del servicio
    - Importe y moneda
- Botón “Ver Documentos anexos”:
  - Visualizar/descargar XML
  - Visualizar/descargar PDF (simulado)
  - Si el PDF proviene del XML, generar una vista previa simple (mock)

### Pantalla 3: Editar comprobante (Reuse/Crear Factura)
- Reutilizar la misma pantalla de “Registro de Comprobantes – Crear Factura” (para este prototipo, crear una vista “InvoiceEdit” que simula esa pantalla).
- Al abrir desde “Editar”, cargar todos los datos previamente guardados.
- Mantener validaciones de:
  - XML (simulado)
  - RUC
  - Totales
- Debe incluir la acción “Confirmar envío a contabilidad”.
- Regla crítica:
  - Si estado = Enviado o Contabilizado → **bloquear edición** (mostrar mensaje)
  - Si estado = Registrado o Rechazado → permitir edición

### Detalle de pagos (Dialog o pantalla)
- Para facturas pagadas, mostrar:
  - Número comprobante
  - Documento de pago
  - Fecha de pago
  - Voucher (doc contable pago)
  - Importe comprobante
  - Importe impuesto
  - Importe neto pagado
  - Indicador impuesto
  - Fecha pago impuesto
  - Número doc referencia
  - Vía de pago
  - Cuenta corriente banco
  - Número comprobante retención + botón descargar PDF certificado retención (mock)
- Si factura está pendiente, mostrar “Sin pago registrado” + fecha aproximada (si existe)

---

## Mock Data requerido (definir schema + data de ejemplo)

Implementar datos mock con entidades:

### Invoice (cabecera)
Campos mínimos:
- InvoiceId (string)  — PK
- DocType (string)  — tipo documento de pago
- Series (string)
- DocNumber (string)
- SupplierRuc (string)
- SupplierName (string)
- IssueDate (date)
- RegisterDate (date)
- ReceiptDate (date)
- PostingDate (date)
- Status (enum)  — Registrado/Enviado/Contabilizado/Rechazado
- Currency (string)
- AmountBase (number)
- AmountIGV (number)
- AmountTotal (number)
- RetentionPct (number)
- RetentionAmount (number)
- DetractionPct (number)
- DetractionAmount (number)
- NetAmount (number)
- TaxIndicator (string) — “RET” / “DET” / “NONE”
- TaxPct (number)
- TaxAmount (number)
- TaxPaymentDate (date|null)
- DueDate (date)
- ApproxPaymentDate (date|null)
- PaymentStatus (enum) — Pendiente/Abonado
- PaymentDocNumber (string|null) — doc contable de pago
- VoucherNumber (string|null) — doc contable registro/pago
- AccountingDocType (string|null)
- ReferenceDoc (string|null) — contrato o doc compras
- Notes/Glosa (string)

### InvoiceContractItem (posiciones de contrato)
- InvoiceId (FK)
- ItemId
- Concept
- BusinessUnitCode
- BusinessUnitDesc
- PeriodMonth
- PeriodYear
- ItemText
- GLAccount
- GLAccountDesc
- Amount
- CostCenter
- FundsCenter

### InvoicePOItem (posiciones de orden de compra)
- InvoiceId (FK)
- PONumber
- PODate
- POItem
- Material
- ServiceDesc
- Amount
- Currency

### PaymentDetail
- InvoiceId (FK)
- PaymentDoc
- PaymentDate
- Voucher
- InvoiceAmount
- TaxAmount
- NetPaidAmount
- TaxIndicator
- TaxPaymentDate
- ReferenceDoc
- PaymentMethod
- BankAccount
- RetentionCertificateNumber
- RetentionCertificatePdfUrl (mock)

### Attachment
- InvoiceId (FK)
- AttachmentId
- Type (XML|PDF|RETENTION_PDF)
- FileName
- MimeType
- ContentBase64 (opcional) o Url (mock)

> Genera al menos:
- 30 facturas con mezcla de estados (Registrado/Enviado/Contabilizado/Rechazado)
- mezcla de pagadas y pendientes
- algunas con contratos, otras con OC, algunas con ambos
- adjuntos XML y PDF para todas, y certificado retención solo para algunas

---

## Requisitos técnicos del proyecto

### Tipo de app
- **SAPUI5 freestyle** (no Fiori Elements), con:
  - `sap.m` + `sap.f` (ObjectPageLayout) + `sap.ui.comp` si necesitas FilterBar (o alternativa simple)
  - Routing en `manifest.json`
  - i18n básico
  - Formateadores (fechas, moneda, estado)

### Datos
- Implementar **MockServer OData V4** local (preferido) **o** JSONModel + filtros manuales.
- Recomendación: OData V4 MockServer para simular servicios y facilitar futuro reemplazo por CAP/S4.
- Incluir un `service/` con metadata y mockdata (`localService/`).

### Exportación
- Usar `sap.ui.export.Spreadsheet` para exportar a XLSX y/o CSV.

### Validaciones al editar
- Simular validación de XML: botón “Validar XML” que marque estado de validación.
- Validación RUC: regex simple y mensajes.
- Validación totales: recalcular neto e impuestos y comparar.

### UX
- BusyIndicator durante “lecturas” mock
- Mensajes con `MessageToast` / `MessageBox`
- Estados con `ObjectStatus` y colores semánticos

---

## Publicación en SAP Build Work Zone (Cloud Foundry)

Genera el proyecto incluyendo **artefactos de deploy** recomendados para HTML5 apps repo:

1. **ui5.yaml** para build
2. `package.json` con scripts:
   - `start` (ui5 serve)
   - `build` (ui5 build --all)
3. `xs-app.json` y `xssuaa` opcional (para el prototipo puede omitirse auth y usar `xs-app.json` minimal)
4. `mta.yaml` **(recomendado)** para empaquetar y desplegar:
   - html5 module (app)
   - approuter (opcional)
   - destination service (opcional)
   - html5-apps-repo service
5. Instrucciones en `README.md`:
   - build
   - deploy (mbt build + cf deploy)
   - cómo “exponer” la app en Work Zone:
     - crear contenido HTML5 app
     - asignar a site/space y roles (si aplica)

> Nota: para mock local sin backend, la app debe funcionar en Work Zone como HTML5 app estática.

---

## Estructura esperada del repositorio

Crea una estructura como:

```
invoice-portal-ui5/
  app/
    webapp/
      controller/
      view/
      fragment/
      model/
      util/
      i18n/
      localService/
        metadata.xml
        mockdata/
          Invoices.json
          InvoiceContractItems.json
          InvoicePOItems.json
          PaymentDetails.json
          Attachments.json
        mockserver.js
      Component.js
      manifest.json
      index.html
      xs-app.json
    ui5.yaml
    package.json
    README.md
  mta.yaml
  .gitignore
```

---

## Reglas de edición / autorización de acciones

Implementar lógica estricta:
- Si `Status` ∈ {`Registrado`, `Rechazado`} → **editar permitido**
- Si `Status` ∈ {`Enviado`, `Contabilizado`} → **editar bloqueado**, mostrar `MessageBox.warning`

En el listado:
- El botón “Editar” debe estar:
  - visible pero deshabilitado con tooltip, **o**
  - oculto cuando no corresponde  
  (elige una opción consistente y explícala en README)

---

## Qué debes generar (output esperado)

Genera:
1. Todos los archivos del proyecto (código completo).
2. Un `README.md` muy claro con:
   - prerequisitos (Node, UI5 CLI)
   - ejecución local
   - build
   - deploy a CF (comandos)
   - pasos Work Zone (alto nivel)
3. Mock data consistente (con relaciones por InvoiceId).
4. UI lista + routing funcionando:
   - `InvoiceList` (tabla + filtros + export)
   - `InvoiceDetail` (Object Page + posiciones + anexos)
   - `InvoiceEdit` (form + validaciones + confirmar envío)
5. Buenas prácticas de UI5:
   - `formatter.js`
   - `models.js` o modelo inicial
   - `ErrorHandler` básico opcional

---

## Interfaces futuras (solo stub en este prototipo)

Además, crea stubs (archivos o servicios simulados) para:
- Obtener data maestra real estate y documentos de compras
- Contratos: detalles, condiciones, cronograma, estado
- Documentos de compra y posiciones
- Registros contables facturas registradas (asociadas a contratos/OC)
- Registros contables facturas pagadas (asociadas a contratos/OC)
- Envío de archivos del proveedor hacia **ONBASE** (solo simular un endpoint y log)

> Para el prototipo: implementar estos como módulos JS que devuelven Promises con data mock.

---

## Restricciones y convenciones

- Todo el código debe estar en **JavaScript** (no TypeScript).
- Evitar dependencias pesadas.
- Mantener nombres consistentes en inglés para entidades técnicas, pero textos visibles en **español**.
- No usar CAP real ni servicios reales: todo mock.
- Incluir ejemplos de cómo reemplazar mock por backend real en el futuro (README).

---

## Entregable final

Devuélveme:
1. El contenido de cada archivo con su ruta (tipo “/app/webapp/…”).
2. Si el output es muy largo, entrega primero la **estructura + archivos clave**, y luego continúa por bloques hasta completar.
3. Asegúrate de que el proyecto **corra** con `npm install && npm start`.

---

## Checklist de validación (debes cumplir)

- [ ] La app inicia localmente
- [ ] Tabla lista con filtros funcionando
- [ ] Navegación a detalle funcionando
- [ ] Botón ver anexos (XML/PDF) funcionando (mock)
- [ ] Detalle de pago funciona (mock)
- [ ] Edición bloqueada/permitida según estado
- [ ] Exportación funciona
- [ ] Artefactos para Work Zone (HTML5 app repo) incluidos
- [ ] README con deploy y pasos Work Zone

---

## Comienza ahora

Genera el proyecto completo siguiendo todo lo anterior.
