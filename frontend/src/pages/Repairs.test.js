import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Repairs from './Repairs';

const mockNavigate = jest.fn();
let mockSearchQuery = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearchQuery)],
}), { virtual: true });
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer test-token' }) }),
}));
jest.mock('axios');
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/components/ui/select', () => {
  const actual = jest.requireActual('@/components/ui/select');
  const React = require('react');
  return {
    ...actual,
    // jsdom has no layout engine; retain the real portal and selection behavior.
    SelectContent: React.forwardRef((props, ref) => (
      <actual.SelectContent {...props} ref={ref} position="item-aligned" />
    )),
  };
});

const repair = {
  id: 'repair-1', ticket_number: 'REP-TEST', customer_name: 'Cliente de prueba',
  device_brand: 'Apple', device_model: 'iPhone X', device_imei: '',
  status: 'received', received_date: '2026-10-01T12:00:00Z', paid: false,
};
let container;
let root;

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchQuery = '';
  axios.get.mockResolvedValue({ data: [repair] });
  axios.patch.mockImplementation((url, changes) => Promise.resolve({ data: { ...repair, ...changes } }));
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.confirm.mockRestore();
});

const renderRepairs = async () => {
  await act(async () => root.render(<Repairs />));
};
const trigger = () => container.querySelector('[data-testid="quick-status-REP-TEST"]');
const openStatusMenu = async () => {
  await act(async () => {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  });
};
const chooseStatus = async (label) => {
  await openStatusMenu();
  const option = Array.from(document.querySelectorAll('[role="option"]'))
    .find((item) => item.textContent.includes(label));
  expect(option).toBeDefined();
  // Use the real portalled Radix menu, including its selection and bubbling.
  await act(async () => option.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

test('choosing a state in the portalled menu saves it without opening the order', async () => {
  await renderRepairs();
  await chooseStatus('Diagnóstico');
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/repair-1'),
    { status: 'diagnosis' }, { headers: { Authorization: 'Bearer test-token' } });
  expect(trigger().textContent).toContain('Diagnóstico');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('shows only one customer’s repair history from the customer wrench action', async () => {
  mockSearchQuery = 'customer_id=c2';
  axios.get.mockImplementation((url) => url.endsWith('/api/customers/c2')
    ? Promise.resolve({ data: { id: 'c2', name: 'Ana Rojas' } })
    : Promise.resolve({ data: [{ ...repair, customer_id: 'c2', customer_name: 'Ana Rojas' }] }));
  await renderRepairs();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/repairs'), {
    headers: { Authorization: 'Bearer test-token' }, params: { customer_id: 'c2' },
  });
  expect(document.querySelector('[data-testid="customer-repairs-banner"]').textContent).toContain('Ana Rojas');
  expect(document.querySelector('[data-testid="repair-row-REP-TEST"]')).not.toBeNull();
  await act(async () => document.querySelector('[data-testid="repair-row-REP-TEST"]').click());
  expect(mockNavigate).toHaveBeenCalledWith('/repairs/repair-1');
});

test('shows an empty history and a way back to all repairs', async () => {
  mockSearchQuery = 'customer_id=c2';
  axios.get.mockImplementation((url) => url.endsWith('/api/customers/c2')
    ? Promise.resolve({ data: { id: 'c2', name: 'Ana Rojas' } })
    : Promise.resolve({ data: [] }));
  await renderRepairs();
  expect(document.body.textContent).toContain('Este cliente aún no tiene reparaciones registradas');
  const allButton = Array.from(document.querySelectorAll('button'))
    .find((button) => button.textContent.includes('Ver todas las reparaciones'));
  await act(async () => allButton.click());
  expect(mockNavigate).toHaveBeenCalledWith('/repairs');
});

test('a failed update restores the previous status and stays in the list', async () => {
  axios.patch.mockRejectedValue({ response: { data: { detail: 'No se pudo guardar' } } });
  await renderRepairs();
  await chooseStatus('Diagnóstico');
  expect(trigger().textContent).toContain('Recibido');
  expect(toast.error).toHaveBeenCalledWith('No se pudo guardar');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each(['Entregado', 'Sin reparación'])('cancelling %s leaves the order unchanged in the list', async (label) => {
  window.confirm.mockReturnValue(false);
  await renderRepairs();
  await chooseStatus(label);
  expect(window.confirm).toHaveBeenCalled();
  expect(axios.patch).not.toHaveBeenCalled();
  expect(trigger().textContent).toContain('Recibido');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each([['Entregado', 'delivered'], ['Sin reparación', 'not_repaired']])(
  'confirming %s saves and locks the status in the list', async (label, status) => {
    await renderRepairs();
    await chooseStatus(label);
    expect(axios.patch).toHaveBeenCalledWith(expect.any(String), { status }, expect.any(Object));
    expect(trigger().textContent).toContain(label);
    expect(trigger().disabled).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);

test('clicking the status cell does not open the order, but View still does', async () => {
  await renderRepairs();
  await act(async () => trigger().closest('td').click());
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => container.querySelector('[data-testid="view-repair-REP-TEST"]').click());
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/repairs/repair-1');
});

test('Sin reparación is first and separated from the remaining states, with Entregado last', async () => {
  await renderRepairs();
  await openStatusMenu();
  const options = Array.from(document.querySelectorAll('[role="option"]'));
  expect(options.map((option) => option.textContent)).toEqual([
    'Sin reparación', 'Recibido', 'Diagnóstico', 'En Reparación', 'Completado', 'Entregado',
  ]);
  expect(options[0].nextElementSibling.getAttribute('aria-hidden')).toBe('true');
  expect(options[0].nextElementSibling.nextElementSibling).toBe(options[1]);
});

test('keyboard selection saves in the list without navigation', async () => {
  await renderRepairs();
  await openStatusMenu();
  const option = Array.from(document.querySelectorAll('[role="option"]'))
    .find((item) => item.textContent === 'En Reparación');
  await act(async () => {
    option.focus();
    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  expect(trigger().textContent).toContain('En Reparación');
  expect(mockNavigate).not.toHaveBeenCalled();
});

const deliveredUnpaid = { ...repair, status: 'delivered' };
const paymentFixtures = [
  deliveredUnpaid,
  { ...repair, id: 'paid', ticket_number: 'REP-PAID', status: 'delivered', paid: true },
  { ...repair, id: 'active', ticket_number: 'REP-ACTIVE', status: 'in_repair' },
  { ...repair, id: 'unrepaired', ticket_number: 'REP-UNREPAIRED', status: 'not_repaired' },
  { ...repair, id: 'legacy', ticket_number: 'REP-LEGACY', status: 'delivered', paid: undefined, customer_name: 'Otro cliente' },
];
const unpaidButton = () => container.querySelector('[data-testid="filter-unpaid"]');
const visibleTickets = () => Array.from(container.querySelectorAll('[data-testid^="repair-row-"]'))
  .map((row) => row.firstElementChild.textContent);

test('the unpaid shortcut shows only delivered unpaid orders and handles missing paid flags', async () => {
  axios.get.mockResolvedValue({ data: paymentFixtures });
  await renderRepairs();
  expect(unpaidButton().textContent).toContain('Entregadas sin pagar (2)');
  await act(async () => unpaidButton().click());
  expect(visibleTickets()).toEqual(['REP-TEST', 'REP-LEGACY']);
  expect(unpaidButton().getAttribute('aria-pressed')).toBe('true');
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => container.querySelector('[data-testid="filter-all"]').click());
  expect(visibleTickets()).toHaveLength(paymentFixtures.length);
  expect(unpaidButton().getAttribute('aria-pressed')).toBe('false');
});

test('search and the unpaid shortcut both restrict results', async () => {
  mockSearchQuery = 'search=Cliente%20de%20prueba';
  axios.get.mockResolvedValue({ data: paymentFixtures });
  await renderRepairs();
  await act(async () => unpaidButton().click());
  expect(visibleTickets()).toEqual(['REP-TEST']);
});

test.each(['success', 'failure'])('marking a filtered order paid updates the list and handles %s', async (outcome) => {
  let resolvePayment;
  let rejectPayment;
  axios.get.mockResolvedValue({ data: [deliveredUnpaid] });
  axios.patch.mockReturnValue(new Promise((resolve, reject) => {
    resolvePayment = resolve;
    rejectPayment = reject;
  }));
  await renderRepairs();
  await act(async () => unpaidButton().click());
  await act(async () => container.querySelector('[data-testid="quick-payment-REP-TEST"]').click());
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/api/repairs/repair-1'),
    { paid: true }, expect.any(Object));
  expect(visibleTickets()).toEqual([]);
  expect(unpaidButton().textContent).toContain('(0)');
  await act(async () => {
    if (outcome === 'success') resolvePayment({ data: { ...deliveredUnpaid, paid: true } });
    else rejectPayment({ response: { data: { detail: 'No se pudo guardar el pago' } } });
  });
  expect(visibleTickets()).toEqual(outcome === 'success' ? [] : ['REP-TEST']);
  expect(unpaidButton().textContent).toContain(outcome === 'success' ? '(0)' : '(1)');
  if (outcome === 'success') expect(container.textContent).toContain('No hay órdenes entregadas pendientes de pago');
  else expect(toast.error).toHaveBeenCalledWith('No se pudo guardar el pago');
  expect(mockNavigate).not.toHaveBeenCalled();
});
