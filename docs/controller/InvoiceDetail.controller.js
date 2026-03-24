sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/core/routing/History",
	"../util/formatter"
], function (Controller, JSONModel, MessageToast, MessageBox, History, formatter) {
	"use strict";

	return Controller.extend("claro.com.listadofacturas.controller.InvoiceDetail", {

		formatter: formatter,

		/* ═════════════════════════ Controller-level formatter ═════════════════════════ */
		formatToleranciaText: function (fDiferencia, sExcede, sOk) {
			return Math.abs(fDiferencia) > 1 ? sExcede : sOk;
		},

		/* ═════════════════════════ Lifecycle ═════════════════════════ */
		onInit: function () {
			this._oService = this.getOwnerComponent()._oMockDataService;
			this._iDesktopPageSize = 10;
			this._iMobilePageSize = 3;

			// ── viewModel ──
			this.getView().setModel(new JSONModel(this._getDefaultViewModelData()), "viewModel");

			// ── detalle (CONTRATO / OC) ──
			this.getView().setModel(new JSONModel({}), "detalle");
			// ── contrato ──
			this.getView().setModel(new JSONModel({}), "contrato");
			// ── comprobante ──
			this.getView().setModel(new JSONModel({}), "comprobante");
			// ── programacion / pendientesFact (Paso 3: CONTRATO) ──
			this.getView().setModel(new JSONModel([]), "programacion");
			this.getView().setModel(new JSONModel([]), "pendientesFact");
			// ── posiciones (Paso 3: OC) ──
			this.getView().setModel(new JSONModel([]), "posiciones");
			// ── paged models for mobile ──
			this.getView().setModel(new JSONModel([]), "programacionPaged");
			this.getView().setModel(new JSONModel([]), "pendientesFactPaged");
			this.getView().setModel(new JSONModel([]), "posicionesPaged");
			// ── cuentasContables (Value Help) ──
			this.getView().setModel(new JSONModel([]), "cuentasContables");

			// Internal arrays for pagination
			this._allProgramacionData = [];
			this._allPendientesData = [];
			this._allPosicionesData = [];

			// Responsive listener
			var that = this;
			this._fnResize = function () {
				var oVM = that.getView() && that.getView().getModel("viewModel");
				if (oVM) { oVM.setProperty("/isPhone", window.innerWidth < 600); }
			};
			window.addEventListener("resize", this._fnResize);

			// Router
			this.getOwnerComponent().getRouter()
				.getRoute("InvoiceDetail")
				.attachPatternMatched(this._onRouteMatched, this);
		},

		onExit: function () {
			window.removeEventListener("resize", this._fnResize);
		},

		/* ═════════════ Default viewModel data ═════════════ */
		_getDefaultViewModelData: function () {
			return {
				busy: false,
				mode: "view",
				readOnly: true,
				pageTitle: "Detalle de Factura",
				step1Valid: true,
				step2Valid: true,
				step3Valid: true,
				step4Valid: true,
				canRegister: false,
				canSubmit: false,
				xmlLoaded: false, xmlFileName: "",
				pdfLoaded: false, pdfFileName: "",
				cdrLoaded: false, cdrFileName: "",
				otrosArchivos: [],
				rucEmisorValid: true,
				rucReceptorValid: true,
				selectedConceptoId: "",
				filterEstadoPosicion: "",
				hasSelectedObligaciones: false,
				hasSelectedPosiciones: false,
				hasSelectedPendientes: false,
				posicionesPage: 1, posicionesTotalPages: 1, posicionesTotal: 0,
				registrationComplete: false,
				asignaciones: [],
				totalAsignado: 0,
				validacionOk: false,
				validacionMessage: "",
				comparacion: [],
				isPhone: window.innerWidth < 600,
				periodoAsignacion: (function () {
					var d = new Date();
					return d.getDate().toString().padStart(2, "0") + "/" +
						(d.getMonth() + 1).toString().padStart(2, "0") + "/" + d.getFullYear();
				}()),
				progDesktopPage: 1, progDesktopTotalPages: 1, progDesktopTotal: 0,
				pendDesktopPage: 1, pendDesktopTotalPages: 1, pendDesktopTotal: 0,
				progMobilePage: 1, progMobileTotalPages: 1, progMobileTotal: 0,
				progMobilePrevEnabled: false, progMobileNextEnabled: false, progMobilePageInfo: "Pag 1 de 1",
				pendMobilePage: 1, pendMobileTotalPages: 1, pendMobileTotal: 0,
				pendMobilePrevEnabled: false, pendMobileNextEnabled: false, pendMobilePageInfo: "Pag 1 de 1",
				posMobilePage: 1, posMobileTotalPages: 1, posMobileTotal: 0,
				posMobilePrevEnabled: false, posMobileNextEnabled: false, posMobilePageInfo: "Pag 1 de 1"
			};
		},

		/* ═════════════ Route handling ═════════════ */
		_onRouteMatched: function (oEvent) {
			var sInvoiceId = oEvent.getParameter("arguments").invoiceId;
			var oInvoice = this._oService.getInvoiceById(sInvoiceId);

			if (!oInvoice) {
				MessageBox.error("Factura no encontrada");
				this.onNavBack();
				return;
			}

			this._sInvoiceId = sInvoiceId;
			this._oInvoice = oInvoice;

			// Determine mode
			var bEditable = (oInvoice.Status === "Registrado" || oInvoice.Status === "Rechazado");
			var sMode = bEditable ? "edit" : "view";
			var bReadOnly = !bEditable;

			// Reset viewModel
			var oVM = this.getView().getModel("viewModel");
			oVM.setData(this._getDefaultViewModelData());
			oVM.setProperty("/mode", sMode);
			oVM.setProperty("/readOnly", bReadOnly);
			oVM.setProperty("/pageTitle", bReadOnly ? "Visualizar Factura" : "Editar Factura");

			// Load detail data from consolidated set
			var oDetail = this._oService.getDetailData(sInvoiceId);
			if (!oDetail) {
				MessageBox.error("No se encontraron datos de detalle para esta factura");
				return;
			}

			// ── Set comprobante model ──
			var oComp = JSON.parse(JSON.stringify(oDetail.comprobante));
			if (oComp.porcentajeRetencion === undefined) { oComp.porcentajeRetencion = 0; }
			if (oComp.montoRetencion      === undefined) { oComp.montoRetencion      = 0; }
			if (oComp.indicadorImpuesto   === undefined) { oComp.indicadorImpuesto   = ""; }
			this.getView().getModel("comprobante").setData(oComp);

			// ── Set detalle model ──
			this.getView().getModel("detalle").setData(JSON.parse(JSON.stringify(oDetail.detalle)));

			// Files status (all pre-loaded for existing invoices)
			var sXmlFile = oInvoice.Series + "-" + oInvoice.DocNumber + ".xml";
			var sPdfFile = oInvoice.Series + "-" + oInvoice.DocNumber + ".pdf";
			oVM.setProperty("/xmlLoaded", true);
			oVM.setProperty("/xmlFileName", sXmlFile);
			oVM.setProperty("/pdfLoaded", true);
			oVM.setProperty("/pdfFileName", sPdfFile);

			// ── Load Step 3 data based on type ──
			if (oDetail.detalle.tipoDocumento === "CONTRATO") {
				this._loadContratoStep3(oDetail);
			} else {
				this._loadOCStep3(oDetail);
			}

			// ── Build asignaciones for Step 4 ──
			this._buildAsignaciones(oDetail);

			// ── Advance wizard: always validate all steps, but only jump to last when editing ──
			var that = this;
			setTimeout(function () {
				that._realizarValidacionImportes();
				if (bReadOnly) {
					oVM.setProperty("/canRegister", false);
					oVM.setProperty("/canSubmit", false);
				}
				var oWizard = that.byId("registerWizard");
				var oStep1   = that.byId("wizardStep1");
				var oStep2   = that.byId("wizardStep2");
				var oStep3   = that.byId("wizardStep3");
				var oLastStep = that.byId("wizardStep4");
				if (oWizard && oStep1 && oLastStep) {
					try {
						[oStep1, oStep2, oStep3, oLastStep].forEach(function (s) { if (s) { s.setValidated(true); } });
						oWizard.discardProgress(oStep1);
						if (!bReadOnly) {
							oWizard.setCurrentStep(oLastStep);
						}
					} catch (e) { /* */ }
				}
			}, 300);
		},

		/* ═════════════ Load CONTRATO Step 3 data ═════════════ */
		_loadContratoStep3: function (oDetail) {
			// Contrato model
			this.getView().getModel("contrato").setData(JSON.parse(JSON.stringify(oDetail.contrato)));

			// Programacion
			this._allProgramacionData = JSON.parse(JSON.stringify(oDetail.programacion || []));
			this._applyProgDesktopPage(1);

			// Pendientes por facturar
			this._allPendientesData = JSON.parse(JSON.stringify(oDetail.pendientesFact || []));
			this._applyPendDesktopPage(1);

			// Auto-select first concepto
			if (oDetail.contrato && oDetail.contrato.conceptos && oDetail.contrato.conceptos.length > 0) {
				this.getView().getModel("viewModel").setProperty("/selectedConceptoId", oDetail.contrato.conceptos[0].id);
			}
		},

		/* ═════════════ Load OC Step 3 data ═════════════ */
		_loadOCStep3: function (oDetail) {
			this._allPosicionesData = JSON.parse(JSON.stringify(oDetail.posiciones || []));
			this._applyPosicionesPagination(1);
		},

		/* ═════════════ Build asignaciones from detail data ═════════════ */
		_buildAsignaciones: function (oDetail) {
			var oVM = this.getView().getModel("viewModel");
			var oComprobante = oDetail.comprobante;
			var aAsignaciones = [];

			if (oDetail.detalle.tipoDocumento === "CONTRATO") {
				(oDetail.pendientesFact || []).forEach(function (oPend) {
					if (oPend.asignado) {
						aAsignaciones.push({
							conceptoPago: oPend.conceptoPago,
							descripcion: oPend.glosaPago,
							mesPago: oPend.mesPago,
							valorVenta: parseFloat(oPend.valorVenta) || 0,
							igv: parseFloat(oPend.igv) || 0,
							inafecto: parseFloat(oPend.inafecto) || 0,
							total: parseFloat(oPend.total) || 0,
							moneda: oPend.moneda
						});
					}
				});
			} else {
				var fTotalComp = oComprobante.montoTotal || 1;
				(oDetail.posiciones || []).forEach(function (oPos) {
					if (oPos.asignado) {
						var fRatio = fTotalComp > 0 ? oPos.importe / fTotalComp : 0;
						aAsignaciones.push({
							descripcion: oPos.descripcion,
							valorVenta: +((oComprobante.importeBase || 0) * fRatio).toFixed(2),
							igv: +((oComprobante.montoIGV || 0) * fRatio).toFixed(2),
							inafecto: +((oComprobante.montoInafecto || 0) * fRatio).toFixed(2),
							total: oPos.importe,
							moneda: oPos.moneda,
							mesPago: "-"
						});
					}
				});
			}

			oVM.setProperty("/asignaciones", aAsignaciones);
			var fTotal = aAsignaciones.reduce(function (s, o) { return s + (parseFloat(o.total) || 0); }, 0);
			oVM.setProperty("/totalAsignado", fTotal);
		},

		/* ══════════════════ PASO 4: Validation ══════════════════ */
		onStep4Activate: function () {
			this._realizarValidacionImportes();
		},

		_realizarValidacionImportes: function () {
			var oVM = this.getView().getModel("viewModel");
			var oComp = this.getView().getModel("comprobante").getData();
			var aAsig = oVM.getProperty("/asignaciones") || [];

			var fBase = 0, fIGV = 0, fInafecto = 0, fTotal = 0;
			aAsig.forEach(function (o) {
				fBase += (parseFloat(o.valorVenta) || 0);
				fIGV += (parseFloat(o.igv) || 0);
				fInafecto += (parseFloat(o.inafecto) || 0);
				fTotal += (parseFloat(o.total) || 0);
			});

			var aComp = [
				{ campo: "Importe Base", xml: oComp.importeBase || 0, asignado: fBase, diferencia: (oComp.importeBase || 0) - fBase },
				{ campo: "Monto IGV", xml: oComp.montoIGV || 0, asignado: fIGV, diferencia: (oComp.montoIGV || 0) - fIGV },
				{ campo: "Monto Inafecto", xml: oComp.montoInafecto || 0, asignado: fInafecto, diferencia: (oComp.montoInafecto || 0) - fInafecto },
				{ campo: "Monto Total", xml: oComp.montoTotal || 0, asignado: fTotal, diferencia: (oComp.montoTotal || 0) - fTotal }
			];

			var bValid = aComp.every(function (r) { return Math.abs(r.diferencia) <= 1; });
			oVM.setProperty("/validacionOk", bValid);
			oVM.setProperty("/validacionMessage", bValid
				? "Los importes coinciden dentro de la tolerancia permitida"
				: "Existen diferencias entre los importes del XML y las asignaciones");
			oVM.setProperty("/comparacion", aComp);
			oVM.setProperty("/step4Valid", bValid);
			oVM.setProperty("/canRegister", bValid && !oVM.getProperty("/readOnly"));
			oVM.setProperty("/canSubmit", bValid && !oVM.getProperty("/readOnly"));
		},

		/* ══════════════════ Pagination: Programación Desktop ══════════════════ */
		_applyProgDesktopPage: function (iPage) {
			var aAll = this._allProgramacionData || [];
			var iSize = this._iDesktopPageSize;
			var iTotal = aAll.length;
			var iPages = Math.max(1, Math.ceil(iTotal / iSize));
			iPage = Math.min(Math.max(1, iPage), iPages);
			var aPage = aAll.slice((iPage - 1) * iSize, iPage * iSize);

			this.getView().getModel("programacion").setData(aPage);
			var oVM = this.getView().getModel("viewModel");
			oVM.setProperty("/progDesktopPage", iPage);
			oVM.setProperty("/progDesktopTotalPages", iPages);
			oVM.setProperty("/progDesktopTotal", iTotal);

			this._applyProgMobilePage(1);
		},
		onProgDesktopFirstPage: function () { this._applyProgDesktopPage(1); },
		onProgDesktopPrevPage: function () { this._applyProgDesktopPage(this.getView().getModel("viewModel").getProperty("/progDesktopPage") - 1); },
		onProgDesktopNextPage: function () { this._applyProgDesktopPage(this.getView().getModel("viewModel").getProperty("/progDesktopPage") + 1); },
		onProgDesktopLastPage: function () { this._applyProgDesktopPage(this.getView().getModel("viewModel").getProperty("/progDesktopTotalPages")); },

		/* ══════════════════ Pagination: Programación Mobile ══════════════════ */
		_applyProgMobilePage: function (iPage) {
			var aAll = this._allProgramacionData || [];
			var iSize = this._iMobilePageSize;
			var iTotal = aAll.length;
			var iPages = Math.max(1, Math.ceil(iTotal / iSize));
			iPage = Math.min(Math.max(1, iPage), iPages);
			this.getView().getModel("programacionPaged").setData(aAll.slice((iPage - 1) * iSize, iPage * iSize));
			var oVM = this.getView().getModel("viewModel");
			oVM.setProperty("/progMobilePage", iPage);
			oVM.setProperty("/progMobileTotalPages", iPages);
			oVM.setProperty("/progMobileTotal", iTotal);
			oVM.setProperty("/progMobilePrevEnabled", iPage > 1);
			oVM.setProperty("/progMobileNextEnabled", iPage < iPages);
			oVM.setProperty("/progMobilePageInfo", "Pag " + iPage + " de " + iPages + " | " + iTotal + " Reg.");
		},
		onProgMobileFirstPage: function () { this._applyProgMobilePage(1); },
		onProgMobilePrevPage: function () { this._applyProgMobilePage(this.getView().getModel("viewModel").getProperty("/progMobilePage") - 1); },
		onProgMobileNextPage: function () { this._applyProgMobilePage(this.getView().getModel("viewModel").getProperty("/progMobilePage") + 1); },
		onProgMobileLastPage: function () { this._applyProgMobilePage(this.getView().getModel("viewModel").getProperty("/progMobileTotalPages")); },

		/* ══════════════════ Pagination: Pendientes Desktop ══════════════════ */
		_applyPendDesktopPage: function (iPage) {
			this._syncPendDesktopBack();
			var aAll = this._allPendientesData || [];
			var iSize = this._iDesktopPageSize;
			var iTotal = aAll.length;
			var iPages = Math.max(1, Math.ceil(iTotal / iSize));
			iPage = Math.min(Math.max(1, iPage), iPages);
			var aPage = aAll.slice((iPage - 1) * iSize, iPage * iSize);

			this.getView().getModel("pendientesFact").setData(aPage);
			var oVM = this.getView().getModel("viewModel");
			oVM.setProperty("/pendDesktopPage", iPage);
			oVM.setProperty("/pendDesktopTotalPages", iPages);
			oVM.setProperty("/pendDesktopTotal", iTotal);

			var oTable = this.byId("pendientesFactTable");
			if (oTable) { oTable.setVisibleRowCount(Math.max(1, aPage.length)); }

			this._applyPendMobilePage(1);
		},
		onPendDesktopFirstPage: function () { this._applyPendDesktopPage(1); },
		onPendDesktopPrevPage: function () { this._applyPendDesktopPage(this.getView().getModel("viewModel").getProperty("/pendDesktopPage") - 1); },
		onPendDesktopNextPage: function () { this._applyPendDesktopPage(this.getView().getModel("viewModel").getProperty("/pendDesktopPage") + 1); },
		onPendDesktopLastPage: function () { this._applyPendDesktopPage(this.getView().getModel("viewModel").getProperty("/pendDesktopTotalPages")); },

		/* ══════════════════ Pagination: Pendientes Mobile ══════════════════ */
		_applyPendMobilePage: function (iPage) {
			var aAll = this._allPendientesData || [];
			var iSize = this._iMobilePageSize;
			var iTotal = aAll.length;
			var iPages = Math.max(1, Math.ceil(iTotal / iSize));
			iPage = Math.min(Math.max(1, iPage), iPages);
			this.getView().getModel("pendientesFactPaged").setData(aAll.slice((iPage - 1) * iSize, iPage * iSize));
			var oVM = this.getView().getModel("viewModel");
			oVM.setProperty("/pendMobilePage", iPage);
			oVM.setProperty("/pendMobileTotalPages", iPages);
			oVM.setProperty("/pendMobileTotal", iTotal);
			oVM.setProperty("/pendMobilePrevEnabled", iPage > 1);
			oVM.setProperty("/pendMobileNextEnabled", iPage < iPages);
			oVM.setProperty("/pendMobilePageInfo", "Pag " + iPage + " de " + iPages + " | " + iTotal + " Reg.");
		},
		onPendMobileFirstPage: function () { this._applyPendMobilePage(1); },
		onPendMobilePrevPage: function () { this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobilePage") - 1); },
		onPendMobileNextPage: function () { this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobilePage") + 1); },
		onPendMobileLastPage: function () { this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobileTotalPages")); },

		/* ══════════════════ Pagination: Posiciones Desktop ══════════════════ */
		_applyPosicionesPagination: function (iPage) {
			var aAll = this._allPosicionesData || [];
			var iSize = this._iDesktopPageSize;
			var iTotal = aAll.length;
			var iPages = Math.max(1, Math.ceil(iTotal / iSize));
			iPage = Math.min(Math.max(1, iPage), iPages);
			this.getView().getModel("posiciones").setData(aAll.slice((iPage - 1) * iSize, iPage * iSize));
			var oVM = this.getView().getModel("viewModel");
			oVM.setProperty("/posicionesPage", iPage);
			oVM.setProperty("/posicionesTotalPages", iPages);
			oVM.setProperty("/posicionesTotal", iTotal);
			var oTable = this.byId("posicionesAsignacionTable");
			if (oTable) { oTable.removeSelections(true); oVM.setProperty("/hasSelectedPosiciones", false); }

			this._applyPosMobilePage(1);
		},
		onPosicionesFirstPage: function () { this._applyPosicionesPagination(1); },
		onPosicionesPrevPage: function () { this._applyPosicionesPagination(this.getView().getModel("viewModel").getProperty("/posicionesPage") - 1); },
		onPosicionesNextPage: function () { this._applyPosicionesPagination(this.getView().getModel("viewModel").getProperty("/posicionesPage") + 1); },
		onPosicionesLastPage: function () { this._applyPosicionesPagination(this.getView().getModel("viewModel").getProperty("/posicionesTotalPages")); },

		/* ══════════════════ Pagination: Posiciones Mobile ══════════════════ */
		_applyPosMobilePage: function (iPage) {
			var aAll = this._allPosicionesData || [];
			var iSize = this._iMobilePageSize;
			var iTotal = aAll.length;
			var iPages = Math.max(1, Math.ceil(iTotal / iSize));
			iPage = Math.min(Math.max(1, iPage), iPages);
			this.getView().getModel("posicionesPaged").setData(aAll.slice((iPage - 1) * iSize, iPage * iSize));
			var oVM = this.getView().getModel("viewModel");
			oVM.setProperty("/posMobilePage", iPage);
			oVM.setProperty("/posMobileTotalPages", iPages);
			oVM.setProperty("/posMobileTotal", iTotal);
			oVM.setProperty("/posMobilePrevEnabled", iPage > 1);
			oVM.setProperty("/posMobileNextEnabled", iPage < iPages);
			oVM.setProperty("/posMobilePageInfo", "Pag " + iPage + " de " + iPages + " | " + iTotal + " Reg.");
		},
		onPosMobileFirstPage: function () { this._applyPosMobilePage(1); },
		onPosMobilePrevPage: function () { this._applyPosMobilePage(this.getView().getModel("viewModel").getProperty("/posMobilePage") - 1); },
		onPosMobileNextPage: function () { this._applyPosMobilePage(this.getView().getModel("viewModel").getProperty("/posMobilePage") + 1); },
		onPosMobileLastPage: function () { this._applyPosMobilePage(this.getView().getModel("viewModel").getProperty("/posMobileTotalPages")); },

		/* ══════════════════ Step 3: Concepto selection (CONTRATO) ══════════════════ */
		onConceptoChange: function (oEvent) {
			this.getView().getModel("viewModel").setProperty("/selectedConceptoId", oEvent.getSource().getSelectedKey());
		},

		onAgregarConcepto: function () {
			var oVM = this.getView().getModel("viewModel");
			var sConceptoId = oVM.getProperty("/selectedConceptoId");
			if (!sConceptoId) { MessageToast.show("Seleccione un concepto"); return; }

			// Filter programacion and pendientes for the selected concepto
			var oDetail = this._oService.getDetailData(this._sInvoiceId);
			if (!oDetail) { return; }

			var oConcepto = (oDetail.contrato.conceptos || []).find(function (c) { return c.id === sConceptoId; });
			var sConceptoStr = oConcepto ? oConcepto.concepto : "";

			var aProg = (oDetail.programacion || []).filter(function (p) { return p.conceptoPago === sConceptoStr; });
			var aPend = (oDetail.pendientesFact || []).filter(function (p) { return p.conceptoPago === sConceptoStr; });

			this._allProgramacionData = JSON.parse(JSON.stringify(aProg));
			this._applyProgDesktopPage(1);

			this._allPendientesData = JSON.parse(JSON.stringify(aPend));
			this._applyPendDesktopPage(1);
			oVM.setProperty("/hasSelectedPendientes", false);

			if (aProg.length === 0 && aPend.length === 0) {
				MessageToast.show("No hay datos para el concepto seleccionado");
			}
		},

		/* ══════════════════ Step 3: Pending selection / assign (CONTRATO) ══════════════════ */
		onPendientesFactSelectionChange: function () {
			var oTable = this.byId("pendientesFactTable");
			var aIdx = oTable ? oTable.getSelectedIndices() : [];
			this.getView().getModel("viewModel").setProperty("/hasSelectedPendientes", aIdx.length > 0);
		},

		onPendienteImporteChange: function (oEvent) {
			var oInput      = oEvent.getSource();
			var sValue      = oEvent.getParameter("value") || "";
			var oCtx        = oInput.getBindingContext("pendientesFact");
			if (!oCtx) { return; }
			var oModel      = this.getView().getModel("pendientesFact");
			var sBindProp   = oInput.getBinding("value") ? oInput.getBinding("value").getPath() : "";
			var fValorVenta, fIGV;
			if (sBindProp === "valorVenta") {
				fValorVenta = parseFloat(sValue) || 0;
				fIGV        = parseFloat(oModel.getProperty(oCtx.getPath() + "/igv")) || 0;
			} else {
				fValorVenta = parseFloat(oModel.getProperty(oCtx.getPath() + "/valorVenta")) || 0;
				fIGV        = parseFloat(sValue) || 0;
			}
			oModel.setProperty(oCtx.getPath() + "/total", parseFloat((fValorVenta + fIGV).toFixed(2)));
		},

		onRegistrarFacturaPendiente: function () {
			var that = this;
			var oTable = this.byId("pendientesFactTable");
			var aIdx = oTable ? oTable.getSelectedIndices() : [];
			if (aIdx.length === 0) { MessageToast.show("Seleccione pendientes"); return; }
			var aData = this.getView().getModel("pendientesFact").getData();
			var oComp = this.getView().getModel("comprobante").getData();
			var sNroFact = oComp.serieDocumento + "-" + oComp.numeroDocumento;
			aIdx.forEach(function (i) {
				if (aData[i]) { aData[i].asignado = true; aData[i].nroFactura = sNroFact; }
			});
			this.getView().getModel("pendientesFact").refresh(true);
			oTable.clearSelection();
			this._rebuildAsignaciones();
			setTimeout(function () { that._refreshPendientesHighlight(); }, 100);
			MessageToast.show(aIdx.length + " pendiente(s) asignado(s)");
		},

		onDesasignarPendiente: function () {
			var that = this;
			var oTable = this.byId("pendientesFactTable");
			var aIdx = oTable ? oTable.getSelectedIndices() : [];
			if (aIdx.length === 0) { MessageToast.show("Seleccione pendientes"); return; }
			var aData = this.getView().getModel("pendientesFact").getData();
			aIdx.forEach(function (i) {
				if (aData[i]) { aData[i].asignado = false; aData[i].nroFactura = null; }
			});
			this.getView().getModel("pendientesFact").refresh(true);
			oTable.clearSelection();
			this._rebuildAsignaciones();
			setTimeout(function () { that._refreshPendientesHighlight(); }, 100);
			MessageToast.show(aIdx.length + " pendiente(s) desasignado(s)");
		},

		_refreshPendientesHighlight: function () {
			var oTable = this.byId("pendientesFactTable");
			if (!oTable) { return; }
			var aData = this.getView().getModel("pendientesFact").getData() || [];
			oTable.getRows().forEach(function (oRow) {
				var iIdx = oRow.getIndex();
				var oTr = oRow.getDomRef();
				if (!oTr) { return; }
				var oItem = aData[iIdx];
				if (oItem && oItem.asignado) {
					oTr.classList.add("claro-row-asignado");
				} else {
					oTr.classList.remove("claro-row-asignado");
				}
			});
		},

		_syncPendDesktopBack: function () {
			var aPage = this.getView().getModel("pendientesFact").getData();
			if (!aPage || !aPage.length) { return; }
			var iPage   = this.getView().getModel("viewModel").getProperty("/pendDesktopPage") || 1;
			var iOffset = (iPage - 1) * (this._iDesktopPageSize || 10);
			aPage.forEach(function (oRow, i) {
				if (this._allPendientesData[iOffset + i]) {
					this._allPendientesData[iOffset + i] = oRow;
				}
			}.bind(this));
		},

		_refreshPosicionesHighlight: function () {
			var oTable = this.byId("posicionesAsignacionTable");
			if (!oTable) { return; }
			oTable.getItems().forEach(function (oItem) {
				var oCtx = oItem.getBindingContext("posiciones");
				if (!oCtx) { return; }
				var oData = oCtx.getObject();
				if (oData && oData.asignado) {
					oItem.addStyleClass("claro-row-asignado");
				} else {
					oItem.removeStyleClass("claro-row-asignado");
				}
			});
		},

		/* Mobile variants */
		onPendientesFactMobileSelectionChange: function () {
			var oList = this.byId("pendientesFactMobileList");
			this.getView().getModel("viewModel").setProperty("/hasSelectedPendientes", oList && oList.getSelectedItems().length > 0);
		},
		onRegistrarFacturaPendienteMobile: function () {
			var oList = this.byId("pendientesFactMobileList");
			var aItems = oList ? oList.getSelectedItems() : [];
			if (aItems.length === 0) { return; }
			var oComp = this.getView().getModel("comprobante").getData();
			var sNroFact = oComp.serieDocumento + "-" + oComp.numeroDocumento;
			aItems.forEach(function (oItem) {
				var oCtx = oItem.getBindingContext("pendientesFactPaged");
				if (oCtx) {
					oCtx.getObject().asignado = true;
					oCtx.getObject().nroFactura = sNroFact;
				}
			});
			this.getView().getModel("pendientesFactPaged").refresh(true);
			oList.removeSelections(true);
			this._rebuildAsignaciones();
			MessageToast.show(aItems.length + " pendiente(s) asignado(s)");
		},
		onDesasignarPendienteMobile: function () {
			var oList = this.byId("pendientesFactMobileList");
			var aItems = oList ? oList.getSelectedItems() : [];
			if (aItems.length === 0) { return; }
			aItems.forEach(function (oItem) {
				var oCtx = oItem.getBindingContext("pendientesFactPaged");
				if (oCtx) {
					oCtx.getObject().asignado = false;
					oCtx.getObject().nroFactura = null;
				}
			});
			this.getView().getModel("pendientesFactPaged").refresh(true);
			oList.removeSelections(true);
			this._rebuildAsignaciones();
		},

		onOpenPendienteMobileDialog: function (oEvent) {
			var that = this;
			var oCtx = oEvent.getSource().getBindingContext("pendientesFactPaged");
			if (!oCtx) { return; }
			var oData = JSON.parse(JSON.stringify(oCtx.getObject()));
			// Compute absolute index in _allPendientesData for later sync
			var iPage = this.getView().getModel("viewModel").getProperty("/pendMobilePage");
			var aPagedData = this.getView().getModel("pendientesFactPaged").getData();
			var iRelIdx = aPagedData.indexOf(oCtx.getObject());
			this._iPendienteMobileOrigIdx = (iPage - 1) * this._iMobilePageSize + iRelIdx;
			if (!this.getView().getModel("pendienteMobileEdit")) {
				this.getView().setModel(new sap.ui.model.json.JSONModel(oData), "pendienteMobileEdit");
			} else {
				this.getView().getModel("pendienteMobileEdit").setData(oData);
			}
			if (!this._oPendienteMobileDialog) {
				sap.ui.core.Fragment.load({
					id: this.getView().getId(),
					name: "claro.com.listadofacturas.fragment.PendienteMobileEditDialog",
					controller: this
				}).then(function (oDialog) {
					that._oPendienteMobileDialog = oDialog;
					that.getView().addDependent(oDialog);
					oDialog.open();
				});
			} else {
				this._oPendienteMobileDialog.open();
			}
		},

		onConfirmPendienteMobileDialog: function () {
			var oEditData = this.getView().getModel("pendienteMobileEdit").getData();
			var iIdx = this._iPendienteMobileOrigIdx;
			if (iIdx !== undefined && this._allPendientesData[iIdx]) {
				["valorVenta", "igv", "inafecto", "total", "cuentaContable", "descripcionCtaContable"].forEach(function (sField) {
					this._allPendientesData[iIdx][sField] = oEditData[sField];
				}.bind(this));
			}
			this._oPendienteMobileDialog.close();
			// Refresh page to reflect changes
			var iPage = this.getView().getModel("viewModel").getProperty("/pendMobilePage");
			this._applyPendMobilePage(iPage);
			MessageToast.show("Datos actualizados");
		},

		onCancelPendienteMobileDialog: function () {
			this._oPendienteMobileDialog.close();
		},

		onPendienteMobileImporteChange: function (oEvent) {
			var sLiveValue = oEvent.getParameter("value") || "";
			var oInput = oEvent.getSource();
			var oEditModel = this.getView().getModel("pendienteMobileEdit");
			var sPath = oInput.getBinding("value") ? oInput.getBinding("value").getPath() : "";
			var fValorVenta, fIGV;
			if (sPath === "/valorVenta") {
				fValorVenta = parseFloat(sLiveValue) || 0;
				fIGV = parseFloat(oEditModel.getProperty("/igv")) || 0;
			} else {
				fValorVenta = parseFloat(oEditModel.getProperty("/valorVenta")) || 0;
				fIGV = parseFloat(sLiveValue) || 0;
			}
			oEditModel.setProperty("/total", parseFloat((fValorVenta + fIGV).toFixed(2)));
		},

		onOpenProgramacionMobileDialog: function (oEvent) {
			var that = this;
			var oCtx = oEvent.getSource().getBindingContext("programacionPaged");
			if (!oCtx) { return; }
			var oData = JSON.parse(JSON.stringify(oCtx.getObject()));
			if (!this.getView().getModel("programacionMobileDetail")) {
				this.getView().setModel(new sap.ui.model.json.JSONModel(oData), "programacionMobileDetail");
			} else {
				this.getView().getModel("programacionMobileDetail").setData(oData);
			}
			if (!this._oProgramacionMobileDialog) {
				sap.ui.core.Fragment.load({
					id: this.getView().getId(),
					name: "claro.com.listadofacturas.fragment.ProgramacionMobileDialog",
					controller: this
				}).then(function (oDialog) {
					that._oProgramacionMobileDialog = oDialog;
					that.getView().addDependent(oDialog);
					oDialog.open();
				});
			} else {
				this._oProgramacionMobileDialog.open();
			}
		},

		onCloseProgramacionMobileDialog: function () {
			this._oProgramacionMobileDialog.close();
		},

		/* ══════════════════ Step 3: Posiciones selection / assign (OC) ══════════════════ */
		onPosicionesSelectionChange: function () {
			var oTable = this.byId("posicionesAsignacionTable");
			this.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", oTable && oTable.getSelectedItems().length > 0);
		},

		onSelectAllPosiciones: function () {
			var oTable = this.byId("posicionesAsignacionTable");
			if (!oTable) { return; }
			oTable.removeSelections(true);
			oTable.getItems().forEach(function (oItem) {
				var oCtx = oItem.getBindingContext("posiciones");
				if (oCtx && oCtx.getObject() && oCtx.getObject().estado === "PENDIENTE") {
					oTable.setSelectedItem(oItem, true);
				}
			});
			this.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", oTable.getSelectedItems().length > 0);
		},

		onAsignarPosiciones: function () {
			var oTable = this.byId("posicionesAsignacionTable");
			var aItems = oTable ? oTable.getSelectedItems() : [];
			if (aItems.length === 0) { MessageToast.show("Seleccione posiciones"); return; }
			aItems.forEach(function (oItem) {
				var oCtx = oItem.getBindingContext("posiciones");
				if (oCtx) {
					oCtx.getObject().asignado = true;
					oCtx.getObject().estado = "FACTURADO";
					oCtx.getObject().estadoDesc = "Facturado";
				}
			});
			this.getView().getModel("posiciones").refresh(true);
			oTable.removeSelections(true);
			this.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", false);
			this._rebuildAsignaciones();
			var that = this;
			setTimeout(function () { that._refreshPosicionesHighlight(); }, 100);
			MessageToast.show(aItems.length + " posición(es) asignada(s)");
		},

		onDesasignarPosiciones: function () {
			var oTable = this.byId("posicionesAsignacionTable");
			var aItems = oTable ? oTable.getSelectedItems() : [];
			if (aItems.length === 0) { return; }
			aItems.forEach(function (oItem) {
				var oCtx = oItem.getBindingContext("posiciones");
				if (oCtx) {
					oCtx.getObject().asignado = false;
					oCtx.getObject().estado = "PENDIENTE";
					oCtx.getObject().estadoDesc = "Pendiente";
				}
			});
			this.getView().getModel("posiciones").refresh(true);
			oTable.removeSelections(true);
			this.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", false);
			this._rebuildAsignaciones();
			var that = this;
			setTimeout(function () { that._refreshPosicionesHighlight(); }, 100);
		},

		/* Mobile OC variants */
		onPosicionesMobileSelectionChange: function () {
			var oList = this.byId("posicionesMobileList");
			this.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", oList && oList.getSelectedItems().length > 0);
		},
		onAsignarPosicionesMobile: function () {
			var oList = this.byId("posicionesMobileList");
			var aItems = oList ? oList.getSelectedItems() : [];
			aItems.forEach(function (oItem) {
				var o = oItem.getBindingContext("posicionesPaged").getObject();
				o.asignado = true; o.estado = "FACTURADO"; o.estadoDesc = "Facturado";
			});
			this.getView().getModel("posicionesPaged").refresh(true);
			oList.removeSelections(true);
			this._rebuildAsignaciones();
		},
		onDesasignarPosicionesMobile: function () {
			var oList = this.byId("posicionesMobileList");
			var aItems = oList ? oList.getSelectedItems() : [];
			aItems.forEach(function (oItem) {
				var o = oItem.getBindingContext("posicionesPaged").getObject();
				o.asignado = false; o.estado = "PENDIENTE"; o.estadoDesc = "Pendiente";
			});
			this.getView().getModel("posicionesPaged").refresh(true);
			oList.removeSelections(true);
			this._rebuildAsignaciones();
		},
		onOpenPosicionMobileDialog: function (oEvent) {
			var that = this;
			var oCtx = oEvent.getSource().getBindingContext("posicionesPaged");
			if (!oCtx) { return; }
			var oData = JSON.parse(JSON.stringify(oCtx.getObject()));
			if (!this.getView().getModel("posicionMobileDetail")) {
				this.getView().setModel(new sap.ui.model.json.JSONModel(oData), "posicionMobileDetail");
			} else {
				this.getView().getModel("posicionMobileDetail").setData(oData);
			}
			if (!this._oPosicionMobileDialog) {
				sap.ui.core.Fragment.load({
					id: this.getView().getId(),
					name: "claro.com.listadofacturas.fragment.PosicionMobileDialog",
					controller: this
				}).then(function (oDialog) {
					that._oPosicionMobileDialog = oDialog;
					that.getView().addDependent(oDialog);
					oDialog.open();
				});
			} else {
				this._oPosicionMobileDialog.open();
			}
		},

		onClosePosicionMobileDialog: function () {
			this._oPosicionMobileDialog.close();
		},

		/* Filter posiciones */
		onFilterPosicionesChange: function () {
			var oVM = this.getView().getModel("viewModel");
			var sFilter = oVM.getProperty("/filterEstadoPosicion");
			var oDetail = this._oService.getDetailData(this._sInvoiceId);
			if (!oDetail || !oDetail.posiciones) { return; }

			var aAll = JSON.parse(JSON.stringify(oDetail.posiciones));
			if (sFilter) {
				aAll = aAll.filter(function (p) { return p.estado === sFilter; });
			}
			this._allPosicionesData = aAll;
			this._applyPosicionesPagination(1);
		},

		/* ══════════════════ Rebuild asignaciones after assign/unassign ══════════════════ */
		_rebuildAsignaciones: function () {
			var oDetail = this._oService.getDetailData(this._sInvoiceId);
			if (!oDetail) { return; }

			// Merge current state into detail data
			var oDetalle = this.getView().getModel("detalle").getData();
			if (oDetalle.tipoDocumento === "CONTRATO") {
				this._syncPendDesktopBack();
				oDetail.pendientesFact = this._allPendientesData;
			} else {
				oDetail.posiciones = this._allPosicionesData;
			}
			this._oService.updateDetailData(this._sInvoiceId, oDetail);
			this._buildAsignaciones(oDetail);
			this._realizarValidacionImportes();
		},

		/* ══════════════════ Cuenta Contable Value Help ══════════════════ */
		onCuentaContableValueHelpRequest: function (oEvent) {
			var that = this;
			this._oCuentaContableInput = oEvent.getSource();
			var aCuentas = this._oService.getCuentasContables();
			this._oCuentaContableMasterData = aCuentas;
			this.getView().getModel("cuentasContables").setData(aCuentas);
			if (!this._oCuentaContableVHDialog) {
				sap.ui.core.Fragment.load({
					id: this.getView().getId(),
					name: "claro.com.listadofacturas.fragment.CuentaContableVH",
					controller: this
				}).then(function (oDialog) {
					that._oCuentaContableVHDialog = oDialog;
					that.getView().addDependent(oDialog);
					oDialog.open();
				});
			} else {
				this._oCuentaContableVHDialog.open();
			}
		},

		onCuentaContableVHSearch: function (oEvent) {
			var sValue = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
			var aMaster = this._oCuentaContableMasterData || [];
			if (!sValue) {
				this.getView().getModel("cuentasContables").setData(aMaster);
				return;
			}
			var sLower = sValue.toLowerCase();
			this.getView().getModel("cuentasContables").setData(
				aMaster.filter(function (o) {
					return o.codigo.toLowerCase().indexOf(sLower) !== -1 ||
						o.descripcion.toLowerCase().indexOf(sLower) !== -1;
				})
			);
		},

		onCuentaContableVHSelect: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var oCuenta = oItem.getBindingContext("cuentasContables").getObject();
			if (this._oCuentaContableInput) {
				this._oCuentaContableInput.setValue(oCuenta.codigo);
				// Desktop table: write to pendientesFact model
				var oRowCtx = this._oCuentaContableInput.getBindingContext("pendientesFact");
				if (oRowCtx) {
					oRowCtx.getModel().setProperty(oRowCtx.getPath() + "/cuentaContable", oCuenta.codigo);
					oRowCtx.getModel().setProperty(oRowCtx.getPath() + "/descripcionCtaContable", oCuenta.descripcion);
				} else {
					// Mobile dialog: write to pendienteMobileEdit model
					var oEditModel = this.getView().getModel("pendienteMobileEdit");
					if (oEditModel) {
						oEditModel.setProperty("/cuentaContable", oCuenta.codigo);
						oEditModel.setProperty("/descripcionCtaContable", oCuenta.descripcion);
					}
				}
			}
			this._oCuentaContableVHDialog.close();
		},

		onCuentaContableVHClose: function () {
			this._oCuentaContableVHDialog.close();
		},

		/* ══════════════════ File handlers (stubs for existing files) ══════════════════ */
		onTipoFacturaChange: function () { },
		onXMLFileChange: function () { MessageToast.show("Carga de XML simulada en modo demo"); },
		onXMLUploadComplete: function () { },
		onPDFFileChange: function () { MessageToast.show("Carga de PDF simulada en modo demo"); },
		onCDRFileChange: function () { MessageToast.show("Carga de CDR simulada en modo demo"); },
		onOtrosFilesChange: function () { MessageToast.show("Carga de anexos simulada en modo demo"); },
		onOtroArchivoPress: function () { },

		/* ══════════════════ Actions ══════════════════ */
		onRegistrar: function () {
			var that = this;
			var oComp = this.getView().getModel("comprobante").getData();
			var oVM = this.getView().getModel("viewModel");
			var aAsig = oVM.getProperty("/asignaciones") || [];
			MessageBox.confirm(
				"Se actualizará la factura " + oComp.serieDocumento + "-" + oComp.numeroDocumento +
				" con estado \"REGISTRADO\".\n\nAsignaciones: " + aAsig.length + "\n¿Desea continuar?",
				{
					title: "Confirmar Registro",
					onClose: function (oAction) {
						if (oAction === MessageBox.Action.OK) {
							that._oService.updateInvoice(that._sInvoiceId, { Status: "Registrado" });
							that.getView().getModel("viewModel").setProperty("/registrationComplete", true);
							MessageToast.show("Factura registrada correctamente");
						}
					}
				}
			);
		},

		onRegistrarYEnviar: function () {
			var that = this;
			var oComp = this.getView().getModel("comprobante").getData();
			var oVM = this.getView().getModel("viewModel");
			var aAsig = oVM.getProperty("/asignaciones") || [];
			MessageBox.confirm(
				"Se registrará y enviará la factura " + oComp.serieDocumento + "-" + oComp.numeroDocumento +
				" a la bandeja de contabilización.\n\nAsignaciones: " + aAsig.length + "\n¿Desea continuar?",
				{
					title: "Confirmar Registro y Envío",
					onClose: function (oAction) {
						if (oAction === MessageBox.Action.OK) {
							that._oService.updateInvoice(that._sInvoiceId, { Status: "Enviado" });
							that.getView().getModel("viewModel").setProperty("/registrationComplete", true);
							MessageToast.show("Factura registrada y enviada correctamente");
						}
					}
				}
			);
		},

		onWizardStepActivate: function (oEvent) {
			var sStepId = oEvent.getParameter("step") && oEvent.getParameter("step").getId();
			if (sStepId && sStepId.indexOf("wizardStep3") >= 0) {
				var that = this;
				setTimeout(function () { that._refreshPendientesHighlight(); }, 150);
			}
		},

		onWizardComplete: function () { },

		/* ══════════════════ Navigation ══════════════════ */
		onCancel: function () {
			var that = this;
			MessageBox.confirm("¿Está seguro de cancelar? Se perderán los cambios.", {
				title: "Confirmar cancelación",
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) { that.onNavBack(); }
				}
			});
		},

		onNavToList: function () {
			var oVM = this.getView().getModel("viewModel");
			var that = this;
			if (oVM.getProperty("/readOnly") || oVM.getProperty("/registrationComplete")) {
				this.getOwnerComponent().getRouter().navTo("InvoiceList");
				return;
			}
			MessageBox.confirm("¿Está seguro? Se perderán los datos ingresados.", {
				title: "Confirmar navegación",
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.OK) { that.getOwnerComponent().getRouter().navTo("InvoiceList"); }
				}
			});
		},

		onNavBack: function () {
			var oVM  = this.getView().getModel("viewModel");
			var that = this;
			if (!oVM.getProperty("/readOnly") && !oVM.getProperty("/registrationComplete")) {
				MessageBox.confirm("¿Está seguro? Se perderán los datos ingresados.", {
					title: "Confirmar navegación",
					onClose: function (oAction) {
						if (oAction === MessageBox.Action.OK) {
							var oHistory = History.getInstance();
							if (oHistory.getPreviousHash() !== undefined) {
								window.history.go(-1);
							} else {
								that.getOwnerComponent().getRouter().navTo("InvoiceList", {}, true);
							}
						}
					}
				});
				return;
			}
			var oHistory = History.getInstance();
			if (oHistory.getPreviousHash() !== undefined) {
				window.history.go(-1);
			} else {
				this.getOwnerComponent().getRouter().navTo("InvoiceList", {}, true);
			}
		}
	});
});
