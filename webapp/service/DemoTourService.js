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

    function _buildSteps(sInvoiceId) {
        return [
            /* S0 — Bienvenida */
            { role:"proveedor", panelSide:"right", targetId:null,
              title:"Bienvenida al Demo Tour",
              instruction:
                "Bienvenido a la <b>demo interactiva</b> del <b>Listado de Facturas</b> " +
                "del Portal de Proveedores Claro.<br><br>" +
                "Este tour te guiará paso a paso por las funcionalidades disponibles:<br>" +
                "&bull; <b>Listado de Facturas</b> con filtros, KPIs y paginación<br>" +
                "&bull; <b>Detalle de la Factura</b> con la información completa en 4 pasos<br><br>" +
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
                "Las <b>acciones</b> por fila permiten Ver, Editar o Eliminar según el estado.<br><br>" +
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
                "La tabla muestra tus facturas registradas.<br><br>" +
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
                "&bull; <b>Tipo de Factura:</b> Electrónica (XML+PDF) o Física (solo PDF)<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; XML</span> — Archivo XML de la factura electrónica<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; PDF</span> — Representación impresa de la factura<br>" +
                "&bull; <b>CDR</b> — Constancia de Recepción SUNAT (opcional)<br>" +
                "&bull; <b>Otros Anexos</b> — Documentación adicional<br><br>" +
                "En modo <b>lectura</b>, puedes ver los nombres de los archivos cargados " +
                "pero no modificarlos. Para editar, usa el botón <b>Editar</b> desde el listado.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver los datos del comprobante.",
              onEnter: function(r){
                  r.navTo("InvoiceDetail", { invoiceId: sInvoiceId });
              } },

            /* S5 — Wizard Paso 2: Datos del Comprobante */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep2",
              title:"Paso 2: Datos del Comprobante",
              instruction:
                "El <b>Paso 2</b> muestra todos los <b>datos del comprobante</b> extraídos del XML:<br><br>" +
                "<b>Datos de la Factura:</b><br>" +
                "&bull; <b>Tipo de Documento:</b> Factura, Nota de Crédito, etc.<br>" +
                "&bull; <b>Serie y Número</b> del comprobante<br>" +
                "&bull; <b>Fecha de Emisión</b> y datos del <b>Emisor/Receptor</b> con validación de RUC<br>" +
                "&bull; <b>Moneda</b> e <b>Indicador IGV</b><br><br>" +
                "<b>Importes:</b><br>" +
                "&bull; <b>Base Imponible</b>, <b>IGV</b>, <b>Inafecto</b> y <b>Total</b><br>" +
                "&bull; <b>Detracción</b> y <b>Retención</b> (% y montos)<br>" +
                "&bull; <b>Importe Neto</b> = Total - Detracción - Retención<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver la asignación al documento de origen.",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 500 },

            /* S6 — Wizard Paso 3: Asignación */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep3",
              title:"Paso 3: Asignación al Documento",
              instruction:
                "El <b>Paso 3</b> muestra las <b>obligaciones o posiciones</b> del documento " +
                "de origen que fueron asignadas a esta factura.<br><br>" +
                "<b>Para Contratos:</b><br>" +
                "&bull; <b>Concepto de Pago</b> seleccionado (ALQ, GC, OTR...)<br>" +
                "&bull; <b>Tabla de Programación:</b> cronograma completo del concepto<br>" +
                "&bull; <b>Tabla de Pendientes:</b> obligaciones asignadas a la factura<br><br>" +
                "<b>Para OC / Póliza:</b><br>" +
                "&bull; <b>Tabla de Posiciones:</b> ítems del documento asignados<br><br>" +
                "Las filas marcadas en <span style='color:#107e3e;font-weight:700'>verde</span> " +
                "son las que están vinculadas con esta factura.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver la validación de importes.",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 500 },

            /* S7 — Wizard Paso 4: Comparación */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep4",
              title:"Paso 4: Validación y Resumen",
              instruction:
                "El <b>Paso 4</b> realiza la <b>validación cruzada</b> de importes y muestra " +
                "el resumen completo de la factura.<br><br>" +
                "<b>Comparación de Importes:</b><br>" +
                "&bull; Compara los importes del <b>XML</b> vs las <b>obligaciones asignadas</b><br>" +
                "&bull; Cada campo muestra la diferencia — tolerancia máxima: <b>≤ S/ 1.00</b><br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; Verde</span> = dentro de tolerancia<br>" +
                "&bull; <span style='color:#DA291C;font-weight:700'>&#10005; Rojo</span> = excede tolerancia<br><br>" +
                "<b>Resumen Final:</b><br>" +
                "&bull; Documento de origen, comprobante, período, fechas<br>" +
                "&bull; <b>Monto Total</b> e <b>Importe Neto</b> (descontando retención/detracción)<br><br>" +
                "Los botones <b>Registrar</b> y <b>Registrar y Enviar</b> aparecen solo en modo edición.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver el paso de la comparación de importes.",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 500 },

            /* S8 — Comparación panel */
            { role:"proveedor", panelSide:"right", targetId:"comparacionTable",
              title:"Tabla de Comparación de Importes",
              instruction:
                "Esta tabla detalla la <b>comparación campo por campo</b>:<br><br>" +
                "<table style='width:100%;font-size:11px;border-collapse:collapse;margin-bottom:8px'>" +
                "<tr style='background:#f0f0f0;font-weight:600'><td style='padding:3px 5px'>Campo</td><td style='text-align:right;padding:3px 5px'>Del XML</td><td style='text-align:right;padding:3px 5px'>Asignado</td><td style='text-align:right;padding:3px 5px'>Diferencia</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>Base Imponible</td><td style='text-align:right;padding:3px 5px'>24,568.14</td><td style='text-align:right;padding:3px 5px'>24,568.14</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:600'>0.00 &#10003;</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>IGV (18%)</td><td style='text-align:right;padding:3px 5px'>4,422.27</td><td style='text-align:right;padding:3px 5px'>4,422.27</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:600'>0.00 &#10003;</td></tr>" +
                "<tr><td style='padding:3px 5px;font-weight:700'>Total</td><td style='text-align:right;padding:3px 5px;font-weight:700'>28,990.41</td><td style='text-align:right;padding:3px 5px;font-weight:700'>28,990.41</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:700'>0.00 &#10003;</td></tr>" +
                "</table>" +
                "Tolerancia máxima: <b>≤ S/ 1.00</b>. &nbsp;Resultado: " +
                "<span style='color:#107e3e;font-weight:700'>Validación APROBADA &#10003;</span><br><br>" +
                "Si la diferencia excede la tolerancia, el sistema bloquea el registro hasta " +
                "que se corrijan los importes asignados.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver el resumen final.",
              onEnter: null },

            /* S9 — Resumen + botones */
            { role:"proveedor", panelSide:"right", targetId:"btnRegistrarEnviar",
              title:"Acciones de la Factura",
              instruction:
                "En la parte inferior de la validación, encontrarás las <b>acciones disponibles</b>:<br><br>" +
                "<div style='display:flex;gap:6px;font-size:11px;margin-bottom:10px'>" +
                "<div style='flex:1;border:2px solid #0854a0;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#0854a0;margin-bottom:5px'>&#128190; Registrar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Guarda con estado <b>REGISTRADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Puedes editar después</div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No va a Contabilidad</div>" +
                "</div>" +
                "<div style='flex:1;border:2px solid #107e3e;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#107e3e;margin-bottom:5px'>&#9993; Registrar y Enviar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Estado: <b>ENVIADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No modificable</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Va a Contabilidad</div>" +
                "</div>" +
                "</div>" +
                "<b>Nota:</b> Estas acciones solo están disponibles en modo <b>edición</b>. " +
                "En modo lectura, los botones no son visibles.<br>" +
                "El botón <b>Cerrar</b> cierra el detalle y vuelve al listado.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para volver al listado.",
              onEnter: null },

            /* S10 — Vuelta al listado */
            { role:"proveedor", panelSide:"right", targetId:"invoiceTable",
              title:"¡Demo Tour Completado! 🎉",
              instruction:
                "Has recorrido el flujo completo del <b>Listado de Facturas</b> del " +
                "<b>Portal de Proveedores Claro</b>.<br><br>" +
                "<b>Resumen de lo visto:</b><br>" +
                "&bull; <b>Listado</b> con KPIs, filtros, exportación a Excel y paginación<br>" +
                "&bull; <b>Detalle</b> con wizard de 4 pasos mostrando toda la información:<br>" +
                "&nbsp;&nbsp;&nbsp;1. Archivos cargados (XML, PDF, CDR)<br>" +
                "&nbsp;&nbsp;&nbsp;2. Datos del comprobante y validación de RUCs<br>" +
                "&nbsp;&nbsp;&nbsp;3. Asignación a obligaciones o posiciones<br>" +
                "&nbsp;&nbsp;&nbsp;4. Validación de importes y resumen final<br><br>" +
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

    /** Avanza el Wizard SAPUI5 al siguiente paso */
    function _advanceWizard() {
        var oWizEl = document.querySelector('[id$="--registerWizard"]');
        if (!oWizEl) { return; }
        try {
            var oWiz = sap.ui.getCore().byId(oWizEl.id);
            if (oWiz && typeof oWiz.nextStep === "function") {
                oWiz.nextStep();
                return;
            }
        } catch (e) { /* fallback */ }
        var oBtn = oWizEl.querySelector(".sapMWizardNextButton");
        if (oBtn) { oBtn.click(); }
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
