import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Reports from './Reports';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test-token' }) }),
}));
jest.mock('axios');
jest.mock('recharts', () => {
  const React = require('react');
  const Box = ({ children }) => <div>{children}</div>;
  return { BarChart: Box, Bar: Box, CartesianGrid: Box, ResponsiveContainer: Box,
    Tooltip: Box, XAxis: Box, YAxis: Box };
});

let container;
let root;
const report = {
  start: '2026-11-01', end: '2026-11-30',
  summary: { finished: 2, repaired: 1, not_repaired: 1, delivered: 1,
    final_value: 20000, recorded_cost: 5000, paid_count: 1, collected: 10000 },
  daily: [{ date: '2026-11-02', count: 2 }],
  by_technician: [{ id: 'tech-1', name: 'Ana Técnica', finished: 2, final_value: 20000 }],
  by_issue: [{ name: 'Pantalla', count: 1 }],
  rows: [{ id: 'repair-1', ticket_number: 'REP-00001', customer_name: 'Cliente Uno',
    device: 'Apple iPhone 13', work: 'Pantalla', technician: 'Ana Técnica', status: 'Reparado',
    finished_date: '2026-11-02', value: 20000, cost: 5000 }],
};

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  jest.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/api/team')
    ? [{ id: 'tech-1', name: 'Ana Técnica', role: 'technician', active: true }]
    : report }));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('genera un reporte mensual por técnico con resumen y acceso al detalle', async () => {
  await act(async () => root.render(<Reports />));
  expect(container.querySelector('[data-testid="report-start"]').value).toMatch(/^\d{4}-\d{2}-01$/);
  const technician = container.querySelector('[data-testid="report-technician"]');
  await act(async () => {
    technician.value = 'tech-1';
    technician.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => container.querySelector('[data-testid="generate-report"]').click());
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/reports/repairs'), {
    headers: { Authorization: 'Bearer test-token' },
    params: expect.objectContaining({ technician_id: 'tech-1' }),
  });
  expect(container.querySelector('[data-testid="generated-report"]')).not.toBeNull();
  expect(container.textContent).toContain('Trabajos terminados');
  expect(container.textContent).toContain('Cliente Uno');
  await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'REP-00001').click());
  expect(mockNavigate).toHaveBeenCalledWith('/repairs/repair-1');
});
