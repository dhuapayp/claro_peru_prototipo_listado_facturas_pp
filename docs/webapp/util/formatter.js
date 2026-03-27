sap.ui.define([
	"sap/ui/core/format/DateFormat",
	"sap/ui/core/format/NumberFormat"
], function (DateFormat, NumberFormat) {
	"use strict";

	var oDateFormat = DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
	var oCurrencyFormat = NumberFormat.getCurrencyInstance({ currencyCode: false, decimals: 2 });

	var fnFormatDate = function (vDate) {
		if (!vDate) { return ""; }
		var oDate = (typeof vDate === "string") ? new Date(vDate) : vDate;
		return isNaN(oDate.getTime()) ? vDate : oDateFormat.format(oDate);
	};

	return {
		/**
		 * Formatea el estado de la factura con texto y estado de objeto
		 * @param {string} sStatus - Estado de la factura
		 * @returns {string} - Texto formateado del estado
		 */
		statusText: function (sStatus) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sStatus) {
				case "Registrado":
					return oResourceBundle.getText("statusRegistered");
				case "Enviado":
					return oResourceBundle.getText("statusSent");
				case "Contabilizado":
					return oResourceBundle.getText("statusPosted");
				case "Rechazado":
					return oResourceBundle.getText("statusRejected");
				default:
					return sStatus;
			}
		},

		/**
		 * Formatea el estado de la factura con el estado de objeto apropiado
		 * @param {string} sStatus - Estado de la factura
		 * @returns {string} - Estado de objeto (Success, Warning, Error, None)
		 */
		statusState: function (sStatus) {
			switch (sStatus) {
				case "Contabilizado":
					return "Success";
				case "Enviado":
					return "Warning";
				case "Rechazado":
					return "Error";
				case "Registrado":
					return "Information";
				default:
					return "None";
			}
		},

		statusIcon: function (sStatus) {
			switch (sStatus) {
				case "Contabilizado":
					return "sap-icon://accept";
				case "Enviado":
					return "sap-icon://paper-plane";
				case "Rechazado":
					return "sap-icon://decline";
				case "Registrado":
					return "sap-icon://document";
				default:
					return "";
			}
		},

		/**
		 * Formatea el estado de pago
		 * @param {string} sPaymentStatus - Estado de pago
		 * @returns {string} - Texto formateado
		 */
		paymentStatusText: function (sPaymentStatus) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			return sPaymentStatus === "Abonado" ? 
				oResourceBundle.getText("paymentPaid") : 
				oResourceBundle.getText("paymentPending");
		},

		/**
		 * Formatea el estado de pago con el estado de objeto apropiado
		 * @param {string} sPaymentStatus - Estado de pago
		 * @returns {string} - Estado de objeto
		 */
		paymentStatusState: function (sPaymentStatus) {
			return sPaymentStatus === "Abonado" ? "Success" : "Warning";
		},

		paymentStatusIcon: function (sPaymentStatus) {
			return sPaymentStatus === "Abonado" ? "sap-icon://accept" : "sap-icon://pending";
		},

		statusHighlight: function (sStatus) {
			switch (sStatus) {
				case "Contabilizado": return "Success";
				case "Enviado":       return "Warning";
				case "Rechazado":     return "Error";
				case "Registrado":    return "Information";
				default:              return "None";
			}
		},

		/**
		 * Formatea el indicador de impuesto
		 * @param {string} sTaxIndicator - Indicador de impuesto
		 * @returns {string} - Texto formateado
		 */
		taxIndicatorText: function (sTaxIndicator) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sTaxIndicator) {
				case "RET":
					return oResourceBundle.getText("taxRetention");
				case "DET":
					return oResourceBundle.getText("taxDetraction");
				case "NONE":
					return oResourceBundle.getText("taxNone");
				default:
					return sTaxIndicator;
			}
		},

		/**
		 * Formatea la fecha en formato local
		 * @param {string} sDate - Fecha en formato ISO
		 * @returns {string} - Fecha formateada
		 */
		dateFormat: function (sDate) {
			if (!sDate) {
				return "";
			}
			var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
				pattern: "dd/MM/yyyy"
			});
			return oDateFormat.format(new Date(sDate));
		},

		/**
		 * Formatea el monto con la moneda
		 * @param {number} fAmount - Monto
		 * @param {string} sCurrency - Moneda
		 * @returns {string} - Monto formateado con moneda
		 */
		currencyFormat: function (fAmount, sCurrency) {
			if (fAmount === null || fAmount === undefined) {
				return "";
			}
			var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
				currencyCode: false
			});
			return sCurrency + " " + oCurrencyFormat.format(fAmount);
		},

		/**
		 * Formatea el número con 2 decimales
		 * @param {number} fNumber - Número
		 * @returns {string} - Número formateado
		 */
		numberFormat: function (fNumber) {
			if (fNumber === null || fNumber === undefined) {
				return "";
			}
			var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
				maxFractionDigits: 2,
				minFractionDigits: 2,
				groupingEnabled: true
			});
			return oNumberFormat.format(fNumber);
		},

		/**
		 * Formatea el porcentaje
		 * @param {number} fPercent - Porcentaje
		 * @returns {string} - Porcentaje formateado
		 */
		percentFormat: function (fPercent) {
			if (!fPercent) {
				return "0%";
			}
			return fPercent.toFixed(2) + "%";
		},

		/**
		 * Determina si un comprobante puede ser editado
		 * @param {string} sStatus - Estado del comprobante
		 * @returns {boolean} - true si puede ser editado
		 */
		canEdit: function (sStatus) {
			return sStatus === "Registrado" || sStatus === "Rechazado";
		},

		canDelete: function (sStatus) {
			return sStatus === "Registrado";
		},

		/**
		 * Determina el texto del documento completo
		 * @param {string} sSeries - Serie
		 * @param {string} sDocNumber - Número de documento
		 * @returns {string} - Documento completo
		 */
		fullDocNumber: function (sSeries, sDocNumber) {
			if (!sSeries || !sDocNumber) {
				return "";
			}
			return sSeries + "-" + sDocNumber;
		},

		/**
		 * Determina si tiene pagos
		 * @param {string} sPaymentStatus - Estado de pago
		 * @returns {boolean} - true si tiene pagos
		 */
		hasPaid: function (sPaymentStatus) {
			return sPaymentStatus === "Abonado";
		},

		// ─── Formatters used by InvoiceDetail wizard view ───
		formatDate: function (vDate) {
			return fnFormatDate(vDate);
		},

		formatCurrency: function (fValue) {
			if (fValue === null || fValue === undefined) { return "0.00"; }
			return oCurrencyFormat.format(fValue);
		},

		formatCurrencyNullable: function (fValue) {
			if (fValue === null || fValue === undefined || fValue === "") { return "—"; }
			return oCurrencyFormat.format(fValue);
		},

		formatProgramacionHighlightFull: function (fImporteProgramado, fImportePagado) {
			if (fImportePagado === null || fImportePagado === undefined || fImportePagado === "") {
				return "Error";
			}
			var fProg = parseFloat(fImporteProgramado) || 0;
			var fPago = parseFloat(fImportePagado) || 0;
			if (fPago >= fProg) { return "Success"; }
			if (fPago > 0) { return "Warning"; }
			return "Error";
		}
	};
});
