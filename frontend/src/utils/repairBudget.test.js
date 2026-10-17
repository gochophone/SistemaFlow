import { budgetBreakdown, grossFromNet, netFromGross, parseBudgetInput } from './repairBudget';

test('el IVA de 19% convierte correctamente entre neto y total en CLP', () => {
  expect(grossFromNet(100000)).toBe(119000);
  expect(netFromGross(119000)).toBe(100000);
  expect(budgetBreakdown(119000, true)).toEqual({ net: 100000, vat: 19000, total: 119000 });
  expect(budgetBreakdown(20000, true)).toEqual({ net: 16807, vat: 3193, total: 20000 });
});

test('el presupuesto antiguo conserva su valor si no tiene IVA activado', () => {
  expect(budgetBreakdown(150000, false)).toEqual({ net: 150000, vat: 0, total: 150000 });
  expect(budgetBreakdown(null, true)).toBeNull();
  expect(parseBudgetInput('$238.000')).toBe(238000);
});
