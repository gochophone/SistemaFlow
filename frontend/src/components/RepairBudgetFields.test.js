import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RepairBudgetFields from './RepairBudgetFields';

test('convierte ambos campos al activar IVA y al editar el total', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const Budget = () => {
    const [value, setValue] = useState({ amount: 100000, vatIncluded: false });
    return <RepairBudgetFields idPrefix="test-repair" amountTestId="net-input"
      amount={value.amount} vatIncluded={value.vatIncluded} onChange={setValue} />;
  };

  try {
    await act(async () => root.render(<Budget />));
    expect(container.querySelector('[data-testid="net-input"]').value).toBe('100.000');
    expect(container.querySelector('label[for="test-repair-net"]').textContent).toBe('Valor (CLP)');

    await act(async () => container.querySelector('[data-testid="test-repair-vat-switch"]').click());
    expect(container.querySelector('[data-testid="net-input"]').value).toBe('100.000');
    expect(container.querySelector('[data-testid="test-repair-gross-input"]').value).toBe('119.000');
    expect(container.querySelector('[data-testid="test-repair-vat-amount"]').textContent).toContain('19.000');

    const gross = container.querySelector('[data-testid="test-repair-gross-input"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(gross, '238.000');
      gross.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="net-input"]').value).toBe('200.000');
    expect(container.querySelector('[data-testid="test-repair-vat-amount"]').textContent).toContain('38.000');

    await act(async () => container.querySelector('[data-testid="test-repair-vat-switch"]').click());
    expect(container.querySelector('[data-testid="net-input"]').value).toBe('200.000');
    expect(container.querySelector('[data-testid="test-repair-gross-input"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
