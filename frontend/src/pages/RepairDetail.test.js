import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import RepairDetail from './RepairDetail';

jest.mock('axios');
jest.mock('@radix-ui/primitive/is-development', () => ({ isDevelopment: false }), { virtual: true });
jest.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'repair-1' }), useNavigate: () => jest.fn(),
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
