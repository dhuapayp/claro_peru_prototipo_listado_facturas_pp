sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "../util/formatter",
    "../service/DemoTourService"
], function (Controller, JSONModel, MessageBox, MessageToast, formatter, DemoTourService) {
    "use strict";

    return Controller.extend("claro.com.listadofacturas.controller.InvoiceList", {
        formatter: formatter,

        onInit: function () {
            this._oRouter = this.getOwnerComponent().getRouter();
            this._oRouter.getRoute("InvoiceList").attachPatternMatched(this._onRouteMatched, this);

            this.getView().setModel(new JSONModel({
                kpiTotalInvoices: 0,
                kpiPendingCount: 0,
                kpiPaidAmount: "0.00",
                kpiPendingAmount: "0.00",
                invoicePage: 1,
                invoiceTotalPages: 1,
                invoiceTotal: 0
            }), "viewModel");

            this.getView().setModel(new JSONModel({ items: [] }), "invoiceListPaged");
            this._aAllInvoices = [];
            this._aFilteredInvoices = [];
        },

        _onRouteMatched: function () {
            var oModel = this.getView().getModel();
            this._aAllInvoices = (oModel.getProperty("/Invoices") || []).slice();
            this._aFilteredInvoices = this._aAllInvoices.slice();
            this.getView().getModel("viewModel").setProperty("/invoicePage", 1);
            this._applyInvoicePage();
            this._updateKPIs();
        },

        _applyInvoicePage: function () {
            var iPageSize = 5;
            var oVM = this.getView().getModel("viewModel");
            var iPage = oVM.getProperty("/invoicePage");
            var aAll = this._aFilteredInvoices;
            var iTotal = Math.max(1, Math.ceil(aAll.length / iPageSize));
            if (iPage > iTotal) { iPage = iTotal; oVM.setProperty("/invoicePage", iPage); }
            this.getView().getModel("invoiceListPaged").setProperty("/items", aAll.slice((iPage - 1) * iPageSize, iPage * iPageSize));
            oVM.setProperty("/invoiceTotalPages", iTotal);
            oVM.setProperty("/invoiceTotal", aAll.length);
        },

        onInvoiceFirstPage: function () {
            this.getView().getModel("viewModel").setProperty("/invoicePage", 1);
            this._applyInvoicePage();
        },

        onInvoicePrevPage: function () {
            var oVM = this.getView().getModel("viewModel");
            var iPage = oVM.getProperty("/invoicePage");
            if (iPage > 1) { oVM.setProperty("/invoicePage", iPage - 1); this._applyInvoicePage(); }
        },

        onInvoiceNextPage: function () {
            var oVM = this.getView().getModel("viewModel");
            var iPage = oVM.getProperty("/invoicePage");
            if (iPage < oVM.getProperty("/invoiceTotalPages")) { oVM.setProperty("/invoicePage", iPage + 1); this._applyInvoicePage(); }
        },

        onInvoiceLastPage: function () {
            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/invoicePage", oVM.getProperty("/invoiceTotalPages"));
            this._applyInvoicePage();
        },

        _updateKPIs: function () {
            var oModel = this.getView().getModel();
            var aInvoices = oModel.getProperty("/Invoices") || [];
            var oViewModel = this.getView().getModel("viewModel");

            var iTotalInvoices = aInvoices.length;
            var iPendingCount = 0;
            var fPaidAmount = 0;
            var fPendingAmount = 0;

            aInvoices.forEach(function (oInv) {
                if (oInv.PaymentStatus === "Pendiente") {
                    iPendingCount++;
                    fPendingAmount += parseFloat(oInv.AmountTotal) || 0;
                } else if (oInv.PaymentStatus === "Abonado") {
                    fPaidAmount += parseFloat(oInv.AmountTotal) || 0;
                }
            });

            oViewModel.setProperty("/kpiTotalInvoices", iTotalInvoices);
            oViewModel.setProperty("/kpiPendingCount", iPendingCount);
            oViewModel.setProperty("/kpiPaidAmount", fPaidAmount.toFixed(2));
            oViewModel.setProperty("/kpiPendingAmount", fPendingAmount.toFixed(2));
        },

        onSearch: function () {
            var sDocNumber = this.byId("filterDocNumber").getValue().toLowerCase();
            var oDateFrom = this.byId("filterDateFrom").getDateValue();
            var oDateTo = this.byId("filterDateTo").getDateValue();
            var sStatus = this.byId("filterStatus").getSelectedKey();
            var sPaymentStatus = this.byId("filterPaymentStatus").getSelectedKey();
            var sCurrency = this.byId("filterCurrency").getSelectedKey();
            var sFrom = oDateFrom ? oDateFrom.toISOString().slice(0, 10) : null;
            var sTo = oDateTo ? oDateTo.toISOString().slice(0, 10) : null;

            this._aFilteredInvoices = this._aAllInvoices.filter(function (o) {
                if (sDocNumber && (o.DocNumber || "").toLowerCase().indexOf(sDocNumber) === -1) { return false; }
                if (sFrom && o.IssueDate < sFrom) { return false; }
                if (sTo && o.IssueDate > sTo) { return false; }
                if (sStatus && o.Status !== sStatus) { return false; }
                if (sPaymentStatus && o.PaymentStatus !== sPaymentStatus) { return false; }
                if (sCurrency && o.Currency !== sCurrency) { return false; }
                return true;
            });
            this.getView().getModel("viewModel").setProperty("/invoicePage", 1);
            this._applyInvoicePage();
        },

        onClearFilters: function () {
            this.byId("filterDocNumber").setValue("");
            this.byId("filterDateFrom").setDateValue(null);
            this.byId("filterDateTo").setDateValue(null);
            this.byId("filterStatus").setSelectedKey("");
            this.byId("filterPaymentStatus").setSelectedKey("");
            this.byId("filterCurrency").setSelectedKey("");
            this._aFilteredInvoices = this._aAllInvoices.slice();
            this.getView().getModel("viewModel").setProperty("/invoicePage", 1);
            this._applyInvoicePage();
        },

        onItemPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("invoiceListPaged");
            var sInvoiceId = oContext.getProperty("InvoiceId");
            window.DemoTourCurrentInvoiceId = sInvoiceId;
            if (window.DemoTour) { window.DemoTour.onUserAction("abrirDetalle"); }
            this._oRouter.navTo("InvoiceDetail", { invoiceId: sInvoiceId, "?query": { mode: "view" } });
        },

        onViewDetail: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("invoiceListPaged");
            var sInvoiceId = oContext.getProperty("InvoiceId");
            window.DemoTourCurrentInvoiceId = sInvoiceId;
            if (window.DemoTour) { window.DemoTour.onUserAction("abrirDetalle"); }
            this._oRouter.navTo("InvoiceDetail", { invoiceId: sInvoiceId, "?query": { mode: "view" } });
        },

        onEditInvoice: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("invoiceListPaged");
            var sInvoiceId = oContext.getProperty("InvoiceId");
            this._oRouter.navTo("InvoiceDetail", { invoiceId: sInvoiceId, "?query": { mode: "edit" } });
        },

        onDeleteInvoice: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("invoiceListPaged");
            var sInvoiceId = oContext.getProperty("InvoiceId");
            var sDocNumber = oContext.getProperty("DocNumber");
            var that = this;

            MessageBox.confirm(
                "¿Está seguro que desea eliminar la factura " + sDocNumber + "?",
                {
                    title: "Confirmar eliminación",
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            var oService = that.getOwnerComponent()._oMockDataService;
                            oService.deleteInvoice(sInvoiceId);
                            var oModel = that.getView().getModel();
                            oModel.setProperty("/Invoices", oService.getInvoices());
                            that._aAllInvoices = oService.getInvoices().slice();
                            that._aFilteredInvoices = that._aAllInvoices.slice();
                            that.getView().getModel("viewModel").setProperty("/invoicePage", 1);
                            that._applyInvoicePage();
                            that._updateKPIs();
                            MessageToast.show("Factura eliminada correctamente");
                        }
                    }
                }
            );
        },

        onExport: function () {
            sap.ui.require(["sap/ui/export/Spreadsheet"], function (Spreadsheet) {
                var oTable = this.byId("invoiceTable");
                var oBinding = oTable.getBinding("items");

                var aCols = [
                    { label: "Nro. Factura", property: "DocNumber" },
                    { label: "Serie", property: "Series" },
                    { label: "Fecha Emisión", property: "IssueDate" },
                    { label: "Fecha Registro", property: "RegisterDate" },
                    { label: "Estado", property: "Status" },
                    { label: "Monto Total", property: "AmountTotal", type: "Number" },
                    { label: "Moneda", property: "Currency" },
                    { label: "Fecha Vencimiento", property: "DueDate" },
                    { label: "Estado de Pago", property: "PaymentStatus" },
                    { label: "Indicador Impuesto", property: "TaxIndicator" }
                ];

                var oSettings = {
                    workbook: { columns: aCols },
                    dataSource: oBinding,
                    fileName: "Facturas_Export.xlsx"
                };

                var oSpreadsheet = new Spreadsheet(oSettings);
                oSpreadsheet.build().finally(function () {
                    oSpreadsheet.destroy();
                });
            }.bind(this));
        },

        onStartDemoTour: function () {
            DemoTourService.start(this._oRouter);
        }
    });
});
