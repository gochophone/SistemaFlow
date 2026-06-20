/**
 * Formatea un número como Pesos Chilenos (CLP)
 * Formato: $1.234.567 (sin decimales) o $1.234.567,89 (con decimales)
 */
export const formatCLP = (amount, showDecimals = false) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0';
  }

  const number = parseFloat(amount);
  
  if (showDecimals) {
    // Con decimales: $1.234.567,89
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  } else {
    // Sin decimales (más común en Chile): $1.234.567
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  }
};

/**
 * Formatea input de usuario para CLP
 * Elimina caracteres no numéricos excepto coma decimal
 */
export const formatCLPInput = (value) => {
  // Remove all non-numeric characters except comma
  return value.replace(/[^\d,]/g, '');
};

/**
 * Parsea string de CLP input a número
 */
export const parseCLPInput = (value) => {
  if (!value) return 0;
  // Replace comma with dot for parsing
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};
