sap.ui.define([
	"sap/ui/export/Spreadsheet",
	"sap/ui/export/library"
], function (Spreadsheet, exportLibrary) {
	"use strict";

	var EdmType = exportLibrary.EdmType;

	return {
		/**
		 * Exporta el listado de facturas
		 * @param {Array} aInvoices - Array de facturas
		 * @param {object} oResourceBundle - Resource bundle para i18n
		 */
		exportInvoices: function (aInvoices, oResourceBundle) {
			var aCols = this._getInvoiceColumns(oResourceBundle);
			var oSettings = {
				workbook: {
					columns: aCols,
					hierarchyLevel: "Level"
				},
				dataSource: aInvoices,
				fileName: "Listado_Facturas.xlsx",
				worker: false
			};

			var oSheet = new Spreadsheet(oSettings);
			oSheet.build().finally(function () {
				oSheet.destroy();
			});
		},

		/**
		 * Exporta las posiciones de contratos
		 * @param {Array} aItems - Array de items
		 * @param {object} oResourceBundle - Resource bundle para i18n
		 */
		exportContractItems: function (aItems, oResourceBundle) {
			var aCols = this._getContractItemColumns(oResourceBundle);
			var oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: aItems,
				fileName: "Posiciones_Contratos.xlsx",
				worker: false
			};

			var oSheet = new Spreadsheet(oSettings);
			oSheet.build().finally(function () {
				oSheet.destroy();
			});
		},

		/**
		 * Exporta las posiciones de órdenes de compra
		 * @param {Array} aItems - Array de items
		 * @param {object} oResourceBundle - Resource bundle para i18n
		 */
		exportPOItems: function (aItems, oResourceBundle) {
			var aCols = this._getPOItemColumns(oResourceBundle);
			var oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: aItems,
				fileName: "Posiciones_OrdCompra.xlsx",
				worker: false
			};

			var oSheet = new Spreadsheet(oSettings);
			oSheet.build().finally(function () {
				oSheet.destroy();
			});
		},

		/**
		 * Exporta los detalles de pagos
		 * @param {Array} aPayments - Array de pagos
		 * @param {object} oResourceBundle - Resource bundle para i18n
		 */
		exportPayments: function (aPayments, oResourceBundle) {
			var aCols = this._getPaymentColumns(oResourceBundle);
			var oSettings = {
				workbook: {
					columns: aCols
				},
				dataSource: aPayments,
				fileName: "Detalle_Pagos.xlsx",
				worker: false
			};

			var oSheet = new Spreadsheet(oSettings);
			oSheet.build().finally(function () {
				oSheet.destroy();
			});
		},

		/**
		 * Define las columnas para exportar facturas
		 * @private
		 */
		_getInvoiceColumns: function (oResourceBundle) {
			return [
				{
					label: oResourceBundle.getText("invoiceNumber"),
					property: ["Series", "DocNumber"],
					template: "{0}-{1}"
				},
				{
					label: oResourceBundle.getText("issueDate"),
					property: "IssueDate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("registerDate"),
					property: "RegisterDate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("status"),
					property: "Status"
				},
				{
					label: oResourceBundle.getText("amount"),
					property: "AmountTotal",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("currency"),
					property: "Currency"
				},
				{
					label: oResourceBundle.getText("dueDate"),
					property: "DueDate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("approxPaymentDate"),
					property: "ApproxPaymentDate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("paymentStatus"),
					property: "PaymentStatus"
				},
				{
					label: oResourceBundle.getText("paymentDocNumber"),
					property: "PaymentDocNumber"
				},
				{
					label: oResourceBundle.getText("voucherNumber"),
					property: "VoucherNumber"
				},
				{
					label: oResourceBundle.getText("accountingDocType"),
					property: "AccountingDocType"
				},
				{
					label: oResourceBundle.getText("taxIndicator"),
					property: "TaxIndicator"
				},
				{
					label: oResourceBundle.getText("taxAmount"),
					property: "TaxAmount",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("referenceDoc"),
					property: "ReferenceDoc"
				}
			];
		},

		/**
		 * Define las columnas para exportar items de contrato
		 * @private
		 */
		_getContractItemColumns: function (oResourceBundle) {
			return [
				{
					label: oResourceBundle.getText("concept"),
					property: "Concept"
				},
				{
					label: oResourceBundle.getText("businessUnitCode"),
					property: "BusinessUnitCode"
				},
				{
					label: oResourceBundle.getText("businessUnitDesc"),
					property: "BusinessUnitDesc"
				},
				{
					label: oResourceBundle.getText("periodMonth"),
					property: "PeriodMonth",
					type: EdmType.Number
				},
				{
					label: oResourceBundle.getText("periodYear"),
					property: "PeriodYear",
					type: EdmType.Number
				},
				{
					label: oResourceBundle.getText("itemText"),
					property: "ItemText"
				},
				{
					label: oResourceBundle.getText("glAccount"),
					property: "GLAccount"
				},
				{
					label: oResourceBundle.getText("glAccountDesc"),
					property: "GLAccountDesc"
				},
				{
					label: oResourceBundle.getText("amount"),
					property: "Amount",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("costCenter"),
					property: "CostCenter"
				},
				{
					label: oResourceBundle.getText("fundsCenter"),
					property: "FundsCenter"
				}
			];
		},

		/**
		 * Define las columnas para exportar items de PO
		 * @private
		 */
		_getPOItemColumns: function (oResourceBundle) {
			return [
				{
					label: oResourceBundle.getText("poNumber"),
					property: "PONumber"
				},
				{
					label: oResourceBundle.getText("poDate"),
					property: "PODate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("poItem"),
					property: "POItem"
				},
				{
					label: oResourceBundle.getText("material"),
					property: "Material"
				},
				{
					label: oResourceBundle.getText("serviceDesc"),
					property: "ServiceDesc"
				},
				{
					label: oResourceBundle.getText("amount"),
					property: "Amount",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("currency"),
					property: "Currency"
				}
			];
		},

		/**
		 * Define las columnas para exportar pagos
		 * @private
		 */
		_getPaymentColumns: function (oResourceBundle) {
			return [
				{
					label: oResourceBundle.getText("invoiceNumber"),
					property: "InvoiceId"
				},
				{
					label: oResourceBundle.getText("paymentDoc"),
					property: "PaymentDoc"
				},
				{
					label: oResourceBundle.getText("paymentDate"),
					property: "PaymentDate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("voucher"),
					property: "Voucher"
				},
				{
					label: oResourceBundle.getText("invoiceAmount"),
					property: "InvoiceAmount",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("taxAmount"),
					property: "TaxAmount",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("netPaidAmount"),
					property: "NetPaidAmount",
					type: EdmType.Number,
					scale: 2
				},
				{
					label: oResourceBundle.getText("taxIndicator"),
					property: "TaxIndicator"
				},
				{
					label: oResourceBundle.getText("taxPaymentDate"),
					property: "TaxPaymentDate",
					type: EdmType.Date
				},
				{
					label: oResourceBundle.getText("referenceDoc"),
					property: "ReferenceDoc"
				},
				{
					label: oResourceBundle.getText("paymentMethod"),
					property: "PaymentMethod"
				},
				{
					label: oResourceBundle.getText("bankAccount"),
					property: "BankAccount"
				}
			];
		}
	};
});
