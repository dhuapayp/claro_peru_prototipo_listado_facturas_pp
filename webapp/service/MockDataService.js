sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/model/json/JSONModel"
], function (BaseObject, JSONModel) {
	"use strict";

	var _oInstance = null;

	var MockDataService = BaseObject.extend("claro.com.listadofacturas.service.MockDataService", {

		constructor: function () {
			this._oInvoicesData = null;
			this._oPaymentDetailsData = null;
			this._oAttachmentsData = null;
			this._oDetailData = null;
		},

		loadAllData: function () {
			var that = this;
			var sBasePath = sap.ui.require.toUrl("claro/com/listadofacturas/localService/mockdata");

			return Promise.all([
				this._loadJsonFile(sBasePath + "/Invoices.json"),
				this._loadJsonFile(sBasePath + "/PaymentDetails.json"),
				this._loadJsonFile(sBasePath + "/Attachments.json"),
				this._loadJsonFile(sBasePath + "/InvoiceDetailData.json")
			]).then(function (aResults) {
				that._oInvoicesData = aResults[0];
				that._oPaymentDetailsData = aResults[1];
				that._oAttachmentsData = aResults[2];
				that._oDetailData = aResults[3];
				return true;
			});
		},

		_loadJsonFile: function (sPath) {
			return new Promise(function (resolve) {
				jQuery.ajax({
					url: sPath,
					dataType: "json",
					success: function (oData) {
						resolve(oData);
					},
					error: function () {
						resolve([]);
					}
				});
			});
		},

		getInvoices: function () {
			return this._oInvoicesData || [];
		},

		getInvoiceById: function (sInvoiceId) {
			var aInvoices = this.getInvoices();
			return aInvoices.find(function (o) { return o.InvoiceId === sInvoiceId; }) || null;
		},

		getInvoiceIndex: function (sInvoiceId) {
			var aInvoices = this.getInvoices();
			return aInvoices.findIndex(function (o) { return o.InvoiceId === sInvoiceId; });
		},

		getPaymentsByInvoice: function (sInvoiceId) {
			return (this._oPaymentDetailsData || []).filter(function (o) { return o.InvoiceId === sInvoiceId; });
		},

		getAttachmentsByInvoice: function (sInvoiceId) {
			return (this._oAttachmentsData || []).filter(function (o) { return o.InvoiceId === sInvoiceId; });
		},

		getDetailData: function (sInvoiceId) {
			if (!this._oDetailData) { return null; }
			return this._oDetailData[sInvoiceId] || null;
		},

		deleteInvoice: function (sInvoiceId) {
			var idx = this.getInvoiceIndex(sInvoiceId);
			if (idx >= 0) {
				this._oInvoicesData.splice(idx, 1);
				return true;
			}
			return false;
		},

		updateInvoice: function (sInvoiceId, oData) {
			var idx = this.getInvoiceIndex(sInvoiceId);
			if (idx >= 0) {
				Object.assign(this._oInvoicesData[idx], oData);
				return true;
			}
			return false;
		},

		updateDetailData: function (sInvoiceId, oNewDetail) {
			if (!this._oDetailData) { this._oDetailData = {}; }
			this._oDetailData[sInvoiceId] = oNewDetail;
		},

		getCuentasContables: function () {
			return [
				{ codigo: "6311010100", descripcion: "Alquileres de terrenos" },
				{ codigo: "6311010200", descripcion: "Gastos comunes inmuebles" },
				{ codigo: "6311010300", descripcion: "Servicios inmobiliarios" },
				{ codigo: "6311020100", descripcion: "Alquiler data center" },
				{ codigo: "6311020200", descripcion: "Suministro energía DC" },
				{ codigo: "6321010100", descripcion: "Mantenimiento edificios" },
				{ codigo: "6321010200", descripcion: "Mantenimiento correctivo" },
				{ codigo: "6321010300", descripcion: "Servicios de limpieza" },
				{ codigo: "6351010100", descripcion: "Servicio de vigilancia" },
				{ codigo: "6351010200", descripcion: "Monitoreo y CCTV" },
				{ codigo: "6411010100", descripcion: "Remuneraciones" },
				{ codigo: "6411010200", descripcion: "Gratificaciones" },
				{ codigo: "6510010100", descripcion: "Telecomunicaciones fijas" },
				{ codigo: "6510010200", descripcion: "Telecomunicaciones móviles" },
				{ codigo: "6591010100", descripcion: "Seguros de inmuebles" },
				{ codigo: "6591010200", descripcion: "Seguros vehiculares" }
			];
		},

		createInvoiceModel: function () {
			return new JSONModel({
				Invoices: this.getInvoices()
			});
		}
	});

	// Singleton
	MockDataService.getInstance = function () {
		if (!_oInstance) {
			_oInstance = new MockDataService();
		}
		return _oInstance;
	};

	return MockDataService;
});
