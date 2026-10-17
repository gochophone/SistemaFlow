import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RepairBudgetFields from './RepairBudgetFields';

test('al activar IVA conserva Valor como total y calcula el neto', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const Budget = () => {
    const [value, setValue] = useState({ amount: 20000, vatIncluded: false });
    return <RepairBudgetFields idPrefix="test-repair" amountTestId="value-input"
      amount={value.amount} vatIncluded={value.vatIncluded} onChange={setValue} />;
  };

  try {
    await act(async () => root.render(<Budget />));
    expect(container.querySelector('[data-testid="value-input"]').value).toBe('20.000');
    expect(container.querySelector('label[for="test-repair-value"]').textContent).toBe('Valor (CLP)');

    await act(async () => container.querySelector('[data-testid="test-repair-vat-switch"]').click());
    expect(container.querySelector('[data-testid="value-input"]').value).toBe('20.000');
    expect(container.querySelector('label[for="test-repair-net"]').textContent).toBe('Valor neto (CLP)');
    expect(container.querySelector('[data-testid="test-repair-net-input"]').value).toBe('16.807');
    expect(container.querySelector('[data-testid="test-repair-vat-amount"]').textContent).toContain('3.193');

    const value = container.querySelector('[data-testid="value-input"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(value, '119.000');
      value.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="test-repair-net-input"]').value).toBe('100.000');
    expect(container.querySelector('[data-testid="test-repair-vat-amount"]').textContent).toContain('19.000');

    const net = container.querySelector('[data-testid="test-repair-net-input"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(net, '200.000');
      net.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="value-input"]').value).toBe('238.000');
    expect(container.querySelector('[data-testid="test-repair-vat-amount"]').textContent).toContain('38.000');

    await act(async () => container.querySelector('[data-testid="test-repair-vat-switch"]').click());
    expect(container.querySelector('[data-testid="value-input"]').value).toBe('238.000');
    expect(container.querySelector('[data-testid="test-repair-net-input"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
