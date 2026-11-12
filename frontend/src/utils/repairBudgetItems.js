export const MAX_REPAIR_BUDGET_ITEMS = 15;

export const budgetItemsTotal = (items = []) => items.reduce((total, item) => {
  if (item.amount === '' || item.amount === null || item.amount === undefined) return total;
  return total + Number(item.amount || 0);
}, 0);

export const prepareBudgetItems = (items = []) => {
  const hasValue = (value) => value !== '' && value !== null && value !== undefined;
  const filled = items.filter((item) => item.issue?.trim() || hasValue(item.amount) || hasValue(item.cost_price));
  if (filled.length > MAX_REPAIR_BUDGET_ITEMS) {
    return { error: `Agrega hasta ${MAX_REPAIR_BUDGET_ITEMS} fallas por orden.` };
  }
  if (filled.some((item) => !item.issue?.trim() || item.amount === '' || item.amount === null || item.amount === undefined)) {
    return { error: 'Selecciona la falla y escribe su precio final en cada fila del presupuesto.' };
  }
  const normalized = filled.map((item) => ({
    issue: item.issue.trim(),
    amount: Number(item.amount),
    ...(hasValue(item.cost_price) ? { cost_price: Number(item.cost_price) } : {}),
  }));
  if (normalized.some((item) => !Number.isSafeInteger(item.amount) || item.amount < 0 || item.amount > 1000000000)) {
    return { error: 'Cada precio final debe ser un monto válido en pesos chilenos.' };
  }
  if (normalized.some((item) => item.cost_price !== undefined &&
      (!Number.isSafeInteger(item.cost_price) || item.cost_price < 0 || item.cost_price > 1000000000))) {
    return { error: 'Cada precio de costo debe ser un monto válido en pesos chilenos.' };
  }
  const keys = normalized.map((item) => item.issue.normalize('NFD').replace(/[\u0300-\u036f\W_]+/g, '').toLowerCase());
  if (keys.length !== new Set(keys).size) {
    return { error: 'Cada falla puede aparecer una sola vez en el presupuesto.' };
  }
  return { items: normalized, amount: normalized.length ? budgetItemsTotal(normalized) : null };
};
