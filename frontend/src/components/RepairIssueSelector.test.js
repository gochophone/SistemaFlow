import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import RepairIssueSelector from './RepairIssueSelector';

jest.mock('axios');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));
jest.mock('@/components/ui/popover', () => {
  const React = require('react');
  const Context = React.createContext(null);
  return {
    Popover: ({ open, onOpenChange, children }) => (
      <Context.Provider value={{ open, onOpenChange }}>{children}</Context.Provider>
    ),
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
let container;
let root;

const Harness = () => {
  const [value, setValue] = useState('');
  return <>
    <RepairIssueSelector value={value} onChange={setValue} />
    <output data-testid="selected-issue">{value}</output>
  </>;
};

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = jest.fn();
});

beforeEach(() => {
  const selections = {};
  const commonOptions = ['No enciende', 'Corto', 'Cámara', 'Pantalla', 'Micrófono', 'Audio', 'Face ID', 'Señal', 'Batería', 'Flex carga'];
  axios.get.mockResolvedValue({ data: {
    options: commonOptions,
    frequent: [],
  } });
  axios.post.mockImplementation((_, { name }) => {
    selections[name] = (selections[name] || 0) + 1;
    return Promise.resolve({ data: {
      options: [...commonOptions, ...Object.keys(selections).filter((issue) => !commonOptions.includes(issue))],
      frequent: Object.entries(selections).map(([selectedName, count]) => ({ name: selectedName, count })),
    } });
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

const renderSelector = async () => {
  await act(async () => root.render(<Harness />));
};

const openOptions = async () => {
  await act(async () => {
    container.querySelector('[data-testid="reported-issue-select"]').click();
  });
};

const chooseOption = async (label) => {
  await openOptions();
  const option = Array.from(document.querySelectorAll('[role="option"], [data-testid="issue-other-option"]'))
    .find((item) => item.textContent.includes(label));
  expect(option).toBeDefined();
  await act(async () => option.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const searchFor = async (text) => {
  const input = document.querySelector('[data-testid="reported-issue-search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

test('starts without quick picks and adds them as failures are selected', async () => {
  await renderSelector();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/issues'), {
    headers: { Authorization: 'Bearer test' },
  });
  expect(container.querySelector('[data-testid="frequent-issues"]')).toBeNull();
  await chooseOption('Pantalla');
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Pantalla');
  expect(container.querySelector('[data-testid="frequent-issues"]').textContent).toContain('Pantalla');
  await chooseOption('Cámara');
  expect(container.querySelector('[data-testid="frequent-issues"]').textContent).toContain('Pantalla');
  expect(container.querySelector('[data-testid="frequent-issues"]').textContent).toContain('Cámara');
  expect(container.querySelector('[data-testid="frequent-issues"]').textContent).not.toContain('(1)');
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/issues'),
    { name: 'Pantalla' }, { headers: { Authorization: 'Bearer test' } });
});

test('manual failure is saved in the list after leaving the input', async () => {
  await renderSelector();
  await chooseOption('Escribir otra falla');
  const input = container.querySelector('[data-testid="reported-issue-input"]');
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Conector USB');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Conector USB');
  await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/issues'),
    { name: 'Conector USB' }, { headers: { Authorization: 'Bearer test' } });
  expect(container.querySelector('[data-testid="frequent-issue-Conector USB"]')).not.toBeNull();
  await openOptions();
  const labels = Array.from(document.querySelectorAll('[role="option"]'))
    .map((option) => option.textContent.trim());
  expect(labels.slice(-2)).toEqual(['Flex carga', 'Conector USB']);
  expect(document.querySelector('[data-testid="issue-other-option"]').textContent).toContain('Escribir otra falla');
  expect(document.body.textContent).not.toContain('Fallas agregadas');
  const savedOption = Array.from(document.querySelectorAll('[role="option"]'))
    .find((option) => option.textContent.includes('Conector USB'));
  await act(async () => savedOption.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(container.querySelector('[data-testid="reported-issue-input"]')).toBeNull();
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Conector USB');
});

test('previously written failures appear in the list on a later visit', async () => {
  axios.get.mockResolvedValueOnce({ data: {
    options: ['No enciende', 'Puerto USB'],
    frequent: [{ name: 'Puerto USB', count: 2 }],
  } });
  await renderSelector();
  await chooseOption('Puerto USB');
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Puerto USB');
  expect(container.querySelector('[data-testid="reported-issue-input"]')).toBeNull();
});

test('search ignores accents and lets an unmatched name start a manual failure', async () => {
  await renderSelector();
  await openOptions();
  await searchFor('camara');
  expect(Array.from(document.querySelectorAll('[role="option"]')).map((option) => option.textContent.trim()))
    .toEqual(['Cámara']);
  await act(async () => document.querySelector('[data-testid="issue-option-Cámara"]').click());
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Cámara');

  await openOptions();
  await searchFor('Puerto de carga');
  expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
  expect(document.body.textContent).toContain('No hay fallas con ese nombre.');
  await act(async () => document.querySelector('[data-testid="issue-other-option"]').click());
  expect(container.querySelector('[data-testid="reported-issue-input"]').value).toBe('Puerto de carga');
});
