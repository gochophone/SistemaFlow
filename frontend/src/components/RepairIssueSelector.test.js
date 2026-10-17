import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import RepairIssueSelector from './RepairIssueSelector';

jest.mock('axios');
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test' }) }),
}));
jest.mock('@/components/ui/select', () => {
  const actual = jest.requireActual('@/components/ui/select');
  const React = require('react');
  return {
    ...actual,
    SelectContent: React.forwardRef((props, ref) => (
      <actual.SelectContent {...props} ref={ref} position="item-aligned" />
    )),
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
  axios.get.mockResolvedValue({ data: {
    options: ['No enciende', 'Corto', 'Cámara', 'Pantalla', 'Micrófono', 'Audio', 'Face ID', 'Señal', 'Batería', 'Flex carga', 'Puerto USB'],
    frequent: [{ name: 'Puerto USB', count: 7 }, { name: 'Pantalla', count: 5 }],
  } });
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

const chooseOption = async (label) => {
  await act(async () => {
    container.querySelector('[data-testid="reported-issue-select"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  });
  const option = Array.from(document.querySelectorAll('[role="option"]'))
    .find((item) => item.textContent.includes(label));
  expect(option).toBeDefined();
  await act(async () => option.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

test('shows saved failures and selects a frequent one with one click', async () => {
  await renderSelector();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/issues'), {
    headers: { Authorization: 'Bearer test' },
  });
  expect(container.querySelector('[data-testid="frequent-issues"]').textContent).toContain('Puerto USB (7)');
  await act(async () => container.querySelector('[data-testid="frequent-issue-Puerto USB"]').click());
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Puerto USB');
  await chooseOption('Pantalla');
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Pantalla');
});

test('allows a manual issue and the quick pick replaces it', async () => {
  await renderSelector();
  await chooseOption('Especificar otra falla');
  const input = container.querySelector('[data-testid="reported-issue-input"]');
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Conector USB');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Conector USB');
  await act(async () => container.querySelector('[data-testid="frequent-issue-Puerto USB"]').click());
  expect(container.querySelector('[data-testid="selected-issue"]').textContent).toBe('Puerto USB');
  expect(container.querySelector('[data-testid="reported-issue-input"]')).toBeNull();
});
