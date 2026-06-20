/**
 * Formatea un RUT chileno con puntos y guión
 * Ejemplo: 12345678-9 → 12.345.678-9
 */
export const formatRUT = (rut) => {
  if (!rut) return '';
  
  // Eliminar todo excepto números y k/K
  const cleaned = rut.replace(/[^\dkK]/g, '').toUpperCase();
  
  if (cleaned.length < 2) return cleaned;
  
  // Separar cuerpo y dígito verificador
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  
  // Formatear cuerpo con puntos
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formattedBody}-${dv}`;
};

/**
 * Limpia el formato del RUT para enviar al backend
 * Ejemplo: 12.345.678-9 → 12345678-9
 */
export const cleanRUT = (rut) => {
  if (!rut) return '';
  return rut.replace(/\./g, '');
};

/**
 * Valida formato básico de RUT chileno
 */
export const isValidRUTFormat = (rut) => {
  if (!rut) return true; // Opcional
  const cleaned = rut.replace(/[^\dkK-]/g, '');
  // Formato: 1-9 dígitos, guión, 1 dígito o K
  return /^\d{1,9}-[\dkK]$/i.test(cleaned);
};

/**
 * Valida dígito verificador del RUT (algoritmo módulo 11)
 */
export const validateRUT = (rut) => {
  if (!rut) return true; // Opcional
  
  const cleaned = rut.replace(/[^\dkK]/g, '').toUpperCase();
  if (cleaned.length < 2) return false;
  
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  
  let sum = 0;
  let multiplier = 2;
  
  // Calcular suma desde el final
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDV = 11 - (sum % 11);
  let calculatedDV;
  
  if (expectedDV === 11) {
    calculatedDV = '0';
  } else if (expectedDV === 10) {
    calculatedDV = 'K';
  } else {
    calculatedDV = expectedDV.toString();
  }
  
  return dv === calculatedDV;
};
