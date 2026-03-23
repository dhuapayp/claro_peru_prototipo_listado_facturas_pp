sap.ui.define([], function () {
	"use strict";

	return {
		/**
		 * Valida el RUC
		 * @param {string} sRuc - RUC a validar
		 * @returns {boolean} - true si es válido
		 */
		validateRuc: function (sRuc) {
			if (!sRuc || sRuc.length !== 11) {
				return false;
			}
			// Validación básica: debe ser numérico
			return /^\d{11}$/.test(sRuc);
		},

		/**
		 * Valida que el total sea correcto
		 * @param {number} fBase - Monto base
		 * @param {number} fIGV - Monto IGV
		 * @param {number} fTotal - Monto total
		 * @returns {boolean} - true si es válido
		 */
		validateTotal: function (fBase, fIGV, fTotal) {
			var fCalculatedTotal = fBase + fIGV;
			var fDifference = Math.abs(fCalculatedTotal - fTotal);
			// Tolerancia de 0.01 por redondeos
			return fDifference < 0.01;
		},

		/**
		 * Valida el formato del XML (simulado)
		 * @param {string} sXmlContent - Contenido XML
		 * @returns {object} - {valid: boolean, message: string}
		 */
		validateXML: function (sXmlContent) {
			if (!sXmlContent) {
				return {
					valid: false,
					message: "El contenido XML está vacío"
				};
			}

			// Validación básica: debe contener tags XML básicos
			if (!sXmlContent.includes("<?xml") || !sXmlContent.includes("<Invoice")) {
				return {
					valid: false,
					message: "El formato del XML no es válido"
				};
			}

			// Simulación: validar que contenga elementos requeridos
			var aRequiredElements = ["RUC", "Serie", "Numero", "FechaEmision", "MontoTotal"];
			for (var i = 0; i < aRequiredElements.length; i++) {
				if (!sXmlContent.includes("<" + aRequiredElements[i])) {
					return {
						valid: false,
						message: "Falta el elemento requerido: " + aRequiredElements[i]
					};
				}
			}

			return {
				valid: true,
				message: "XML válido"
			};
		},

		/**
		 * Valida que la serie tenga el formato correcto
		 * @param {string} sSeries - Serie a validar
		 * @returns {boolean} - true si es válido
		 */
		validateSeries: function (sSeries) {
			if (!sSeries) {
				return false;
			}
			// Formato: F### o B### (4 caracteres)
			return /^[FB]\d{3}$/.test(sSeries);
		},

		/**
		 * Valida que el número de documento tenga el formato correcto
		 * @param {string} sDocNumber - Número de documento
		 * @returns {boolean} - true si es válido
		 */
		validateDocNumber: function (sDocNumber) {
			if (!sDocNumber) {
				return false;
			}
			// Formato: 8 dígitos
			return /^\d{8}$/.test(sDocNumber);
		},

		/**
		 * Calcula el IGV
		 * @param {number} fBase - Monto base
		 * @param {number} fIgvRate - Tasa de IGV (default 0.18)
		 * @returns {number} - Monto de IGV
		 */
		calculateIGV: function (fBase, fIgvRate) {
			var fRate = fIgvRate || 0.18;
			return fBase * fRate;
		},

		/**
		 * Calcula el monto neto después de retenciones/detracciones
		 * @param {number} fTotal - Monto total
		 * @param {number} fRetention - Monto retención
		 * @param {number} fDetraction - Monto detracción
		 * @returns {number} - Monto neto
		 */
		calculateNetAmount: function (fTotal, fRetention, fDetraction) {
			return fTotal - fRetention - fDetraction;
		}
	};
});
