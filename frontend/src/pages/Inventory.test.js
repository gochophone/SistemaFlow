import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Inventory from './Inventory';

jest.mock('axios');
jest.mock('@radix-ui/primitive/is-development', () => ({ isDevelopment: false }), { virtual: true });
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));
jest.mock('@/components/DevicePhotos', () => () => null);
jest.mock('@/components/InventoryNameSelector', () => ({ value, onChange }) => (
  <input data-testid="item-name-input" value={value} onChange={(event) => onChange(event.target.value)} />
));

let container;
let root;

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: [{ id: 'item-1', code: 'INV-1', name: 'Pantalla',
    description: 'OLED', quantity: 1, purchase_price: 10000, price: 20000, available: true }] });
  axios.post.mockResolvedValue({ data: { id: 'item-2' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

const enter = async (input, value) => act(async () => {
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

test('muestra el total y los dos precios sin alerta de stock ni color de fila', async () => {
  await act(async () => root.render(<Inventory />));
  expect(container.textContent).toContain('1 artículo');
  expect(container.textContent).not.toContain('stock bajo');
  expect(container.textContent).not.toContain('Stock Bajo');
  expect(container.querySelector('[data-testid="inventory-row-INV-1"]').className).not.toContain('bg-orange');
  expect(container.querySelector('[data-testid="inventory-row-INV-1"]').textContent).toContain('OLED');
  expect(container.querySelector('[data-testid="inventory-row-INV-1"]').textContent).toContain('$10.000');
  expect(container.querySelector('[data-testid="inventory-row-INV-1"]').textContent).toContain('$20.000');
});

test('permite crear sin campos obligatorios y guarda precios y descripción cuando se indican', async () => {
  await act(async () => root.render(<Inventory />));
  await act(async () => container.querySelector('[data-testid="add-inventory-button"]').click());
  expect(document.querySelector('[data-testid="item-name-input"]').required).toBe(false);
  expect(document.querySelector('[data-testid="item-quantity-input"]').required).toBe(false);
  expect(document.querySelector('[data-testid="item-purchase-price-input"]').required).toBe(false);
  expect(document.querySelector('[data-testid="item-price-input"]').required).toBe(false);

  await act(async () => document.querySelector('#inventory-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/inventory'), expect.objectContaining({
    name: '', quantity: 0, purchase_price: null, price: null, description: null,
  }), expect.anything());

  await act(async () => document.querySelector('[data-testid="add-inventory-button"]').click());
  await enter(document.querySelector('[data-testid="item-name-input"]'), 'Flex de carga');
  await enter(document.querySelector('[data-testid="item-purchase-price-input"]'), '15000');
  await enter(document.querySelector('[data-testid="item-price-input"]'), '25000');
  await enter(document.querySelector('[data-testid="item-description-input"]'), 'Compatible con iPhone');
  await act(async () => document.querySelector('#inventory-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringContaining('/api/inventory'), expect.objectContaining({
    name: 'Flex de carga', purchase_price: 15000, price: 25000, description: 'Compatible con iPhone',
  }), expect.anything());
});
