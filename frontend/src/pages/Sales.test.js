import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Sales from './Sales';

jest.mock('axios');
jest.mock('@radix-ui/primitive/is-development', () => ({ isDevelopment: false }), { virtual: true });
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }) }));
jest.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(), jest.fn()] }), { virtual: true });
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/DevicePhotos', () => ({ onPhotoClick }) => <div data-testid="photos">
  <button type="button" onClick={() => onPhotoClick?.('https://example.com/new.jpg')}>Vista previa de foto</button>
</div>);

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
    if (url.endsWith('/api/customers')) return Promise.resolve({ data: [
      { id: 'c1', name: 'Ana', phone: '123' },
      { id: 'c2', name: 'Bruno', phone: '456' },
    ] });
    if (url.endsWith('/api/inventory')) return Promise.resolve({ data: [{ id: 'i1', name: 'MacBook Air', code: 'INV-1', price: 500000, quantity: 1, available: true, photos: [] }] });
    if (url.endsWith('/api/repairs')) return Promise.resolve({ data: [{ customer_id: 'c1' }] });
    return Promise.resolve({ data: [] });
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('registers an inventory sale linked to a customer', async () => {
  axios.post.mockResolvedValue({ data: {
    id: 'sale-1', sale_number: 'VEN-20261002-AAAABBBB', customer_id: 'c1', customer_name: 'Ana', item_name: 'MacBook Air',
    source: 'inventory', category: 'macbook', quantity: 1, unit_price: 500000,
    total_price: 500000, condition: 'used', sold_on: '2026-10-02', photos: [], sold_by_name: 'Admin',
  } });
  await act(async () => root.render(<Sales />));
  await act(async () => document.querySelector('[data-testid="new-sale-button"]').click());
  const form = document.querySelector('[data-testid="sale-form"]');
  expect(form).not.toBeNull();
  await act(async () => form.querySelector('[data-testid="sale-customer-select"]').click());
  const customer = Array.from(document.querySelectorAll('[cmdk-item]')).find((item) => item.textContent.includes('Ana'));
  await act(async () => customer.click());
  await act(async () => {
    const source = form.querySelector('#sale-source');
    source.value = 'inventory';
    source.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const item = Array.from(form.querySelectorAll('button')).find((button) => button.textContent.includes('MacBook Air'));
  await act(async () => item.click());
  await act(async () => {
    form.querySelector('#sale-category').value = 'macbook';
    form.querySelector('#sale-category').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/sales'), expect.objectContaining({
    customer_id: 'c1', source: 'inventory', inventory_item_id: 'i1', category: 'macbook',
    quantity: 1, unit_price: 500000,
  }), expect.anything());
});

test('registers a manually named article with optional IMEI', async () => {
  axios.post.mockResolvedValue({ data: {
    id: 'sale-2', sale_number: 'VEN-20261002-CCCCDDDD', customer_id: 'c1', customer_name: 'Ana', item_name: 'Placa MacBook',
    source: 'manual', category: 'board', quantity: 1, unit_price: 80000,
    total_price: 80000, condition: 'for_parts', imei: '123', sold_on: '2026-10-02',
    photos: [], sold_by_name: 'Admin',
  } });
  await act(async () => root.render(<Sales />));
  await act(async () => document.querySelector('[data-testid="new-sale-button"]').click());
  const form = document.querySelector('[data-testid="sale-form"]');
  await act(async () => form.querySelector('[data-testid="sale-customer-select"]').click());
  const customer = Array.from(document.querySelectorAll('[cmdk-item]')).find((item) => item.textContent.includes('Ana'));
  await act(async () => customer.click());
  const fill = async (selector, value) => {
    await act(async () => {
      const input = form.querySelector(selector);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  await fill('#sale-name', 'Placa MacBook');
  await fill('#sale-price', '80000');
  await fill('#sale-imei', '123');
  await act(async () => {
    const category = form.querySelector('#sale-category');
    category.value = 'board';
    category.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/sales'), expect.objectContaining({
    source: 'manual', inventory_item_id: null, item_name: 'Placa MacBook', imei: '123',
    unit_price: 80000, category: 'board',
  }), expect.anything());
});

test('selects a frequent repair client with the same picker used in New Repair', async () => {
  await act(async () => root.render(<Sales />));
  await act(async () => document.querySelector('[data-testid="new-sale-button"]').click());
  const form = document.querySelector('[data-testid="sale-form"]');
  expect(document.querySelector('[cmdk-item]')).toBeNull();

  await act(async () => form.querySelector('[data-testid="sale-customer-select"]').click());
  expect(document.body.textContent).toContain('Clientes frecuentes');
  expect(document.querySelector('[cmdk-list]').textContent).toContain('Ana');
  expect(document.querySelector('[cmdk-list]').textContent).not.toContain('Bruno');

  const search = document.querySelector('[data-testid="sale-customer-search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(search, 'Bruno');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(document.querySelector('[cmdk-list]').textContent).toContain('Bruno');
  expect(document.querySelector('[cmdk-list]').textContent).not.toContain('Ana');
  const customer = Array.from(document.querySelectorAll('[cmdk-item]')).find((item) => item.textContent.includes('Bruno'));
  await act(async () => customer.click());
  expect(document.querySelector('[cmdk-item]')).toBeNull();
  expect(form.querySelector('[data-testid="sale-customer-select"]').textContent).toContain('Bruno');
});

test('also treats a client with previous sales as frequent', async () => {
  axios.get.mockImplementation((url) => {
    if (url.endsWith('/api/customers')) return Promise.resolve({ data: [
      { id: 'c1', name: 'Ana', phone: '123' }, { id: 'c2', name: 'Bruno', phone: '456' },
    ] });
    if (url.endsWith('/api/repairs')) return Promise.resolve({ data: [] });
    if (url.endsWith('/api/inventory')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [{ id: 'sale-1', customer_id: 'c2', customer_name: 'Bruno',
      item_name: 'iPhone', category: 'phone', source: 'manual', quantity: 1, total_price: 100000,
      sold_on: '2026-10-02', photos: [] }] });
  });
  await act(async () => root.render(<Sales />));
  await act(async () => document.querySelector('[data-testid="new-sale-button"]').click());
  const form = document.querySelector('[data-testid="sale-form"]');
  await act(async () => form.querySelector('[data-testid="sale-customer-select"]').click());
  expect(document.querySelector('[cmdk-list]').textContent).toContain('Bruno');
  expect(document.querySelector('[cmdk-list]').textContent).not.toContain('Ana');
});

test('opens a sold article photo in an in-page preview', async () => {
  const photo = 'https://example.com/article.jpg';
  axios.get.mockImplementation((url) => {
    if (url.endsWith('/api/customers') || url.endsWith('/api/inventory') || url.endsWith('/api/repairs')) {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: [{
      id: 'sale-1', sale_number: 'VEN-1', customer_id: 'c1', customer_name: 'Ana',
      item_name: 'MacBook Air', source: 'manual', category: 'macbook', condition: 'used',
      quantity: 1, unit_price: 500000, total_price: 500000, sold_on: '2026-10-02',
      photos: [photo],
    }] });
  });
  await act(async () => root.render(<Sales />));
  await act(async () => document.querySelector('[data-testid="sale-sale-1"] button').click());
  await act(async () => document.querySelector('[aria-label="Ampliar foto 1 de MacBook Air"]').click());
  expect(document.querySelector('img[alt="Foto ampliada del artículo"]')?.getAttribute('src')).toBe(photo);
  expect(document.querySelector('a[target="_blank"]')).toBeNull();
});

test('opens a newly uploaded article photo without leaving the sale form', async () => {
  await act(async () => root.render(<Sales />));
  await act(async () => document.querySelector('[data-testid="new-sale-button"]').click());
  await act(async () => document.querySelector('[data-testid="photos"] button').click());
  expect(document.querySelector('img[alt="Foto ampliada del artículo"]')?.getAttribute('src'))
    .toBe('https://example.com/new.jpg');
  expect(document.querySelector('[data-testid="sale-form"]')).not.toBeNull();
});
