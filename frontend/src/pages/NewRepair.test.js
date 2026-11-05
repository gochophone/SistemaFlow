import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import NewRepair from './NewRepair';

jest.mock('axios');
jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }), { virtual: true });
jest.mock('@radix-ui/primitive/is-development', () => ({ isDevelopment: false }), { virtual: true });
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }) }));
jest.mock('@/components/PatternLock', () => () => null);
jest.mock('@/components/DevicePhotos', () => () => null);
jest.mock('@/components/RepairIssueSelector', () => () => null);
jest.mock('@/components/RepairItemizedBudgetFields', () => () => <div data-testid="itemized-budget-marker">Falla reportada</div>);

const enterText = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('convierte el serial a mayúsculas y permite crear un cliente sin RUT', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: { id: 'customer-1', name: 'Cliente', phone: '123456789', rut: null } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<NewRepair />));
    expect(document.querySelector('#diagnosis').compareDocumentPosition(
      document.querySelector('[data-testid="itemized-budget-marker"]')
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const serial = document.querySelector('[data-testid="device-serial-input"]');
    await act(async () => enterText(serial, 'ab-c123'));
    expect(serial.value).toBe('AB-C123');

    await act(async () => document.querySelector('[data-testid="add-customer-link"]').click());
    expect(document.querySelector('label[for="repair-customer-rut"]').textContent).toContain('opcional');
    expect(document.querySelector('#repair-customer-rut').required).toBe(false);
    await act(async () => {
      enterText(document.querySelector('#repair-customer-name'), 'Cliente');
      enterText(document.querySelector('#repair-customer-phone'), '123456789');
    });
    await act(async () => document.querySelector('[data-testid="new-repair-customer-form"]')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/customers'), expect.objectContaining({
      name: 'Cliente', phone: '123456789', rut: null,
    }), expect.anything());
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
