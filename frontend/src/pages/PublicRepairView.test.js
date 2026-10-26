import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import PublicRepairView from './PublicRepairView';

jest.mock('axios');
jest.mock('react-router-dom', () => ({
  useParams: () => ({ ticketNumber: 'token-de-prueba' }),
}), { virtual: true });

test('muestra el nombre registrado de la empresa en el seguimiento público', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockResolvedValue({ data: {
    company_name: 'Servicios GP SpA',
    ticket_number: 'REP-00001',
    customer_name: 'Cliente de prueba',
    device_brand: 'Apple',
    device_model: 'iPhone',
    reported_issue: 'Pantalla',
    status: 'received',
    received_date: '2026-10-25T12:00:00',
  } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PublicRepairView />));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/public/repair/token-de-prueba'));
    expect(container.textContent).toContain('Para más información, contacta directamente con Servicios GP SpA');
    expect(container.textContent).not.toContain('ServiceTech');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
