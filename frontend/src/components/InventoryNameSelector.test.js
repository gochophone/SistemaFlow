import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import InventoryNameSelector from './InventoryNameSelector';

jest.mock('axios');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));
jest.mock('@/components/ui/popover', () => {
  const React = require('react');
  const Context = React.createContext(null);
  return {
    Popover: ({ open, onOpenChange, children }) => <Context.Provider value={{ open, onOpenChange }}>{children}</Context.Provider>,
    PopoverTrigger: ({ children }) => {
      const { open, onOpenChange } = React.useContext(Context);
      return React.cloneElement(children, { onClick: () => onOpenChange(!open) });
    },
    PopoverContent: ({ children }) => {
      const { open } = React.useContext(Context);
      return open ? <div>{children}</div> : null;
    },
  };
});

const Harness = () => {
  const [name, setName] = useState('');
  return <><InventoryNameSelector value={name} onChange={setName} existingNames={['Cargador']} />
    <output data-testid="selected-name">{name}</output></>;
};

let container;
let root;
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { names: ['Conector USB'] } });
  axios.post.mockResolvedValue({ data: { name: 'Flex encendido' } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

const openList = async () => act(async () => container.querySelector('[data-testid="item-name-select"]').click());
const typeInto = async (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

test('muestra artículos comunes, existentes y guardados y permite seleccionar uno', async () => {
  await act(async () => root.render(<Harness />));
  await openList();
  expect(Array.from(container.querySelectorAll('[role="option"]')).map((element) => element.textContent.trim()))
    .toEqual(['Pantalla', 'Batería', 'Flex de carga', 'Placa base', 'Cámara',
      'Altavoz', 'Micrófono', 'Tapa trasera', 'Cargador', 'Cable', 'Conector USB']);
  await act(async () => container.querySelector('[data-testid="item-name-option-Batería"]').click());
  expect(container.querySelector('[data-testid="selected-name"]').textContent).toBe('Batería');
});

test('añade un nombre escrito a la lista privada del negocio', async () => {
  await act(async () => root.render(<Harness />));
  await openList();
  await typeInto(container.querySelector('[data-testid="item-name-search"]'), 'Flex encendido');
  await act(async () => container.querySelector('[data-testid="item-name-other-option"]').click());
  expect(container.querySelector('[data-testid="selected-name"]').textContent).toBe('Flex encendido');
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/inventory/names'),
    { name: 'Flex encendido' }, { headers: { Authorization: 'Bearer test' } });
  await openList();
  expect(container.querySelector('[data-testid="item-name-option-Flex encendido"]')).not.toBeNull();
});

test('permite escribir otro artículo al final de la lista y lo guarda al salir', async () => {
  await act(async () => root.render(<Harness />));
  await openList();
  await act(async () => container.querySelector('[data-testid="item-name-other-option"]').click());
  const input = container.querySelector('[data-testid="item-name-input"]');
  expect(input).not.toBeNull();
  await typeInto(input, 'Sensor de proximidad');
  await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/inventory/names'),
    { name: 'Sensor de proximidad' }, expect.anything());
  await openList();
  expect(container.querySelector('[data-testid="item-name-option-Sensor de proximidad"]')).not.toBeNull();
});
