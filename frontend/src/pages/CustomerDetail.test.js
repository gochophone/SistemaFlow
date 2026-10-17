import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import CustomerDetail from './CustomerDetail';

const mockNavigate = jest.fn();
jest.mock('axios');
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'c1' }), useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const enterText = (input, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

test('la ficha muestra todas las órdenes del cliente y permite abrir cada equipo', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/api/customers/')
    ? { id: 'c1', name: 'Ana Rojas', rut: '12345678K', phone: '+56 9 1234 5678' }
    : [
      { id: 'r1', ticket_number: 'REP-00001', device_brand: 'Apple', device_model: 'iPhone 13', device_imei: '12345', status: 'delivered', received_date: '2026-10-01T12:00:00Z', reported_issue: 'Pantalla' },
      { id: 'r2', ticket_number: 'REP-00002', device_brand: 'Samsung', device_model: 'Galaxy A55', device_serial: 'ABC123', status: 'in_repair', received_date: '2026-10-02T12:00:00Z', reported_issue: 'Batería' },
    ] }));
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<CustomerDetail />));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/repairs'), {
      headers: { Authorization: 'Bearer test' }, params: { customer_id: 'c1' },
    });
    expect(container.querySelector('[data-testid="customer-repair-history"]').textContent).toContain('2 órdenes registradas');
    expect(container.querySelector('[data-testid="customer-repair-r1"]').textContent).toContain('iPhone 13');
    expect(container.querySelector('[data-testid="customer-repair-r2"]').textContent).toContain('Galaxy A55');
    await act(async () => container.querySelector('[data-testid="customer-repair-r2"]').click());
    expect(mockNavigate).toHaveBeenCalledWith('/repairs/r2');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('permite editar los datos desde la ficha y muestra los cambios guardados', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/api/customers/')
    ? { id: 'c1', name: 'Ana Rojas', rut: '12345678-5', phone: '+56 9 1234 5678', email: '', address: '' }
    : [] }));
  axios.put.mockResolvedValue({ data: {
    id: 'c1', name: 'Ana Pérez', rut: '12345678-5', phone: '+56 9 8765 4321',
    email: 'ana@ejemplo.cl', address: 'Santiago',
  } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<CustomerDetail />));
    await act(async () => container.querySelector('[data-testid="edit-customer-button"]').click());
    const name = document.querySelector('[data-testid="edit-customer-name"]');
    expect(name.value).toBe('Ana Rojas');
    await act(async () => {
      enterText(name, 'Ana Pérez');
      enterText(document.querySelector('[data-testid="edit-customer-phone"]'), '+56 9 8765 4321');
      enterText(document.querySelector('[data-testid="edit-customer-email"]'), 'ana@ejemplo.cl');
      enterText(document.querySelector('[data-testid="edit-customer-address"]'), 'Santiago');
    });
    await act(async () => enterText(document.querySelector('[data-testid="edit-customer-rut"]'), '12.345.678-0'));
    await act(async () => document.querySelector('[data-testid="save-customer-button"]').closest('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(axios.put).not.toHaveBeenCalled();
    await act(async () => enterText(document.querySelector('[data-testid="edit-customer-rut"]'), '12.345.678-5'));
    await act(async () => document.querySelector('[data-testid="save-customer-button"]').closest('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/customers/c1'), {
      name: 'Ana Pérez', rut: '12345678-5', phone: '+56 9 8765 4321',
      email: 'ana@ejemplo.cl', address: 'Santiago',
    }, { headers: { Authorization: 'Bearer test' } });
    expect(container.querySelector('h1').textContent).toContain('Ana Pérez');
    expect(container.querySelector('[aria-label="Datos del cliente"]').textContent).toContain('Santiago');
    expect(document.querySelector('[data-testid="edit-customer-name"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
