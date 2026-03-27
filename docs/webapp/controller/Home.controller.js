sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function(Controller) {
    "use strict";

    return Controller.extend("claro.com.listadofacturas.controller.Home", {
        onInit: function() {
            // Auto-navigate to invoice list
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("InvoiceList");
        },

        onGoToInvoices: function() {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("InvoiceList");
        }
    });
});