/**
 * DemoTourService.js — Listado de Facturas
 * Panel DOM flotante persistente (cross-route).
 *
 * FLUJO: Listado de Facturas → Detalle de Factura (Wizard 4 pasos read-only)
 *
 * Reutiliza la mecánica del Gestor de Comprobantes:
 *   • _highlightWithRetry — reintenta N veces tras navegación cross-route
 *   • _getTargetRect      — excluye líneas separadoras del wizard progress nav
 *   • _placeFrame / _placeBadge — in-place update sin parpadeo
 */
sap.ui.define([], function () {
    "use strict";

    /* ── Estado del módulo ──────────────────────────────────────── */
    var _oRouter    = null;
    var _nCurrent   = 0;
    var _aSteps     = null;
    var PANEL_ID    = "cdt-panel";
    var BADGE_ID    = "cdt-badge";
    var FRAME_ID    = "cdt-frame";
    var _bMinimized = false;
    var _bDragged   = false;

    var ROLES = {
        proveedor: { label: "Proveedor", color: "#DA291C" }
    };

    /* ═══════════════════════════════════════════════════════════════
       DEFINICIÓN DE PASOS
    ═══════════════════════════════════════════════════════════════ */

    /** Obtiene el tipo de documento de la factura seleccionada */
    function _getInvoiceType(sInvoiceId) {
        try {
            var oComp = sap.ui.getCore().getModel &&
                        sap.ui.getCore().getModel("invoiceDetail");
            if (oComp) {
                var oData = oComp.getData();
                if (oData && oData[sInvoiceId]) {
                    return oData[sInvoiceId].detalle.tipoDocumento;
                }
            }
        } catch (e) { /* ignore */ }
        // Fallback: leer del servicio
        try {
            var oSvc = sap.ui.getCore().byId(
                document.querySelector('[id$="--invoiceDetailPage"]').id
            );
        } catch (e2) { /* ignore */ }
        return "OC"; // default
    }

    function _buildSteps(sInvoiceId) {
        /* ── Determinar tipo de documento ── */
        var sTipo = "OC";
        try {
            var aViews = sap.ui.getCore().byId("__component0")
                         .getRootControl().getContent()[0].getPages();
            for (var v = 0; v < aViews.length; v++) {
                var oCtrl = aViews[v].getController && aViews[v].getController();
                if (oCtrl && oCtrl._oService && typeof oCtrl._oService.getDetailData === "function") {
                    var oD = oCtrl._oService.getDetailData(sInvoiceId);
                    if (oD) { sTipo = oD.detalle.tipoDocumento; }
                    break;
                }
            }
        } catch (e) { /* use default */ }

        /* ── Labels según tipo ── */
        var sDocLabel, sDocIcon, sDocNum;
        if (sTipo === "CONTRATO") {
            sDocLabel = "Contrato";
            sDocIcon  = "&#128196;";
        } else if (sTipo === "POLIZA") {
            sDocLabel = "Póliza de Seguros";
            sDocIcon  = "&#128737;";
        } else {
            sDocLabel = "Orden de Compra";
            sDocIcon  = "&#128230;";
        }

        /* ── Paso 3 dinámico (Asignación) ── */
        var sStep3Title, sStep3Body;

        if (sTipo === "CONTRATO") {
            sStep3Title = "Paso 3: Asignación al Contrato";
            sStep3Body =
                "Esta factura está asociada a un <b>" + sDocIcon + " Contrato</b>. " +
                "El Paso 3 muestra la información de asignación específica:<br><br>" +
                "<b>1. Conceptos de Pago:</b><br>" +
                "&bull; Lista desplegable con los conceptos del contrato (ej: Alquiler, Mantenimiento)<br>" +
                "&bull; Selecciona un concepto para filtrar la programación y pendientes<br><br>" +
                "<b>2. Tabla de Programación (Obligaciones de Pago):</b><br>" +
                "&bull; Cronograma de pagos del contrato por período<br>" +
                "&bull; Muestra <b>importe programado</b> vs <b>importe pagado</b><br>" +
                "&bull; Períodos con pago registrado aparecen como completados<br><br>" +
                "<b>3. Tabla de Pendientes por Facturar:</b><br>" +
                "&bull; Obligaciones del contrato disponibles o ya asignadas<br>" +
                "&bull; Filas en <span style='color:#107e3e;font-weight:700'>verde</span> = asignadas a esta factura<br>" +
                "&bull; Filas sin color = disponibles para asignar (en modo edición)<br>" +
                "&bull; Cada fila muestra: mes, valor venta, IGV, total, cuenta contable<br><br>" +
                "En modo <b>edición</b>, puedes <b>asignar</b> o <b>desasignar</b> pendientes usando los botones de la tabla.";
        } else if (sTipo === "POLIZA") {
            sStep3Title = "Paso 3: Asignación a la Póliza";
            sStep3Body =
                "Esta factura está asociada a una <b>" + sDocIcon + " Póliza de Seguros</b>. " +
                "El Paso 3 muestra las posiciones de la póliza:<br><br>" +
                "<b>Tabla de Posiciones de la Póliza:</b><br>" +
                "&bull; Cada fila representa una <b>cobertura o partida</b> del seguro<br>" +
                "&bull; Columnas: Posición, Descripción, Cantidad, Importe, Moneda<br>" +
                "&bull; Filas en <span style='color:#107e3e;font-weight:700'>verde</span> = asignadas a esta factura<br>" +
                "&bull; Filas sin color = otras coberturas de la póliza no vinculadas<br><br>" +
                "Ejemplos de coberturas típicas:<br>" +
                "&bull; Responsabilidad Civil General<br>" +
                "&bull; Responsabilidad Civil Patronal<br>" +
                "&bull; Seguro contra Todo Riesgo<br><br>" +
                "En modo <b>edición</b>, puedes seleccionar posiciones y usar " +
                "<b>Asignar</b> / <b>Desasignar</b> para modificar la vinculación.";
        } else {
            sStep3Title = "Paso 3: Asignación a la OC";
            sStep3Body =
                "Esta factura está asociada a una <b>" + sDocIcon + " Orden de Compra</b>. " +
                "El Paso 3 muestra las posiciones de la OC:<br><br>" +
                "<b>Tabla de Posiciones de la OC:</b><br>" +
                "&bull; Cada fila representa un <b>ítem o servicio</b> de la orden<br>" +
                "&bull; Columnas: Posición, Descripción, Cantidad, Precio Unit., Importe, Moneda<br>" +
                "&bull; Filas en <span style='color:#107e3e;font-weight:700'>verde</span> = asignadas a esta factura<br>" +
                "&bull; Filas sin color = otros ítems de la OC no vinculados<br><br>" +
                "La suma de los importes de las posiciones asignadas debe coincidir " +
                "con el <b>monto total</b> de la factura (validación en el Paso 4).<br><br>" +
                "En modo <b>edición</b>, puedes seleccionar posiciones y usar " +
                "<b>Asignar</b> / <b>Desasignar</b> para modificar la vinculación.";
        }

        return [
            /* S0 — Bienvenida */
            { role:"proveedor", panelSide:"right", targetId:null,
              title:"Bienvenida al Demo Tour",
              instruction:
                "Bienvenido a la <b>demo interactiva</b> del <b>Listado de Facturas</b> " +
                "del Portal de Proveedores Claro.<br><br>" +
                "Este tour te guiará paso a paso por las funcionalidades disponibles:<br>" +
                "&bull; <b>Listado de Facturas</b> con filtros, KPIs y paginación<br>" +
                "&bull; <b>Detalle de la Factura</b> con la información completa en 4 pasos<br>" +
                "&bull; Asignación diferenciada según tipo: <b>Contrato</b>, <b>OC</b> o <b>Póliza</b><br><br>" +
                "Pulsa <b>Sig &rarr;</b> en cada paso para avanzar.<br>" +
                "Puedes pulsar <b>&larr; Ant</b> en cualquier momento para retroceder.",
              onEnter: function(r){ r.navTo("InvoiceList"); } },

            /* S1 — Tabla de facturas */
            { role:"proveedor", panelSide:"right", targetId:"invoiceTable",
              title:"Listado de Facturas",
              instruction:
                "Esta es la <b>tabla principal de facturas</b>. Lista todas las facturas " +
                "registradas por tu empresa en una sola vista:<br><br>" +
                "&bull; <b>Número de Factura</b> (Serie-Número)<br>" +
                "&bull; <b>Fecha de Emisión</b> y <b>Fecha de Registro</b><br>" +
                "&bull; <b>Estado:</b> Registrado, Enviado, Contabilizado o Rechazado<br>" +
                "&bull; <b>Monto Total</b> y <b>Moneda</b><br>" +
                "&bull; <b>Fecha de Vencimiento</b> y <b>Estado de Pago</b><br>" +
                "&bull; <b>Indicador Tributario</b> (Retención, Detracción, etc.)<br><br>" +
                "<b>Acciones por fila:</b><br>" +
                "&bull; &#128065; <b>Ver</b> — Abre en modo solo lectura<br>" +
                "&bull; &#9999; <b>Editar</b> — Abre en modo edición (solo Registrado o Rechazado)<br>" +
                "&bull; &#128465; <b>Eliminar</b> — Elimina la factura (solo Registrado)<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para explorar los filtros disponibles.",
              onEnter: function(r){ r.navTo("InvoiceList"); } },

            /* S2 — Filtros */
            { role:"proveedor", panelSide:"right", targetId:"filterDocNumber",
              title:"Panel de Filtros",
              instruction:
                "Usa los filtros para encontrar rápidamente las facturas que necesitas:<br><br>" +
                "&bull; <b>Número de Factura:</b> búsqueda por serie-número<br>" +
                "&bull; <b>Fecha Desde / Hasta:</b> acota por rango de emisión<br>" +
                "&bull; <b>Estado:</b> Registrado, Enviado, Contabilizado, Rechazado<br>" +
                "&bull; <b>Estado de Pago:</b> Pendiente o Abonado<br>" +
                "&bull; <b>Moneda:</b> PEN o USD<br><br>" +
                "Pulsa <b>Buscar</b> para aplicar o <b>Limpiar</b> para reiniciar todos los filtros.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para seleccionar una factura y ver su detalle.",
              onEnter: null },

            /* S3 — Seleccionar factura */
            { role:"proveedor", panelSide:"right", targetId:"invoiceTable",
              title:"Seleccionar una Factura",
              instruction:
                "Ahora seleccionarás una factura para ver su detalle.<br><br>" +
                "<div style='background:#e8f4fd;border:1px solid #0854a0;border-radius:4px;padding:8px 10px;font-size:11px;margin-bottom:8px'>" +
                "<b>&#128161; Tip:</b> El tour se adaptará al <b>tipo de documento</b> de la factura que selecciones:<br>" +
                "&bull; &#128196; <b>Contrato</b> — Verás programación de pagos y pendientes por facturar<br>" +
                "&bull; &#128230; <b>Orden de Compra</b> — Verás posiciones de la OC asignadas<br>" +
                "&bull; &#128737; <b>Póliza</b> — Verás coberturas del seguro asignadas" +
                "</div>" +
                "<div style='background:#fff8e1;border:1px solid #e9730c;border-radius:4px;padding:8px 10px;font-size:11px;text-align:center;margin-bottom:8px'>" +
                "<span style='font-size:16px'>&#128073;</span>&nbsp; " +
                "<b>Haz clic en el icono de Ver</b> (&#128065;) de cualquier fila para continuar<br>" +
                "<span style='color:#777;font-size:10px'>O pulsa <b>Sig &rarr;</b> y el sistema seleccionará la primera factura automáticamente</span>" +
                "</div>",
              onEnter: null,
              listenAction: "abrirDetalle",
              autoAction: function() {
                  var oBtn = document.querySelector('[id$="--invoiceTable"] .sapMListTblRow .sapMBtn .sapMBtnInner');
                  if (!oBtn) {
                      oBtn = document.querySelector('[id$="--invoiceTable"] .sapMListTblRow .sapMBtn');
                  }
                  if (oBtn) {
                      oBtn.click();
                  }
              } },

            /* S4 — Wizard Paso 1: Archivos */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep1",
              title:"Paso 1: Archivos Cargados",
              instruction:
                "El <b>Paso 1</b> del detalle muestra los <b>archivos cargados</b> " +
                "al momento de registrar esta factura:<br><br>" +
                "<div style='background:#f5f5f5;border-radius:4px;padding:6px 10px;font-size:11px;margin-bottom:8px'>" +
                sDocIcon + " Documento de origen: <b>" + sDocLabel + "</b>" +
                "</div>" +
                "&bull; <b>Tipo de Factura:</b> Electrónica (XML+PDF) o Física (solo PDF)<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; XML</span> — Archivo XML de la factura electrónica<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; PDF</span> — Representación impresa de la factura<br>" +
                "&bull; <b>CDR</b> — Constancia de Recepción SUNAT (opcional)<br>" +
                "&bull; <b>Otros Anexos</b> — Documentación adicional<br><br>" +
                "En modo <b>lectura</b>, puedes ver los nombres de los archivos cargados " +
                "pero no modificarlos. Para editar, usa el botón <b>Editar</b> (&#9999;) desde el listado.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver los datos del comprobante.",
              onEnter: function(r){
                  r.navTo("InvoiceDetail", { invoiceId: sInvoiceId, "?query": { mode: "view" } });
                  setTimeout(function() { _goToWizardStep(1); }, 500);
              } },

            /* S5 — Wizard Paso 2: Datos del Comprobante */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep2",
              title:"Paso 2: Datos del Comprobante",
              instruction:
                "El <b>Paso 2</b> muestra todos los <b>datos del comprobante</b> extraídos del XML:<br><br>" +
                "<b>Datos de la Factura:</b><br>" +
                "&bull; <b>Tipo de Documento:</b> Factura, Nota de Crédito, Nota de Débito<br>" +
                "&bull; <b>Serie y Número</b> del comprobante<br>" +
                "&bull; <b>Fecha de Emisión</b> y datos del <b>Emisor/Receptor</b> con validación de RUC<br>" +
                "&bull; <b>Moneda</b> e <b>Indicador IGV</b><br><br>" +
                "<b>Importes:</b><br>" +
                "&bull; <b>Base Imponible</b>, <b>IGV</b>, <b>Inafecto</b> y <b>Total</b><br>" +
                "&bull; <b>Detracción</b> y <b>Retención</b> (% y montos calculados)<br>" +
                "&bull; <b>Importe Neto</b> = Total - Detracción - Retención<br><br>" +
                "<b>Documento de origen:</b><br>" +
                "&bull; Tipo: <b>" + sDocLabel + "</b> — vincula los importes con el documento fuente<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver la asignación al documento de origen.",
              onEnter: function() { _goToWizardStep(2); } },

            /* S6 — Wizard Paso 3: Asignación (DINÁMICO según tipo) */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep3",
              title: sStep3Title,
              instruction: sStep3Body + "<br><br>Pulsa <b>Sig &rarr;</b> para ver la validación de importes.",
              onEnter: function() { _goToWizardStep(3); } },

            /* S7 — Wizard Paso 4: Validación */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep4",
              title:"Paso 4: Validación y Resumen",
              instruction:
                "El <b>Paso 4</b> realiza la <b>validación cruzada</b> de importes entre el comprobante " +
                "y las asignaciones del paso anterior.<br><br>" +
                "<b>¿Qué se compara?</b><br>" +
                (sTipo === "CONTRATO"
                  ? "&bull; Importes del <b>XML</b> vs la suma de los <b>pendientes asignados</b> del contrato<br>"
                  : "&bull; Importes del <b>XML</b> vs la suma de las <b>posiciones asignadas</b> de la " + sDocLabel + "<br>") +
                "&bull; Campos: Base Imponible, IGV, Inafecto y Total<br>" +
                "&bull; Tolerancia máxima: <b>≤ 1.00</b> por campo<br><br>" +
                "<b>Resultado:</b><br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; Verde</span> = dentro de tolerancia<br>" +
                "&bull; <span style='color:#DA291C;font-weight:700'>&#10005; Rojo</span> = excede tolerancia (bloquea registro)<br><br>" +
                "Debajo se muestra el <b>Resumen Final</b> con todos los datos consolidados.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver la tabla de comparación en detalle.",
              onEnter: function() { _goToWizardStep(4); } },

            /* S8 — Comparación panel */
            { role:"proveedor", panelSide:"right", targetId:"comparacionTable",
              title:"Tabla de Comparación de Importes",
              instruction:
                "Esta tabla detalla la <b>comparación campo por campo</b> entre los importes " +
                "del comprobante y los importes " +
                (sTipo === "CONTRATO" ? "de los <b>pendientes asignados</b>:" : "de las <b>posiciones asignadas</b>:") +
                "<br><br>" +
                "<table style='width:100%;font-size:11px;border-collapse:collapse;margin-bottom:8px'>" +
                "<tr style='background:#f0f0f0;font-weight:600'><td style='padding:3px 5px'>Campo</td><td style='text-align:center;padding:3px 5px'>Del XML</td><td style='text-align:center;padding:3px 5px'>Asignado</td><td style='text-align:center;padding:3px 5px'>Diferencia</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>Base Imponible</td><td style='text-align:center'>&#10003;</td><td style='text-align:center'>&#10003;</td><td style='text-align:center;color:#107e3e;font-weight:600'>≤ 1.00</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>IGV (18%)</td><td style='text-align:center'>&#10003;</td><td style='text-align:center'>&#10003;</td><td style='text-align:center;color:#107e3e;font-weight:600'>≤ 1.00</td></tr>" +
                "<tr><td style='padding:3px 5px;font-weight:700'>Total</td><td style='text-align:center'>&#10003;</td><td style='text-align:center'>&#10003;</td><td style='text-align:center;color:#107e3e;font-weight:700'>≤ 1.00</td></tr>" +
                "</table>" +
                "Resultado esperado: " +
                "<span style='color:#107e3e;font-weight:700'>Validación APROBADA &#10003;</span><br><br>" +
                "Si la diferencia excede la tolerancia, el sistema <b>bloquea el registro</b> hasta " +
                "que se corrijan las asignaciones en el Paso 3.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver el resumen de la factura.",
              onEnter: null },

            /* S9 — Resumen Final */
            { role:"proveedor", panelSide:"right", targetId:"resumenPanel",
              title:"Resumen Final de la Factura",
              instruction:
                "Debajo de la tabla de comparación se presenta el <b>Resumen Final</b>, " +
                "una vista consolidada con toda la información clave de la factura:<br><br>" +
                "<div style='border:2px solid #0854a0;border-radius:6px;padding:10px;margin-bottom:10px;font-size:11px'>" +
                "<div style='font-weight:700;color:#0854a0;margin-bottom:8px;font-size:12px'>&#128203; Datos del Resumen</div>" +
                "<div style='display:grid;grid-template-columns:1fr 1fr;gap:4px'>" +
                "<div><b>Documento Origen:</b> Tipo + Número</div>" +
                "<div><b>Comprobante:</b> Serie-Número</div>" +
                "<div><b>Periodo de Registro:</b> Mes-Año</div>" +
                "<div><b>Fecha Emisión:</b> dd/mm/aaaa</div>" +
                "<div><b>Fecha Recepción:</b> dd/mm/aaaa</div>" +
                "<div><b>Cant. Asignaciones:</b> Total asignadas</div>" +
                "</div>" +
                "</div>" +
                "En la parte inferior se muestra la <b>banda financiera</b> destacada con:<br>" +
                "&bull; <b>Monto Total</b> del comprobante<br>" +
                "&bull; <b>Importe Neto</b> (resaltado en <span style='color:#107e3e;font-weight:700'>verde</span>)<br><br>" +
                "Esta sección permite al proveedor <b>confirmar visualmente</b> que todos los datos " +
                "son correctos antes de proceder con las acciones de registro.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver las acciones disponibles.",
              onEnter: null },

            /* S10 — Acciones */
            { role:"proveedor", panelSide:"right", targetId:"btnCerrar",
              title:"Acciones de la Factura",
              instruction:
                "En la parte inferior encontrarás las <b>acciones disponibles</b> según el modo:<br><br>" +
                "<div style='display:flex;gap:6px;font-size:11px;margin-bottom:10px'>" +
                "<div style='flex:1;border:2px solid #0854a0;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#0854a0;margin-bottom:5px'>&#128190; Registrar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Guarda con estado <b>REGISTRADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Puedes editar después</div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No va a Contabilidad aún</div>" +
                "</div>" +
                "<div style='flex:1;border:2px solid #107e3e;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#107e3e;margin-bottom:5px'>&#9993; Registrar y Enviar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Estado: <b>ENVIADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> Ya no es modificable</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Se envía a Contabilidad</div>" +
                "</div>" +
                "</div>" +
                "<b>Modo lectura:</b> Solo se muestra el botón <b>Cerrar</b> para volver al listado.<br>" +
                "<b>Modo edición:</b> Ambos botones visibles; al confirmar regresa al listado automáticamente.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para finalizar el tour.",
              onEnter: null },

            /* S11 — Fin */
            { role:"proveedor", panelSide:"right", targetId:"invoiceTable",
              title:"¡Demo Tour Completado! &#127881;",
              instruction:
                "Has recorrido el flujo completo del <b>Listado de Facturas</b> del " +
                "<b>Portal de Proveedores Claro</b>.<br><br>" +
                "<b>Resumen de lo visto:</b><br>" +
                "&bull; <b>Listado</b> con KPIs, filtros, exportación a Excel y paginación<br>" +
                "&bull; <b>Detalle</b> con wizard de 4 pasos:<br>" +
                "&nbsp;&nbsp;&nbsp;1. Archivos cargados (XML, PDF, CDR)<br>" +
                "&nbsp;&nbsp;&nbsp;2. Datos del comprobante y validación de RUCs<br>" +
                "&nbsp;&nbsp;&nbsp;3. Asignación según tipo (" + sDocIcon + " " + sDocLabel + ")<br>" +
                "&nbsp;&nbsp;&nbsp;4. Validación cruzada de importes + resumen consolidado<br><br>" +
                "<b>Tipos de documento soportados:</b><br>" +
                "&bull; &#128196; <b>Contrato</b> — Programación de obligaciones + pendientes por facturar<br>" +
                "&bull; &#128230; <b>Orden de Compra</b> — Posiciones (ítems/servicios) de la OC<br>" +
                "&bull; &#128737; <b>Póliza</b> — Coberturas de seguros asignadas<br><br>" +
                "&#127881; <b>¡Gracias por completar el tour!</b><br><br>" +
                "Pulsa <b>&#10003; Finalizar</b> para cerrar.",
              onEnter: function(r){ r.navTo("InvoiceList"); } }
        ];
    }

    /* ── Helpers DOM / SAPUI5 ───────────────────────────────────── */

    function _findEl(targetId) {
        if (!targetId) { return null; }
        var mWiz = targetId.match(/^wizardStep(\d+)$/);
        if (mWiz) {
            // Return the step CONTENT element so scrollIntoView goes to the right section
            var oStepEl = document.querySelector('[id$="--' + targetId + '"]');
            if (oStepEl) { return oStepEl; }
            // Fallback: progress nav circle
            var iIdx = parseInt(mWiz[1], 10) - 1;
            var oLi = document.querySelector(
                '[id$="--registerWizard-progressNavigator-step-' + iIdx + '"]'
            );
            if (oLi) { return oLi; }
        }
        return document.querySelector('[id$="--' + targetId + '"]') ||
               document.getElementById(targetId);
    }

    function _firePress(targetId) {
        var oEl = _findEl(targetId);
        if (!oEl) { return false; }
        try {
            var oCtrl = sap.ui.getCore().byId(oEl.id);
            if (oCtrl && typeof oCtrl.firePress === "function") {
                oCtrl.firePress();
                return true;
            }
        } catch (e) { /* ignore */ }
        oEl.dispatchEvent(new MouseEvent("click", { bubbles:true, cancelable:true, view:window }));
        return true;
    }

    /** Navega el Wizard SAPUI5 al paso n (1-based) */
    function _goToWizardStep(n) {
        var oWizEl = document.querySelector('[id$="--registerWizard"]');
        if (!oWizEl) { return; }
        try {
            var oWiz = sap.ui.getCore().byId(oWizEl.id);
            if (!oWiz) { return; }
            var aSteps = oWiz.getSteps();
            if (aSteps && aSteps[n - 1]) {
                oWiz.goToStep(aSteps[n - 1]);
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Resalta el elemento targetId con reintentos automáticos.
     */
    function _highlightWithRetry(targetId, color, maxTries, intervalMs) {
        _clearHighlight();
        if (!targetId) { return; }
        var tries  = 0;
        maxTries   = maxTries   || 20;
        intervalMs = intervalMs || 150;

        function attempt() {
            var oEl = _findEl(targetId);
            if (oEl) {
                var rCheck = _getTargetRect(oEl);
                if (rCheck.width === 0 && rCheck.height === 0) {
                    tries++;
                    if (tries < maxTries) { setTimeout(attempt, intervalMs); }
                    return;
                }
                _clearHighlight();
                oEl.style.setProperty("--cdt-color", color);
                oEl.scrollIntoView({ behavior: "instant", block: "center" });
                setTimeout(function () { _placeBadge(oEl, color); }, 80);
                setTimeout(function () { _placeFrame(oEl, color); }, 80);
                /* Re-place after any pending scroll/layout settles */
                setTimeout(function () {
                    _placeBadge(oEl, color);
                    _placeFrame(oEl, color);
                }, 500);
                return;
            }
            tries++;
            if (tries < maxTries) {
                setTimeout(attempt, intervalMs);
            }
        }
        attempt();
    }

    /* ── Panel DOM ───────────────────────────────────────────────── */

    function _initDrag(oPanel) {
        var oHandle = oPanel.querySelector(".cdt-drag-handle");
        if (!oHandle) { return; }
        oHandle.addEventListener("mousedown", function (eDown) {
            if (eDown.target.tagName === "BUTTON") { return; }
            eDown.preventDefault();
            var rect    = oPanel.getBoundingClientRect();
            var offsetX = eDown.clientX - rect.left;
            var offsetY = eDown.clientY - rect.top;
            function onMove(eMove) {
                var nL = eMove.clientX - offsetX;
                var nT = eMove.clientY - offsetY;
                oPanel.style.left      = Math.max(4, Math.min(nL, window.innerWidth  - oPanel.offsetWidth  - 4)) + "px";
                oPanel.style.right     = "auto";
                oPanel.style.top       = Math.max(4, Math.min(nT, window.innerHeight - oPanel.offsetHeight - 4)) + "px";
                oPanel.style.transform = "none";
            }
            function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup",  onUp);
                _bDragged = true;
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup",  onUp);
        });
    }

    function _removeBadge() {
        var b = document.getElementById(BADGE_ID);
        if (b) { b.remove(); }
    }

    function _clearFrame() {
        var f = document.getElementById(FRAME_ID);
        if (f) { f.remove(); }
    }

    /**
     * Calcula el rect de un elemento. Para pasos del wizard progress nav,
     * excluye la línea separadora y retorna solo icono + título.
     */
    function _getTargetRect(oEl) {
        if (oEl.tagName === "LI" && oEl.closest && oEl.closest(".sapMWizardProgressNav")) {
            var oCircle = oEl.querySelector(".sapMWizardProgressNavAnchor") ||
                          oEl.querySelector("a") ||
                          oEl.querySelector("span.sapMWizardProgressNavStepCircle");
            var oTitle  = oEl.querySelector(".sapMWizardProgressNavStepTitle") ||
                          oEl.querySelector("span[class*='Title']");
            if (oCircle) {
                var rC = oCircle.getBoundingClientRect();
                if (oTitle && oTitle.getBoundingClientRect().width > 0) {
                    var rT = oTitle.getBoundingClientRect();
                    return {
                        top:    Math.min(rC.top, rT.top),
                        left:   Math.min(rC.left, rT.left),
                        right:  Math.max(rC.right, rT.right),
                        bottom: Math.max(rC.bottom, rT.bottom),
                        width:  Math.max(rC.right, rT.right) - Math.min(rC.left, rT.left),
                        height: Math.max(rC.bottom, rT.bottom) - Math.min(rC.top, rT.top)
                    };
                }
                return rC;
            }
        }
        return oEl.getBoundingClientRect();
    }

    function _placeFrame(oEl, color) {
        if (!oEl) { _clearFrame(); return; }
        var rect = _getTargetRect(oEl);
        if (rect.width === 0 && rect.height === 0) { return; }
        var pad = 5;
        var frame = document.getElementById(FRAME_ID);
        if (!frame) {
            frame = document.createElement("div");
            frame.id = FRAME_ID;
            document.body.appendChild(frame);
        }
        frame.style.cssText =
            "position:fixed;z-index:8998;pointer-events:none;" +
            "top:"    + (rect.top    - pad) + "px;" +
            "left:"   + (rect.left   - pad) + "px;" +
            "width:"  + (rect.width  + pad * 2) + "px;" +
            "height:" + (rect.height + pad * 2) + "px;" +
            "border:3px solid " + color + ";" +
            "border-radius:6px;" +
            "box-shadow:0 0 0 5px " + color + "22;" +
            "animation:cdt-frame-pulse 1.4s ease-in-out infinite alternate;";
    }

    function _clearHighlight() {
        document.querySelectorAll(".cdt-highlight").forEach(function (el) {
            el.classList.remove("cdt-highlight");
        });
        _removeBadge();
        _clearFrame();
    }

    function _placeBadge(oEl, color) {
        if (!oEl) { _removeBadge(); return; }
        var rect = _getTargetRect(oEl);
        if (rect.width === 0 && rect.height === 0) { return; }
        var badge = document.getElementById(BADGE_ID);
        if (!badge) {
            badge = document.createElement("div");
            badge.id = BADGE_ID;
            badge.className = "cdt-badge";
            document.body.appendChild(badge);
        }
        badge.style.top  = Math.max(4, rect.top - 30) + "px";
        badge.style.left = rect.left + "px";
        badge.style.background = color;
        badge.innerHTML = "&#9654;&nbsp;Paso&nbsp;" + (_nCurrent + 1);
    }

    function _getPanel() { return document.getElementById(PANEL_ID); }

    function _createPanel() {
        var existing = _getPanel();
        if (existing) { existing.remove(); }
        var div = document.createElement("div");
        div.id = PANEL_ID;
        div.className = "cdt-panel";
        document.body.appendChild(div);
        return div;
    }

    function _positionPanel(panelSide) {
        var oPanel = _getPanel();
        if (!oPanel || _bDragged) { return; }
        oPanel.style.top       = "50%";
        oPanel.style.transform = "translateY(-50%)";
        if (panelSide === "left") {
            oPanel.style.left  = "14px";
            oPanel.style.right = "auto";
        } else {
            oPanel.style.right = "14px";
            oPanel.style.left  = "auto";
        }
    }

    function _renderStep(n) {
        var oPanel = _getPanel();
        if (!oPanel) { return; }
        var oStep  = _aSteps[n];
        var oRole  = ROLES[oStep.role];
        var nTotal = _aSteps.length;

        _positionPanel(oStep.panelSide);

        /* Lista de pasos */
        var sList = '<div class="cdt-list">';
        var sPrevRole = null;
        _aSteps.forEach(function (s, i) {
            if (s.role !== sPrevRole) {
                if (sPrevRole !== null) { sList += "</div>"; }
                sPrevRole = s.role;
                var r = ROLES[s.role];
                sList += '<div class="cdt-group">';
                sList += '<div class="cdt-group-lbl" style="color:' + r.color +
                         ';border-left:3px solid ' + r.color + '">' + r.label + '</div>';
            }
            var bDone = i < n, bActive = i === n;
            var bg = bActive ? oRole.color : (bDone ? "#888" : "#ddd");
            var fg = (bActive || bDone) ? "#fff" : "#aaa";
            var ic = bDone ? "&#10003;" : (bActive ? "&#9654;" : (i + 1));
            var rowStyle = bActive
                ? "background:#f5f5f5;border-left:3px solid " + oRole.color
                : "background:transparent;border-left:3px solid transparent";
            sList += '<div class="cdt-item" style="' + rowStyle + '">';
            sList += '<span class="cdt-dot" style="background:' + bg + ';color:' + fg + '">' + ic + '</span>';
            sList += '<span style="font-size:11px;line-height:1.3;color:' + (bActive ? "#111" : (bDone ? "#999" : "#ccc")) +
                     ';font-weight:' + (bActive ? "600" : "400") + '">' + s.title + '</span>';
            sList += '</div>';
        });
        sList += '</div></div>';

        var sCard =
            '<div class="cdt-card">' +
                '<div class="cdt-step-num" style="color:' + oRole.color + '">' +
                    'Paso ' + (n + 1) + ' / ' + nTotal + ' &middot; ' + oRole.label +
                '</div>' +
                '<div class="cdt-card-title">' + oStep.title + '</div>' +
                '<div class="cdt-card-body">' + oStep.instruction + '</div>' +
            '</div>';

        var sNextLbl = n === nTotal - 1 ? "&#10003;&nbsp;Finalizar" : "Sig&nbsp;&#8250;";
        var sNav =
            '<div class="cdt-nav">' +
                '<button class="cdt-btn-prev"' + (n === 0 ? " disabled" : "") +
                    ' onclick="window.DemoTour&&window.DemoTour.prev()">&#8249;&nbsp;Ant</button>' +
                '<span class="cdt-cnt">' + (n + 1) + '&nbsp;/&nbsp;' + nTotal + '</span>' +
                '<button class="cdt-btn-next" style="background:' + oRole.color +
                    '" onclick="window.DemoTour&&window.DemoTour.next()">' + sNextLbl + '</button>' +
            '</div>';

        var sMinIcon = _bMinimized ? '&#9650;' : '&#9660;';
        oPanel.innerHTML =
            '<div class="cdt-hdr cdt-drag-handle" style="background:' + oRole.color + '">' +
                '<span class="cdt-hdr-title">&#127916;&nbsp;Demo Tour &middot; ' + (n + 1) + '/' + nTotal + '</span>' +
                '<button class="cdt-min" onclick="window.DemoTour&&window.DemoTour.toggleMinimize()" ' +
                    'title="' + (_bMinimized ? "Expandir" : "Minimizar") + '">' + sMinIcon + '</button>' +
                '<button class="cdt-x" onclick="window.DemoTour&&window.DemoTour.close()" title="Salir">&#10005;</button>' +
            '</div>' +
            '<div class="cdt-panel-body" style="' + (_bMinimized ? 'display:none' : '') + '">' +
                '<div class="cdt-role-chip" style="color:' + oRole.color +
                    ';border-bottom:2px solid ' + oRole.color + '1a">' +
                    '<span style="width:9px;height:9px;border-radius:50%;background:' + oRole.color +
                        ';display:inline-block;margin-right:6px;vertical-align:middle"></span>' +
                    oRole.label +
                '</div>' +
                sList + sCard + sNav +
            '</div>';

        setTimeout(function () {
            var oActive = oPanel.querySelector(".cdt-item[style*='background:#f5f5f5']");
            if (oActive) { oActive.scrollIntoView({ block: "nearest" }); }
        }, 60);

        _initDrag(oPanel);
    }

    /* ── API pública ─────────────────────────────────────────────── */
    return {

        start: function (oRouter) {
            _oRouter    = oRouter;
            _aSteps     = _buildSteps("INV001");
            _nCurrent   = 0;
            _bMinimized = false;
            window.DemoTour = this;
            _createPanel();
            this._goTo(0);
        },

        _goTo: function (n) {
            _nCurrent = n;
            _bDragged = false;
            var oStep = _aSteps[n];

            if (oStep.onEnter) { oStep.onEnter(_oRouter); }

            _renderStep(n);

            var nInitDelay = oStep.highlightDelay || (oStep.onEnter ? 400 : 50);
            setTimeout(function () {
                _highlightWithRetry(oStep.targetId, ROLES[oStep.role].color, 20, 150);
            }, nInitDelay);
        },

        _advance: function () {
            if (_nCurrent < _aSteps.length - 1) {
                this._goTo(_nCurrent + 1);
            } else {
                this.close();
            }
        },

        next: function () {
            var oStep = _aSteps[_nCurrent];
            var that  = this;
            if (!oStep) { return; }

            if (oStep.autoAction) {
                oStep.autoAction();
                if (!oStep.listenAction) {
                    var delay = oStep.autoDelay != null ? oStep.autoDelay : 0;
                    setTimeout(function () { that._advance(); }, delay);
                }
            } else {
                this._advance();
            }
        },

        prev: function () {
            if (_nCurrent > 0) { this._goTo(_nCurrent - 1); }
        },

        onUserAction: function (key) {
            var oStep = _aSteps && _aSteps[_nCurrent];
            if (!oStep || oStep.listenAction !== key) { return; }

            if (key === "abrirDetalle") {
                var sInvoiceId = window.DemoTourCurrentInvoiceId || "INV001";
                _aSteps = _buildSteps(sInvoiceId);
            }

            this._advance();
        },

        toggleMinimize: function () {
            _bMinimized = !_bMinimized;
            var oPanel = _getPanel();
            if (!oPanel) { return; }
            var oBody = oPanel.querySelector(".cdt-panel-body");
            if (oBody) { oBody.style.display = _bMinimized ? "none" : ""; }
            var oBtn  = oPanel.querySelector(".cdt-min");
            if (oBtn)  {
                oBtn.innerHTML = _bMinimized ? '&#9650;' : '&#9660;';
                oBtn.title     = _bMinimized ? "Expandir" : "Minimizar";
            }
        },

        close: function () {
            _clearHighlight();
            var p = _getPanel();
            if (p) { p.remove(); }
            window.DemoTour = null;
            window.DemoTourCurrentInvoiceId = null;
        }
    };
});
