sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "claro/com/listadofacturas/model/models",
    "claro/com/listadofacturas/service/MockDataService"
], function(UIComponent, JSONModel, models, MockDataService) {
    "use strict";

    return UIComponent.extend("claro.com.listadofacturas.Component", {
        metadata: {
            manifest: "json",
            config: {
                fullWidth: true
            },
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // Session model - logged-in supplier info
            this.setModel(new JSONModel({
                supplierRuc: "20100130204",
                supplierName: "INMOBILIARIA PERU SAC",
                supplierAddress: "Av. Alfredo Mendiola 1400, Independencia, Lima",
                supplierPhone: "01-711-5000",
                supplierEmail: "facturacion@inmobiliariaperu.com.pe",
                supplierBank: "BCP",
                supplierBankAccount: "193-2156789-0-12"
            }), "session");

            // Load mock data and set as default model
            var oService = MockDataService.getInstance();
            this._oMockDataService = oService;
            var that = this;
            oService.loadAllData().then(function () {
                var oInvoiceModel = new JSONModel({
                    Invoices: oService.getInvoices()
                });
                oInvoiceModel.setSizeLimit(500);
                oInvoiceModel.setDefaultBindingMode("TwoWay");
                that.setModel(oInvoiceModel);

                // enable routing after data is ready
                that.getRouter().initialize();
            });
        }
    });
});