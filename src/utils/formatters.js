/**
 * 🗓️ UTILIDADES DE FORMATO DE FECHAS
 * Soluciona el bug de "día anterior" causado por timezone del navegador
 */

/**
 * Parsea una fecha de la BD (YYYY-MM-DD o ISO) sin aplicar timezone
 * @param {string} dateString - Fecha en formato YYYY-MM-DD o ISO
 * @returns {Date} Fecha parseada correctamente
 */
export const parseDateFromDB = (dateString) => {
  if (!dateString) return new Date();
  
  // Extraer solo la parte de fecha (ignorar hora y timezone)
  const dateOnly = dateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  
  // Crear fecha en timezone local sin conversión UTC
  return new Date(year, month - 1, day);
};

/**
 * Formatea una fecha de la BD para mostrar en la UI (formato largo)
 * @param {string} dateString - Fecha en formato YYYY-MM-DD o ISO
 * @returns {string} Fecha formateada (ej: "8 de febrero de 2026")
 */
export const formatDateToDisplay = (dateString) => {
  const date = parseDateFromDB(dateString);
  return date.toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Formatea una fecha de la BD para mostrar en formato corto
 * @param {string} dateString - Fecha en formato YYYY-MM-DD o ISO
 * @returns {string} Fecha formateada (ej: "08/02/2026")
 */
export const formatDateToShort = (dateString) => {
  const date = parseDateFromDB(dateString);
  return date.toLocaleDateString('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Convierte una fecha Date a formato YYYY-MM-DD para la BD
 * @param {Date} date - Objeto Date
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const formatDateForDB = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formatea un monto con separadores de miles y decimales
 * @param {number|string} amount - Monto a formatear
 * @param {string} currency - Moneda ('USD' o 'VES')
 * @returns {string} Monto formateado con símbolo
 */
export const formatCurrency = (amount, currency = 'USD') => {
  const symbol = currency === 'USD' ? '$' : 'Bs. ';
  const value = parseFloat(amount);
  
  return symbol + value.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};