import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Customers from './Customers';

const mockNavigate = jest.fn();
jest.mock('axios');
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' }, getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));

let container;
let root;

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: [
    { id: 'c1', name: 'José Pérez', rut: '12345678K', phone: '+56 9 1111 1111', email: 'jose@example.com' },
    { id: 'c2', name: 'Ana Rojas', rut: '87654321K', phone: '+56 9 2222 2222', email: 'ana@example.com' },
  ] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('searches customers and opens the selected customer repair history from the history icon', async () => {
  await act(async () => root.render(<Customers />));
  const search = document.querySelector('[data-testid="customer-search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'ana');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(document.querySelector('[data-testid="customer-row-Ana Rojas"]')).not.toBeNull();
  expect(document.querySelector('[data-testid="customer-row-José Pérez"]')).toBeNull();
  const actions = document.querySelector('[data-testid="customer-row-Ana Rojas"]');
  expect(actions.querySelector('[aria-label="Ver compras de Ana Rojas"]')).not.toBeNull();
  expect(actions.querySelector('[aria-label="Ver historial de reparaciones de Ana Rojas"] .lucide-history')).not.toBeNull();
  await act(async () => actions.querySelector('[data-testid="customer-repairs-c2"]').click());
  expect(mockNavigate).toHaveBeenCalledWith('/customers/c2');

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, '12345678k');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(document.querySelector('[data-testid="customer-row-José Pérez"]')).not.toBeNull();
  expect(document.querySelector('[data-testid="customer-row-Ana Rojas"]')).toBeNull();
});

test('crea un cliente sin exigir RUT', async () => {
  axios.post.mockResolvedValue({ data: { id: 'c3', name: 'Cliente sin RUT', phone: '123456789', rut: null } });
  await act(async () => root.render(<Customers />));
  await act(async () => document.querySelector('[data-testid="add-customer-button"]').click());
  const name = document.querySelector('[data-testid="customer-name-input"]');
  const phone = document.querySelector('[data-testid="customer-phone-input"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Cliente sin RUT');
    name.dispatchEvent(new Event('input', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(phone, '123456789');
    phone.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(document.querySelector('label[for="rut"]').textContent).toContain('opcional');
  await act(async () => name.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/customers'), expect.objectContaining({
    name: 'Cliente sin RUT', phone: '123456789', rut: null,
  }), expect.anything());
});
