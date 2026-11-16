import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Billing from './Billing';

jest.mock('axios');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { is_owner: true, role: 'admin' }, token: 'test-token' }),
}));
jest.mock('@/utils/nativePdf', () => ({ isNativeApp: () => false }));

let container;
let root;

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('la cuenta exenta muestra acceso sin vencimiento y no pide transferencias', async () => {
  axios.get.mockResolvedValue({ data: {
    active: true, exempt: true, suspended: false, expires_at: '2020-01-01T00:00:00Z',
    is_manager: false, bank: null, pending: null, history: [],
  } });
  await act(async () => root.render(<Billing />));
  expect(container.textContent).toContain('Cuenta principal exenta de suscripción');
  expect(container.textContent).toContain('Acceso activo sin vencimiento');
  expect(container.textContent).not.toContain('Renovar por transferencia');
  expect(container.textContent).not.toContain('Vencimiento:');
});

test('las cuentas comunes conservan vencimiento y opción de pago', async () => {
  axios.get.mockResolvedValue({ data: {
    active: true, exempt: false, suspended: false, expires_at: '2030-01-01T00:00:00Z',
    is_manager: false, bank: null, pending: null, history: [],
  } });
  await act(async () => root.render(<Billing />));
  expect(container.textContent).toContain('$10.000 CLP / mes por negocio');
  expect(container.textContent).toContain('Vencimiento:');
  expect(container.textContent).toContain('Renovar por transferencia');
});
