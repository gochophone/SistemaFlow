import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import RepairDetail from './RepairDetail';

const mockNavigate = jest.fn();
jest.mock('axios');
jest.mock('@/utils/nativePdf', () => ({
  isNativeApp: () => false,
  cacheNativePdf: jest.fn(),
  openNativePdf: jest.fn(),
  shareNativePdf: jest.fn(),
}));
jest.mock('@radix-ui/primitive/is-development', () => ({ isDevelopment: false }), { virtual: true });
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'repair-1' }), useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' }, getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));
jest.mock('@/components/PatternLock', () => () => null);
jest.mock('@/components/DevicePhotos', () => () => null);

let container;
let root;

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation((url) => {
    if (url.endsWith('/api/repairs/repair-1/delivery-pdf')) {
      return Promise.resolve({ data: new Blob(['%PDF-test']) });
    }
    return Promise.resolve({ data: {
      id: 'repair-1', ticket_number: 'REP-00001', status: 'delivered',
      customer_id: 'customer-1', customer_name: 'Ana', device_brand: 'Apple',
      device_model: 'iPhone 13', device_imei: '123456789012345', device_photos: [],
      reported_issue: 'Pantalla rota',
    } });
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('confirmar o cancelar el pago funciona dentro de la orden en ambos sentidos', async () => {
  const repair = {
    id: 'repair-1', ticket_number: 'REP-00001', status: 'delivered', paid: false,
    customer_id: 'customer-1', customer_name: 'Ana', device_brand: 'Apple',
    device_model: 'iPhone 13', device_photos: [], reported_issue: 'Pantalla rota',
  };
  axios.get.mockResolvedValue({ data: repair });
  axios.patch.mockImplementation((url, changes) => Promise.resolve({ data: { ...repair, ...changes } }));
  await act(async () => root.render(<RepairDetail />));

  await act(async () => document.querySelector('[data-testid="paid-switch"]').click());
  expect(document.querySelector('[data-testid="payment-confirmation-dialog"]').textContent).toContain('REP-00001');
  expect(axios.patch).not.toHaveBeenCalled();
  await act(async () => document.querySelector('[data-testid="cancel-payment-change"]').click());
  expect(axios.patch).not.toHaveBeenCalled();

  await act(async () => document.querySelector('[data-testid="paid-switch"]').click());
  await act(async () => document.querySelector('[data-testid="confirm-payment-change"]').click());
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/repair-1'),
    { paid: true }, expect.any(Object));
  expect(document.querySelector('[data-testid="paid-switch"]').getAttribute('data-state')).toBe('checked');

  axios.patch.mockImplementation((url, changes) => Promise.resolve({ data: { ...repair, paid: true, ...changes } }));
  await act(async () => document.querySelector('[data-testid="paid-switch"]').click());
  expect(document.querySelector('[data-testid="payment-confirmation-dialog"]').textContent).toContain('se quitará la fecha de pago');
  expect(axios.patch).toHaveBeenCalledTimes(1);
  await act(async () => document.querySelector('[data-testid="confirm-payment-change"]').click());
  expect(axios.patch).toHaveBeenLastCalledWith(expect.stringContaining('/api/repairs/repair-1'),
    { paid: false }, expect.any(Object));
  expect(document.querySelector('[data-testid="paid-switch"]').getAttribute('data-state')).toBe('unchecked');
});

test('al seleccionar el cliente abre su ficha con el historial de equipos', async () => {
  await act(async () => root.render(<RepairDetail />));
  await act(async () => document.querySelector('[data-testid="repair-customer-profile-link"]').click());
  expect(mockNavigate).toHaveBeenCalledWith('/customers/customer-1');
});

test('permite copiar y preparar el seguimiento por WhatsApp antes de entregar la orden', async () => {
  const repair = {
    id: 'repair-1', ticket_number: 'REP-00001', status: 'received', public_token: 'token-abc',
    customer_id: 'customer-1', customer_name: 'Ana', device_brand: 'Apple',
    device_model: 'iPhone 13', device_photos: [], reported_issue: 'Pantalla rota',
  };
  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.includes('/api/customers/customer-1')
      ? { name: 'Ana', phone: '9 4788 2225' }
      : repair,
  }));
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const open = jest.spyOn(window, 'open').mockImplementation(() => ({}));
  try {
    await act(async () => root.render(<RepairDetail />));
    const link = `${window.location.origin}/public/token-abc`;
    expect(document.querySelector('[data-testid="repair-tracking-actions"]').textContent).toContain(link);

    await act(async () => document.querySelector('[data-testid="copy-tracking-link-button"]').click());
    expect(writeText).toHaveBeenCalledWith(link);

    await act(async () => document.querySelector('[data-testid="share-tracking-link-button"]').click());
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/customers/customer-1'), {
      headers: { Authorization: 'Bearer test' },
    });
    const [whatsappUrl] = open.mock.calls[0];
    expect(whatsappUrl).toMatch(/^https:\/\/wa\.me\/56947882225\?text=/);
    expect(decodeURIComponent(new URL(whatsappUrl).searchParams.get('text'))).toContain(link);
    expect(decodeURIComponent(new URL(whatsappUrl).searchParams.get('text'))).toContain('REP-00001');
    expect(axios.get.mock.calls.some(([url]) => url.endsWith('/delivery-pdf'))).toBe(false);
  } finally {
    open.mockRestore();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete navigator.clipboard;
  }
});

