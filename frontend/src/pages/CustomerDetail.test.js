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
