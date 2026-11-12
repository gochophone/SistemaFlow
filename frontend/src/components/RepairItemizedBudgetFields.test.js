import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RepairItemizedBudgetFields from './RepairItemizedBudgetFields';
import { prepareBudgetItems } from '@/utils/repairBudgetItems';

jest.mock('@/components/RepairIssueSelector', () => ({ value, onChange, label }) => (
  <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Seleccionar falla</option>
    <option value="Pantalla">Pantalla</option>
    <option value="Flex carga">Flex carga</option>
  </select>
));

const enterText = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('suma valores por falla, calcula IVA y permite quitar una falla', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let state;
  const Harness = () => {
    const [budget, setBudget] = useState({ items: [{ issue: 'Pantalla', amount: '' }], vatIncluded: false });
    state = budget;
    return <RepairItemizedBudgetFields idPrefix="test-repair"
      items={budget.items} vatIncluded={budget.vatIncluded} onChange={setBudget} />;
  };

  try {
    await act(async () => root.render(<Harness />));
    expect(container.querySelectorAll('select[aria-label="Falla reportada *"]')).toHaveLength(1);
    expect(container.querySelector('label[for="test-repair-amount-0"]').textContent).toBe('Precio final (CLP)');
    await act(async () => enterText(container.querySelector('[data-testid="test-repair-amount-0"]'), '100.000'));
    await act(async () => enterText(container.querySelector('[data-testid="test-repair-cost-0"]'), '40.000'));
    await act(async () => container.querySelector('[data-testid="test-repair-add-budget-item"]').click());
    await act(async () => {
      const select = container.querySelector('select[aria-label="Falla adicional"]');
      select.value = 'Flex carga';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => enterText(container.querySelector('[data-testid="test-repair-amount-1"]'), '25.000'));
    expect(container.querySelector('[data-testid="test-repair-budget-total"]').textContent).toContain('125.000');
    expect(prepareBudgetItems(state.items)).toEqual({ items: [
      { issue: 'Pantalla', amount: 100000, cost_price: 40000 }, { issue: 'Flex carga', amount: 25000 },
    ], amount: 125000 });

    await act(async () => container.querySelector('[data-testid="test-repair-vat-switch"]').click());
    expect(container.querySelector('[data-testid="test-repair-net-input"]').readOnly).toBe(true);
    expect(container.querySelector('[data-testid="test-repair-vat-amount"]').textContent).not.toBe('—');
    await act(async () => container.querySelector('[data-testid="test-repair-remove-budget-item-1"]').click());
    expect(container.querySelector('[data-testid="test-repair-budget-total"]').textContent).toContain('100.000');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('rechaza un costo inválido sin cambiar el precio final', () => {
  expect(prepareBudgetItems([{ issue: 'Pantalla', amount: 100000, cost_price: -1 }]).error)
    .toMatch(/precio de costo/);
  expect(prepareBudgetItems([{ issue: 'Pantalla', amount: '', cost_price: 40000 }]).error)
    .toMatch(/precio final/);
});