test('no habilita compartir una orden sin enlace público', async () => {
  await act(async () => root.render(<RepairDetail />));
  expect(document.querySelector('[data-testid="copy-tracking-link-button"]').disabled).toBe(true);
  expect(document.querySelector('[data-testid="share-tracking-link-button"]').disabled).toBe(true);
});

test('shows the repair delivery PDF in place before saving or printing', async () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  window.URL.createObjectURL = jest.fn(() => 'blob:repair-delivery');
  window.URL.revokeObjectURL = jest.fn();
  let filename;
  const download = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { filename = this.download; });
  const newWindow = jest.spyOn(window, 'open').mockImplementation(() => null);
  try {
    await act(async () => root.render(<RepairDetail />));
    const openButton = document.querySelector('[data-testid="print-delivery-button"]');
    expect(openButton.textContent).toContain('Ver PDF de entrega');
    await act(async () => openButton.click());

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/repair-1/delivery-pdf'), {
      headers: { Authorization: 'Bearer test' }, responseType: 'blob',
    });
    const frame = document.querySelector('[data-testid="delivery-pdf-preview"]');
    expect(frame?.getAttribute('src')).toBe('blob:repair-delivery');
    expect(newWindow).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();

    const print = jest.fn();
    const focus = jest.fn();
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: { print, focus } });
    await act(async () => document.querySelector('[data-testid="delivery-pdf-print-button"]').click());
    expect(print).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);

    await act(async () => document.querySelector('[data-testid="delivery-pdf-save-button"]').click());
    expect(download).toHaveBeenCalledTimes(1);
    expect(filename).toBe('orden_entrega_REP-00001.pdf');

    await act(async () => document.querySelector('[data-testid="delivery-pdf-back-button"]').click());
    expect(document.querySelector('[data-testid="delivery-pdf-preview"]')).toBeNull();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:repair-delivery');
    expect(document.querySelector('[data-testid="share-delivery-button"]')).not.toBeNull();
  } finally {
    download.mockRestore();
    newWindow.mockRestore();
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('adds a private note to a saved order and can include it in the PDF', async () => {
  const repair = {
    id: 'repair-1', ticket_number: 'REP-00001', status: 'delivered',
    customer_id: 'customer-1', customer_name: 'Ana', device_brand: 'Apple',
    device_model: 'iPhone 13', device_photos: [], reported_issue: 'Pantalla rota',
    note_entries: [],
  };
  axios.get.mockResolvedValue({ data: repair });
  axios.post.mockResolvedValue({ data: {
    ...repair, note_entries: [{ id: 'note-1', text: 'Revisar batería', is_private: true, created_by: 'Técnica', created_at: '2026-09-12T12:00:00Z' }],
  } });
  axios.patch.mockResolvedValue({ data: {
    ...repair, note_entries: [{ id: 'note-1', text: 'Revisar batería', is_private: false, created_by: 'Técnica', created_at: '2026-09-12T12:00:00Z' }],
  } });

  await act(async () => root.render(<RepairDetail />));
  const input = document.querySelector('[data-testid="new-repair-note"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Revisar batería');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => document.querySelector('[data-testid="save-repair-note"]').click());

  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/repair-1/notes'), {
    text: 'Revisar batería', is_private: true,
  }, { headers: { Authorization: 'Bearer test' } });
  expect(document.querySelector('[data-testid="repair-note"]').textContent).toContain('Privada · no sale en PDF');

  await act(async () => document.querySelector('[data-testid="toggle-note-note-1"]').click());
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/repair-1/notes/note-1'), {
    is_private: false,
  }, { headers: { Authorization: 'Bearer test' } });
  expect(document.querySelector('[data-testid="repair-note"]').textContent).toContain('Visible en PDF');
});
